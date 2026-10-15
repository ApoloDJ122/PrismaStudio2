import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import type { PrismaId, PrismaNode } from "../../../designer/types";
import type { ProjectNode } from "../../../types/project";
import { linkedStylesheets } from "../../../designer/edit";
import { readAttribute } from "../../../designer/attributes";
import { isContainerTag, isVoidTag } from "../../../designer/html";
import { readDeclaration, scopeResponsiveCss } from "../../../designer/cssEdit";
import { displayLabel, visualChildren } from "../../../designer/visual";
import type { DesignerState } from "../../../hooks/useDesigner";
import "./design.css";

/** Ámbito con el que se inyecta la hoja del autor dentro de la página. */
const CANVAS_SCOPE = ".ds-page";

function clampZoom(value: number): number {
  return Math.min(2, Math.max(0.25, Math.round(value * 100) / 100));
}

interface ResizeBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

type ViewportMode = "desktop" | "tablet" | "mobile" | "custom";
type ViewportSize = { width: number; height: number };

const VIEWPORT_PRESETS: Record<Exclude<ViewportMode, "custom">, ViewportSize> = {
  desktop: { width: 1366, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};
const VIEWPORT_STORAGE_KEY = "prisma-designer-viewport-v1";

function defaultDesktopViewport(): ViewportSize {
  if (typeof window === "undefined") return VIEWPORT_PRESETS.desktop;
  const width = window.screen.availWidth || window.innerWidth || VIEWPORT_PRESETS.desktop.width;
  const availableHeight = window.screen.availHeight || window.innerHeight || VIEWPORT_PRESETS.desktop.height;
  // La barra del navegador ocupa espacio fuera de su viewport CSS cuando abre maximizada.
  return { width: Math.round(width), height: Math.max(320, Math.round(availableHeight - 100)) };
}

function readViewportSettings(): { mode: ViewportMode; size: ViewportSize } {
  const defaults = defaultDesktopViewport();
  try {
    const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY);
    if (stored !== null) {
      const value = JSON.parse(stored) as { mode?: ViewportMode; size?: Partial<ViewportSize> };
      const width = Number(value.size?.width);
      const height = Number(value.size?.height);
      if (Number.isFinite(width) && Number.isFinite(height) && width >= 320 && height >= 240) {
        return {
          mode: value.mode === "desktop" || value.mode === "tablet" || value.mode === "mobile" || value.mode === "custom"
            ? value.mode
            : "desktop",
          size: { width: Math.round(width), height: Math.round(height) },
        };
      }
    }
  } catch {}
  return { mode: "desktop", size: defaults };
}

/** `style="..."` del autor a objeto React (`kebab` -> `camelCase`). */
function parseInlineStyle(value: string): CSSProperties {
  const out: Record<string, string> = {};
  let cursor = 0;
  let start = 0;
  let depth = 0;
  let quote: string | null = null;

  const push = (end: number): void => {
    const raw = value.slice(start, end).trim();
    start = end + 1;
    if (raw === "") {
      return;
    }
    const colon = raw.indexOf(":");
    if (colon < 0) {
      return;
    }
    const name = raw
      .slice(0, colon)
      .trim()
      .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    if (name !== "") {
      out[name] = raw.slice(colon + 1).trim();
    }
  };

  while (cursor < value.length) {
    const char = value[cursor];
    if (quote !== null) {
      if (char === quote) {
        quote = null;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (char === ";" && depth === 0) {
      push(cursor);
    }
    cursor += 1;
  }
  push(value.length);
  return out as CSSProperties;
}

interface NodeViewProps {
  node: PrismaNode;
  cssText: string;
  selectedId: PrismaId | null;
  dropTargetId: PrismaId | null;
  draggingId: PrismaId | null;
  dragActive: boolean;
  dragDelta: { x: number; y: number };
  dragDisplay: string | null;
  onSelect: (id: PrismaId | null) => void;
  onDragStart: (id: PrismaId, x: number, y: number, element: HTMLElement) => void;
  onDragEnter: (id: PrismaId) => void;
  onDragLeave: () => void;
  onDrop: (id: PrismaId) => void;
}

function ImgView({
  node,
  props,
}: {
  node: PrismaNode;
  props: Record<string, unknown>;
}) {
  const [failed, setFailed] = useState(false);
  const src = readAttribute(node, "src");
  const alt = readAttribute(node, "alt") ?? "Imagen";

  if (failed || src === null || src.trim() === "") {
    return (
      <div {...props} className={`${props.className ?? ""} ds-img-fallback`.trim()}>
        <span className="ds-img-fallback__icon" aria-hidden="true">
          ◧
        </span>
        <span>{alt}</span>
      </div>
    );
  }

  return <img {...props} src={src} alt={alt} onError={() => setFailed(true)} />;
}

function NodeView({
  node,
  cssText,
  selectedId,
  dropTargetId,
  draggingId,
  dragActive,
  dragDelta,
  dragDisplay,
  onSelect,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDrop,
}: NodeViewProps) {
  const ref = useRef<any>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (node.kind !== "element") {
        return;
      }
      e.stopPropagation();
      onSelect(node.id);
      onDragStart(node.id, e.clientX, e.clientY, e.currentTarget);
    },
    [node, onSelect, onDragStart],
  );

  if (node.kind !== "element" || node.tag === null) {
    if (node.kind === "text") {
      return <>{node.content ?? ""}</>;
    }
    if (node.kind === "dynamic" || node.kind === "directive") {
      return <span className="ds-blade">{displayLabel(node)}</span>;
    }
    return null;
  }

  const selected = selectedId === node.id;
  const isDrop = dropTargetId === node.id;
  const isDragging = dragActive && draggingId === node.id;
  const kids = visualChildren(node);
  const empty = kids.length === 0;

  const attrs: Record<string, unknown> = {};
  let authorClass = "";
  let inline: CSSProperties | undefined;
  for (const a of node.attributes) {
    const name = a.name.toLowerCase();
    const value = a.value ?? "";
    if (name === "class") {
      authorClass = value;
    } else if (name === "style") {
      inline = parseInlineStyle(value);
    } else if (name === "for" && node.tag === "label") {
      attrs.htmlFor = value;
    } else {
      attrs[a.name] = value;
    }
  }

  // Las posiciones se escriben en CSS del proyecto. Reflejarlas como estilo
  // de vista evita que el layout base de etiquetas vacías las reúna en una fila
  // si el navegador del lienzo todavía está resolviendo la hoja enlazada.
  let canvasPosition: CSSProperties | undefined;
  if (node.kind === "element") {
    const classNames = readAttribute(node, "class")?.split(/\s+/).filter(Boolean) ?? [];
    for (const name of classNames) {
      const selector = `.${name}`;
      const position = readDeclaration(cssText, selector, "position");
      const left = readDeclaration(cssText, selector, "left");
      const top = readDeclaration(cssText, selector, "top");
      if (position === "absolute" && left !== null && top !== null) {
        canvasPosition = { position: "absolute", left, top };
        break;
      }
    }
  }

  const className = [
    authorClass,
    "ds-node",
    selected ? "ds-selected" : "",
    isDrop ? "ds-drop" : "",
    isDragging ? "ds-dragging" : "",
    empty ? "ds-empty" : "",
  ]
    .filter((part) => part !== "")
    .join(" ");

  const common = {
    ...attrs,
    className,
    "data-prisma-id": node.id,
    "data-ds-tag": node.tag,
    ref,
    onPointerDown: handlePointerDown,
    style: isDragging
      ? {
          ...inline,
          ...canvasPosition,
          ...(dragDisplay !== null ? { display: dragDisplay } : {}),
          translate: `${dragDelta.x}px ${dragDelta.y}px`,
          zIndex: 8,
        }
      : { ...inline, ...canvasPosition },
  };

  if (isVoidTag(node.tag)) {
    // Un void vacío no tiene caja clicable (y varios ni admiten pseudo-elementos).
    // En el lienzo se representa como una ficha seleccionable; el HTML serializado
    // sigue conservando la etiqueta real sin este placeholder.
    if (empty) {
      return <span {...common} role="img" aria-label={`<${node.tag}>`} />;
    }
    // Los void no admiten hijos en React: se dibujan autocerrados.
    if (node.tag === "img") {
      return <ImgView node={node} props={common} />;
    }
    const Tag: any = node.tag;
    return <Tag {...common} />;
  }

  if (node.tag === "input") {
    return <input {...common} readOnly />;
  }

  if (node.tag === "textarea") {
    return <textarea {...common} readOnly value={node.children.map((c) => c.content ?? "").join("")} />;
  }

  const Tag: any = node.tag;
  return (
    <Tag
      {...common}
      onPointerOver={(e: React.PointerEvent) => {
        e.stopPropagation();
        if (draggingId !== null && draggingId !== node.id && isContainerTag(node.tag as string)) {
          onDragEnter(node.id);
        }
      }}
      onPointerOut={(e: React.PointerEvent) => {
        e.stopPropagation();
        onDragLeave();
      }}
      onPointerUp={(e: React.PointerEvent) => {
        e.stopPropagation();
        if (draggingId !== null) {
          onDrop(draggingId);
        }
      }}
    >
      {kids.map((child) => (
        <NodeView
          key={child.id}
          node={child}
          cssText={cssText}
          selectedId={selectedId}
          dropTargetId={dropTargetId}
          draggingId={draggingId}
          dragActive={dragActive}
          dragDelta={dragDelta}
          dragDisplay={dragDisplay}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      ))}
    </Tag>
  );
}

// Si un nodo no se puede dibujar, se muestra un aviso en el lienzo en lugar de
// tumbar la aplicación entera. Los archivos del proyecto no se tocan.
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <p className="ds-error">
          No se pudo dibujar este documento en el lienzo. Puedes seguir editándolo en modo
          Código.
        </p>
      );
    }
    return this.props.children;
  }
}

interface CssFileChoice {
  path: string;
  relativePath: string;
  href: string;
}

interface DocumentBarProps {
  designer: DesignerState;
  cssFiles: CssFileChoice[];
  folders: ProjectNode[];
  onCreateCssFile: (folderPath: string, name: string) => Promise<{ path: string; href: string }>;
}

/** Permite elegir el CSS activo del HTML, enlazar otro archivo o guardar CSS dentro del HTML. */
function DocumentBar({ designer, cssFiles, folders, onCreateCssFile }: DocumentBarProps) {
  const [draft, setDraft] = useState("styles.css");
  const [folderPath, setFolderPath] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const links = linkedStylesheets(designer.roots);
  const value =
    designer.cssTarget?.kind === "external"
      ? designer.cssTarget.href
      : designer.cssTarget?.kind === "internal"
        ? "__internal__"
        : "__default__";
  const shown = links.includes(value) || value === "__internal__" || value === "__default__" || cssFiles.some((file) => file.href === value)
    ? value
    : "__default__";
  const path = designer.document?.filePath ?? null;
  const name = path === null ? "Sin documento HTML" : (path.split(/[\\/]/).pop() ?? path);

  useEffect(() => {
    if (path === null) return;
    const parent = path.slice(0, Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/")));
    setFolderPath(folders.some((folder) => folder.path === parent) ? parent : folders[0]?.path ?? "");
  }, [path, folders]);

  const create = async (): Promise<void> => {
    const clean = draft.trim() === "" ? "styles.css" : draft.trim();
    const filename = clean.toLowerCase().endsWith(".css") ? clean : `${clean}.css`;
    if (/[\\/]/.test(filename) || filename === ".css") {
      setCreateError("Escribe solo el nombre del archivo; elige la carpeta en la lista.");
      return;
    }
    if (folderPath === "") {
      setCreateError("Selecciona la carpeta donde se creará la hoja.");
      return;
    }
    setCreateError(null);
    try {
      const created = await onCreateCssFile(folderPath, filename);
      designer.ensureExternalCss(created.href);
    } catch (cause) {
      setCreateError(typeof cause === "string" ? cause : "No se pudo crear el archivo CSS.");
    }
  };

  return (
    <div className="ds-docbar">
      <span className="ds-docbar__doc" title={path ?? ""}>
        {name}
      </span>
      <label className="ds-docbar__field" title="Hoja de estilo del documento">
        <span>Hoja</span>
        <select
          className="ds-field__input ds-docbar__select"
          value={shown}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "__default__") {
              designer.useDefaultCssTarget();
            } else if (next === "__internal__") {
              designer.selectCssTarget({ kind: "internal" });
            } else if (next !== "") {
              if (links.includes(next)) designer.selectCssTarget({ kind: "external", href: next });
              else designer.ensureExternalCss(next);
            }
          }}
        >
          <option value="__default__">Predeterminada del HTML</option>
          {links.map((href) => (
            <option key={href} value={href}>
              {href} · enlazada
            </option>
          ))}
          {cssFiles.filter((file) => !links.includes(file.href)).map((file) => (
            <option key={file.path} value={file.href}>
              {file.relativePath} · enlazar al HTML
            </option>
          ))}
          <option value="__internal__">{"<style> interno"}</option>
        </select>
      </label>
      <label className="ds-docbar__field" title="Carpeta donde se creará el nuevo archivo CSS">
        <span>Carpeta</span>
        <select className="ds-field__input ds-docbar__folder" value={folderPath} onChange={(event) => setFolderPath(event.target.value)}>
          {folders.map((folder) => (
            <option key={folder.path} value={folder.path}>
              {folder.path.split(/[\\/]/).pop() || folder.name}
            </option>
          ))}
        </select>
      </label>
      <input
        className="ds-field__input ds-docbar__new"
        value={draft}
        placeholder="nuevo.css"
        aria-label="Nombre del nuevo archivo CSS"
        title="Nombre del nuevo archivo CSS"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            void create();
          }
        }}
      />
      <button
        type="button"
        className="ds-mini-btn"
        title="Crea el archivo y lo enlaza automáticamente con el HTML"
        disabled={designer.hasUnappliedChanges}
        onClick={() => void create()}
      >
        Crear y enlazar
      </button>
      {createError !== null && <span className="ds-docbar__error" role="alert">{createError}</span>}
    </div>
  );
}

export function DesignCanvas({
  designer,
  cssFiles,
  folders,
  onCreateCssFile,
}: {
  designer: DesignerState;
  cssFiles: CssFileChoice[];
  folders: ProjectNode[];
  onCreateCssFile: DocumentBarProps["onCreateCssFile"];
}) {
  const [zoom, setZoom] = useState(1);
  const [initialViewport] = useState(readViewportSettings);
  const [viewport, setViewport] = useState<ViewportMode>(initialViewport.mode);
  const [viewportSize, setViewportSize] = useState<ViewportSize>(initialViewport.size);
  const [draggingId, setDraggingId] = useState<PrismaId | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
  const [dragDisplay, setDragDisplay] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<PrismaId | null>(null);
  const [paletteDropPoint, setPaletteDropPoint] = useState<{ x: number; y: number } | null>(null);
  const [paletteDropLabel, setPaletteDropLabel] = useState("");
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [resizeBounds, setResizeBounds] = useState<ResizeBounds | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const paletteGestureRef = useRef<{ tag: string; startX: number; startY: number; moved: boolean } | null>(null);
  // Dónde se pulsó: por debajo del umbral es un clic (selecciona) y no un
  // arrastre (mueve). Sin esto, cada clic teletransportaba el elemento.
  const pressPos = useRef<{ x: number; y: number } | null>(null);
  const dragGrabOffset = useRef({ x: 0, y: 0 });
  const dropTargetRef = useRef<PrismaId | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify({ mode: viewport, size: viewportSize }));
    } catch {}
  }, [viewport, viewportSize]);

  // La biblioteca y el lienzo son paneles hermanos. Gestionar el gesto en la
  // ventana evita depender del drag-and-drop nativo del WebView de Tauri.
  useEffect(() => {
    const start = (event: Event) => {
      const detail = (event as CustomEvent<{ tag: string; x: number; y: number }>).detail;
      if (detail === undefined) return;
      paletteGestureRef.current = { tag: detail.tag, startX: detail.x, startY: detail.y, moved: false };
    };
    const clear = (dragged: boolean) => {
      paletteGestureRef.current = null;
      setPaletteDropPoint(null);
      setPaletteDropLabel("");
      window.dispatchEvent(new CustomEvent("prisma-palette-drag-end", { detail: { dragged } }));
    };
    const move = (event: PointerEvent) => {
      const gesture = paletteGestureRef.current;
      if (gesture === null) return;
      if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 5) return;
      gesture.moved = true;
      const page = pageRef.current;
      const bounds = page?.getBoundingClientRect();
      if (page === null || bounds === undefined || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        setPaletteDropPoint(null);
        setPaletteDropLabel("");
        return;
      }
      setPaletteDropPoint({ x: (event.clientX - bounds.left) / zoom, y: (event.clientY - bounds.top) / zoom });
      let target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-prisma-id]") ?? null;
      while (target !== null && !isContainerTag(target.dataset.dsTag ?? "")) {
        target = target.parentElement?.closest<HTMLElement>("[data-prisma-id]") ?? null;
      }
      setPaletteDropLabel(target?.dataset.dsTag ? `<${target.dataset.dsTag}>` : "<body>");
    };
    const finish = (event: PointerEvent) => {
      const current = paletteGestureRef.current;
      if (current === null) return;
      const page = pageRef.current;
      const bounds = page?.getBoundingClientRect();
      const overPage = current.moved && bounds !== undefined && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      if (overPage && bounds !== undefined) {
        let target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-prisma-id]") ?? null;
        while (target !== null && !isContainerTag(target.dataset.dsTag ?? "")) {
          target = target.parentElement?.closest<HTMLElement>("[data-prisma-id]") ?? null;
        }
        const parentId = target?.dataset.prismaId as PrismaId | undefined;
        const rect = target?.getBoundingClientRect() ?? page?.querySelector<HTMLElement>(".ds-page")?.getBoundingClientRect() ?? bounds;
        const targetStyle = target === null ? null : window.getComputedStyle(target);
        const borderLeft = targetStyle === null ? 0 : Number.parseFloat(targetStyle.borderLeftWidth) || 0;
        const borderTop = targetStyle === null ? 0 : Number.parseFloat(targetStyle.borderTopWidth) || 0;
        const x = Math.max(0, Math.round((event.clientX - rect.left) / zoom - borderLeft));
        const y = Math.max(0, Math.round((event.clientY - rect.top) / zoom - borderTop));
        designer.insertTag(current.tag, parentId ?? designer.containerId, { x, y });
      }
      clear(current.moved);
    };
    const cancel = () => { if (paletteGestureRef.current !== null) clear(false); };
    window.addEventListener("prisma-palette-drag-start", start);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("prisma-palette-drag-cancel", cancel);
    return () => {
      window.removeEventListener("prisma-palette-drag-start", start);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("prisma-palette-drag-cancel", cancel);
    };
  }, [designer, zoom]);

  // La hoja del autor, con ámbito para no pintar la UI de Prisma. Solo
  // previsualización: el archivo real nunca pasa por este texto.
  const scopedCss = useMemo(() => scopeResponsiveCss(designer.cssText, CANVAS_SCOPE), [designer.cssText]);

  const beginPress = useCallback((id: PrismaId, x: number, y: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const display = window.getComputedStyle(element).display;
    dragGrabOffset.current = { x: (x - rect.left) / zoom, y: (y - rect.top) / zoom };
    pressPos.current = { x, y };
    setDragActive(false);
    setDragDelta({ x: 0, y: 0 });
    setDragDisplay(display === "inline" ? "inline-block" : display === "contents" ? "block" : null);
    setDraggingId(id);
  }, [zoom]);

  useEffect(() => {
    if (draggingId === null) {
      setDragPos(null);
      return;
    }
    const onMove = (e: PointerEvent) => {
      const start = pressPos.current;
      if (start === null) {
        return;
      }
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) {
        return;
      }
      setDragActive(true);
      setDragPos({ x: e.clientX, y: e.clientY });
      setDragDelta({ x: (e.clientX - start.x) / zoom, y: (e.clientY - start.y) / zoom });

      const hit = document.elementFromPoint(e.clientX, e.clientY);
      let candidate = hit?.closest<HTMLElement>("[data-prisma-id]") ?? null;
      while (candidate !== null) {
        const candidateId = candidate.dataset.prismaId;
        const candidateTag = candidate.dataset.dsTag ?? "";
        if (candidateId !== draggingId && isContainerTag(candidateTag)) {
          dropTargetRef.current = candidateId as PrismaId;
          setDropTargetId(candidateId as PrismaId);
          return;
        }
        candidate = candidate.parentElement?.closest<HTMLElement>("[data-prisma-id]") ?? null;
      }
      dropTargetRef.current = null;
      setDropTargetId(null);
    };
    const onUp = () => {
      pressPos.current = null;
      setDragActive(false);
      setDragDelta({ x: 0, y: 0 });
      setDragDisplay(null);
      setDraggingId(null);
      dropTargetRef.current = null;
      setDropTargetId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingId, zoom]);

  const handleDrop = useCallback(
    (nodeId: PrismaId) => {
      const targetId = dropTargetRef.current ?? dropTargetId ?? designer.containerId;
      pressPos.current = null;
      setDraggingId(null);
      dropTargetRef.current = null;
      setDropTargetId(null);
      setDragActive(false);
      setDragDelta({ x: 0, y: 0 });
      setDragDisplay(null);
      // Clic sin arrastre: solo selecciona, no toca el modelo.
      if (!dragActive || dragPos === null) {
        return;
      }
      // Sin contenedor bajo el cursor, el fondo de la página (el `<body>`).
      let x = 0;
      let y = 0;
      const pageRect = pageRef.current?.querySelector<HTMLElement>(".ds-page")?.getBoundingClientRect() ?? null;

      if (targetId !== null) {
        const el = pageRef.current?.querySelector(
          `[data-prisma-id="${targetId}"]`,
        ) as HTMLElement | null;
        const rect = el?.getBoundingClientRect() ?? null;
        if (rect !== null) {
          const style = window.getComputedStyle(el!);
          const originLeft = rect.left + (Number.parseFloat(style.borderLeftWidth) || 0) * zoom;
          const originTop = rect.top + (Number.parseFloat(style.borderTopWidth) || 0) * zoom;
          x = Math.round((dragPos.x - originLeft) / zoom - dragGrabOffset.current.x);
          y = Math.round((dragPos.y - originTop) / zoom - dragGrabOffset.current.y);
        } else if (pageRect !== null) {
          x = Math.round((dragPos.x - pageRect.left) / zoom - dragGrabOffset.current.x);
          y = Math.round((dragPos.y - pageRect.top) / zoom - dragGrabOffset.current.y);
        }
      } else if (pageRect !== null) {
        x = Math.round((dragPos.x - pageRect.left) / zoom - dragGrabOffset.current.x);
        y = Math.round((dragPos.y - pageRect.top) / zoom - dragGrabOffset.current.y);
      }

      designer.moveNode(nodeId, targetId, Math.max(0, x), Math.max(0, y));
    },
    [dragPos, dropTargetId, designer, zoom, dragActive],
  );

  const centerPage = useCallback(() => {
    const wrap = wrapRef.current;
    if (wrap === null) {
      return;
    }
    wrap.scrollTo({
      left: Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2),
      top: 0,
    });
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
      return;
    }
    e.preventDefault();
    const step = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((current) => clampZoom(current + step));
  }, []);

  useEffect(() => {
    const selected = designer.selectedNode;
    if (selected?.kind !== "element" || selected.tag === "body" || selected.tag === "html") {
      setResizeBounds(null);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const page = pageRef.current;
      const element = page?.querySelector<HTMLElement>(`[data-prisma-id="${selected.id}"]`);
      if (page === null || page === undefined || element === null || element === undefined) {
        setResizeBounds(null);
        return;
      }
      const pageRect = page.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      setResizeBounds({
        left: (rect.left - pageRect.left) / zoom,
        top: (rect.top - pageRect.top) / zoom,
        width: rect.width / zoom,
        height: rect.height / zoom,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [designer.selectedNode, designer.roots, zoom]);

  const beginResize = useCallback((event: React.PointerEvent, axes: "x" | "y" | "xy") => {
    event.preventDefault();
    event.stopPropagation();
    const selected = designer.selectedNode;
    const bounds = resizeBounds;
    if (selected?.kind !== "element" || bounds === null) return;
    const element = pageRef.current?.querySelector<HTMLElement>(`[data-prisma-id="${selected.id}"]`);
    if (element === null || element === undefined) return;
    const style = window.getComputedStyle(element);
    const initialWidth = Number.parseFloat(style.width) || bounds.width;
    const initialHeight = Number.parseFloat(style.height) || bounds.height;
    const current = { width: initialWidth, height: initialHeight };
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (pointer: PointerEvent) => {
      const dx = (pointer.clientX - startX) / zoom;
      const dy = (pointer.clientY - startY) / zoom;
      if (axes !== "y") current.width = Math.max(16, initialWidth + dx);
      if (axes !== "x") current.height = Math.max(16, initialHeight + dy);
      setResizeBounds({
        ...bounds,
        width: axes === "y" ? bounds.width : Math.max(16, bounds.width + dx),
        height: axes === "x" ? bounds.height : Math.max(16, bounds.height + dy),
      });
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      if (axes !== "y") designer.setNodeStyle(selected.id, "width", `${Math.round(current.width)}px`);
      if (axes !== "x") designer.setNodeStyle(selected.id, "height", `${Math.round(current.height)}px`);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  }, [designer, resizeBounds, zoom]);

  const selectOnCanvas = useCallback((id: PrismaId | null) => {
    designer.setSelectedId(id);
    pageRef.current?.focus({ preventScroll: true });
  }, [designer.setSelectedId]);

  const handleCanvasKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.key === "Escape") {
      designer.setSelectedId(null);
      return;
    }
    const selected = designer.selectedNode;
    if (selected === null) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      designer.deleteNode(selected.id);
      return;
    }
    const delta = event.shiftKey ? 10 : 1;
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [-delta, 0], ArrowRight: [delta, 0],
      ArrowUp: [0, -delta], ArrowDown: [0, delta],
    };
    const offset = offsets[event.key];
    if (offset !== undefined) {
      event.preventDefault();
      const box = designer.nodeBox(selected.id) ?? { x: 0, y: 0 };
      designer.moveNode(
        selected.id,
        selected.parentId ?? designer.containerId,
        Math.max(0, box.x + offset[0]),
        Math.max(0, box.y + offset[1]),
      );
    }
  }, [designer]);

  const empty = designer.canvasNodes.length === 0;
  const pageWidth = viewportSize.width;
  const pageHeight = viewportSize.height;

  return (
    <div className="ds-canvas-col">
      <DocumentBar designer={designer} cssFiles={cssFiles} folders={folders} onCreateCssFile={onCreateCssFile} />
      <div className="ds-canvas" ref={wrapRef} onWheel={onWheel}>
      <div className="ds-canvas__toolbar" role="toolbar" aria-label="Vista del lienzo">
        <div className="ds-viewport-switch" role="group" aria-label="Tamaño de vista previa">
          {(["desktop", "tablet", "mobile"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`ds-zoom__btn${viewport === mode ? " ds-zoom__btn--active" : ""}`}
              aria-label={`Vista ${mode === "desktop" ? "escritorio" : mode === "tablet" ? "tableta" : "móvil"}`}
              aria-pressed={viewport === mode}
              title={`Vista ${mode === "desktop" ? "escritorio" : mode === "tablet" ? "tableta" : "móvil"}`}
              onClick={() => {
                setViewport(mode);
                setViewportSize(mode === "desktop" ? defaultDesktopViewport() : VIEWPORT_PRESETS[mode]);
              }}
            >
              {mode === "desktop" ? "▰" : mode === "tablet" ? "▯" : "▏"}
            </button>
          ))}
        </div>
        <label className="ds-viewport-dimensions" title="El lienzo usa estas dimensiones en píxeles CSS">
          <input
            type="number"
            min={320}
            max={7680}
            aria-label="Ancho de la pantalla del lienzo en píxeles"
            value={viewportSize.width}
            onChange={(event) => {
              const width = event.currentTarget.valueAsNumber;
              if (Number.isFinite(width) && width >= 320 && width <= 7680) {
                setViewport("custom");
                setViewportSize((current) => ({ ...current, width: Math.round(width) }));
              }
            }}
          />
          <span aria-hidden="true">×</span>
          <input
            type="number"
            min={240}
            max={4320}
            aria-label="Alto de la pantalla del lienzo en píxeles"
            value={viewportSize.height}
            onChange={(event) => {
              const height = event.currentTarget.valueAsNumber;
              if (Number.isFinite(height) && height >= 240 && height <= 4320) {
                setViewport("custom");
                setViewportSize((current) => ({ ...current, height: Math.round(height) }));
              }
            }}
          />
          <span>px</span>
        </label>
        <button
          type="button"
          className="ds-zoom__btn"
          title="Reducir zoom"
          onClick={() => setZoom((current) => clampZoom(current - 0.1))}
        >
          −
        </button>
        <button
          type="button"
          className="ds-zoom__value"
          title="Restablecer zoom al 100%"
          onClick={() => setZoom(1)}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="ds-zoom__btn"
          title="Ampliar zoom"
          onClick={() => setZoom((current) => clampZoom(current + 0.1))}
        >
          +
        </button>
        <button type="button" className="ds-zoom__btn" title="Centrar lienzo" onClick={centerPage}>
          ◎
        </button>
      </div>

      <div className="ds-page-wrap">
        <div
          ref={pageRef}
          className="ds-viewport"
          tabIndex={0}
          aria-label={`Vista del navegador de ${pageWidth} por ${pageHeight} píxeles. Usa las flechas para mover el elemento seleccionado, Supr para eliminarlo y Escape para quitar la selección.`}
          onKeyDown={handleCanvasKeyDown}
          style={{ width: pageWidth, height: pageHeight, maxWidth: "none", transform: `scale(${zoom})`, backgroundColor: "#fff", color: "#111", colorScheme: "light" }}
          onPointerDown={() => designer.setSelectedId(null)}
          onPointerUp={() => {
            if (draggingId !== null) {
              handleDrop(draggingId);
            }
          }}
        >
          <style>{scopedCss}</style>
          <div className="ds-page">
            <CanvasBoundary>
              {designer.canvasNodes.map((node) => (
                <NodeView
                  key={node.id}
                  node={node}
          cssText={designer.cssText}
                  selectedId={designer.selectedId}
                  dropTargetId={dropTargetId}
                  draggingId={draggingId}
                  dragActive={dragActive}
                dragDelta={dragDelta}
                dragDisplay={dragDisplay}
                  onSelect={selectOnCanvas}
                  onDragStart={beginPress}
                  onDragEnter={setDropTargetId}
                  onDragLeave={() => setDropTargetId(null)}
                  onDrop={handleDrop}
                />
              ))}
            </CanvasBoundary>
            {empty && (
              <div className="ds-empty-hint">
                <p className="ds-empty-hint__title">Canvas vacío</p>
                <p className="ds-empty-hint__sub">Usa la paleta para añadir el primer elemento</p>
              </div>
            )}
          </div>
          {paletteDropPoint !== null && (
            <div className="ds-palette-drop-marker" style={{ left: paletteDropPoint.x, top: paletteDropPoint.y }} aria-hidden="true">
              <span>Soltar en {paletteDropLabel}</span>
            </div>
          )}
          {resizeBounds !== null && designer.selectedNode?.kind === "element" && (
            <>
              <span
                className="ds-selection-label"
                style={{ left: resizeBounds.left, top: resizeBounds.top - 20 }}
                aria-hidden="true"
              >
                &lt;{designer.selectedNode.tag}&gt;
              </span>
              <div
                className="ds-resize-overlay"
                aria-label={`Redimensionar <${designer.selectedNode.tag}>`}
                style={{ left: resizeBounds.left, top: resizeBounds.top, width: resizeBounds.width, height: resizeBounds.height }}
              >
                <button type="button" className="ds-resize-handle ds-resize-handle--e" aria-label="Cambiar ancho" title="Arrastra para cambiar el ancho" onPointerDown={(event) => beginResize(event, "x")} />
                <button type="button" className="ds-resize-handle ds-resize-handle--s" aria-label="Cambiar alto" title="Arrastra para cambiar el alto" onPointerDown={(event) => beginResize(event, "y")} />
                <button type="button" className="ds-resize-handle ds-resize-handle--se" aria-label="Cambiar ancho y alto" title="Arrastra para cambiar ancho y alto" onPointerDown={(event) => beginResize(event, "xy")} />
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default DesignCanvas;
