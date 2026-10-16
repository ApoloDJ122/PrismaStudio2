import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { attributeHelp, cssPropertyHelp, TAG_LABELS, tagInfo } from "./catalog.ts";
import { KNOWN_TAGS } from "./html.ts";
import { parseMarkup } from "./parse.ts";
import { serialize } from "./tree.ts";

const { equal, ok, notEqual } = assert;

describe("catálogo en español del diseñador", () => {
  it("tiene un nombre descriptivo para cada etiqueta reconocida", () => {
    for (const tag of KNOWN_TAGS) {
      ok(TAG_LABELS[tag], `Falta un nombre descriptivo para <${tag}>`);
      equal(tagInfo(tag).known, true);
    }
    equal(tagInfo("div").label, "Contenedor");
    equal(tagInfo("h1").label, "Título 1");
  });

  it("preserva nombres de componentes desconocidos en vez de sustituirlos", () => {
    const info = tagInfo("x-alerta");
    equal(info.label, "x-alerta");
    equal(info.known, false);
    ok(info.description.includes("<x-alerta>"));
  });

  it("no modifica el HTML al consultar etiquetas para mostrarlas", () => {
    const source = "<main><h1 class=\"titulo\">Hola</h1><x-tarjeta data-x=\"1\">Texto</x-tarjeta></main>";
    const roots = parseMarkup(source, "index.html").roots;
    const before = serialize(roots);
    for (const tag of ["main", "h1", "x-tarjeta"]) tagInfo(tag);
    equal(serialize(roots), before);
  });

  it("adapta type al contexto y cubre atributos comunes", () => {
    notEqual(attributeHelp("input", "type"), attributeHelp("button", "type"));
    notEqual(attributeHelp("input", "type"), attributeHelp("custom-element", "type"));
    ok(attributeHelp("img", "alt").includes("Alternativa textual"));
    ok(attributeHelp("input", "required").includes("obligatorio"));
    ok(attributeHelp("custom-element", "data-state").includes("framework"));
  });

  it("explica las propiedades CSS editables sin tocar sus nombres de origen", () => {
    for (const property of [
      "display", "position", "width", "height", "min-width", "max-width", "margin", "padding",
      "font-size", "line-height", "visibility", "overflow", "gap", "align-items", "justify-content",
    ]) {
      ok(cssPropertyHelp(property).length > 5, `Falta ayuda para ${property}`);
    }
    equal(cssPropertyHelp("z-index"), "Orden de apilamiento; tiene efecto según el contexto de posicionamiento.");
  });
});
