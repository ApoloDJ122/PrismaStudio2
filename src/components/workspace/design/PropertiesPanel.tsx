import { useEffect, useState } from "react";

import { designClassOf } from "../../../designer/class";
import { classList } from "../../../designer/tree";
import { isSimpleTextElement, nodeText } from "../../../designer/visual";
import type { DesignerState } from "../../../hooks/useDesigner";
import "./design.css";

interface Props {
  designer: DesignerState;
}

/** Campo que confirma con Enter o al salir. */
function TextField({
  label,
  value,
  placeholder,
  title,
  onCommit,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  title?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  return (
    <label className="ds-field" title={title}>
      <span className="ds-field__label">{label}</span>
      <input
        className="ds-field__input"
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
    </label>
  );
}

/** Campo numérico (px) que confirma con Enter o al salir. */
function NumberField({
  label,
  value,
  title,
  onCommit,
}: {
  label: string;
  value: number | null;
  title?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  return (
    <label className="ds-field" title={title}>
      <span className="ds-field__label">{label}</span>
      <input
        className="ds-field__input"
        type="number"
        value={draft}
        placeholder="auto"
        // La rueda sobre un number cambia su valor y roba el scroll del panel:
        // al soltar el foco la rueda vuelve a desplazar.
        onWheel={(e) => {
          (e.target as HTMLInputElement).blur();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const current = value === null ? "" : String(value);
          if (draft !== current && draft.trim() !== "") {
            onCommit(draft.trim());
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onCommit,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  onCommit: (value: string) => void;
}) {
  return (
    <label className="ds-field">
      <span className="ds-field__label">{label}</span>
      <select className="ds-field__input" value={value ?? ""} onChange={(event) => onCommit(event.target.value)}>
        <option value="">Automático</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
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

const STYLE_FIELDS: { property: string; label: string; options?: readonly string[]; placeholder?: string }[] = [
  { property: "display", label: "Display", options: ["block", "flex", "inline-flex", "grid", "inline-grid", "inline", "inline-block", "none"] },
  { property: "position", label: "Position" },
  { property: "text-align", label: "Alineación", options: ["left", "center", "right", "justify"] },
  { property: "margin", label: "Margin", placeholder: "0 16px" },
  { property: "padding", label: "Padding", placeholder: "12px 16px" },
  { property: "border", label: "Borde" },
  { property: "border-radius", label: "Radio" },
  { property: "color", label: "Color" },
  { property: "background-color", label: "Fondo" },
  { property: "font-size", label: "Fuente" },
  { property: "gap", label: "Separación", placeholder: "8px" },
  { property: "align-items", label: "Alinear items", options: ["stretch", "flex-start", "center", "flex-end", "baseline"] },
  { property: "justify-content", label: "Distribución", options: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"] },
];

const ATTRIBUTES_BY_TAG: Record<string, { name: string; label: string }[]> = {
  a: [{ name: "href", label: "Destino" }, { name: "target", label: "Ventana" }, { name: "rel", label: "Relación" }],
  img: [{ name: "src", label: "Origen" }, { name: "alt", label: "Texto alternativo" }, { name: "width", label: "Ancho" }, { name: "height", label: "Alto" }],
  input: [{ name: "type", label: "Tipo" }, { name: "name", label: "Nombre" }, { name: "value", label: "Valor" }, { name: "placeholder", label: "Placeholder" }],
  button: [{ name: "type", label: "Tipo" }, { name: "name", label: "Nombre" }, { name: "value", label: "Valor" }],
  textarea: [{ name: "name", label: "Nombre" }, { name: "placeholder", label: "Placeholder" }, { name: "rows", label: "Filas" }, { name: "cols", label: "Columnas" }],
  form: [{ name: "action", label: "Destino" }, { name: "method", label: "Método" }],
  video: [{ name: "src", label: "Origen" }, { name: "poster", label: "Portada" }, { name: "width", label: "Ancho" }, { name: "height", label: "Alto" }],
  audio: [{ name: "src", label: "Origen" }],
};

const BOOLEAN_ATTRIBUTES_BY_TAG: Record<string, { name: string; label: string }[]> = {
  input: [{ name: "required", label: "Obligatorio" }, { name: "disabled", label: "Desactivado" }, { name: "checked", label: "Marcado" }],
  button: [{ name: "disabled", label: "Desactivado" }],
  textarea: [{ name: "required", label: "Obligatorio" }, { name: "disabled", label: "Desactivado" }],
  select: [{ name: "required", label: "Obligatorio" }, { name: "multiple", label: "Selección múltiple" }, { name: "disabled", label: "Desactivado" }],
  video: [{ name: "controls", label: "Controles" }, { name: "muted", label: "Silenciado" }, { name: "loop", label: "Repetir" }],
  audio: [{ name: "controls", label: "Controles" }, { name: "muted", label: "Silenciado" }, { name: "loop", label: "Repetir" }],
};

export function PropertiesPanel({ designer }: Props) {
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
  const designClass = isElement ? designClassOf(designer.roots, node) : null;
  const box = designer.nodeBox(node.id);
  const canEditText = isElement && isSimpleTextElement(node);
  const parentId = node.parentId ?? designer.containerId;
  const cssLine =
    designer.cssTarget?.kind === "external"
      ? designer.cssTarget.href
      : designer.cssTarget?.kind === "internal"
        ? "<style> interno"
        : "sin hoja";

  return (
    <div className="ds-side">
      <Section title="Propiedades">
        <p className="ds-element-name">
          {node.kind === "element" ? node.tag : node.kind}
          {designClass !== null && <span className="ds-element-class">.{designClass}</span>}
        </p>
        <p className="ds-css-line" title="Hoja donde se escribe el CSS de este elemento">
          {cssLine}
        </p>
      </Section>

      {canEditText && (
        <Section title="Texto">
          <TextField
            label="Contenido"
            value={nodeText(node)}
            onCommit={(value) => designer.updateText(node.id, value)}
          />
        </Section>
      )}

      {isElement && (
        <Section title="Identificación">
          <TextField
            label="ID"
            value={node.attributes.find((a) => a.name.toLowerCase() === "id")?.value ?? null}
            placeholder="—"
            onCommit={(value) => designer.setNodeAttr(node.id, "id", value)}
          />
          <TextField
            label="Clase"
            value={classList(node).join(" ") || null}
            placeholder="—"
            title="La regla propia se escribe en la primera clase única"
            onCommit={(value) => designer.setNodeAttr(node.id, "class", value)}
          />
        </Section>
      )}

      {isElement && node.tag !== null && (
        <Section title="Atributos HTML">
          {[...(ATTRIBUTES_BY_TAG[node.tag.toLowerCase()] ?? []),
            { name: "title", label: "Título" },
            { name: "aria-label", label: "Etiqueta accesible" },
          ].map((attribute) => (
            <TextField
              key={attribute.name}
              label={attribute.label}
              value={node.attributes.find((item) => item.name.toLowerCase() === attribute.name)?.value ?? null}
              placeholder="—"
              onCommit={(value) => designer.setNodeAttr(node.id, attribute.name, value)}
            />
          ))}
          {(BOOLEAN_ATTRIBUTES_BY_TAG[node.tag.toLowerCase()] ?? []).map((attribute) => (
            <label className="ds-field" key={attribute.name}>
              <span className="ds-field__label">{attribute.label}</span>
              <input
                type="checkbox"
                checked={node.attributes.some((item) => item.name.toLowerCase() === attribute.name)}
                onChange={(event) => designer.setBooleanAttr(node.id, attribute.name, event.target.checked)}
              />
            </label>
          ))}
        </Section>
      )}

      {isElement && (
        <Section title="Disposición">
          <div className="ds-field-row">
            <NumberField
              label="X"
              value={box?.x ?? null}
              title="Distancia al borde izquierdo del contenedor"
              onCommit={(value) =>
                designer.moveNode(node.id, parentId, Number(value), box?.y ?? 0)
              }
            />
            <NumberField
              label="Y"
              value={box?.y ?? null}
              title="Distancia al borde superior del contenedor"
              onCommit={(value) =>
                designer.moveNode(node.id, parentId, box?.x ?? 0, Number(value))
              }
            />
          </div>
          <div className="ds-field-row">
            <TextField
              label="Ancho"
              value={designer.nodeStyle(node.id, "width")}
              placeholder="auto"
              onCommit={(value) => designer.setNodeStyle(node.id, "width", value)}
            />
            <TextField
              label="Alto"
              value={designer.nodeStyle(node.id, "height")}
              placeholder="auto"
              onCommit={(value) => designer.setNodeStyle(node.id, "height", value)}
            />
          </div>
        </Section>
      )}

      {isElement && (
        <Section title="Estilos" defaultOpen={false}>
          {STYLE_FIELDS.map((field) => (
            field.options ? (
              <SelectField
                key={field.property}
                label={field.label}
                value={designer.nodeStyle(node.id, field.property)}
                options={field.options}
                onCommit={(value) => designer.setNodeStyle(node.id, field.property, value)}
              />
            ) : (
              <TextField
                key={field.property}
                label={field.label}
                value={designer.nodeStyle(node.id, field.property)}
                placeholder={field.placeholder ?? "—"}
                onCommit={(value) => designer.setNodeStyle(node.id, field.property, value)}
              />
            )
          ))}
        </Section>
      )}

      <Section title="Acciones" defaultOpen={false}>
        <div className="ds-actions">
          {isElement && (
            <>
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
      </Section>

      {designer.error !== null && (
        <p className="ds-error" role="alert">
          {designer.error}
        </p>
      )}
    </div>
  );
}

export default PropertiesPanel;
