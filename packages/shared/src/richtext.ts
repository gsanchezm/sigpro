// Saneado del HTML del editor enriquecido (`contenteditable`) con lista blanca. Función pura: sin DOM,
// así corre igual en la API (al guardar) y en la web (al cargar/guardar). Ningún atributo sobrevive.

const ALLOWED = new Set(['strong', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li']);
/** `execCommand` de Chromium genera <b>, <i> y <div>: se normalizan a sus equivalentes semánticos. */
const ALIASES: ReadonlyMap<string, string> = new Map([
  ['b', 'strong'],
  ['i', 'em'],
  ['div', 'p'],
]);
const DROP_CONTENT = new Set(['script', 'style', 'iframe', 'object']);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

const escapeText = (text: string): string =>
  text
    .replace(/&(?!(?:amp|lt|gt|quot|#39|nbsp);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

interface State {
  readonly out: string;
  readonly open: readonly string[];
  readonly dropDepth: number;
}

const openTag = (state: State, name: string): State =>
  name === 'br' ? { ...state, out: `${state.out}<br>` } : { ...state, out: `${state.out}<${name}>`, open: [...state.open, name] };

const closeTag = (state: State, name: string): State => {
  const index = state.open.lastIndexOf(name);
  if (index < 0) return state;
  const closing = state.open
    .slice(index)
    .reverse()
    .map((tag) => `</${tag}>`)
    .join('');
  return { ...state, out: state.out + closing, open: state.open.slice(0, index) };
};

/** Deja solo `strong`, `em`, `u`, `p`, `br`, `ul`, `ol` y `li` (sin atributos), equilibra las etiquetas y escapa el texto. */
export const sanitizeRichText = (html: string): string => {
  const tokens: { readonly kind: 'text' | 'tag'; readonly value: string; readonly closing?: boolean }[] = [];
  let last = 0;
  for (const match of html.matchAll(TAG)) {
    tokens.push({ kind: 'text', value: html.slice(last, match.index) });
    tokens.push({ kind: 'tag', value: (match[2] ?? '').toLowerCase(), closing: match[1] === '/' });
    last = (match.index ?? 0) + match[0].length;
  }
  tokens.push({ kind: 'text', value: html.slice(last) });

  const final = tokens.reduce<State>(
    (state, token) => {
      if (token.kind === 'text') return state.dropDepth > 0 ? state : { ...state, out: state.out + escapeText(token.value) };
      if (DROP_CONTENT.has(token.value)) return { ...state, dropDepth: Math.max(0, state.dropDepth + (token.closing ? -1 : 1)) };
      if (state.dropDepth > 0) return state;
      const name = ALIASES.get(token.value) ?? token.value;
      if (!ALLOWED.has(name)) return state;
      return token.closing ? closeTag(state, name) : openTag(state, name);
    },
    { out: '', open: [], dropDepth: 0 },
  );
  // Cierra lo que haya quedado abierto, de dentro hacia fuera
  return final.out + [...final.open].reverse().map((tag) => `</${tag}>`).join('');
};

const ENTITIES: ReadonlyMap<string, string> = new Map([
  ['&amp;', '&'],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
  ['&nbsp;', ' '],
]);

/** Texto plano de un HTML (para CSV, búsqueda y resúmenes): los saltos de bloque pasan a espacios. */
export const richTextToPlain = (html: string): string =>
  html
    .replace(/<(?:br|\/p|\/li)\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES.get(entity) ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
