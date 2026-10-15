import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  analyzeProject,
  type AnalyzeProjectInput,
  type ReadFailure,
} from "../analysis/analyze";
import {
  DEFAULT_IGNORED_DIRS,
  buildFileModels,
  groupFiles,
  readableFiles,
} from "../analysis/scan";
import type { DocumentModel, ProjectModel } from "../analysis/types";
import {
  applyMove,
  deleteNode as deleteNodePure,
  duplicateNode as duplicateNodePure,
  insertElement,
  positionSelector,
  reorderNode,
  removeNodeAttribute as removeNodeAttributePure,
  setNodeAttribute as setNodeAttributePure,
  setNodeText as setNodeTextPure,
} from "../designer/edit";
import {
  ensurePositionRelative,
  readBox,
  readDeclaration,
  removeDeclaration,
  writeDeclaration,
} from "../designer/cssEdit";
import { designClassOf } from "../designer/class";
import { removeAttribute } from "../designer/attributes";
import { findById, serialize } from "../designer/tree";
import { canvasContainerId, canvasNodes as visualCanvasNodes } from "../designer/visual";
import { createIdFactory, createIdFactoryAfter } from "../designer/identity";

type IdFactory = { next: () => PrismaId };
import type { PrismaId, PrismaNode } from "../designer/types";
import { parseMarkup } from "../designer/parse";
import {
  linkedStylesheets,
  readInternalStyle,
  ensureStylesheetLink,
  ensureStyleNode,
} from "../designer/edit";
import { readProjectFile, scanProjectFiles } from "../services/projects";
import type { ProjectState } from "./useProject";
import { messageOf } from "./useProject";

export type DesignViewMode = "code" | "design";

export type CssTarget =
  | { kind: "external"; href: string }
  | { kind: "internal" };

export interface DesignerOptions {
  getCssText: (hrefOrNull: string | null) => Promise<string | null>;
  writeCssText: (hrefOrNull: string | null, text: string) => Promise<void>;
  resolveCssPath: (href: string) => string | null;
}

export interface DesignerState {
  viewMode: DesignViewMode;
  document: DocumentModel | null;
  roots: PrismaNode[];
  cssTarget: CssTarget | null;
  elementCssTarget: (nodeId: PrismaId) => CssTarget | null;
  cssText: string;
  selectedId: PrismaId | null;
  /** Nodo seleccionado, o `null`. */
  selectedNode: PrismaNode | null;
  /** Nodos dibujables de primer nivel (sin `head`, `meta`, `script`, ...). */
  canvasNodes: PrismaNode[];
  /** Dónde cae lo soltado en el fondo: el `<body>` o `null` en fragmentos. */
  containerId: PrismaId | null;
  isBusy: boolean;
  error: string | null;
  hasUnappliedChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  projectModel: ProjectModel | null;
  setViewMode: (mode: DesignViewMode) => void;
  setSelectedId: (id: PrismaId | null) => void;
  undo: () => void;
  redo: () => void;
  setCssTarget: (target: CssTarget | null) => void;
  insertTag: (tag: string, parentId: PrismaId | null, position?: { x: number; y: number }) => void;
  moveNode: (nodeId: PrismaId, parentId: PrismaId | null, x: number, y: number) => void;
  reorder: (nodeId: PrismaId, direction: "up" | "down") => void;
  /** Cambia de hoja y carga su contenido (externo o `<style>` interno). */
  selectCssTarget: (target: CssTarget) => boolean;
  useDefaultCssTarget: () => boolean;
  setElementCssTarget: (nodeId: PrismaId, target: CssTarget | null) => void;
  deleteNode: (nodeId: PrismaId) => void;
  duplicateNode: (nodeId: PrismaId) => void;
  updateText: (nodeId: PrismaId, text: string) => void;
  setNodeAttr: (nodeId: PrismaId, name: string, value: string) => void;
  removeNodeAttr: (nodeId: PrismaId, name: string) => void;
  setBooleanAttr: (nodeId: PrismaId, name: string, enabled: boolean) => void;
  setNodeStyle: (nodeId: PrismaId, property: string, value: string) => void;
  /** Valor CSS de una propiedad para el nodo, o `null` si no tiene. */
  nodeStyle: (nodeId: PrismaId, property: string) => string | null;
  /** Posición `left/top` del nodo, o `null` si está en flujo. */
  nodeBox: (nodeId: PrismaId) => { x: number; y: number } | null;
  ensureExternalCss: (href: string, nodeId?: PrismaId | null) => void;
  applyToBuffers: (workspace: {
    writeBuffer: (path: string, content: string) => void;
    saveBuffer: (path: string) => Promise<string | null>;
    ensureBuffer: (path: string) => Promise<string | null>;
  }) => Promise<boolean>;
  refresh: () => void;
}

function shallowCloneRoots(roots: PrismaNode[]): PrismaNode[] {
  return roots.map((r) => structuredClone(r));
}

export function useDesigner(
  projectState: ProjectState,
  options: DesignerOptions,
  workspace?: {
    activePath: string | null;
    writeBuffer: (path: string, content: string) => void;
    saveBuffer?: (path: string) => Promise<string | null>;
    buffers?: Record<string, any>;
    ensureBuffer?: (path: string) => Promise<string | null>;
  },
): DesignerState {
  const { project } = projectState;
  const rootPath = project?.path ?? null;
  const [viewMode, setViewMode] = useState<DesignViewMode>("code");
  const [roots, setRoots] = useState<PrismaNode[]>([]);
  const rootsRef = useRef(roots);
  // Los eventos de puntero pueden terminar con callbacks de un render anterior.
  // Mantener el árbol actual en una referencia evita aplicar el movimiento a
  // una copia vieja después de que otra acción actualizó el documento.
  rootsRef.current = roots;
  const [factory, setFactory] = useState<IdFactory>(() => createIdFactory());
  const [document, setDocument] = useState<DocumentModel | null>(null);
  const [cssTarget, setCssTarget] = useState<CssTarget | null>(null);
  const [elementCssTargets, setElementCssTargets] = useState<Record<PrismaId, CssTarget>>({});
  const [cssText, setCssText] = useState<string>("");
  const [selectedId, setSelectedId] = useState<PrismaId | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectModel, setProjectModel] = useState<ProjectModel | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [appliedSnapshot, setAppliedSnapshot] = useState("");
  const historyRef = useRef<{
    entries: Array<{ roots: PrismaNode[]; cssText: string; key: string }>;
    index: number;
    skipNext: boolean;
  }>({ entries: [], index: -1, skipNext: false });
  const loadRequestRef = useRef(0);

  // Los puentes `options`/`workspace` llegan como objetos nuevos en cada render.
  // Se guardan en referencias para que la recarga solo dependa del archivo
  // activo (primitiva estable): si dependiera de su identidad, cada selección
  // o edición re-renderizaría, re-leería el disco y borraría lo editado.
  const activePath = workspace?.activePath ?? null;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const activePathRef = useRef<string | null>(activePath);
  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  // El CSS vive también en una referencia: varias operaciones lo leen y lo
  // escriben encadenadas, y el valor del render puede ir una jugada por detrás.
  const cssTextRef = useRef(cssText);
  useEffect(() => {
    cssTextRef.current = cssText;
  }, [cssText]);

  const writeCssText = useCallback((next: string) => {
    cssTextRef.current = next;
    setCssText(next);
  }, []);

  useEffect(() => {
    if (historyRef.current.skipNext) {
      historyRef.current.skipNext = false;
      return;
    }
    const key = JSON.stringify(roots) + "\u0000" + cssText;
    const current = historyRef.current;
    if (current.entries[current.index]?.key === key) return;
    current.entries = current.entries.slice(0, current.index + 1);
    current.entries.push({ roots: structuredClone(roots), cssText, key });
    if (current.entries.length > 100) current.entries.shift();
    current.index = current.entries.length - 1;
  }, [roots, cssText]);

  const restoreHistory = useCallback((index: number) => {
    const history = historyRef.current;
    const entry = history.entries[index];
    if (entry === undefined) return;
    history.index = index;
    history.skipNext = true;
    setRoots(structuredClone(entry.roots));
    writeCssText(entry.cssText);
  }, [writeCssText]);

  const undo = useCallback(() => {
    if (historyRef.current.index > 0) restoreHistory(historyRef.current.index - 1);
  }, [restoreHistory]);

  const redo = useCallback(() => {
    if (historyRef.current.index < historyRef.current.entries.length - 1) {
      restoreHistory(historyRef.current.index + 1);
    }
  }, [restoreHistory]);

  const loadFromActive = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const ws = workspaceRef.current;
    const opts = optionsRef.current;
    const path = ws?.activePath ?? null;
    activePathRef.current = path;
    if (rootPath === null || path === null) {
      historyRef.current = { entries: [], index: -1, skipNext: false };
      setDocument(null);
      setRoots([]);
      setFactory(createIdFactory());
      setCssText("");
      setCssTarget(null);
      setElementCssTargets({});
      setAppliedSnapshot("");
      setIsBusy(false);
      return;
    }
    const isHtmlLike = /\.html?$|\.blade\.php$/i.test(path);
    if (!isHtmlLike) {
      historyRef.current = { entries: [], index: -1, skipNext: false };
      setDocument(null);
      setRoots([]);
      setCssText("");
      setCssTarget(null);
      setElementCssTargets({});
      setAppliedSnapshot("");
      setIsBusy(false);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      let content = "";
      try {
        const buf = ws?.buffers?.[path];
        if (buf?.content !== undefined) {
          content = buf.content;
        }
      } catch {}
      if (ws?.buffers?.[path] === undefined) {
        const read = await readProjectFile(path, rootPath);
        content = read.content;
      }
      const doc = parseMarkup(content, path);
      let savedTargets: Record<PrismaId, CssTarget> = {};
      try {
        const stored = localStorage.getItem(`prisma-element-css-targets:${path}`);
        const parsed = stored === null ? {} : JSON.parse(stored) as Record<string, unknown>;
        for (const [id, value] of Object.entries(parsed)) {
          if (findById(doc.roots, id) === null || value === null || typeof value !== "object") continue;
          const candidate = value as Partial<CssTarget>;
          if (candidate.kind === "internal") savedTargets[id] = { kind: "internal" };
          else if (candidate.kind === "external" && typeof candidate.href === "string") {
            savedTargets[id] = { kind: "external", href: candidate.href };
          }
        }
      } catch {}
      let nextCssTarget: CssTarget | null = null;
      let nextCssText = "";
      const links = linkedStylesheets(doc.roots);
      if (links.length > 0 && links[0]) {
        nextCssTarget = { kind: "external", href: links[0] };
        nextCssText = (await opts.getCssText(links[0])) ?? "";
      } else {
        const internal = readInternalStyle(doc.roots);
        if (internal !== null) {
          nextCssTarget = { kind: "internal" };
          nextCssText = internal;
        }
      }
      // Una lectura lenta de la pestaña anterior no puede reemplazar el diseño
      // de la pestaña que el usuario abrió mientras tanto.
      if (requestId !== loadRequestRef.current || activePathRef.current !== path) return;
      historyRef.current = { entries: [], index: -1, skipNext: false };
      setDocument({
        id: path,
        filePath: path,
        relativePath: path.replace(rootPath, "").replace(/^[\\/]+/, "").replace(/\\\\/g, "/"),
        type: path.endsWith(".blade.php") ? "blade" : "html",
        title: null,
        root: doc.roots,
        linkedStylesheets: [],
        linkedScripts: [],
        inlineStylesheets: 0,
        elementCount: doc.roots.length,
        inlineStyleCount: 0,
        warnings: [],
        elementWarnings: {},
      } as unknown as DocumentModel);
      setRoots(doc.roots);
      setElementCssTargets(savedTargets);
      setSelectedId(null);
      // Los IDs del documento cargado ya ocupan los primeros números. Si la
      // fábrica empieza otra vez en 1, los elementos nuevos comparten ID con
      // nodos existentes y cualquier movimiento acaba apuntando al nodo viejo.
      setFactory(createIdFactoryAfter(doc.roots));
      setCssTarget(nextCssTarget);
      writeCssText(nextCssText);
      setAppliedSnapshot(`${serialize(doc.roots)}\u0000${nextCssText}`);
    } catch (e) {
      if (requestId === loadRequestRef.current && activePathRef.current === path) {
        setError(messageOf(e, "No se pudo cargar el documento para diseño"));
      }
    } finally {
      if (requestId === loadRequestRef.current) setIsBusy(false);
    }
  }, [rootPath, activePath, writeCssText]);

  // Solo se recarga al cambiar de proyecto/archivo o al pedirlo (`refresh`).
  // Recargar en cada render borraría las ediciones aún no aplicadas.
  useEffect(() => {
    void loadFromActive();
  }, [loadFromActive, attempt]);

  useEffect(() => {
    if (rootPath === null) {
      setProjectModel(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const scan = await scanProjectFiles(rootPath, DEFAULT_IGNORED_DIRS);
        if (cancelled) return;
        const files = buildFileModels(scan.files);
        const contents: Record<string, string> = {};
        const readFailures: ReadFailure[] = [];
        for (const file of readableFiles(groupFiles(files))) {
          try {
            const read = await readProjectFile(file.path, rootPath);
            if (cancelled) return;
            contents[file.path] = read.content;
          } catch (cause) {
            readFailures.push({
              path: file.path,
              relativePath: file.relativePath,
              message: messageOf(cause, "no se pudo leer"),
            });
          }
        }
        if (cancelled) return;
        const input: AnalyzeProjectInput = {
          rootPath,
          name: project?.name ?? "",
          files,
          contents,
          readFailures,
          scanWarnings: scan.warnings,
          truncated: scan.truncated,
        };
        setProjectModel(analyzeProject(input));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [rootPath, project?.name, attempt]);

  const insertTag = useCallback(
    (tag: string, parentId: PrismaId | null, position?: { x: number; y: number }) => {
      setError(null);
      const next = shallowCloneRoots(roots);
      const res = insertElement(next, factory, tag, parentId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      // Regla base propia desde el primer momento (`.div-1 { position: relative; }`):
      // el elemento ya es contexto de posicionamiento para sus futuros hijos.
      const selector = positionSelector(next, res.value);
      let nextCss = cssTextRef.current;
      if (selector !== null) {
        nextCss = ensurePositionRelative(nextCss, selector);
      }
      if (position !== undefined) {
        const moved = applyMove(next, nextCss, {
          nodeId: res.value.id,
          parentId,
          box: position,
        });
        if (!moved.ok) {
          setError(moved.message);
          return;
        }
        nextCss = moved.value.cssText;
      }
      if (nextCss !== cssTextRef.current) writeCssText(nextCss);
      setRoots(next);
      setSelectedId(res.value.id);
    },
    [roots, factory, writeCssText],
  );

  const moveNode = useCallback(
    (nodeId: PrismaId, parentId: PrismaId | null, x: number, y: number) => {
      const currentRoots = rootsRef.current;
      if (findById(currentRoots, nodeId) === null) return;
      setError(null);
      const next = shallowCloneRoots(currentRoots);
      const res = applyMove(next, cssTextRef.current, { nodeId, parentId, box: { x, y } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      writeCssText(res.value.cssText);
      setRoots(next);
    },
    [writeCssText],
  );

  const reorder = useCallback(
    (nodeId: PrismaId, direction: "up" | "down") => {
      setError(null);
      const next = shallowCloneRoots(roots);
      const res = reorderNode(next, nodeId, direction);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setRoots(next);
    },
    [roots],
  );

  const deleteNode = useCallback(
    (nodeId: PrismaId) => {
      setError(null);
      const next = shallowCloneRoots(roots);
      const res = deleteNodePure(next, nodeId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setRoots(next);
      setSelectedId((current) => (current === nodeId ? null : current));
    },
    [roots],
  );

  const duplicateNode = useCallback(
    (nodeId: PrismaId) => {
      setError(null);
      const next = shallowCloneRoots(rootsRef.current);
      const result = duplicateNodePure(next, factory, nodeId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRoots(next);
      setSelectedId(result.value.id);
    },
    [factory],
  );

  const updateText = useCallback(
    (nodeId: PrismaId, text: string) => {
      setError(null);
      const next = shallowCloneRoots(roots);
      const res = setNodeTextPure(next, factory, nodeId, text);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setRoots(next);
    },
    [roots, factory],
  );

  const setNodeAttr = useCallback(
    (nodeId: PrismaId, name: string, value: string) => {
      setError(null);
      const next = shallowCloneRoots(roots);
      const res = setNodeAttributePure(next, nodeId, name, value);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setRoots(next);
    },
    [roots],
  );

  const removeNodeAttr = useCallback(
    (nodeId: PrismaId, name: string) => {
      setError(null);
      const next = shallowCloneRoots(rootsRef.current);
      const result = removeNodeAttributePure(next, nodeId, name);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRoots(next);
    },
    [],
  );

  const setBooleanAttr = useCallback(
    (nodeId: PrismaId, name: string, enabled: boolean) => {
      setError(null);
      const next = shallowCloneRoots(roots);
      const node = findById(next, nodeId);
      const changed = node === null ? false : enabled
        ? setNodeAttributePure(next, nodeId, name, "").ok
        : removeAttribute(node, name);
      if (!changed) {
        setError("No se pudo actualizar el atributo del elemento.");
        return;
      }
      setRoots(next);
    },
    [roots],
  );

  const setNodeStyle = useCallback(
    (nodeId: PrismaId, property: string, value: string) => {
      setError(null);
      const next = shallowCloneRoots(roots);
      const node = findById(next, nodeId);
      if (node === null) {
        setError("El elemento ya no está en el documento.");
        return;
      }
      const selector = positionSelector(next, node);
      if (selector === null) {
        setError("Este nodo no se puede posicionar con CSS.");
        return;
      }
      const nextCss = value.trim() === ""
        ? removeDeclaration(cssTextRef.current, selector, property)
        : writeDeclaration(cssTextRef.current, selector, property, value.trim());
      writeCssText(nextCss);
      setRoots(next);
    },
    [roots, writeCssText],
  );

  /** Selector con el que el lienzo escribe el CSS de un nodo, sin crearlo. */
  const styleSelectorOf = useCallback(
    (nodeId: PrismaId): string | null => {
      const node = findById(roots, nodeId);
      if (node === null) {
        return null;
      }
      const unique = designClassOf(roots, node);
      if (unique !== null) {
        return `.${unique}`;
      }
      if (node.kind === "element" && (node.tag === "body" || node.tag === "html")) {
        return node.tag;
      }
      return null;
    },
    [roots],
  );

  const nodeStyle = useCallback(
    (nodeId: PrismaId, property: string): string | null => {
      const selector = styleSelectorOf(nodeId);
      return selector === null ? null : readDeclaration(cssText, selector, property);
    },
    [cssText, styleSelectorOf],
  );

  const nodeBox = useCallback(
    (nodeId: PrismaId): { x: number; y: number } | null => {
      const selector = styleSelectorOf(nodeId);
      return selector === null ? null : readBox(cssText, selector);
    },
    [cssText, styleSelectorOf],
  );

  const selectedNode = useMemo(
    () => (selectedId === null ? null : findById(roots, selectedId)),
    [roots, selectedId],
  );

  const visibleCanvasNodes = useMemo(() => visualCanvasNodes(roots), [roots]);
  const containerId = useMemo(() => canvasContainerId(roots), [roots]);
  const hasUnappliedChanges = document !== null &&
    appliedSnapshot !== `${serialize(roots)}\u0000${cssText}`;
  const requestViewMode = useCallback((mode: DesignViewMode) => {
    const isHtmlLike = activePath !== null && /\.html?$|\.blade\.php$/i.test(activePath);
    if (mode === "design" && !isHtmlLike) {
      setViewMode("code");
      return;
    }
    if (viewMode !== mode && mode === "design") setAttempt((current) => current + 1);
    setViewMode(mode);
  }, [viewMode, activePath]);

  useEffect(() => {
    if (activePath === null || !/\.html?$|\.blade\.php$/i.test(activePath)) {
      setViewMode("code");
    }
  }, [activePath]);

  const selectCssTarget = useCallback(
    (target: CssTarget) => {
      const sameTarget = target.kind === "internal"
        ? cssTarget?.kind === "internal"
        : cssTarget?.kind === "external" && cssTarget.href === target.href;
      if (sameTarget) return true;
      const currentSnapshot = `${serialize(roots)}\u0000${cssTextRef.current}`;
      if (appliedSnapshot !== currentSnapshot) {
        setError("Aplica los cambios pendientes antes de cambiar de hoja de estilos.");
        return false;
      }
      setError(null);
      setCssTarget(target);
      void (async () => {
        try {
          let nextText = "";
          if (target.kind === "external") {
            const ct = await optionsRef.current.getCssText(target.href);
            nextText = ct ?? "";
          } else {
            nextText = readInternalStyle(roots) ?? "";
          }
          writeCssText(nextText);
          setAppliedSnapshot(`${serialize(roots)}\u0000${nextText}`);
        } catch (cause) {
          setCssTarget(cssTarget);
          setError(messageOf(cause, "No se pudo leer la hoja de estilos."));
        }
      })();
      return true;
    },
    [roots, cssTarget, appliedSnapshot, writeCssText],
  );

  const useDefaultCssTarget = useCallback(() => {
    const currentSnapshot = `${serialize(roots)}\u0000${cssTextRef.current}`;
    if (appliedSnapshot !== currentSnapshot) {
      setError("Guarda los cambios pendientes antes de cambiar la hoja de estilos.");
      return false;
    }
    const links = linkedStylesheets(roots);
    const firstLink = links[0];
    const hasInternal = readInternalStyle(roots) !== null;
    const target: CssTarget | null = firstLink
      ? { kind: "external", href: firstLink }
      : hasInternal ? { kind: "internal" } : null;
    const sameTarget = target === null
      ? cssTarget === null
      : target.kind === "internal"
        ? cssTarget?.kind === "internal"
        : cssTarget?.kind === "external" && cssTarget.href === target.href;
    if (sameTarget) return true;
    setError(null);
    setCssTarget(target);
    void (async () => {
      try {
        const text = target?.kind === "external"
          ? await optionsRef.current.getCssText(target.href) ?? ""
          : target?.kind === "internal" ? readInternalStyle(roots) ?? "" : "";
        writeCssText(text);
        setAppliedSnapshot(`${serialize(roots)}\u0000${text}`);
      } catch (cause) {
        setCssTarget(cssTarget);
        setError(messageOf(cause, "No se pudo leer la hoja de estilos."));
      }
    })();
    return true;
  }, [roots, appliedSnapshot, writeCssText, cssTarget]);

  const ensureExternalCss = useCallback(
    (href: string, nodeId: PrismaId | null = null) => {
      const clean = href.trim();
      if (clean === "") {
        setError("Indica el nombre de la hoja de estilo.");
        return;
      }
      const currentSnapshot = `${serialize(roots)}\u0000${cssTextRef.current}`;
      if (appliedSnapshot !== currentSnapshot) {
        setError("Guarda los cambios pendientes antes de cambiar la hoja de estilos.");
        return;
      }
      setError(null);
      const next = shallowCloneRoots(roots);
      const res = ensureStylesheetLink(next, factory, clean);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setRoots(next);
      setCssTarget({ kind: "external", href: clean });
      if (nodeId !== null) {
        const assigned = { ...elementCssTargets, [nodeId]: { kind: "external", href: clean } as const };
        setElementCssTargets(assigned);
        try {
          const path = activePathRef.current;
          if (path !== null) localStorage.setItem(`prisma-element-css-targets:${path}`, JSON.stringify(assigned));
        } catch {}
      }
      void (async () => {
        try {
          const ct = await optionsRef.current.getCssText(clean);
          if (ct === null) {
            // Crear significa crear: el fichero aparece en el árbol desde ya,
            // no solo al pulsar Aplicar.
            await optionsRef.current.writeCssText(clean, "");
            writeCssText("");
          } else {
            writeCssText(ct);
          }
        } catch (cause) {
          setError(messageOf(cause, "No se pudo leer la hoja de estilos."));
        }
      })();
    },
    [roots, factory, appliedSnapshot, writeCssText, elementCssTargets],
  );

  const elementCssTarget = useCallback(
    (nodeId: PrismaId): CssTarget | null => elementCssTargets[nodeId] ?? null,
    [elementCssTargets],
  );

  const setElementCssTarget = useCallback((nodeId: PrismaId, target: CssTarget | null) => {
    if (target === null) {
      if (!useDefaultCssTarget()) return;
    } else if (target.kind === "external" && !linkedStylesheets(roots).includes(target.href)) {
      ensureExternalCss(target.href, nodeId);
      return;
    } else if (!selectCssTarget(target)) {
      return;
    }

    const next = { ...elementCssTargets };
    if (target === null) delete next[nodeId];
    else next[nodeId] = target;
    setElementCssTargets(next);
    try {
      const path = activePathRef.current;
      if (path !== null) localStorage.setItem(`prisma-element-css-targets:${path}`, JSON.stringify(next));
    } catch {}
  }, [roots, elementCssTargets, ensureExternalCss, selectCssTarget, useDefaultCssTarget]);

  useEffect(() => {
    if (selectedId === null) return;
    const target = elementCssTargets[selectedId];
    if (target === undefined) {
      useDefaultCssTarget();
    } else {
      selectCssTarget(target);
    }
  }, [selectedId, elementCssTargets, useDefaultCssTarget, selectCssTarget]);

  const applyToBuffers = useCallback(
    async (ws: {
      writeBuffer: (path: string, content: string) => void;
      saveBuffer: (path: string) => Promise<string | null>;
      ensureBuffer: (path: string) => Promise<string | null>;
    }) => {
      const path = activePathRef.current;
      if (path === null || document === null) return false;
      // El `<style>` interno se materializa aquí, sobre una copia local: así el
      // HTML volcado ya lo contiene y no depende del estado pendiente de React.
      let current = roots;
      if (cssTarget === null && cssTextRef.current.trim() !== "") {
        const next = shallowCloneRoots(roots);
        const ensured = ensureStyleNode(next, factory, cssTextRef.current);
        if (!ensured.ok) {
          setError(ensured.message);
          return false;
        }
        current = next;
        setRoots(next);
        setCssTarget({ kind: "internal" });
      } else if (cssTarget?.kind === "internal") {
        const next = shallowCloneRoots(roots);
        const ensured = ensureStyleNode(next, factory, cssTextRef.current);
        if (!ensured.ok) {
          setError(ensured.message);
          return false;
        }
        current = next;
        setRoots(next);
      }
      const html = serialize(current);
      ws.writeBuffer(path, html);
      if (cssTarget?.kind === "external") {
        const cssPath = optionsRef.current.resolveCssPath(cssTarget.href);
        if (cssPath === null) {
          setError("La hoja de estilos no es un archivo local del proyecto y no se puede guardar desde el diseñador.");
          return false;
        }
        if (workspaceRef.current?.buffers?.[cssPath] === undefined) {
          const loadError = await ws.ensureBuffer(cssPath);
          if (loadError !== null) {
            setError(loadError);
            return false;
          }
        }
        ws.writeBuffer(cssPath, cssTextRef.current);
        const cssError = await ws.saveBuffer(cssPath);
        if (cssError !== null) {
          setError(cssError);
          return false;
        }
        const htmlError = await ws.saveBuffer(path);
        if (htmlError !== null) {
          setError(htmlError);
          return false;
        }
      } else {
        const htmlError = await ws.saveBuffer(path);
        if (htmlError !== null) {
          setError(htmlError);
          return false;
        }
      }
      setAppliedSnapshot(`${serialize(current)}\u0000${cssTextRef.current}`);
      setError(null);
      return true;
    },
    [roots, cssTarget, document, factory],
  );

  const refresh = useCallback(() => setAttempt((v) => v + 1), []);

  return {
    viewMode,
    setViewMode: requestViewMode,
    document,
    roots,
    cssTarget,
    elementCssTarget,
    cssText,
    selectedId,
    selectedNode,
    canvasNodes: visibleCanvasNodes,
    containerId,
    setSelectedId,
    setCssTarget,
    isBusy,
    error,
    hasUnappliedChanges,
    canUndo: historyRef.current.index > 0,
    canRedo: historyRef.current.index >= 0 && historyRef.current.index < historyRef.current.entries.length - 1,
    projectModel,
    undo,
    redo,
    insertTag,
    moveNode,
    reorder,
    deleteNode,
    duplicateNode,
    updateText,
    setNodeAttr,
    removeNodeAttr,
    setBooleanAttr,
    setNodeStyle,
    nodeStyle,
    nodeBox,
    selectCssTarget,
    useDefaultCssTarget,
    setElementCssTarget,
    ensureExternalCss,
    applyToBuffers,
    refresh,
  };
}
