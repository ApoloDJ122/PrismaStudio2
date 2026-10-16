import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GLOBAL_ATTRIBUTES, tagSpecificAttributes, CSS_RECOMMENDED_BY_TAG } from "./propertyCatalog.ts";
import { findById } from "./tree.ts";
import { parseMarkup } from "./parse.ts";
import { removeNodeAttribute, setNodeAttribute } from "./edit.ts";
import { serialize } from "./tree.ts";

const { deepEqual, equal, ok } = assert;

function element(html: string, tag: string) {
  const roots = parseMarkup(html, "page.blade.php").roots;
  const node = roots.flatMap(function walk(item): typeof roots {
    return [item, ...item.children.flatMap(walk)];
  }).find((item) => item.kind === "element" && item.tag === tag);
  if (!node) throw new Error(`No se encontró <${tag}> en el fixture`);
  return { roots, node };
}

describe("catálogo dinámico de propiedades M3.2.0", () => {
  it("separa los atributos globales de los específicos por etiqueta", () => {
    const globalNames = GLOBAL_ATTRIBUTES.map((item) => item.name);
    ok(globalNames.includes("lang"));
    ok(globalNames.includes("contenteditable"));
    ok(!globalNames.includes("href"));
    ok(tagSpecificAttributes("a", []).some((item) => item.name === "href"));
    ok(!tagSpecificAttributes("img", []).some((item) => item.name === "href"));
  });

  it("adapta las propiedades de input[type] sin descartar sus atributos", () => {
    const checkbox = tagSpecificAttributes("input", [{ name: "type", value: "checkbox" }]);
    const file = tagSpecificAttributes("input", [{ name: "type", value: "file" }]);
    ok(checkbox.some((item) => item.name === "checked"));
    ok(!checkbox.some((item) => item.name === "accept"));
    ok(file.some((item) => item.name === "accept"));
    ok(!file.some((item) => item.name === "checked"));
    deepEqual(tagSpecificAttributes("input", [{ name: "type", value: "custom-type" }]).map((item) => item.name),
      tagSpecificAttributes("input", [{ name: "type", value: "text" }]).filter((item) => !item.inputTypes).map((item) => item.name));
  });

  it("ofrece definiciones específicas para imagen, enlace, tabla, formularios y metadatos", () => {
    for (const [tag, names] of Object.entries({
      img: ["src", "alt", "srcset", "loading"], a: ["href", "target", "rel"], td: ["colspan", "rowspan", "headers"],
      form: ["action", "method", "enctype"], meta: ["name", "content", "charset", "http-equiv"],
    })) {
      const defined = tagSpecificAttributes(tag, []).map((item) => item.name);
      for (const name of names) ok(defined.includes(name), `<${tag}> debe ofrecer ${name}`);
    }
    ok((CSS_RECOMMENDED_BY_TAG.img ?? []).includes("object-fit"));
    ok((CSS_RECOMMENDED_BY_TAG.table ?? []).includes("border-collapse"));
  });

  it("modifica atributos localmente y conserva hijos, comentarios, Blade y atributos ajenos", () => {
    const { roots, node } = element('<div class="card" data-x="1"><!-- conservar -->{{ $slot }}<span>hijo</span></div>', "div");
    const beforeChildren = node.children.map((child) => child.id);
    ok(setNodeAttribute(roots, node.id, "aria-label", "Tarjeta").ok);
    const output = serialize(roots);
    ok(output.includes('aria-label="Tarjeta"'));
    ok(output.includes('class="card" data-x="1"'));
    ok(output.includes("<!-- conservar -->"));
    ok(output.includes("{{ $slot }}"));
    ok(output.includes("<span>hijo</span>"));
    deepEqual(node.children.map((child) => child.id), beforeChildren);
  });

  it("guarda booleanos como presencia/ausencia y permite editar atributos de script sin ejecutarlos", () => {
    const { roots, node } = element('<script src="app.js" defer>window.noEjecutar()</script>', "script");
    ok(setNodeAttribute(roots, node.id, "nonce", "abc").ok);
    equal(removeNodeAttribute(roots, node.id, "defer").ok, true);
    const html = serialize(roots);
    ok(html.includes('<script src="app.js" nonce="abc">'));
    ok(html.includes("window.noEjecutar()"));
  });

  it("conserva etiquetas desconocidas y permite editar sus atributos genéricos", () => {
    const { roots, node } = element('<mi-panel dato="x"><b>contenido</b></mi-panel>', "mi-panel");
    ok(setNodeAttribute(roots, node.id, "data-state", "abierto").ok);
    ok(serialize(roots).includes('<mi-panel dato="x" data-state="abierto"><b>contenido</b></mi-panel>'));
    equal(findById(roots, node.id)?.known, false);
  });
});
