import { useEffect, useId, useState } from "react";

import { cssPropertyHelp } from "../../../designer/catalog";
import { CSS_RECOMMENDED_BY_TAG, CSS_RECOMMENDED_OPTIONS } from "../../../designer/propertyCatalog";
import type { PrismaNode } from "../../../designer/types";
import type { DesignerState } from "../../../hooks/useDesigner";
import { ContextHelp } from "./ContextHelp";

interface Props {
  designer: DesignerState;
  node: PrismaNode;
  box: { x: number; y: number } | null;
  parentId: string | null;
}

type Field = { property: string; label: string; options?: readonly string[]; kind?: "color" | "length" | "number" | "opacity"; placeholder?: string };
const lengthUnits = ["px", "%", "rem", "em", "vw", "vh", "vmin", "vmax", "dvw", "dvh", "ch", "ex", "cm", "mm", "in", "pt", "pc"] as const;
const lengthPattern = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(px|%|rem|em|vw|vh|vmin|vmax|dvw|dvh|ch|ex|cm|mm|in|pt|pc)?$/i;
function parseLength(value: string | null) {
  if (value === null) return { number: "", unit: "px" };
  const match = lengthPattern.exec(value.trim());
  return match ? { number: match[1], unit: (match[2] ?? "px").toLowerCase() } : null;
}
function colorPickerValue(value: string | null) {
  const hex = value?.trim();
  if (!hex || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return "#000000";
  return hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
}

const groups: { title: string; fields: Field[] }[] = [
  { title: "Dimensiones", fields: [
    { property: "width", label: "Ancho", kind: "length", placeholder: "auto" }, { property: "height", label: "Alto", kind: "length", placeholder: "auto" },
    { property: "min-width", label: "Ancho mínimo", kind: "length" }, { property: "max-width", label: "Ancho máximo", kind: "length" },
    { property: "min-height", label: "Alto mínimo", kind: "length" }, { property: "max-height", label: "Alto máximo", kind: "length" },
  ] },
  { title: "Apariencia", fields: [
    { property: "color", label: "Color del texto", kind: "color" }, { property: "background-color", label: "Fondo", kind: "color" },
    { property: "opacity", label: "Opacidad", kind: "opacity" }, { property: "background-repeat", label: "Repetición del fondo", options: ["repeat", "no-repeat", "repeat-x", "repeat-y", "space", "round"] },
    { property: "background-position", label: "Posición del fondo", options: ["center", "top", "right", "bottom", "left", "center center", "top left", "top right", "bottom left", "bottom right"] },
    { property: "background-size", label: "Tamaño del fondo", options: ["auto", "cover", "contain"] },
    { property: "object-fit", label: "Ajuste de imagen", options: ["fill", "contain", "cover", "none", "scale-down"] },
    { property: "object-position", label: "Posición de imagen", options: ["center", "top", "right", "bottom", "left", "top left", "top right", "bottom left", "bottom right"] },
    { property: "border-color", label: "Color del borde", kind: "color" },
    { property: "border-width", label: "Grosor del borde", kind: "length" }, { property: "border-style", label: "Estilo del borde", options: ["none", "solid", "dashed", "dotted", "double"] },
    { property: "border-radius", label: "Radio", kind: "length" }, { property: "box-shadow", label: "Sombra", options: ["none", "0 1px 2px rgba(0, 0, 0, 0.15)", "0 2px 8px rgba(0, 0, 0, 0.2)", "0 4px 16px rgba(0, 0, 0, 0.25)", "0 0 0 1px currentColor"] },
  ] },
  { title: "Tipografía", fields: [
    { property: "font-family", label: "Familia", options: ["Arial, sans-serif", "Georgia, serif", "Verdana, sans-serif", "Tahoma, sans-serif", "'Trebuchet MS', sans-serif", "'Times New Roman', serif", "'Courier New', monospace", "system-ui, sans-serif", "monospace", "serif", "sans-serif"] }, { property: "font-size", label: "Tamaño", kind: "length" },
    { property: "font-style", label: "Estilo de fuente", options: ["normal", "italic", "oblique"] },
    { property: "font-weight", label: "Grosor", options: ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"] },
    { property: "text-align", label: "Alineación", options: ["left", "center", "right", "justify", "start", "end"] },
    { property: "text-decoration", label: "Decoración", options: ["none", "underline", "overline", "line-through", "underline overline"] },
    { property: "text-transform", label: "Transformación", options: ["none", "capitalize", "uppercase", "lowercase"] },
    { property: "white-space", label: "Espacios y salto", options: ["normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"] },
    { property: "text-overflow", label: "Desborde de texto", options: ["clip", "ellipsis"] },
    { property: "line-height", label: "Altura de línea", kind: "number" },
    { property: "letter-spacing", label: "Espaciado entre letras", kind: "length" },
  ] },
  { title: "Distribución", fields: [
    { property: "display", label: "Display", options: ["block", "flex", "inline-flex", "grid", "inline-grid", "inline", "inline-block", "none"] },
    { property: "position", label: "Position", options: ["static", "relative", "absolute", "fixed", "sticky"] },
    { property: "top", label: "Arriba", kind: "length" }, { property: "right", label: "Derecha", kind: "length" }, { property: "bottom", label: "Abajo", kind: "length" }, { property: "left", label: "Izquierda", kind: "length" },
    { property: "z-index", label: "Z-index", kind: "number" }, { property: "overflow", label: "Desbordamiento", options: ["visible", "hidden", "auto", "scroll", "clip"] },
    { property: "visibility", label: "Visibilidad", options: ["visible", "hidden", "collapse"] }, { property: "box-sizing", label: "Modelo de caja", options: ["content-box", "border-box"] },
    { property: "cursor", label: "Cursor", options: ["auto", "default", "pointer", "text", "move", "grab", "not-allowed", "wait", "crosshair", "help"] },
    { property: "pointer-events", label: "Eventos del puntero", options: ["auto", "none"] },
    { property: "gap", label: "Separación", kind: "length" }, { property: "align-items", label: "Alinear items", options: ["stretch", "flex-start", "center", "flex-end", "baseline"] },
    { property: "align-content", label: "Alinear contenido", options: ["stretch", "center", "flex-start", "flex-end", "space-between", "space-around"] },
    { property: "justify-content", label: "Distribución", options: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"] },
    { property: "flex-direction", label: "Dirección", options: ["row", "row-reverse", "column", "column-reverse"] },
    { property: "flex-wrap", label: "Ajuste flex", options: ["nowrap", "wrap", "wrap-reverse"] },
    { property: "flex-grow", label: "Crecimiento", kind: "number" }, { property: "flex-shrink", label: "Reducción", kind: "number" }, { property: "flex-basis", label: "Base flex", kind: "length" },
    { property: "grid-template-columns", label: "Columnas grid", options: ["1fr", "repeat(2, 1fr)", "repeat(3, 1fr)", "repeat(4, 1fr)", "repeat(auto-fit, minmax(200px, 1fr))"] },
    { property: "grid-template-rows", label: "Filas grid", options: ["auto", "1fr", "repeat(2, 1fr)", "repeat(3, 1fr)"] },
  ] },
];

const recommendedProperties = new Set(Object.values(CSS_RECOMMENDED_BY_TAG).flat());
const knownProperties = new Set([...groups.flatMap((group) => group.fields.map((field) => field.property)), ...recommendedProperties, "margin", "padding", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left"]);
const cssLabels: Readonly<Record<string, string>> = {
  "text-underline-offset": "Desplazamiento del subrayado", "aspect-ratio": "Proporción", "border-collapse": "Bordes de tabla",
  "border-spacing": "Separación de celdas", "table-layout": "Distribución de tabla", "caption-side": "Posición del título",
  "accent-color": "Color de controles", "caret-color": "Color del cursor de texto", "list-style-type": "Marcador de lista",
  "list-style-position": "Posición del marcador", "list-style-image": "Imagen del marcador", inset: "Desplazamiento interior",
};

function ValueField({
  designer, nodeId, field,
}: { designer: DesignerState; nodeId: string; field: Field }) {
  const value = designer.responsiveCondition
    ? designer.responsiveNodeStyle(nodeId, field.property)
    : designer.nodeStyle(nodeId, field.property);
  const inheritedHint = designer.responsiveCondition ? designer.nodeStyle(nodeId, field.property) : null;
  const explicit = value !== null;
  const inlineValue = designer.nodeInlineStyle(nodeId, field.property);
  const shorthandByProperty: Record<string, string> = {
    "margin-top": "margin", "margin-right": "margin", "margin-bottom": "margin", "margin-left": "margin",
    "padding-top": "padding", "padding-right": "padding", "padding-bottom": "padding", "padding-left": "padding",
    "background-color": "background", "border-color": "border", "border-width": "border", "border-style": "border",
    "font-family": "font", "font-size": "font", "font-weight": "font", "font-style": "font", "line-height": "font",
  };
  const inlineProperties = designer.nodeInlineDeclarations(nodeId).map((item) => item.property);
  const inlineShorthand = shorthandByProperty[field.property];
  const blockedByInline = (designer.responsiveCondition !== null && inlineValue !== null)
    || (inlineValue === null && inlineShorthand !== undefined && inlineProperties.includes(inlineShorthand));
  const blockedWithoutSelector = designer.styleSelector(nodeId) === null && inlineValue === null;
  const blocked = blockedByInline || blockedWithoutSelector;
  const canUseSelect = field.options !== undefined && (value === null || field.options.includes(value));
  const kind = field.kind ?? (/^(?:color|.*-color)$/.test(field.property) ? "color"
    : /(?:^|[-])(width|height|radius|size|gap|spacing|offset|basis)$/.test(field.property) ? "length" : undefined);
  const parsedLength = kind === "length" ? parseLength(value) : null;
  const opacityValue = value !== null && /^\d*\.?\d+$/.test(value.trim()) && Number(value) >= 0 && Number(value) <= 1 ? Number(value) : null;
  const numberValue = value !== null && /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) ? value.trim() : "";
  const id = useId();
  const [draft, setDraft] = useState(value ?? "");
  const [numberDraft, setNumberDraft] = useState(numberValue);
  const [lengthNumber, setLengthNumber] = useState(parsedLength?.number ?? "");
  const [lengthUnit, setLengthUnit] = useState(parsedLength?.unit ?? "px");
  useEffect(() => setDraft(value ?? ""), [value]);
  useEffect(() => setNumberDraft(numberValue), [numberValue]);
  useEffect(() => {
    const parsed = parseLength(value);
    setLengthNumber(parsed?.number ?? "");
    setLengthUnit(parsed?.unit ?? "px");
  }, [value]);
  const commit = () => {
    if (draft.trim() !== (value ?? "")) designer.setNodeStyle(nodeId, field.property, draft.trim());
  };
  return (
    <div className="ds-field">
      <label className="ds-field__label" htmlFor={id}>{field.label}</label>
      <ContextHelp title={`${field.label} (${field.property})`} description={`${cssPropertyHelp(field.property)} Valor declarado directamente en el selector del elemento; no es un valor calculado del navegador.`} />
      {canUseSelect ? (
        <select id={id} className="ds-field__input" value={value ?? ""} disabled={blocked} onChange={(event) => designer.setNodeStyle(nodeId, field.property, event.target.value)}>
          <option value="">Sin declaración propia</option>
          {field.options!.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input id={id} className="ds-field__input" value={draft} disabled={blocked} placeholder={inheritedHint ? `Base: ${inheritedHint}` : field.placeholder ?? "Sin declaración"}
          onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }} />
      )}
      {kind === "color" && <label className="ds-color-control" title={value === null ? "Elegir color crea la declaración CSS" : "Elegir un color reemplaza el valor CSS actual"}>
        <input aria-label={`Selector de ${field.label}`} type="color" disabled={blocked} value={colorPickerValue(value)} onChange={(event) => designer.setNodeStyle(nodeId, field.property, event.target.value)} />
        <span>Elegir color</span>
      </label>}
      {field.kind === "length" && <div className="ds-length-control">
        <input aria-label={`${field.label} numérico`} className="ds-field__input" type="number" step="any" disabled={blocked || parsedLength === null} value={lengthNumber}
          placeholder={parsedLength === null ? "CSS personalizado" : "Valor"} onChange={(event) => setLengthNumber(event.target.value)}
          onBlur={() => { if (lengthNumber.trim() !== "" && Number.isFinite(Number(lengthNumber))) designer.setNodeStyle(nodeId, field.property, `${lengthNumber}${lengthUnit}`); }} />
        <select aria-label={`Unidad de ${field.label}`} className="ds-field__input" disabled={blocked || parsedLength === null} value={lengthUnit}
          onChange={(event) => { const unit = event.target.value; setLengthUnit(unit); if (lengthNumber.trim() !== "" && Number.isFinite(Number(lengthNumber))) designer.setNodeStyle(nodeId, field.property, `${lengthNumber}${unit}`); }}>
          {lengthUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </select>
        {parsedLength === null && <span className="ds-hint">Se conserva el valor CSS personalizado.</span>}
      </div>}
      {kind === "number" && <input aria-label={`${field.label} numérico`} className="ds-field__input ds-number-control" type="number" step={field.property === "z-index" ? "1" : "any"} disabled={blocked || (value !== null && numberValue === "")} value={numberDraft}
        placeholder={value !== null && numberValue === "" ? "CSS personalizado" : "Valor"} onChange={(event) => setNumberDraft(event.target.value)} onBlur={() => { if (numberDraft.trim() !== "" && numberDraft !== value && Number.isFinite(Number(numberDraft))) designer.setNodeStyle(nodeId, field.property, numberDraft); }} />}
      {field.kind === "opacity" && <div className="ds-opacity-control">
        <input aria-label="Opacidad de 0 a 1" type="range" min="0" max="1" step="0.01" disabled={blocked || (value !== null && opacityValue === null)} value={opacityValue ?? 1}
          onChange={(event) => designer.setNodeStyle(nodeId, field.property, event.target.value)} />
        <span>{opacityValue === null ? (value === null ? "Sin declaración (referencia 1)" : "Valor CSS personalizado") : opacityValue}</span>
      </div>}
      {designer.responsiveCondition && explicit && <button type="button" className="ds-mini-btn" disabled={blocked} title="Quitar la declaración del breakpoint" aria-label={`Restablecer ${field.label} al estilo base`} onClick={() => designer.setNodeStyle(nodeId, field.property, "")}>↶</button>}
      {blockedByInline && <span className="ds-hint">El estilo inline tiene prioridad; edita el shorthand desde HTML.</span>}
      {blockedWithoutSelector && <span className="ds-hint">Añade una clase o id único, o declara antes este estilo inline.</span>}
    </div>
  );
}

function SpacingGroup({ designer, nodeId, prefix }: { designer: DesignerState; nodeId: string; prefix: "margin" | "padding" }) {
  const [linked, setLinked] = useState(true);
  const sides = ["top", "right", "bottom", "left"] as const;
  const label = prefix === "margin" ? "Margen" : "Relleno";
  return (
    <details className="ds-acc">
      <summary className="ds-acc__head">{label}</summary>
      <div className="ds-acc__body">
        <label className="ds-check"><input type="checkbox" checked={linked} onChange={(event) => setLinked(event.target.checked)} /> Vincular los cuatro lados</label>
        {linked ? <ValueField designer={designer} nodeId={nodeId} field={{ property: prefix, label: `${label} (4 lados)`, kind: "length", placeholder: "0" }} /> : <>
          {(designer.nodeStyle(nodeId, prefix) !== null) && <p className="ds-hint">Se conserva el shorthand `{prefix}: {designer.nodeStyle(nodeId, prefix)}`. Los valores de lado se editan aparte y pueden sobrescribirlo.</p>}
          {sides.map((side) => <ValueField key={side} designer={designer} nodeId={nodeId} field={{ property: `${prefix}-${side}`, label: ({ top: "Arriba", right: "Derecha", bottom: "Abajo", left: "Izquierda" })[side], kind: "length" }} />)}
        </>}
      </div>
    </details>
  );
}

function PositionField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label className="ds-field"><span className="ds-field__label">{label}</span><input className="ds-field__input" inputMode="decimal" value={draft}
    onChange={(event) => setDraft(event.target.value)} onBlur={() => { const next = Number(draft); if (draft.trim() !== "" && Number.isFinite(next) && next !== value) onCommit(next); }}
    onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }} /></label>;
}

export function StyleEditor({ designer, node, box, parentId }: Props) {
  const selector = designer.styleSelector(node.id);
  const declarations = designer.responsiveNodeDeclarations(node.id);
  const recommended = CSS_RECOMMENDED_BY_TAG[node.tag?.toLowerCase() ?? ""] ?? [];
  const extra = [...new Map(declarations.filter((declaration) => !knownProperties.has(declaration.property)).map((item) => [item.property, item])).values()];
  const inlineStyle = node.attributes.find((attribute) => attribute.name.toLowerCase() === "style")?.value;
  const target = designer.cssTarget?.kind === "external" ? designer.cssTarget.href : designer.cssTarget?.kind === "internal" ? "<style> interno" : "CSS interno nuevo al aplicar";

  return <div className="ds-style-editor">
    <div className="ds-acc__body">
      <label className="ds-field"><span className="ds-field__label">Contexto CSS</span>
        <select className="ds-field__input" value={designer.responsiveCondition ?? ""} onChange={(event) => {
          const condition = event.target.value || null;
          designer.setResponsiveCondition(condition);
          const point = condition === null ? null : designer.responsiveBreakpoints.find((item) => item.condition === condition);
          if (point) window.dispatchEvent(new CustomEvent("prisma-responsive-viewport", { detail: point.width }));
        }}>
          <option value="">Estilo base</option>
          {designer.responsiveBreakpoints.map((item) => <option key={item.condition} value={item.condition}>@media {item.condition}</option>)}
        </select>
      </label>
      <p className="ds-hint">Declaraciones directas · {target}{selector ? ` · ${selector}` : ""}</p>
      {designer.responsiveCondition && <div className="ds-actions">
        <button type="button" className="ds-mini-btn" onClick={() => { const value = window.prompt("Ancho máximo del nuevo breakpoint (px)", "600"); const width = Number(value); if (value !== null && Number.isFinite(width) && width >= 1) designer.addResponsiveBreakpoint(width); }}>Añadir breakpoint</button>
        {(() => { const point = designer.responsiveBreakpoints.find((item) => item.condition === designer.responsiveCondition); return point ? <>
          <button type="button" className="ds-mini-btn" onClick={() => { if (point.ruleCount > 0 && !window.confirm(`Cambiará cuándo se aplican las ${point.ruleCount} regla(s) de este breakpoint. ¿Continuar?`)) return; const next = window.prompt("Nueva condición (por ejemplo: (max-width: 640px))", point.condition); if (next) designer.renameResponsiveBreakpoint(point.condition, next); }}>Editar condición</button>
          <button type="button" className="ds-mini-btn ds-mini-btn--danger" disabled={point.ruleCount !== 0} title={point.ruleCount ? "Solo se eliminan breakpoints vacíos" : "Eliminar breakpoint vacío"} onClick={() => designer.removeEmptyResponsiveBreakpoint(point.condition)}>Eliminar</button>
        </> : null; })()}
      </div>}
    </div>

    {inlineStyle && <p className="ds-style-warning" role="note">Este elemento tiene estilo inline. En el estilo base, las propiedades presentes se editan en ese atributo y se conservan las demás. Los breakpoints no pueden sobrescribir con seguridad una declaración inline, por eso esos campos quedan desactivados.</p>}
    {selector === null && !inlineStyle && <p className="ds-style-warning" role="alert">No hay una clase o un id único para apuntar a este elemento sin afectar a otros. Añade una clase o un id desde HTML para habilitar la edición CSS.</p>}
    {selector !== null || inlineStyle ? <>
      {recommended.length > 0 && <details className="ds-acc"><summary className="ds-acc__head">Accesos CSS recomendados para &lt;{node.tag}&gt;</summary><div className="ds-acc__body">
        {recommended.map((property) => <ValueField key={property} designer={designer} nodeId={node.id} field={{ property, label: cssLabels[property] ?? property, options: CSS_RECOMMENDED_OPTIONS[property] }} />)}
      </div></details>}
      {box && <details className="ds-acc"><summary className="ds-acc__head">Posición en el lienzo</summary><div className="ds-acc__body"><div className="ds-field-row">
        <PositionField label="X" value={box.x} onCommit={(x) => designer.moveNode(node.id, parentId, x, box.y)} />
        <PositionField label="Y" value={box.y} onCommit={(y) => designer.moveNode(node.id, parentId, box.x, y)} />
      </div></div></details>}
      {groups.map((group) => <details className="ds-acc" key={group.title} open={group.title === "Dimensiones" ? true : undefined}>
        <summary className="ds-acc__head">{group.title}</summary><div className="ds-acc__body">{group.fields.map((field) => <ValueField key={field.property} designer={designer} nodeId={node.id} field={field} />)}</div>
      </details>)}
      {(["margin", "padding"] as const).map((prefix) => <SpacingGroup key={prefix} designer={designer} nodeId={node.id} prefix={prefix} />)}
      <details className="ds-acc"><summary className="ds-acc__head">Otras propiedades declaradas ({extra.length})</summary><div className="ds-acc__body">
        {extra.length === 0 ? <p className="ds-hint">No hay otras declaraciones propias en este selector y contexto.</p> : extra.map((item, index) => <ValueField key={`${item.property}-${index}`} designer={designer} nodeId={node.id} field={{ property: item.property, label: item.property }} />)}
      </div></details>
    </> : null}
  </div>;
}
