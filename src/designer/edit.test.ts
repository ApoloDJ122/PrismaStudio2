import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyMove, deleteNode, duplicateNode, ensureStylesheetLink, insertElement, linkedStylesheets, removeNodeAttribute, reorderNode, setNodeAttribute, setNodeText } from "./edit.ts";
import { createIdFactory, createIdFactoryAfter } from "./identity.ts";
import { parseMarkup } from "./parse.ts";
import { serialize } from "./tree.ts";
import { readBox, readDeclaration } from "./cssEdit.ts";

const { deepEqual, equal, ok } = assert;

function roots(html: string) {
  return parseMarkup(html).roots;
}

describe("M2.2.0 ediciones del diseñador", () => {
  it("inserta un elemento dentro de otro", () => {
    const doc = roots("<body><div id=\"main\"></div></body>");
    const factory = createIdFactory();
    const parent = doc[0]?.children[0];
    ok(parent !== undefined);
    const res = insertElement(doc, factory, "button", parent!.id);
    ok(res.ok);
    const html = serialize(doc);
    ok(html.includes("<button"));
    ok(html.includes("</button>"));
    ok(html.indexOf("<button") > html.indexOf("<div"));
  });

  it("inserta un elemento en la raiz cuando no hay padre", () => {
    const doc = roots("<body></body>");
    const factory = createIdFactory();
    const res = insertElement(doc, factory, "section", null);
    ok(res.ok);
    ok(serialize(doc).includes("<section"));
  });

  it("mueve un elemento de un padre a otro", () => {
    const doc = roots(
      '<body><div id="a"><span id="s">x</span></div><div id="b"></div></body>',
    );
    const span = doc[0]?.children[0]?.children[0];
    const divB = doc[0]?.children[1];
    ok(span !== undefined && divB !== undefined);
    const res = applyMove(doc, "", {
      nodeId: span!.id,
      parentId: divB!.id,
      box: { x: 10, y: 20 },
    });
    ok(res.ok);
    const html = serialize(doc);
    const spanPos = html.indexOf("<span");
    const bPos = html.indexOf('id="b"');
    ok(spanPos > bPos, "span should be inside #b");
  });

  it("posiciona un h1 sobre su contenedor con CSS absoluto y origen relativo", () => {
    const doc = roots('<body><div class="contenedor"><h1 class="titulo">Título</h1></div></body>');
    const div = doc[0]?.children[0];
    const h1 = div?.children[0];
    ok(div !== undefined && h1 !== undefined);
    const moved = applyMove(doc, "", {
      nodeId: h1!.id,
      parentId: div!.id,
      box: { x: 84, y: 37 },
    });
    if (!moved.ok) throw new Error(moved.message);
    equal(readDeclaration(moved.value.cssText, ".titulo", "position"), "absolute");
    equal(readBox(moved.value.cssText, ".titulo")?.x, 84);
    equal(readBox(moved.value.cssText, ".titulo")?.y, 37);
    equal(readDeclaration(moved.value.cssText, ".contenedor", "position"), "relative");
  });

  it("mover una copia usa una clase y una caja independientes del original", () => {
    const doc = roots('<body><div><h1 class="h1-1">Título</h1></div></body>');
    const h1 = doc[0]?.children[0]?.children[0];
    ok(h1 !== undefined);
    const duplicate = duplicateNode(doc, createIdFactoryAfter(doc), h1!.id);
    if (!duplicate.ok) throw new Error(duplicate.message);
    const moved = applyMove(
      doc,
      ".h1-1 { position: absolute; left: 10px; top: 20px; }",
      { nodeId: duplicate.value.id, parentId: duplicate.value.parentId, box: { x: 90, y: 65 } },
    );
    if (!moved.ok) throw new Error(moved.message);
    const copiedBox = readBox(moved.value.cssText, ".h1-2");
    deepEqual(copiedBox, { x: 90, y: 65 });
    equal(readBox(moved.value.cssText, ".h1-1")?.x, 10);
    equal(readBox(moved.value.cssText, ".h1-1")?.y, 20);
  });

  it("reordena elementos hermanos", () => {
    const doc = roots("<body><p>1</p><p>2</p><p>3</p></body>");
    const ps = doc[0]?.children ?? [];
    const firstP = ps[0];
    ok(firstP !== undefined);
    const res = reorderNode(doc, firstP!.id, "down");
    ok(res.ok);
    const html = serialize(doc);
    ok(html.indexOf("<p>2</p>") < html.indexOf("<p>1</p>"));
  });

  it("no mueve un elemento a sí mismo", () => {
    const doc = roots("<body><div></div></body>");
    const res = applyMove(doc, "", {
      nodeId: "element-001",
      parentId: "element-001",
      box: { x: 0, y: 0 },
    });
    ok(!res.ok);
  });
});

describe("M2.2.1 eliminar y editar texto", () => {
  it("elimina un elemento con todo su contenido", () => {
    const doc = roots('<body><div><p id="x">hola</p></div><span>fuera</span></body>');
    const div = doc[0]?.children[0];
    ok(div !== undefined);
    const res = deleteNode(doc, div!.id);
    ok(res.ok);
    const html = serialize(doc);
    ok(!html.includes("<div>"));
    ok(!html.includes('id="x"'));
    ok(html.includes("<span>fuera</span>"));
  });

  it("no deja eliminar la estructura del documento", () => {
    const doc = roots("<html><body><div></div></body></html>");
    const body = doc[0]?.children.find((n) => n.tag === "body");
    ok(body !== undefined);
    ok(!deleteNode(doc, body!.id).ok);
  });

  it("duplica un subárbol con contenido y comentarios, asignando IDs internos nuevos", () => {
    const doc = roots('<body><section class="card"><!-- keep --><p id="label">Hola</p><a href="#label" aria-describedby="label">ir</a></section></body>');
    const original = doc[0]?.children[0];
    ok(original !== undefined);
    const copy = duplicateNode(doc, createIdFactory(), original!.id);
    if (!copy.ok) throw new Error(copy.message);
    equal(copy.value.parentId, original!.parentId);
    ok(copy.value.id !== original!.id);
    equal(copy.value.children.length, original!.children.length);
    ok(copy.value.children.every((child, index) => child.id !== original!.children[index]?.id));
    equal(serialize(doc), '<body><section class="card"><!-- keep --><p id="label">Hola</p><a href="#label" aria-describedby="label">ir</a></section><section class="card"><!-- keep --><p id="label-copy">Hola</p><a href="#label-copy" aria-describedby="label-copy">ir</a></section></body>');
  });

  it("edita y elimina atributos adicionales sin cambiar los demás", () => {
    const doc = roots('<body><button class="btn" data-state="ready" aria-live="polite"></button></body>');
    const button = doc[0]?.children[0];
    ok(button !== undefined);
    ok(setNodeAttribute(doc, button!.id, "data-state", "busy").ok);
    ok(removeNodeAttribute(doc, button!.id, "aria-live").ok);
    equal(serialize(doc), '<body><button class="btn" data-state="busy"></button></body>');
    ok(!setNodeAttribute(doc, button!.id, "bad name", "x").ok);
    equal(serialize(doc), '<body><button class="btn" data-state="busy"></button></body>');
  });

  it("cambia el texto de un elemento simple", () => {
    const doc = roots("<body><h1>Hola</h1></body>");
    const h1 = doc[0]?.children[0];
    ok(h1 !== undefined);
    const factory = createIdFactory();
    ok(setNodeText(doc, factory, h1!.id, "Adiós").ok);
    const html = serialize(doc);
    ok(html.includes("<h1>Adiós</h1>"));
  });

  it("vaciar el texto deja el elemento sin hijos", () => {
    const doc = roots("<body><button>Enviar</button></body>");
    const button = doc[0]?.children[0];
    ok(button !== undefined);
    const factory = createIdFactory();
    ok(setNodeText(doc, factory, button!.id, "").ok);
    equal(serialize(doc), "<body><button></button></body>");
  });

  it("sigue prohibiendo meter un elemento dentro de su descendiente", () => {
    const doc = roots("<body><div><button>x</button></div></body>");
    const div = doc[0]?.children[0];
    const button = div?.children[0];
    ok(div !== undefined && button !== undefined);
    const res = applyMove(doc, "", {
      nodeId: div!.id,
      parentId: button!.id,
      box: { x: 0, y: 0 },
    });
    ok(!res.ok);
    ok(serialize(doc).includes("<div><button>x</button></div>"));
  });

  it("crea el <link> una sola vez, también sin head", () => {
    const doc = roots("<body><div></div></body>");
    const factory = createIdFactory();
    ok(ensureStylesheetLink(doc, factory, "styles.css").ok);
    equal(linkedStylesheets(doc).length, 1);
    ok(ensureStylesheetLink(doc, factory, "styles.css").ok);
    equal(linkedStylesheets(doc).length, 1);
    ok(serialize(doc).includes('<link rel="stylesheet" href="styles.css">'));
  });

  it("no destruye contenido anidado al editar texto", () => {
    const doc = roots("<body><div><p>x</p></div></body>");
    const div = doc[0]?.children[0];
    ok(div !== undefined);
    const factory = createIdFactory();
    const res = setNodeText(doc, factory, div!.id, "hola");
    ok(!res.ok);
    ok(serialize(doc).includes("<p>x</p>"));
  });

  it("rechaza editar texto si hay comentarios para no eliminarlos", () => {
    const doc = roots("<body><p>Antes<!-- mantener -->después</p></body>");
    const p = doc[0]?.children[0];
    ok(p !== undefined);
    const res = setNodeText(doc, createIdFactory(), p!.id, "Nuevo");
    ok(!res.ok);
    equal(serialize(doc), "<body><p>Antes<!-- mantener -->después</p></body>");
  });
});
