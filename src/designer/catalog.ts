import { isKnownTag } from "./html.ts";

/** Nombres de presentación: nunca se usan al serializar HTML. */
export const TAG_LABELS: Readonly<Record<string, string>> = {
  a: "Enlace", abbr: "Abreviatura", address: "Información de contacto", area: "Área de mapa de imagen",
  article: "Artículo", aside: "Contenido complementario", audio: "Audio", b: "Texto en negrita",
  base: "URL base del documento", bdi: "Texto bidireccional aislado", bdo: "Dirección del texto",
  blockquote: "Cita extensa", body: "Cuerpo del documento", br: "Salto de línea", button: "Botón",
  canvas: "Lienzo HTML", caption: "Título de tabla", cite: "Referencia a una obra", code: "Código",
  col: "Columna", colgroup: "Grupo de columnas", data: "Dato asociado", datalist: "Opciones sugeridas",
  dd: "Descripción de término", del: "Contenido eliminado", details: "Panel desplegable", dfn: "Término definido",
  dialog: "Diálogo", div: "Contenedor", dl: "Lista de descripciones", dt: "Término", em: "Énfasis",
  embed: "Contenido incrustado", fieldset: "Grupo de campos", figcaption: "Pie de figura", figure: "Figura",
  footer: "Pie de página o sección", form: "Formulario", h1: "Título 1", h2: "Título 2", h3: "Título 3",
  h4: "Título 4", h5: "Título 5", h6: "Título 6", head: "Metadatos del documento",
  header: "Encabezado de página o sección", hgroup: "Grupo de encabezados", hr: "Separador temático",
  html: "Documento HTML", i: "Texto en otra voz", iframe: "Marco de contenido externo", img: "Imagen",
  input: "Campo de entrada", ins: "Contenido insertado", kbd: "Entrada de teclado", label: "Etiqueta de campo",
  legend: "Título de grupo", li: "Elemento de lista", link: "Enlace a un recurso", main: "Contenido principal",
  map: "Mapa de imagen", mark: "Texto resaltado", menu: "Lista de acciones", meta: "Metadato",
  meter: "Medidor", nav: "Navegación", noscript: "Alternativa sin JavaScript", object: "Recurso externo",
  ol: "Lista ordenada", optgroup: "Grupo de opciones", option: "Opción", output: "Resultado de cálculo",
  p: "Párrafo", picture: "Imagen adaptable", pre: "Texto preformateado", progress: "Progreso", q: "Cita breve",
  rp: "Alternativa para anotación Ruby", rt: "Texto de anotación Ruby", ruby: "Anotación Ruby", s: "Texto no vigente",
  samp: "Salida de programa", script: "Código JavaScript", search: "Región de búsqueda", section: "Sección",
  select: "Lista de selección", slot: "Punto de inserción de componente", small: "Nota secundaria", source: "Fuente multimedia",
  span: "Contenedor de texto", strong: "Importancia del texto", style: "Hoja de estilos", sub: "Subíndice",
  summary: "Resumen desplegable", sup: "Superíndice", table: "Tabla", tbody: "Cuerpo de tabla", td: "Celda de tabla",
  template: "Plantilla HTML", textarea: "Área de texto", tfoot: "Pie de tabla", th: "Celda de encabezado",
  thead: "Encabezado de tabla", time: "Fecha u hora", title: "Título del documento", tr: "Fila de tabla",
  track: "Pista de subtítulos", u: "Anotación de texto", ul: "Lista desordenada", var: "Variable",
  video: "Vídeo", wbr: "Punto posible de salto de línea",
};

const TAG_DESCRIPTIONS: Readonly<Record<string, string>> = {
  div: "Agrupa elementos para organizarlos como una unidad o aplicarles estilos comunes.",
  span: "Agrupa una parte breve del texto sin crear por sí sola una sección nueva.",
  header: "Agrupa el encabezado de una página o sección, como un título y su introducción.",
  nav: "Agrupa enlaces de navegación importantes, por ejemplo el menú principal.",
  main: "Identifica el contenido principal de la página; normalmente hay uno por documento.",
  section: "Agrupa contenido relacionado que forma una sección temática; suele incluir un encabezado.",
  article: "Representa contenido independiente que puede entenderse por sí mismo, como una noticia.",
  footer: "Agrupa información de cierre de una página o sección, como créditos o enlaces relacionados.",
  h1: "Representa un encabezado de nivel principal. Úsalo para expresar la estructura del contenido.",
  h2: "Representa un encabezado de segundo nivel dentro de la jerarquía del contenido.",
  h3: "Representa un encabezado de tercer nivel dentro de la jerarquía del contenido.",
  h4: "Representa un encabezado de cuarto nivel dentro de la jerarquía del contenido.",
  h5: "Representa un encabezado de quinto nivel dentro de la jerarquía del contenido.",
  h6: "Representa un encabezado de sexto nivel dentro de la jerarquía del contenido.",
  p: "Representa un párrafo de texto.",
  button: "Permite realizar una acción, como enviar un formulario o abrir un panel. El comportamiento depende del contexto y del código asociado.",
  a: "Crea un enlace a otra página, archivo o ubicación; el atributo href indica el destino.",
  img: "Muestra una imagen. El atributo alt aporta una alternativa textual cuando corresponda.",
  form: "Agrupa controles para recopilar o enviar datos.",
  input: "Crea un control de entrada; su formato depende del atributo type.",
  textarea: "Permite introducir texto de varias líneas.",
  select: "Permite elegir una o varias opciones incluidas en sus elementos option.",
  option: "Define una opción dentro de un control select o datalist.",
  label: "Asocia un texto descriptivo con un control de formulario.",
  ul: "Agrupa elementos de una lista sin un orden numérico inherente.",
  ol: "Agrupa elementos de una lista ordenada, normalmente numerada.",
  li: "Representa un elemento dentro de una lista.",
  table: "Representa datos tabulares organizados en filas y columnas.",
  tr: "Define una fila de una tabla.",
  th: "Define una celda que actúa como encabezado de una fila o columna.",
  td: "Define una celda de datos dentro de una fila.",
  video: "Inserta un reproductor de vídeo; sus fuentes y controles dependen de sus atributos e hijos.",
  audio: "Inserta un reproductor de audio; sus fuentes y controles dependen de sus atributos e hijos.",
  canvas: "Ofrece una superficie de dibujo que normalmente controla JavaScript; Prisma no ejecuta ese código.",
  iframe: "Incrusta otro documento o página externa. Revisa su origen y atributos de seguridad.",
  script: "Referencia o contiene código de script. Prisma conserva su contenido y no lo ejecuta en el diseñador.",
};

const TAG_EXAMPLES: Readonly<Record<string, string>> = {
  div: "<div>Contenido agrupado</div>",
  button: "<button type=\"button\">Guardar</button>",
  h1: "<h1>Título principal</h1>",
  p: "<p>Un párrafo de ejemplo.</p>",
  a: "<a href=\"/acerca\">Acerca de</a>",
  img: "<img src=\"foto.jpg\" alt=\"Descripción de la imagen\">",
  input: "<input type=\"email\" name=\"correo\">",
};

export interface TagInfo { tag: string; label: string; description: string; known: boolean; example?: string; }

export function tagInfo(tag: string): TagInfo {
  const normalized = tag.toLowerCase();
  const known = isKnownTag(normalized);
  const label = TAG_LABELS[normalized] ?? tag;
  return {
    tag,
    label: known ? label : tag,
    known,
    example: TAG_EXAMPLES[normalized],
    description: known
      ? TAG_DESCRIPTIONS[normalized] ?? `Representa ${label.toLowerCase()}. Úsalo cuando ese sea el propósito semántico del contenido.`
      : `Etiqueta personalizada <${tag}>. Prisma conserva su nombre y contenido; su significado depende del proyecto o framework.`,
  };
}

const CSS_HELP: Readonly<Record<string, string>> = {
  width: "Ancho del elemento dentro de su contexto de diseño.", height: "Alto del elemento dentro de su contexto de diseño.", "min-width": "Ancho mínimo permitido.", "max-width": "Ancho máximo permitido.",
  "min-height": "Alto mínimo permitido.", "max-height": "Alto máximo permitido.", margin: "Espacio exterior alrededor del elemento.",
  padding: "Espacio interior entre el contenido y el borde.", position: "Define cómo participa el elemento en el flujo y cómo se posiciona.",
  top: "Desplazamiento desde el borde superior del contenedor de posicionamiento.", right: "Desplazamiento desde el borde derecho del contenedor de posicionamiento.",
  bottom: "Desplazamiento desde el borde inferior del contenedor de posicionamiento.", left: "Desplazamiento desde el borde izquierdo del contenedor de posicionamiento.",
  display: "Define cómo se presenta el elemento y cómo se distribuyen sus hijos.", "text-align": "Alinea el contenido en línea, como el texto, dentro del elemento.",
  border: "Define el grosor, estilo y color del borde.", "border-radius": "Redondea las esquinas del borde.", color: "Color del texto y del contenido que hereda esta propiedad.",
  "background-color": "Color de fondo del elemento.", "font-size": "Tamaño del texto.", "line-height": "Altura de línea del texto; afecta al espacio vertical entre líneas.",
  visibility: "Muestra u oculta el elemento conservando su espacio en el diseño.", overflow: "Define qué ocurre cuando el contenido excede la caja del elemento.",
  gap: "Espacio entre elementos hijos en diseños flex o grid.", "align-items": "Alinea los hijos en el eje transversal de flex o grid.",
  "justify-content": "Distribuye los hijos a lo largo del eje principal o de las columnas.", "z-index": "Orden de apilamiento; tiene efecto según el contexto de posicionamiento.",
};

export function cssPropertyHelp(property: string): string {
  const normalized = property.toLowerCase();
  return CSS_HELP[normalized] ?? `Valor CSS de ${normalized}; su efecto depende de la propiedad y del contexto de diseño.`;
}

const ATTRIBUTE_HELP: Readonly<Record<string, string>> = {
  id: "Identificador del elemento dentro del documento. Debe ser único para evitar referencias ambiguas.",
  class: "Lista de clases que CSS y otros recursos pueden usar para seleccionar o agrupar elementos.",
  href: "Destino de un enlace o referencia; su significado depende de la etiqueta.",
  src: "Ubicación del recurso que utiliza el elemento, como una imagen, audio o script.",
  alt: "Alternativa textual de una imagen cuando no puede verse; describe su propósito o contenido.",
  placeholder: "Texto orientativo de un campo vacío; no reemplaza una etiqueta accesible.",
  required: "Indica que el control es obligatorio y debe tener un valor antes de enviar el formulario, si la etiqueta lo admite.",
  disabled: "Desactiva la interacción del control cuando la etiqueta admite este atributo.",
  target: "Indica el contexto donde se abre el destino de un enlace.",
  name: "Nombre usado por el formulario al enviar el valor del control.",
  value: "Valor asociado al control; su uso varía según la etiqueta y su tipo.",
  title: "Texto auxiliar asociado al elemento; no sustituye una etiqueta visible o accesible.",
  "aria-label": "Nombre accesible para tecnologías de asistencia cuando no hay un nombre visible suficiente.",
  rel: "Describe la relación entre el documento actual y el destino del enlace.",
  action: "URL a la que el formulario envía sus datos.", method: "Método HTTP que el formulario usa para enviar sus datos.",
  rows: "Cantidad visible de filas de texto en textarea.", cols: "Ancho visible aproximado de textarea en caracteres.",
  controls: "Solicita controles de reproducción para audio o vídeo.", muted: "Inicia audio o vídeo silenciado.", loop: "Repite audio o vídeo al terminar.",
  poster: "Imagen que se muestra como portada antes de reproducir el vídeo.",
};

export function attributeHelp(tag: string, attribute: string): string {
  const name = attribute.toLowerCase();
  if (name === "type" && tag.toLowerCase() === "script") return "Indica el tipo o formato del script, por ejemplo un módulo; no se ejecuta desde el diseñador.";
  if (name === "type" && tag.toLowerCase() === "button") return "Define si el botón envía el formulario, lo restablece o actúa como botón común.";
  if (name === "type" && tag.toLowerCase() === "input") return "Selecciona el tipo de campo, por ejemplo texto, correo o casilla de verificación.";
  if (name === "type") return `Atributo type de <${tag}>. Su efecto depende de la etiqueta y del estándar o framework que la defina.`;
  return ATTRIBUTE_HELP[name] ?? `Atributo ${attribute} de <${tag}>. Su significado lo define la especificación HTML o el framework del proyecto.`;
}
