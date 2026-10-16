/** Catálogo de atributos HTML y accesos rápidos CSS del inspector M3.2.0. */
export type AttributeControl = "text" | "number" | "boolean" | "select";
export interface AttributeDefinition {
  name: string;
  label: string;
  control?: AttributeControl;
  options?: readonly string[];
  inputTypes?: readonly string[];
  help: string;
}

const attr = (name: string, label: string, help: string, control: AttributeControl = "text", options?: readonly string[], inputTypes?: readonly string[]): AttributeDefinition =>
  ({ name, label, help, control, ...(options ? { options } : {}), ...(inputTypes ? { inputTypes } : {}) });

export const GLOBAL_ATTRIBUTES: readonly AttributeDefinition[] = [
  attr("title", "Título", "Texto auxiliar del elemento; no sustituye una etiqueta visible o accesible."),
  attr("lang", "Idioma", "Idioma del contenido, por ejemplo es o en-US."),
  attr("dir", "Dirección", "Dirección del texto.", "select", ["ltr", "rtl", "auto"]),
  attr("hidden", "Oculto", "Indica que el elemento no está actualmente presentado.", "boolean"),
  attr("tabindex", "Orden de teclado", "Orden de enfoque del teclado; admite un entero." , "number"),
  attr("accesskey", "Tecla de acceso", "Tecla rápida asociada al elemento."),
  attr("draggable", "Arrastrable", "Indica si el elemento puede arrastrarse.", "select", ["true", "false"]),
  attr("contenteditable", "Editable", "Indica si el usuario puede editar el contenido.", "select", ["true", "false", "plaintext-only"]),
  attr("spellcheck", "Corrector ortográfico", "Activa o desactiva la revisión ortográfica.", "select", ["true", "false"]),
  attr("translate", "Traducible", "Indica si el contenido debe traducirse.", "select", ["yes", "no"]),
  attr("inert", "Inactivo", "Desactiva interacción y enfoque para el subárbol.", "boolean"),
];

export const BOOLEAN_ATTRIBUTE_NAMES = new Set([
  "allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "defer", "disabled", "formnovalidate",
  "hidden", "inert", "ismap", "itemscope", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline",
  "readonly", "required", "reversed", "selected", "typemustmatch",
]);

const definitions: Record<string, readonly AttributeDefinition[]> = {
  a: [attr("href", "Destino", "URL del destino del enlace."), attr("target", "Ventana", "Contexto de navegación del destino.", "select", ["_self", "_blank", "_parent", "_top"]), attr("rel", "Relación", "Relación con el destino; admite uno o varios tokens."), attr("download", "Descarga", "Indica que el destino puede descargarse."), attr("hreflang", "Idioma de destino", "Idioma del recurso enlazado."), attr("type", "Tipo MIME", "Tipo de medio del destino.")],
  area: [attr("alt", "Texto alternativo", "Alternativa textual del área."), attr("coords", "Coordenadas", "Coordenadas del área en el mapa de imagen."), attr("shape", "Forma", "Forma geométrica.", "select", ["rect", "circle", "poly", "default"]), attr("href", "Destino", "URL del destino."), attr("target", "Ventana", "Contexto de navegación.", "select", ["_self", "_blank", "_parent", "_top"])],
  img: [attr("src", "Origen", "Ruta o URL de la imagen."), attr("alt", "Texto alternativo", "Describe la imagen o deja vacío si es decorativa."), attr("width", "Ancho HTML", "Ancho intrínseco en píxeles; distinto del ancho CSS.", "number"), attr("height", "Alto HTML", "Alto intrínseco en píxeles; distinto del alto CSS.", "number"), attr("loading", "Carga", "Estrategia de carga.", "select", ["eager", "lazy"]), attr("decoding", "Decodificación", "Preferencia de decodificación.", "select", ["sync", "async", "auto"]), attr("fetchpriority", "Prioridad", "Prioridad de descarga.", "select", ["high", "low", "auto"]), attr("srcset", "Fuentes adaptables", "Lista de imágenes candidatas."), attr("sizes", "Tamaños", "Tamaños de presentación para srcset."), attr("usemap", "Mapa", "Nombre del mapa de imagen asociado."), attr("ismap", "Mapa del servidor", "Indica que la imagen es un mapa del servidor.", "boolean")],
  picture: [],
  source: [attr("src", "Origen", "Fuente del recurso."), attr("srcset", "Fuentes adaptables", "Lista de recursos candidatos."), attr("sizes", "Tamaños", "Tamaños para srcset."), attr("media", "Condición", "Condición de medios para esta fuente."), attr("type", "Tipo MIME", "Tipo del recurso."), attr("width", "Ancho", "Ancho intrínseco de imagen.", "number"), attr("height", "Alto", "Alto intrínseco de imagen.", "number")],
  audio: [attr("src", "Origen", "Fuente de audio."), attr("controls", "Controles", "Muestra controles de reproducción.", "boolean"), attr("autoplay", "Reproducción automática", "Solicita reproducción automática; el diseñador no reproduce el medio.", "boolean"), attr("loop", "Repetir", "Repite al terminar.", "boolean"), attr("muted", "Silenciado", "Inicia silenciado.", "boolean"), attr("preload", "Precarga", "Preferencia de precarga.", "select", ["none", "metadata", "auto"])],
  video: [attr("src", "Origen", "Fuente de vídeo."), attr("poster", "Portada", "Imagen visible antes de reproducir."), attr("width", "Ancho", "Ancho intrínseco en píxeles.", "number"), attr("height", "Alto", "Alto intrínseco en píxeles.", "number"), attr("controls", "Controles", "Muestra controles de reproducción.", "boolean"), attr("autoplay", "Reproducción automática", "Solicita reproducción automática; el diseñador no reproduce el medio.", "boolean"), attr("loop", "Repetir", "Repite al terminar.", "boolean"), attr("muted", "Silenciado", "Inicia silenciado.", "boolean"), attr("preload", "Precarga", "Preferencia de precarga.", "select", ["none", "metadata", "auto"]), attr("playsinline", "Reproducir en línea", "Solicita reproducción dentro de la página.", "boolean")],
  track: [attr("kind", "Tipo de pista", "Tipo de subtítulos o metadatos.", "select", ["subtitles", "captions", "descriptions", "chapters", "metadata"]), attr("src", "Origen", "Archivo de pista."), attr("srclang", "Idioma", "Idioma de la pista."), attr("label", "Etiqueta", "Nombre visible de la pista."), attr("default", "Predeterminada", "Pista seleccionada por defecto.", "boolean")],
  iframe: [attr("src", "Origen", "URL del documento incrustado."), attr("title", "Título accesible", "Descripción accesible del marco."), attr("width", "Ancho", "Ancho del marco.", "number"), attr("height", "Alto", "Alto del marco.", "number"), attr("loading", "Carga", "Estrategia de carga.", "select", ["eager", "lazy"]), attr("name", "Nombre", "Nombre del contexto."), attr("sandbox", "Sandbox", "Restricciones de seguridad separadas por espacios."), attr("allow", "Permisos", "Políticas de funciones permitidas."), attr("allowfullscreen", "Pantalla completa", "Permite pantalla completa.", "boolean"), attr("referrerpolicy", "Política de referencia", "Controla el encabezado Referer.", "select", ["no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin", "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url"])],
  form: [attr("action", "Destino", "URL que recibe el formulario."), attr("method", "Método", "Método HTTP.", "select", ["get", "post", "dialog"]), attr("enctype", "Codificación", "Formato de envío.", "select", ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"]), attr("target", "Ventana", "Contexto de navegación."), attr("autocomplete", "Autocompletar", "Preferencia de autocompletado.", "select", ["on", "off"]), attr("novalidate", "Sin validación", "Desactiva la validación al enviar.", "boolean")],
  input: [attr("type", "Tipo", "Formato del control; al cambiarlo se actualizan los campos visibles sin borrar atributos.", "select", ["text", "password", "email", "number", "tel", "url", "search", "checkbox", "radio", "file", "date", "time", "datetime-local", "month", "week", "color", "range", "hidden", "button", "submit", "reset", "image"]), attr("name", "Nombre", "Clave usada al enviar el formulario."), attr("value", "Valor", "Valor actual o inicial del control."), attr("placeholder", "Texto de ayuda", "Pista para un campo vacío."), attr("required", "Obligatorio", "Exige un valor al enviar.", "boolean"), attr("disabled", "Desactivado", "Desactiva el control.", "boolean"), attr("readonly", "Solo lectura", "Impide editar el valor.", "boolean"), attr("checked", "Marcado", "Estado inicial para casilla o radio.", "boolean", undefined, ["checkbox", "radio"]), attr("min", "Mínimo", "Límite inferior para valores numéricos o fechas.", "text", undefined, ["number", "range", "date", "time", "datetime-local", "month", "week"]), attr("max", "Máximo", "Límite superior para valores numéricos o fechas.", "text", undefined, ["number", "range", "date", "time", "datetime-local", "month", "week"]), attr("step", "Incremento", "Incremento permitido en campos numéricos.", "number", undefined, ["number", "range"]), attr("minlength", "Longitud mínima", "Cantidad mínima de caracteres.", "number", undefined, ["text", "password", "email", "tel", "url", "search"]), attr("maxlength", "Longitud máxima", "Cantidad máxima de caracteres.", "number", undefined, ["text", "password", "email", "tel", "url", "search"]), attr("pattern", "Patrón", "Expresión de validación HTML; se conserva como texto." , "text", undefined, ["text", "password", "email", "tel", "url", "search"]), attr("multiple", "Múltiples valores", "Permite seleccionar varios valores o archivos.", "boolean", undefined, ["email", "file"]), attr("accept", "Tipos aceptados", "Tipos MIME o extensiones permitidos.", "text", undefined, ["file"]), attr("autocomplete", "Autocompletar", "Sugerencia de autocompletado."), attr("list", "Lista sugerida", "ID de datalist asociado."), attr("form", "Formulario", "ID del formulario asociado."), attr("size", "Tamaño visible", "Ancho visible del control de texto.", "number", undefined, ["text", "password", "email", "tel", "url", "search"]), attr("src", "Origen", "Imagen del botón de tipo image.", "text", undefined, ["image"]), attr("alt", "Texto alternativo", "Descripción de la imagen del botón.", "text", undefined, ["image"])],
  button: [attr("type", "Tipo", "Comportamiento del botón.", "select", ["submit", "button", "reset"]), attr("name", "Nombre", "Nombre enviado con el formulario."), attr("value", "Valor", "Valor enviado con el formulario."), attr("disabled", "Desactivado", "Desactiva el botón.", "boolean"), attr("form", "Formulario", "ID del formulario asociado."), attr("formaction", "Destino", "Sobrescribe action para este botón."), attr("formmethod", "Método", "Sobrescribe method para este botón.", "select", ["get", "post", "dialog"]), attr("formnovalidate", "Sin validación", "Omite la validación al enviar.", "boolean")],
  textarea: [attr("name", "Nombre", "Clave enviada por el formulario."), attr("rows", "Filas", "Filas visibles.", "number"), attr("cols", "Columnas", "Columnas visibles.", "number"), attr("placeholder", "Texto de ayuda", "Pista cuando no hay texto."), attr("required", "Obligatorio", "Exige contenido al enviar.", "boolean"), attr("disabled", "Desactivado", "Desactiva el control.", "boolean"), attr("readonly", "Solo lectura", "Impide editar el contenido.", "boolean"), attr("minlength", "Longitud mínima", "Cantidad mínima de caracteres.", "number"), attr("maxlength", "Longitud máxima", "Cantidad máxima de caracteres.", "number"), attr("wrap", "Ajuste", "Cómo se ajustan las líneas al enviar.", "select", ["soft", "hard"])],
  select: [attr("name", "Nombre", "Clave enviada por el formulario."), attr("multiple", "Selección múltiple", "Permite varias opciones.", "boolean"), attr("required", "Obligatorio", "Exige una selección.", "boolean"), attr("disabled", "Desactivado", "Desactiva el control.", "boolean"), attr("size", "Opciones visibles", "Cantidad de opciones visibles.", "number"), attr("form", "Formulario", "ID del formulario asociado.")],
  option: [attr("value", "Valor", "Valor que aporta la opción."), attr("selected", "Seleccionada", "Indica la selección inicial.", "boolean"), attr("label", "Etiqueta", "Texto alternativo visible."), attr("disabled", "Desactivada", "Impide elegir esta opción.", "boolean")],
  optgroup: [attr("label", "Etiqueta", "Nombre del grupo."), attr("disabled", "Desactivado", "Desactiva las opciones del grupo.", "boolean")],
  label: [attr("for", "Control asociado", "ID del control etiquetado."), attr("form", "Formulario", "ID del formulario asociado.")],
  fieldset: [attr("disabled", "Desactivado", "Desactiva los controles del grupo.", "boolean"), attr("form", "Formulario", "ID del formulario asociado."), attr("name", "Nombre", "Nombre del grupo.")],
  output: [attr("for", "Controles asociados", "Lista de IDs relacionados."), attr("form", "Formulario", "ID del formulario asociado."), attr("name", "Nombre", "Nombre del resultado.")],
  progress: [attr("value", "Valor", "Progreso actual." , "number"), attr("max", "Máximo", "Progreso total.", "number")],
  meter: [attr("value", "Valor", "Medida actual.", "number"), attr("min", "Mínimo", "Límite inferior.", "number"), attr("max", "Máximo", "Límite superior.", "number"), attr("low", "Límite bajo", "Umbral bajo.", "number"), attr("high", "Límite alto", "Umbral alto.", "number"), attr("optimum", "Valor óptimo", "Valor considerado óptimo.", "number")],
  table: [attr("width", "Ancho heredado", "Atributo antiguo conservado por compatibilidad; se recomienda CSS.", "number")],
  th: [attr("scope", "Alcance", "Relación del encabezado.", "select", ["row", "col", "rowgroup", "colgroup"]), attr("colspan", "Columnas combinadas", "Número de columnas ocupadas.", "number"), attr("rowspan", "Filas combinadas", "Número de filas ocupadas.", "number"), attr("headers", "Encabezados", "IDs de encabezados relacionados.")],
  td: [attr("colspan", "Columnas combinadas", "Número de columnas ocupadas.", "number"), attr("rowspan", "Filas combinadas", "Número de filas ocupadas.", "number"), attr("headers", "Encabezados", "IDs de encabezados relacionados.")],
  col: [attr("span", "Columnas", "Número de columnas que representa.", "number"), attr("width", "Ancho heredado", "Ancho de columnas; se recomienda CSS.")],
  colgroup: [attr("span", "Columnas", "Número de columnas del grupo.", "number"), attr("width", "Ancho heredado", "Ancho de columnas; se recomienda CSS.")],
  ol: [attr("start", "Inicio", "Número inicial de la lista.", "number"), attr("reversed", "Orden inverso", "Enumera en orden descendente.", "boolean"), attr("type", "Marcador", "Estilo del marcador.", "select", ["1", "a", "A", "i", "I"])],
  li: [attr("value", "Número", "Valor numérico de este elemento en una lista ordenada.", "number")],
  blockquote: [attr("cite", "Fuente", "URL de la fuente de la cita.")], q: [attr("cite", "Fuente", "URL de la fuente de la cita.")],
  ins: [attr("cite", "Fuente", "Motivo o referencia del cambio.") , attr("datetime", "Fecha", "Fecha del cambio en formato legible por máquinas.")],
  del: [attr("cite", "Fuente", "Motivo o referencia de la eliminación.") , attr("datetime", "Fecha", "Fecha del cambio en formato legible por máquinas.")],
  time: [attr("datetime", "Fecha normalizada", "Fecha u hora legible por máquinas.")],
  data: [attr("value", "Valor asociado", "Valor legible por máquinas asociado al texto.")],
  abbr: [],
  details: [attr("open", "Abierto", "Muestra el contenido del panel.", "boolean")],
  dialog: [attr("open", "Abierto", "Indica que el diálogo está abierto en el documento.", "boolean")],
  canvas: [attr("width", "Ancho del lienzo", "Ancho de bitmap, distinto de CSS.", "number"), attr("height", "Alto del lienzo", "Alto de bitmap, distinto de CSS.", "number")],
  map: [attr("name", "Nombre", "Nombre usado por usemap en una imagen.")],
  object: [attr("data", "Recurso", "URL del recurso incrustado."), attr("type", "Tipo MIME", "Tipo del recurso."), attr("name", "Nombre", "Nombre del contexto."), attr("form", "Formulario", "ID del formulario asociado."), attr("width", "Ancho", "Ancho del objeto.", "number"), attr("height", "Alto", "Alto del objeto.", "number")],
  embed: [attr("src", "Origen", "URL del contenido incrustado."), attr("type", "Tipo MIME", "Tipo del recurso."), attr("width", "Ancho", "Ancho del contenido.", "number"), attr("height", "Alto", "Alto del contenido.", "number")],
  param: [attr("name", "Nombre", "Nombre del parámetro."), attr("value", "Valor", "Valor del parámetro.")],
  meta: [attr("name", "Nombre", "Nombre del metadato."), attr("content", "Contenido", "Valor del metadato."), attr("charset", "Codificación", "Codificación del documento."), attr("http-equiv", "Directiva HTTP", "Directiva equivalente de cabecera."), attr("property", "Propiedad", "Propiedad de metadatos, por ejemplo Open Graph.")],
  link: [attr("rel", "Relación", "Relación con el recurso enlazado."), attr("href", "Origen", "URL del recurso."), attr("media", "Medios", "Medios a los que aplica."), attr("type", "Tipo MIME", "Tipo de recurso."), attr("sizes", "Tamaños", "Tamaños de icono."), attr("crossorigin", "CORS", "Modo de solicitud CORS.", "select", ["anonymous", "use-credentials"])],
  script: [attr("src", "Origen", "Archivo de script; Prisma no lo ejecuta."), attr("type", "Tipo", "Tipo o módulo de script; Prisma no lo ejecuta."), attr("async", "Asíncrono", "Carga asíncrona.", "boolean"), attr("defer", "Diferido", "Difiere la ejecución del script.", "boolean"), attr("nomodule", "Sin módulo", "Se omite en navegadores con módulos.", "boolean"), attr("crossorigin", "CORS", "Modo de solicitud CORS.", "select", ["anonymous", "use-credentials"]), attr("integrity", "Integridad", "Hash de integridad del recurso."), attr("nonce", "Nonce", "Valor de autorización CSP.")],
  style: [attr("media", "Medios", "Condición de medios para la hoja."), attr("type", "Tipo", "Tipo de contenido CSS."), attr("nonce", "Nonce", "Valor de autorización CSP.")],
  base: [attr("href", "URL base", "URL base para resolver rutas relativas."), attr("target", "Ventana", "Contexto predeterminado de navegación.")],
  title: [],
};

export function tagSpecificAttributes(tag: string, attributes: readonly { name: string; value: string | null }[]) {
  const normalizedTag = tag.toLowerCase();
  const inputType = (attributes.find((item) => item.name.toLowerCase() === "type")?.value ?? "text").toLowerCase();
  return (definitions[normalizedTag] ?? []).filter((definition) => !definition.inputTypes || definition.inputTypes.includes(inputType));
}

export function hasSpecificAttributeCatalog(tag: string) {
  return Object.prototype.hasOwnProperty.call(definitions, tag.toLowerCase());
}

export const CSS_RECOMMENDED_BY_TAG: Readonly<Record<string, readonly string[]>> = {
  a: ["text-decoration", "text-underline-offset", "cursor"],
  img: ["object-fit", "object-position", "aspect-ratio"],
  video: ["object-fit", "object-position", "aspect-ratio"],
  table: ["border-collapse", "border-spacing", "table-layout", "caption-side"],
  caption: ["caption-side"], tr: ["border-collapse", "border-spacing"], th: ["text-align", "vertical-align"], td: ["text-align", "vertical-align"],
  input: ["accent-color", "caret-color", "appearance"],
  ul: ["list-style-type", "list-style-position", "list-style-image"],
  ol: ["list-style-type", "list-style-position", "list-style-image"],
  dialog: ["position", "inset", "max-width"],
};

export const CSS_RECOMMENDED_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  "object-fit": ["fill", "contain", "cover", "none", "scale-down"],
  "object-position": ["center", "top", "right", "bottom", "left"],
  "border-collapse": ["collapse", "separate"], "table-layout": ["auto", "fixed"],
  "caption-side": ["top", "bottom"], "appearance": ["none", "auto"],
  "list-style-type": ["disc", "circle", "square", "decimal", "decimal-leading-zero", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman", "none"],
  "list-style-position": ["outside", "inside"],
  "text-decoration": ["none", "underline", "overline", "line-through"],
};
