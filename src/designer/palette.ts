import { KNOWN_TAGS } from "./html";

export interface PaletteItem {
  readonly tag: string;
  readonly label: string;
  readonly group: string;
}

const GROUPS: Readonly<Record<string, string>> = {
  a: "Enlaces", area: "Enlaces", link: "Documento",
  address: "Texto", blockquote: "Texto", br: "Texto", cite: "Texto", code: "Texto",
  del: "Texto", dfn: "Texto", em: "Texto", h1: "Texto", h2: "Texto", h3: "Texto",
  h4: "Texto", h5: "Texto", h6: "Texto", hr: "Texto", i: "Texto", kbd: "Texto",
  mark: "Texto", p: "Texto", pre: "Texto", q: "Texto", s: "Texto", samp: "Texto",
  small: "Texto", span: "Texto", strong: "Texto", sub: "Texto", sup: "Texto",
  time: "Texto", u: "Texto", var: "Texto", wbr: "Texto",
  button: "Formularios", datalist: "Formularios", fieldset: "Formularios", form: "Formularios",
  input: "Formularios", label: "Formularios", legend: "Formularios", meter: "Formularios",
  optgroup: "Formularios", option: "Formularios", output: "Formularios", progress: "Formularios",
  select: "Formularios", textarea: "Formularios",
  audio: "Multimedia", canvas: "Multimedia", embed: "Multimedia", iframe: "Multimedia",
  img: "Multimedia", map: "Multimedia", object: "Multimedia", picture: "Multimedia",
  source: "Multimedia", track: "Multimedia", video: "Multimedia",
  dd: "Listas", dl: "Listas", dt: "Listas", li: "Listas", menu: "Listas", ol: "Listas", ul: "Listas",
  caption: "Tablas", col: "Tablas", colgroup: "Tablas", table: "Tablas", tbody: "Tablas",
  td: "Tablas", tfoot: "Tablas", th: "Tablas", thead: "Tablas", tr: "Tablas",
  body: "Documento", head: "Documento", html: "Documento", meta: "Documento", noscript: "Documento",
  script: "Documento", style: "Documento", template: "Documento", title: "Documento",
};

/** Biblioteca completa de etiquetas reconocidas por el modelo HTML. */
export const ELEMENT_PALETTE: readonly PaletteItem[] = [...KNOWN_TAGS]
  .sort((a, b) => a.localeCompare(b))
  .map((tag) => ({ tag, label: `<${tag}>`, group: GROUPS[tag] ?? "Contenedores" }));

export const PROTECTED_TAGS: readonly string[] = ["script", "style", "iframe"];
