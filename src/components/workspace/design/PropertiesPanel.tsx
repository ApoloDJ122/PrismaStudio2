import { useEffect, useId, useState } from "react";

import { classList } from "../../../designer/tree";
import { isSimpleTextElement, nodeText } from "../../../designer/visual";
import { attributeHelp, tagInfo } from "../../../designer/catalog";
import { BOOLEAN_ATTRIBUTE_NAMES, GLOBAL_ATTRIBUTES, hasSpecificAttributeCatalog, tagSpecificAttributes, type AttributeDefinition } from "../../../designer/propertyCatalog";
import type { DesignerState } from "../../../hooks/useDesigner";
import { ContextHelp } from "./ContextHelp";
import { StyleEditor } from "./StyleEditor";
import "./design.css";

interface Props {
  designer: DesignerState;
  onLocateCode?: (path: string, line: number) => void;
}

type InspectorTab = "styles" | "html" | "code" | "actions";

/** Campo que confirma con Enter o al salir. */
function TextField({
  label,
  value,
  placeholder,
  title,
  help,
  inputType = "text",
  onReset,
  onCommit,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  title?: string;
  help?: string;
  inputType?: "text" | "number";
  onReset?: () => void;
  onCommit: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  return (
    <div className="ds-field" title={title}>
      <label className="ds-field__label" htmlFor={id}>{label}</label>
      {help && <ContextHelp title={label} description={help} />}
      <input
        id={id}
        className="ds-field__input"
        type={inputType}
        value={draft}
        placeholder={placeholder ?? ""}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== (value ?? "")) {
            onCommit(draft);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {onReset && <button type="button" className="ds-mini-btn" aria-label={`Restablecer ${label} al valor heredado`} title="Restablecer al valor general" onMouseDown={(event) => event.preventDefault()} onClick={onReset}>↶</button>}
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="ds-acc" open={defaultOpen || undefined}>
      <summary className="ds-acc__head">{title}</summary>
      <div className="ds-acc__body">{children}</div>
    </details>
  );
}

function CatalogAttributeField({ tag, definition, value, onSet, onRemove }: {
  tag: string; definition: AttributeDefinition; value: string | null; onSet: (name: string, value: string) => void; onRemove: (name: string) => void;
}) {
  const id = useId();
  const name = definition.name;
  const help = tag === "abbr" && name === "title"
    ? "Expansión o explicación de la abreviatura; algunos navegadores la muestran como texto auxiliar."
    : definition.help;
  if (definition.control === "boolean" || BOOLEAN_ATTRIBUTE_NAMES.has(name)) {
    return <div className="ds-field"><label className="ds-field__label" htmlFor={id}>{definition.label}</label>
      <ContextHelp title={`${definition.label} (${name})`} description={help} />
      <input id={id} type="checkbox" checked={value !== null} onChange={(event) => event.target.checked ? onSet(name, "") : onRemove(name)} />
    </div>;
  }
  if (definition.control === "select") {
    const options = definition.options ?? [];
    return <div className="ds-field"><label className="ds-field__label" htmlFor={id}>{definition.label}</label>
      <ContextHelp title={`${definition.label} (${name})`} description={help} />
      <select id={id} className="ds-field__input" value={value ?? ""} onChange={(event) => event.target.value === "" ? onRemove(name) : onSet(name, event.target.value)}>
        <option value="">Sin atributo</option>
        {value !== null && value !== "" && !options.includes(value) && <option value={value}>{value} (valor actual)</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>;
  }
  const numeric = definition.control === "number" && (value === null || /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value));
  return (
    <TextField key={`${tag}:${name}`} label={definition.label} value={value} help={help || attributeHelp(tag, name)} inputType={numeric ? "number" : "text"} placeholder={definition.control === "number" ? "Número" : ""} onCommit={(next) => onSet(name, next)} />
  );
}

export function PropertiesPanel({ designer, onLocateCode }: Props) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("styles");
  const [newAttributeName, setNewAttributeName] = useState("");
  const [newAttributeValue, setNewAttributeValue] = useState("");
  const node = designer.selectedNode;

  if (node === null) {
    return (
      <div className="ds-side">
        <Section title="Inspector">
          <p className="ds-hint">Selecciona un elemento del lienzo o la jerarquía.</p>
        </Section>
      </div>
    );
  }

  const isElement = node.kind === "element" && node.tag !== null;
  const canEditText = isElement && isSimpleTextElement(node);
  const cssLine =
    designer.cssTarget?.kind === "external"
      ? designer.cssTarget.href
      : designer.cssTarget?.kind === "internal"
        ? "<style> interno"
        : "sin hoja";
  const elementInfo = isElement && node.tag !== null ? tagInfo(node.tag) : null;
  const sourcePath = node.origin.path ?? designer.document?.filePath ?? null;
  const htmlId = isElement ? node.attributes.find((a) => a.name.toLowerCase() === "id")?.value : null;
  const htmlClasses = isElement ? classList(node).join(" ") : "";
  const tag = isElement ? node.tag!.toLowerCase() : "";
  const hasTagCatalog = isElement && hasSpecificAttributeCatalog(tag);
  const commonAttributeNames = new Set(GLOBAL_ATTRIBUTES.map((item) => item.name.toLowerCase()));
  const specificAttributes = isElement ? tagSpecificAttributes(tag, node.attributes).filter((item) => !commonAttributeNames.has(item.name.toLowerCase())) : [];
  const specificAttributeNames = new Set(specificAttributes.map((item) => item.name.toLowerCase()));
  const duplicateNewAttribute = node.attributes.some((item) => item.name.toLowerCase() === newAttributeName.trim().toLowerCase());

  return (
    <div className="ds-side">
      <header className="ds-inspector__identity">
        <p className="ds-element-name">
          {elementInfo ? <>{elementInfo.label} <span className="ds-tree__original">&lt;{node.tag}&gt;</span><ContextHelp title={elementInfo.label} description={elementInfo.description} example={elementInfo.example} /></> : node.kind}
        </p>
        {htmlId && <p className="ds-inspector__meta"><span>ID</span> #{htmlId}</p>}
        {htmlClasses && <p className="ds-inspector__meta"><span>Clases</span> {htmlClasses.split(/\s+/).map((name) => `.${name}`).join(" ")}</p>}
        <p className="ds-css-line" title="Hoja donde se escribe el CSS de este elemento">{cssLine}</p>
      </header>

      <nav className="ds-inspector__tabs" role="tablist" aria-label="Propiedades del elemento">
        {([
          ["styles", "Estilos"], ["html", "HTML"], ["code", "Código"], ["actions", "Acciones"],
        ] as const).map(([tab, label]) => (
          <button key={tab} type="button" role="tab" aria-selected={activeTab === tab}
            className={`ds-inspector__tab${activeTab === tab ? " ds-inspector__tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}>{label}</button>
        ))}
      </nav>

      <div className="ds-inspector__content" role="tabpanel" aria-label={activeTab === "html" ? "HTML y atributos" : activeTab === "code" ? "Código" : activeTab === "actions" ? "Acciones" : "Estilos"}>
      {activeTab === "html" && <>
      {canEditText && (
        <Section title="Texto">
          <TextField
            label="Contenido"
            value={nodeText(node)}
            help="Texto que contiene el elemento. Solo se puede editar aquí cuando el elemento tiene texto simple y no hijos o contenido dinámico que pudiera perderse."
            onCommit={(value) => designer.updateText(node.id, value)}
          />
        </Section>
      )}

      {isElement && (
        <Section title="General">
          <TextField
            label="ID"
            value={node.attributes.find((a) => a.name.toLowerCase() === "id")?.value ?? null}
            help={attributeHelp(node.tag!, "id")}
            placeholder="—"
            onCommit={(value) => designer.setNodeAttr(node.id, "id", value)}
          />
          <TextField
            label="Clase"
            value={classList(node).join(" ") || null}
            placeholder="—"
            title="La regla propia se escribe en la primera clase única"
            help={attributeHelp(node.tag!, "class")}
            onCommit={(value) => designer.setNodeAttr(node.id, "class", value)}
          />
          {GLOBAL_ATTRIBUTES.map((definition) => <CatalogAttributeField key={definition.name} tag={tag} definition={definition}
            value={node.attributes.find((item) => item.name.toLowerCase() === definition.name)?.value ?? null}
            onSet={(name, value) => definition.control === "boolean" ? designer.setBooleanAttr(node.id, name, true) : designer.setNodeAttr(node.id, name, value)}
            onRemove={(name) => designer.removeNodeAttr(node.id, name)} />)}
        </Section>
      )}

      {isElement && node.tag !== null && specificAttributes.length > 0 && (
        <Section title={`Propiedades específicas · <${node.tag}>`} defaultOpen={false}>
          {specificAttributes.map((definition) => <CatalogAttributeField key={definition.name} tag={tag} definition={definition}
            value={node.attributes.find((item) => item.name.toLowerCase() === definition.name)?.value ?? null}
            onSet={(name, value) => definition.control === "boolean" ? designer.setBooleanAttr(node.id, name, true) : designer.setNodeAttr(node.id, name, value)}
            onRemove={(name) => designer.removeNodeAttr(node.id, name)} />)}
          {tag === "input" && <p className="ds-hint">Campos mostrados para type="{(node.attributes.find((item) => item.name.toLowerCase() === "type")?.value ?? "text")}". Cambiar el tipo solo cambia el panel; no borra otros atributos.</p>}
        </Section>
      )}

      {isElement && tag === "picture" && <Section title="Fuentes adaptables">
        <p className="ds-hint">Selecciona los elementos &lt;source&gt; y &lt;img&gt; hijos en el árbol para editar sus recursos y condiciones. Prisma conserva el orden y la estructura de &lt;picture&gt;.</p>
      </Section>}

      {isElement && node.tag !== null && (
        <Section title="Atributos avanzados" defaultOpen={false}>
          {!hasTagCatalog && <p className="ds-hint">Elemento personalizado o etiqueta sin catálogo específico: se conservan sus propiedades reales y se editan de forma genérica.</p>}
          <p className="ds-hint">Incluye atributos data-*, aria-*, eventos y extensiones. Los valores se editan como texto; Prisma no ejecuta manejadores ni scripts.</p>
          {node.attributes
            .filter((attribute) => ![
              "id", "class", "style",
              ...[...commonAttributeNames, ...specificAttributeNames],
            ].includes(attribute.name.toLowerCase()))
            .map((attribute) => (
              <div className="ds-field-row" key={attribute.name}>
                <CatalogAttributeField tag={node.tag!} definition={{ name: attribute.name, label: attribute.name, help: attributeHelp(node.tag!, attribute.name), control: BOOLEAN_ATTRIBUTE_NAMES.has(attribute.name.toLowerCase()) ? "boolean" : "text" }}
                  value={attribute.value} onSet={(name, value) => BOOLEAN_ATTRIBUTE_NAMES.has(name.toLowerCase()) ? designer.setBooleanAttr(node.id, name, true) : designer.setNodeAttr(node.id, name, value)} onRemove={(name) => designer.removeNodeAttr(node.id, name)} />
                <button type="button" className="ds-mini-btn ds-mini-btn--danger" aria-label={`Quitar ${attribute.name}`} onClick={() => designer.removeNodeAttr(node.id, attribute.name)}>×</button>
              </div>
            ))}
          <div className="ds-field">
            <span className="ds-field__label">Nombre</span>
            <ContextHelp title="Nombre del atributo" description="Nombre HTML adicional, como data-estado o aria-label. Prisma conserva el nombre en el marcado." />
            <input className="ds-field__input" value={newAttributeName} onChange={(event) => setNewAttributeName(event.target.value)} placeholder="data-estado" />
          </div>
          <div className="ds-field">
            <span className="ds-field__label">Valor</span>
            <ContextHelp title={`Valor de ${newAttributeName || "atributo"}`} description={newAttributeName ? attributeHelp(node.tag!, newAttributeName) : "Valor almacenado en el atributo; su significado depende del nombre y de la etiqueta."} />
            <input className="ds-field__input" value={newAttributeValue} onChange={(event) => setNewAttributeValue(event.target.value)} />
          </div>
          <button
            type="button"
            className="ds-mini-btn"
            disabled={newAttributeName.trim() === "" || duplicateNewAttribute || !/^[a-z_:][a-z0-9:._-]*$/i.test(newAttributeName.trim())}
            onClick={() => {
              const name = newAttributeName.trim();
              if (BOOLEAN_ATTRIBUTE_NAMES.has(name.toLowerCase())) designer.setBooleanAttr(node.id, name, true);
              else designer.setNodeAttr(node.id, name, newAttributeValue);
              setNewAttributeName("");
              setNewAttributeValue("");
            }}
          >Añadir atributo</button>
          {duplicateNewAttribute && <p className="ds-hint">Ese atributo ya existe; edítalo en la lista para evitar duplicados.</p>}
          {node.attributes.some((item) => /^on/i.test(item.name)) && <p className="ds-hint">Los atributos de evento existentes se conservan y no se ejecutan durante la edición.</p>}
        </Section>
      )}
      </>}

      {activeTab === "styles" && isElement && <StyleEditor key={node.id} designer={designer} node={node} box={designer.nodeBox(node.id)} parentId={node.parentId ?? designer.containerId} />}

      {activeTab === "code" && (
        <Section title="Código del elemento">
          <p className="ds-hint">Fragmento conservado por el diseñador. Para editar el documento completo, ábrelo en el editor principal.</p>
          <pre className="ds-inspector__source">{node.source || node.content || "(sin fragmento de código disponible)"}</pre>
          <p className="ds-inspector__meta">{sourcePath ?? "Documento actual"}{node.origin.line > 0 ? ` · línea ${node.origin.line}` : ""}</p>
          {onLocateCode && sourcePath !== null && (
            <button type="button" className="ds-mini-btn" onClick={() => onLocateCode(sourcePath, node.origin.line || 1)}>
              {designer.hasUnappliedChanges ? "Aplicar y abrir en código" : "Abrir en el editor"}
            </button>
          )}
        </Section>
      )}

      {activeTab === "actions" && <Section title="Acciones">
        <div className="ds-actions">
          {isElement && (
            <>
              <button
                type="button"
                className="ds-mini-btn"
                onClick={() => designer.duplicateNode(node.id)}
              >
                Duplicar
              </button>
              <button
                type="button"
                className="ds-mini-btn"
                onClick={() => designer.reorder(node.id, "up")}
              >
                Subir
              </button>
              <button
                type="button"
                className="ds-mini-btn"
                onClick={() => designer.reorder(node.id, "down")}
              >
                Bajar
              </button>
            </>
          )}
          <button
            type="button"
            className="ds-mini-btn ds-mini-btn--danger"
            onClick={() => designer.deleteNode(node.id)}
          >
            Eliminar
          </button>
        </div>
      </Section>}

      {designer.error !== null && (
        <p className="ds-error" role="alert">
          {designer.error}
        </p>
      )}
      </div>
    </div>
  );
}

export default PropertiesPanel;
