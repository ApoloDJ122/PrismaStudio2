/**
 * M2.2.0 - Edición de texto CSS.
 *
 * El analizador de `css.ts` es de solo lectura y devuelve hojas en memoria;
 * aquí hacemos lo contrario: cambiar el texto del archivo de forma quirúrgica.
 *
 * Por qué texto y no árbol: el usuario escribe CSS a mano. Comentarios,
 * orden de propiedades, sangrías, `@media` y `{ }` propios del proyecto
 * desaparecerían si serializáramos una hoja que antes solo habíamos leído.
 * Así que solo se toca lo necesario: la declaración que cambia, o una regla
 * nueva al final del archivo.
 *
 * Reglas del escáner:
 * - Solo se miran reglas de nivel superior; lo que hay dentro de un `@media`
 *   queda intacto y, si hiciera falta una regla para ese selector, se anade
 *   nueva al final (igual especificidad, gana la última).
 * - Un selector que aparece en una lista compartida (`.a, .b`) no se edita:
 *   afectaría a la otra clase. En ese caso se anade una regla propia.
 * - Los comentarios y las cadenas se saltan, para no confundir un `}` dentro
 *   de un comentario con el cierre de la regla.
 */

export interface Box {
  x: number;
  y: number;
}

export interface ResponsiveBreakpoint {
  condition: string;
  kind: "min-width" | "max-width";
  width: number;
  ruleCount: number;
}

/** Breakpoints editables: únicamente consultas simples de ancho a nivel raíz. */
export function responsiveBreakpoints(text: string): ResponsiveBreakpoint[] {
  const out: ResponsiveBreakpoint[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    if (text[cursor] === "/" && text[cursor + 1] === "*") { cursor = skipComment(text, cursor); continue; }
    if (text[cursor] === '"' || text[cursor] === "'") { cursor = skipString(text, cursor); continue; }
    if (text[cursor] === "{") {
      const end = matchBrace(text, cursor);
      if (end < 0) break;
      const header = text.slice(0, cursor).slice(Math.max(text.lastIndexOf("}", cursor - 1), text.lastIndexOf(";", cursor - 1)) + 1).trim();
      if (/^@media\b/i.test(header)) {
        const condition = header.replace(/^@media\s*/i, "").trim();
        const match = /^\(\s*(min|max)-width\s*:\s*(\d+(?:\.\d+)?)\s*(px|em|rem)\s*\)$/i.exec(condition);
        if (match) {
          const direction = match[1] ?? "max";
          const unit = match[3] ?? "px";
          const kind = `${direction.toLowerCase()}-width` as ResponsiveBreakpoint["kind"];
          const width = Number(match[2] ?? 0) * (unit.toLowerCase() === "px" ? 1 : 16);
          const inner = text.slice(cursor + 1, end);
          const meaningful = inner.replace(/\/\*[\s\S]*?\*\//g, "").trim();
          const ruleCount = meaningful === "" ? 0 : Math.max(1, scanRules(inner).length);
          if (!out.some((item) => item.condition.toLowerCase() === condition.toLowerCase())) out.push({ condition, kind, width, ruleCount });
        }
      }
      cursor = end + 1;
      continue;
    }
    cursor += 1;
  }
  return out;
}

/** Añade @media max-width evitando condiciones equivalentes ya presentes. */
export function addResponsiveBreakpoint(text: string, width: number): string {
  if (!Number.isFinite(width) || width < 1) return text;
  const existing = responsiveBreakpoints(text).find((item) => item.kind === "max-width" && item.width === width);
  if (existing) return text;
  const separator = text.trim() === "" || text.endsWith("\n") ? "" : "\n";
  return `${text}${separator}\n@media (max-width: ${Math.round(width)}px) {\n}\n`;
}

/** Cambia la condición simple, preservando el bloque y todas sus reglas. */
export function renameResponsiveBreakpoint(text: string, condition: string, nextCondition: string): string {
  const valid = /^\(\s*(?:min|max)-width\s*:\s*\d+(?:\.\d+)?\s*(?:px|em|rem)\s*\)$/i;
  if (!valid.test(condition) || !valid.test(nextCondition)) return text;
  let cursor = 0;
  while (cursor < text.length) {
    if (text[cursor] === "/" && text[cursor + 1] === "*") { cursor = skipComment(text, cursor); continue; }
    if (text[cursor] === '"' || text[cursor] === "'") { cursor = skipString(text, cursor); continue; }
    if (text[cursor] === "{") {
      const end = matchBrace(text, cursor);
      if (end < 0) return text;
      const start = Math.max(text.lastIndexOf("}", cursor - 1), text.lastIndexOf(";", cursor - 1)) + 1;
      const header = text.slice(start, cursor).trim();
      if (header.toLowerCase() === `@media ${condition}`.toLowerCase()) {
        const headerStart = text.indexOf("@media", start);
        return `${text.slice(0, headerStart)}@media ${nextCondition}${text.slice(cursor)}`;
      }
      cursor = end + 1;
      continue;
    }
    cursor += 1;
  }
  return text;
}

/** Elimina solo una consulta vacía; nunca descarta reglas CSS del usuario. */
export function removeEmptyResponsiveBreakpoint(text: string, condition: string): string {
  const breakpoint = responsiveBreakpoints(text).find((item) => item.condition === condition);
  if (!breakpoint || breakpoint.ruleCount !== 0) return text;
  const marker = `@media ${condition}`;
  const index = text.toLowerCase().indexOf(marker.toLowerCase());
  const open = text.indexOf("{", index + marker.length);
  const close = open < 0 ? -1 : matchBrace(text, open);
  const body = open < 0 || close < 0 ? "" : text.slice(open + 1, close);
  if (index < 0 || open < 0 || close < 0 || body.replace(/\/\*[\s\S]*?\*\//g, "").trim() !== "") return text;
  let start = index;
  while (start > 0 && (text[start - 1] === " " || text[start - 1] === "\t")) start -= 1;
  let end = close + 1;
  if (text[end] === "\r") end += 1;
  if (text[end] === "\n") end += 1;
  return `${text.slice(0, start)}${text.slice(end)}`;
}

/** Escribe una sola propiedad dentro del selector de un @media soportado. */
export function writeResponsiveDeclaration(text: string, condition: string, selector: string, property: string, value: string): string {
  const match = /^\(\s*(?:min|max)-width\s*:\s*\d+(?:\.\d+)?\s*(?:px|em|rem)\s*\)$/i.exec(condition.trim());
  if (!match) return text;
  let cursor = 0;
  let lastBlock: { open: number; end: number } | null = null;
  while (cursor < text.length) {
    if (text[cursor] === "/" && text[cursor + 1] === "*") { cursor = skipComment(text, cursor); continue; }
    if (text[cursor] === '"' || text[cursor] === "'") { cursor = skipString(text, cursor); continue; }
    if (text[cursor] === "{") {
      const end = matchBrace(text, cursor);
      if (end < 0) return text;
      const header = text.slice(0, cursor).slice(Math.max(text.lastIndexOf("}", cursor - 1), text.lastIndexOf(";", cursor - 1)) + 1).trim();
      if (header.toLowerCase() === `@media ${condition}`.toLowerCase()) {
        lastBlock = { open: cursor, end };
      }
      cursor = end + 1;
      continue;
    }
    cursor += 1;
  }
  if (lastBlock !== null) {
    const inner = text.slice(lastBlock.open + 1, lastBlock.end);
    const next = value.trim() === "" ? removeDeclaration(inner, selector, property) : writeDeclaration(inner, selector, property, value.trim());
    if (next === inner) return text;
    return `${text.slice(0, lastBlock.open + 1)}${next}${text.slice(lastBlock.end)}`;
  }
  if (value.trim() === "") return text;
  const created = writeDeclaration("", selector, property, value.trim());
  const separator = text.trim() === "" || text.endsWith("\n") ? "" : "\n";
  return `${text}${separator}\n@media ${condition} {\n${created}\n}\n`;
}

/** Lee solo una declaración explícita del breakpoint, nunca el valor global. */
export function readResponsiveDeclaration(text: string, condition: string, selector: string, property: string): string | null {
  let cursor = 0;
  let value: string | null = null;
  while (cursor < text.length) {
    if (text[cursor] === "/" && text[cursor + 1] === "*") { cursor = skipComment(text, cursor); continue; }
    if (text[cursor] === '"' || text[cursor] === "'") { cursor = skipString(text, cursor); continue; }
    if (text[cursor] === "{") {
      const end = matchBrace(text, cursor);
      if (end < 0) return null;
      const start = Math.max(text.lastIndexOf("}", cursor - 1), text.lastIndexOf(";", cursor - 1)) + 1;
      if (text.slice(start, cursor).trim().toLowerCase() === `@media ${condition}`.toLowerCase()) {
        const next = readDeclaration(text.slice(cursor + 1, end), selector, property);
        if (next !== null) value = next;
      }
      cursor = end + 1;
      continue;
    }
    cursor += 1;
  }
  return value;
}

/** Declaraciones propias de una regla exacta, en el orden del archivo. */
export function readDeclarations(text: string, selector: string): { property: string; value: string }[] {
  const rule = findSingleRule(text, selector);
  if (rule === null) return [];
  return splitDeclarations(text.slice(rule.bodyStart, rule.bodyEnd)).map(({ property, value }) => ({ property, value }));
}

/** Lee declaraciones de `style="..."` sin confundirlas con CSS calculado. */
export function readInlineDeclarations(text: string): { property: string; value: string }[] {
  return splitDeclarations(text).map(({ property, value }) => ({ property, value }));
}

/** Cambia solo la declaración inline solicitada y conserva el resto del atributo. */
export function writeInlineDeclaration(text: string, property: string, value: string): string {
  const declarations = splitDeclarations(text);
  const existing = lastDeclaration(declarations, property.toLowerCase());
  if (value.trim() !== "") return upsertDeclaration(text, property.toLowerCase(), value.trim());
  if (existing === undefined) return text;
  const end = text[existing.end] === ";" ? existing.end + 1 : existing.end;
  return `${text.slice(0, existing.propertyStart)}${text.slice(end)}`;
}

export function readInlineDeclaration(text: string, property: string): string | null {
  return lastDeclaration(splitDeclarations(text), property.toLowerCase())?.value ?? null;
}

/** Declaraciones de una regla exacta dentro de un breakpoint simple. */
export function readResponsiveDeclarations(text: string, condition: string, selector: string): { property: string; value: string }[] {
  let cursor = 0;
  const values = new Map<string, string>();
  while (cursor < text.length) {
    if (text[cursor] === "/" && text[cursor + 1] === "*") { cursor = skipComment(text, cursor); continue; }
    if (text[cursor] === '"' || text[cursor] === "'") { cursor = skipString(text, cursor); continue; }
    if (text[cursor] === "{") {
      const end = matchBrace(text, cursor);
      if (end < 0) return [];
      const start = Math.max(text.lastIndexOf("}", cursor - 1), text.lastIndexOf(";", cursor - 1)) + 1;
      if (text.slice(start, cursor).trim().toLowerCase() === `@media ${condition}`.toLowerCase()) {
        for (const declaration of readDeclarations(text.slice(cursor + 1, end), selector)) values.set(declaration.property, declaration.value);
      }
      cursor = end + 1;
      continue;
    }
    cursor += 1;
  }
  return [...values].map(([property, value]) => ({ property, value }));
}

interface RuleSpan {
  /** Selector completo de la regla, tal y como está escrito. */
  selector: string;
  /** Posición del primer carácter del selector. */
  start: number;
  /** Posición justo después del `{`. */
  bodyStart: number;
  /** Posición del `}` que cierra la regla. */
  bodyEnd: number;
  /** Posición justo después del `}`. */
  end: number;
}

interface Declaration {
  /** Posición de inicio, incluida la sangría que la precede. */
  start: number;
  /** Posición final, sin el `;` ni el `}` que cierra. */
  end: number;
  /** Posición del `:`. */
  colon: number;
  /** Inicio del nombre de propiedad, separado de espacios y comentarios previos. */
  propertyStart: number;
  property: string;
  value: string;
}

function skipComment(text: string, index: number): number {
  const close = text.indexOf("*/", index + 2);
  return close < 0 ? text.length : close + 2;
}

function skipString(text: string, index: number): number {
  const quote = text[index];
  let cursor = index + 1;

  while (cursor < text.length) {
    const char = text[cursor];

    if (char === "\\") {
      cursor += 2;
      continue;
    }

    if (char === quote) {
      return cursor + 1;
    }

    cursor += 1;
  }

  return text.length;
}

/** Índice del `}` que cierra la llave abierta en `open`, o `-1`. */
function matchBrace(text: string, open: number): number {
  let depth = 1;
  let cursor = open + 1;

  while (cursor < text.length) {
    const char = text[cursor];

    if (char === "/" && text[cursor + 1] === "*") {
      cursor = skipComment(text, cursor);
      continue;
    }

    if (char === '"' || char === "'") {
      cursor = skipString(text, cursor);
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return cursor;
      }
    }

    cursor += 1;
  }

  return -1;
}

/** Reglas de nivel superior del texto, con sus posiciones. */
function scanRules(text: string): RuleSpan[] {
  const rules: RuleSpan[] = [];
  let cursor = 0;
  let selectorStart = 0;

  while (cursor < text.length) {
    const char = text[cursor];

    if (char === "/" && text[cursor + 1] === "*") {
      cursor = skipComment(text, cursor);
      continue;
    }

    if (char === '"' || char === "'") {
      cursor = skipString(text, cursor);
      continue;
    }

    if (char === "{") {
      const raw = text.slice(selectorStart, cursor);
      const close = matchBrace(text, cursor);

      if (close < 0) {
        break;
      }

      const leading = raw.length - raw.trimStart().length;
      const selector = raw.trim();

      if (selector !== "" && !selector.startsWith("@")) {
        rules.push({
          selector,
          start: selectorStart + leading,
          bodyStart: cursor + 1,
          bodyEnd: close,
          end: close + 1,
        });
      }

      cursor = close + 1;
      selectorStart = close + 1;
      continue;
    }

    cursor += 1;
  }

  return rules;
}

function normalizeSelector(selector: string): string {
  return selector.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Regla cuyo selector es exactamente `selector`, sin lista de selectores.
 *
 * `null` cuando no existe o cuando está compartida: en ese caso la edición
 * anade una regla nueva en su lugar de reescribir la ajena.
 */
function findSingleRule(text: string, selector: string): RuleSpan | null {
  const wanted = normalizeSelector(selector);

  for (const rule of scanRules(text)) {
    if (normalizeSelector(rule.selector) === wanted) {
      return rule;
    }
  }

  return null;
}

function splitDeclarations(body: string): Declaration[] {
  const declarations: Declaration[] = [];
  let cursor = 0;
  let start = 0;
  let paren = 0;

  const push = (end: number): void => {
    const raw = body.slice(start, end);

    if (raw.trim() === "") {
      return;
    }

    const colon = findColon(raw);

    if (colon < 0) {
      start = end;
      return;
    }

    const relativeColon = start + colon;
    const beforeColon = body.slice(start, relativeColon);
    const propertyMatch = /([-\w]+)\s*$/.exec(beforeColon);

    if (propertyMatch === null || propertyMatch[1] === undefined) {
      start = end;
      return;
    }

    declarations.push({
      start,
      end,
      colon: relativeColon,
      propertyStart: start + propertyMatch.index,
      property: propertyMatch[1].toLowerCase(),
      value: body.slice(relativeColon + 1, end).trim(),
    });
    start = end;
  };

  while (cursor < body.length) {
    const char = body[cursor];

    if (char === "/" && body[cursor + 1] === "*") {
      cursor = skipComment(body, cursor);
      continue;
    }

    if (char === '"' || char === "'") {
      cursor = skipString(body, cursor);
      continue;
    }

    if (char === "(") {
      paren += 1;
    } else if (char === ")") {
      paren = Math.max(0, paren - 1);
    } else if ((char === ";" || char === "}") && paren === 0) {
      push(cursor);
      start = cursor + 1;
    }

    cursor += 1;
  }

  push(body.length);
  return declarations;
}

function lastDeclaration(items: Declaration[], property: string): Declaration | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.property === property) return item;
  }
  return undefined;
}

/** Posición del `:` que separa propiedad de valor, ignorando cadenas y paréntesis. */
function findColon(text: string): number {
  let cursor = 0;
  let paren = 0;

  while (cursor < text.length) {
    const char = text[cursor];

    if (char === "/" && text[cursor + 1] === "*") {
      cursor = skipComment(text, cursor);
      continue;
    }

    if (char === '"' || char === "'") {
      cursor = skipString(text, cursor);
      continue;
    }

    if (char === "(") {
      paren += 1;
    } else if (char === ")") {
      paren = Math.max(0, paren - 1);
    } else if (char === ":" && paren === 0) {
      return cursor;
    }

    cursor += 1;
  }

  return -1;
}

function hasImportant(value: string): boolean {
  return /!\s*important\s*$/i.test(value);
}

/**
 * Escribe `property: value` dentro del cuerpo de una regla.
 *
 * Si la propiedad ya está, se cambia solo su valor y se conservan el resto de
 * las declaraciones, la sangría y un eventual `!important` que traiga el
 * original. Si no está, se anade antes del cierre con el mismo formato.
 */
function upsertDeclaration(body: string, property: string, value: string): string {
  const wanted = property.toLowerCase();
  const declarations = splitDeclarations(body);
  const existing = lastDeclaration(declarations, wanted);

  if (existing !== undefined) {
    const next = hasImportant(existing.value) && !hasImportant(value)
      ? `${value} !important`
      : value;
    const head = body.slice(existing.start, existing.colon + 1);
    return `${body.slice(0, existing.start)}${head} ${next}${body.slice(existing.end)}`;
  }

  const trailingMatch = body.match(/\s*$/);
  const trailing = trailingMatch?.[0] ?? "";
  const core = body.slice(0, body.length - trailing.length);
  const indentation = /(^|\n)([ \t]*)$/.exec(core);
  const indent = indentation?.[2] ?? "  ";
  const separator = core.trim() === "" || core.endsWith(";") ? "" : ";";

  if (core.trim() === "") {
    return `${core}\n${indent}${property}: ${value};${trailing}`;
  }

  return `${core}${separator}\n${indent}${property}: ${value};${trailing}`;
}

function appendRule(text: string, selector: string, declarations: [string, string][]): string {
  const body = declarations
    .map(([property, value]) => `  ${property}: ${value};`)
    .join("\n");
  const rule = `${selector} {\n${body}\n}\n`;
  const base = text === "" || text.endsWith("\n") ? text : `${text}\n`;
  return `${base}\n${rule}`;
}

/** `left`/`top` actuales de una regla, o `null` si alguno no es un desplazamiento en px. */
export function readBox(text: string, selector: string): Box | null {
  const rule = findSingleRule(text, selector);

  if (rule === null) {
    return null;
  }

  const body = text.slice(rule.bodyStart, rule.bodyEnd);
  const declarations = splitDeclarations(body);
  const left = declarations.find((item) => item.property === "left");
  const top = declarations.find((item) => item.property === "top");

  if (left === undefined || top === undefined) {
    return null;
  }

  const leftMatch = /^(-?\d+(?:\.\d+)?)px$/.exec(left.value.trim());
  const topMatch = /^(-?\d+(?:\.\d+)?)px$/.exec(top.value.trim());

  if (leftMatch === null || topMatch === null || leftMatch[1] === undefined || topMatch[1] === undefined) {
    return null;
  }

  return { x: Number(leftMatch[1]), y: Number(topMatch[1]) };
}

/**
 * Escribe `position: absolute` con `left`/`top` para `selector`.
 *
 * Si la regla ya existe se actualiza dentro de ella; si no existe, o si solo
 * aparece dentro de una lista compartida, se anade una regla propia al final
 * del archivo. En ningún caso se duplica la regla del selector.
 */
export function writeBox(text: string, selector: string, box: Box): string {
  const rule = findSingleRule(text, selector);

  if (rule === null) {
    return appendRule(text, selector, [
      ["position", "absolute"],
      ["left", `${box.x}px`],
      ["top", `${box.y}px`],
    ]);
  }

  let body = text.slice(rule.bodyStart, rule.bodyEnd);
  body = upsertDeclaration(body, "position", "absolute");
  body = upsertDeclaration(body, "left", `${box.x}px`);
  body = upsertDeclaration(body, "top", `${box.y}px`);
  return `${text.slice(0, rule.bodyStart)}${body}${text.slice(rule.bodyEnd)}`;
}

/**
 * Garantiza que `selector` sea contexto de posicionamiento.
 *
 * No sobreescribe si la regla ya tiene una posición que sirva: un elemento
 * `absolute`, `fixed` o `sticky` ya sitúa a sus hijos, y cambiarlo a `relative`
 * rompería su propio movimiento.
 */
export function ensurePositionRelative(text: string, selector: string): string {
  const rule = findSingleRule(text, selector);

  if (rule === null) {
    return appendRule(text, selector, [["position", "relative"]]);
  }

  const body = text.slice(rule.bodyStart, rule.bodyEnd);
  const declarations = splitDeclarations(body);
  const position = declarations.find((item) => item.property === "position");

  if (position !== undefined && position.value.trim() !== "static") {
    return text;
  }

  const next = upsertDeclaration(body, "position", "relative");
  return `${text.slice(0, rule.bodyStart)}${next}${text.slice(rule.bodyEnd)}`;
}

/** Valor de una declaración concreta de la regla, o `null`. */
export function readDeclaration(text: string, selector: string, property: string): string | null {
  const rule = findSingleRule(text, selector);

  if (rule === null) {
    return null;
  }

  const body = text.slice(rule.bodyStart, rule.bodyEnd);
  const declarations = splitDeclarations(body);
  const wanted = property.toLowerCase();
  const found = lastDeclaration(declarations, wanted);
  return found === undefined ? null : found.value;
}

/** `true` si hay una regla con ese selector exacto. */
export function hasRule(text: string, selector: string): boolean {
  return findSingleRule(text, selector) !== null;
}

/**
 * Escribe una declaración cualquiera (`margin`, `color`, `display`, ...) para
 * `selector`, creando la regla al final si no existe.
 *
 * Misma cirugía que `writeBox`: si el selector solo aparece en una lista
 * compartida, se añade una regla propia en lugar de tocar la ajena.
 */
export function writeDeclaration(
  text: string,
  selector: string,
  property: string,
  value: string,
): string {
  const rule = findSingleRule(text, selector);

  if (rule === null) {
    return appendRule(text, selector, [[property.toLowerCase(), value]]);
  }

  const body = text.slice(rule.bodyStart, rule.bodyEnd);
  const next = upsertDeclaration(body, property.toLowerCase(), value);
  return `${text.slice(0, rule.bodyStart)}${next}${text.slice(rule.bodyEnd)}`;
}

/** Quita una declaración propia, conservando intactas las demás reglas. */
export function removeDeclaration(text: string, selector: string, property: string): string {
  const rule = findSingleRule(text, selector);
  if (rule === null) return text;

  const body = text.slice(rule.bodyStart, rule.bodyEnd);
  const declaration = lastDeclaration(splitDeclarations(body), property.toLowerCase());
  if (declaration === undefined) return text;

  const end = body[declaration.end] === ";" ? declaration.end + 1 : declaration.end;
  const next = `${body.slice(0, declaration.propertyStart)}${body.slice(end)}`;
  return `${text.slice(0, rule.bodyStart)}${next}${text.slice(rule.bodyEnd)}`;
}

/**
 * Quita los bloques `@...` de un texto CSS (`@media`, `@import`, `@font-face`).
 *
 * El lienzo es desktop-first: lo responsive queda para otro módulo. Además, una
 * regla dentro de un `@media` no se puede reescribir con el mismo prefijo que
 * las de nivel superior, así que para previsualizar se ignoran en lugar de
 * aplicarlas a medias.
 */
export function stripAtRules(text: string): string {
  let out = "";
  let cursor = 0;
  let index = 0;
  let depth = 0;

  const flush = (end: number): void => {
    out += text.slice(cursor, end);
    cursor = end;
  };

  while (index < text.length) {
    const char = text[index];

    if (char === "/" && text[index + 1] === "*") {
      index = skipComment(text, index);
      continue;
    }

    if (char === '"' || char === "'") {
      index = skipString(text, index);
      continue;
    }

    if (depth === 0 && char === "@" && /[a-zA-Z]/.test(text[index + 1] ?? "")) {
      flush(index);
      const semicolon = text.indexOf(";", index);
      const brace = text.indexOf("{", index);

      if (brace >= 0 && (semicolon < 0 || brace < semicolon)) {
        const close = matchBrace(text, brace);
        index = close < 0 ? text.length : close + 1;
      } else if (semicolon >= 0) {
        index = semicolon + 1;
      } else {
        index = text.length;
      }

      cursor = index;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
    }

    index += 1;
  }

  flush(text.length);
  return out;
}

/** Prefija cada selector de una lista con el ámbito (`body`/`html` se absorben). */
function scopeSelectorList(selector: string, scope: string): string {
  return selector
    .split(",")
    .map((part) => {
      const trimmed = part
        .trim()
        .replace(/^(?:(?:html|body)(?![\w-])\s*)+/i, "")
        .trim();
      return trimmed === "" ? scope : `${scope} ${trimmed}`;
    })
    .join(", ");
}

function scopeTopLevelRules(text: string, scope: string): string {
  const rules = scanRules(text);
  let out = "";
  let cursor = 0;

  for (const rule of rules) {
    out += text.slice(cursor, rule.start);
    out += scopeSelectorList(rule.selector, scope);
    out += ` ${text.slice(rule.bodyStart - 1, rule.end)}`;
    cursor = rule.end;
  }

  return out + text.slice(cursor);
}

/** Convierte unidades de viewport al viewport emulado por el lienzo. */
function scopeViewportUnits(text: string): string {
  const units: Record<string, string> = {
    vw: "cqw", svw: "cqw", lvw: "cqw", dvw: "cqw",
    vh: "cqh", svh: "cqh", lvh: "cqh", dvh: "cqh",
    vi: "cqi", vb: "cqb", vmin: "cqmin", vmax: "cqmax",
  };
  const pattern = /^(\d+(?:\.\d*)?|\.\d+)(dvw|svw|lvw|dvh|svh|lvh|vmin|vmax|vw|vh|vi|vb)\b/i;
  let out = "";
  let index = 0;

  while (index < text.length) {
    if (text[index] === "/" && text[index + 1] === "*") {
      const end = skipComment(text, index);
      out += text.slice(index, end);
      index = end;
      continue;
    }
    if (text[index] === "'" || text[index] === '"') {
      const end = skipString(text, index);
      out += text.slice(index, end);
      index = end;
      continue;
    }

    const previous = text[index - 1] ?? "";
    const match = /[\w.-]/.test(previous) ? null : pattern.exec(text.slice(index));
    if (match !== null) {
      const unit = (match[2] ?? "").toLowerCase();
      out += `${match[1]}${units[unit] ?? unit}`;
      index += match[0].length;
      continue;
    }

    out += text[index];
    index += 1;
  }

  return out;
}

/**
 * Limita las reglas al documento y traduce las consultas y unidades del viewport
 * a la pantalla emulada dentro del lienzo.
 */
export function scopeResponsiveCss(text: string, scope: string): string {
  let out = "";
  let cursor = 0;
  let index = 0;
  let depth = 0;

  while (index < text.length) {
    const char = text[index];
    if (char === "/" && text[index + 1] === "*") {
      index = skipComment(text, index);
      continue;
    }
    if (char === "'" || char === '"') {
      index = skipString(text, index);
      continue;
    }
    if (depth === 0 && char === "@" && /^@media\b/i.test(text.slice(index))) {
      const brace = text.indexOf("{", index);
      if (brace < 0) break;
      const close = matchBrace(text, brace);
      if (close < 0) break;
      out += scopeTopLevelRules(text.slice(cursor, index), scope);
      const header = text.slice(index, brace);
      const condition = header.replace(/^@media\s*/i, "").replace(/^(?:only\s+)?screen(?:\s+and)?\s*/i, "").trim();
      const responsive = /\b(?:min|max)-(?:width|height|aspect-ratio)\b|\b(?:width|height|aspect-ratio|orientation)\b/i.test(condition);
      const scopedHeader = responsive
        ? `@container ds-preview ${condition}`
        : header;
      out += `${scopedHeader} {${scopeResponsiveCss(text.slice(brace + 1, close), scope)}}`;
      index = close + 1;
      cursor = index;
      continue;
    }
    if (depth === 0 && char === "@" && /[a-z]/i.test(text[index + 1] ?? "")) {
      const brace = text.indexOf("{", index);
      const semicolon = text.indexOf(";", index);
      out += scopeTopLevelRules(text.slice(cursor, index), scope);
      if (brace >= 0 && (semicolon < 0 || brace < semicolon)) {
        const close = matchBrace(text, brace);
        index = close < 0 ? text.length : close + 1;
      } else {
        index = semicolon < 0 ? text.length : semicolon + 1;
      }
      cursor = index;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") depth = Math.max(0, depth - 1);
    index += 1;
  }

  out += scopeTopLevelRules(text.slice(cursor), scope);
  return scopeViewportUnits(out);
}

/** Ámbito clásico del lienzo: elimina los bloques `@...` como hacía M2.2.1. */
export function scopeCss(text: string, scope: string): string {
  return scopeTopLevelRules(stripAtRules(text), scope);
}
