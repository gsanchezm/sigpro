import { field, type ApiResult, type Session } from './api';

// INTÉRPRETE DE LA RESPUESTA ESPERADA. Convierte el texto de una celda o de un paso «Entonces/Y» de una historia
// («401 invalid_credentials con attempts 1», «423 account_locked, sin attempts ni ningún token»…) en una `Expectation`:
// el código HTTP y una lista de comprobaciones pequeñas, cada una con su frase en español. Es una función pura y no sabe
// nada de ninguna historia en concreto: lo que no reconoce LANZA un error («celda sin interpretación»); nunca se ignora
// un trozo del texto ni se supone qué quiso decir.
//
// Las historias web y móvil pueden reutilizarlo para los textos que describen una respuesta de la API.

/** Contexto que algunas comprobaciones necesitan (p. ej. «nuevos» compara con la sesión anterior). */
export interface CheckContext {
  readonly previous?: Session;
}

export interface Check {
  /** Lo que se espera, en español, para la frase `expected` del resultado. */
  readonly label: string;
  /** `undefined` si se cumple; si no, lo observado que contradice la expectativa. */
  readonly verify: (result: ApiResult, context: CheckContext) => string | undefined;
  /** La comprobación compara con una sesión anterior: quien la ejecuta debe pasar `context.previous`. */
  readonly requiresPrevious?: true;
}

export interface Expectation {
  readonly status: number;
  readonly checks: readonly Check[];
}

export interface Judgement {
  readonly ok: boolean;
  /** Una frase por cada cosa que no coincide (vacío si todo coincide). */
  readonly mismatches: readonly string[];
}

type Json = Readonly<Record<string, unknown>>;

const SESSION_KEYS = ['accessToken', 'refreshToken'] as const;
const TOKEN_KEYS = [...SESSION_KEYS, 'mfaToken'] as const;
const NONE = '(ninguno)';

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const asRecord = (body: unknown): Json | undefined => (isRecord(body) ? body : undefined);
const has = (body: unknown, key: string): boolean => isRecord(body) && Object.prototype.hasOwnProperty.call(body, key);
const nonEmptyString = (value: unknown): boolean => typeof value === 'string' && value.length > 0;
const show = (value: unknown): string => (value === undefined ? 'ausente' : JSON.stringify(value));

/** Usuario de la respuesta: el objeto `user` de un login, o el propio cuerpo si trae `email` (GET /auth/me, paso del segundo factor). */
const userOf = (body: unknown): Json | undefined => {
  const user = field(body, 'user');
  if (isRecord(user)) return user;
  return has(body, 'email') ? asRecord(body) : undefined;
};

const errorsOf = (body: unknown): Json | undefined => asRecord(field(body, 'errors'));

/** Comprobación de igualdad sobre un valor que se lee de la respuesta. */
const equals = (name: string, expected: unknown, read: (result: ApiResult) => unknown): Check => ({
  label: `${name} ${String(expected)}`,
  verify: (result) => (Object.is(read(result), expected) ? undefined : `${name} ${show(read(result))}`),
});

const bodyField = (key: string) => (result: ApiResult): unknown => field(result.body, key);
const userField = (key: string) => (result: ApiResult): unknown => field(userOf(result.body), key);

/** Ausencia de las claves indicadas en el cuerpo (no basta con que valgan `null` o vacío). */
const absent = (label: string, keys: readonly string[]): Check => ({
  label,
  verify: (result) => {
    const present = keys.filter((key) => has(result.body, key));
    return present.length === 0 ? undefined : `trae ${present.join(', ')}`;
  },
});

/** Presencia de las claves indicadas como texto no vacío (el valor del token no se guarda en ningún sitio). */
const present = (label: string, keys: readonly string[]): Check => ({
  label,
  verify: (result) => {
    const missing = keys.filter((key) => !nonEmptyString(field(result.body, key)));
    return missing.length === 0 ? undefined : `falta ${missing.join(', ')}`;
  },
});

const sessionTokens = (): Check => present('accessToken y refreshToken', SESSION_KEYS);
const noToken = (): Check => absent('sin ningún token', TOKEN_KEYS);
const noAttempts = (): Check => absent('sin attempts', ['attempts']);

/** «(ninguno)» exige que el campo no tenga motivo; cualquier otro texto, ese motivo exacto. */
const reason = (target: string, expected: string): Check => ({
  label: expected === NONE ? `sin motivo para ${target}` : `motivo de ${target} ${expected}`,
  verify: (result) => {
    const observed = errorsOf(result.body)?.[target];
    const matches = expected === NONE ? observed === undefined : observed === expected;
    return matches ? undefined : `motivo de ${target} ${show(observed)}`;
  },
});

const anyReason = (target: string): Check => ({
  label: `un motivo para ${target}`,
  verify: (result) => {
    const observed = errorsOf(result.body)?.[target];
    return nonEmptyString(observed) ? undefined : `motivo de ${target} ${show(observed)}`;
  },
});

const noBody = (): Check => ({
  label: 'sin cuerpo',
  verify: (result) => (result.body === null ? undefined : `con cuerpo (${typeof result.body})`),
});

const programs = (tenant: string): Check => ({
  label: `la lista de programas del tenant ${tenant} (con al menos uno)`,
  verify: (result) => {
    const items = Array.isArray(result.body) ? result.body : field(result.body, 'items');
    return Array.isArray(items) && items.length > 0 ? undefined : `lista de programas ${Array.isArray(items) ? 'vacía' : 'ausente'}`;
  },
});

/** «nuevos»: los dos tokens están y NO son los mismos textos que los de la sesión anterior. */
const freshSession = (): Check => ({
  label: 'un accessToken y un refreshToken nuevos (distintos de los anteriores)',
  requiresPrevious: true,
  verify: (result, context) => {
    if (!context.previous) throw new Error('La expectativa «nuevos» necesita la sesión anterior para comparar (context.previous)');
    const missing = SESSION_KEYS.filter((key) => !nonEmptyString(field(result.body, key)));
    if (missing.length > 0) return `falta ${missing.join(', ')}`;
    const same = SESSION_KEYS.filter((key) => field(result.body, key) === context.previous?.[key]);
    return same.length === 0 ? undefined : `idéntico al anterior: ${same.join(', ')}`;
  },
});

const errorName = (name: string): readonly Check[] => [
  equals('error', name, bodyField('error')),
  {
    label: 'un traceId',
    verify: (result) => (nonEmptyString(field(result.body, 'traceId')) ? undefined : `traceId ${show(field(result.body, 'traceId'))}`),
  },
];

interface Facet {
  readonly pattern: RegExp;
  readonly build: (match: RegExpExecArray) => readonly Check[];
}

/** Ancla el patrón al principio del resto y exige que termine en una frontera (espacio, coma o fin) para no aceptar prefijos. */
const facet = (source: RegExp, build: Facet['build']): Facet => ({ pattern: new RegExp(`^(?:${source.source})(?=[\\s,]|$)`), build });

// El orden importa: los textos más largos y específicos van antes que sus prefijos.
const FACETS: readonly Facet[] = [
  facet(/sin attempts ni ningún token/, () => [noAttempts(), noToken()]),
  facet(/no incluye attempts ni ningún token/, () => [noAttempts(), noToken()]),
  facet(/sin attempts/, () => [noAttempts()]),
  facet(/(?:sin|no incluye) ningún token/, () => [noToken()]),
  facet(/sin cuerpo/, () => [noBody()]),
  facet(/attempts (\d+)/, (m) => [equals('attempts', Number(m[1]), bodyField('attempts'))]),
  facet(/(?:trae )?accessToken, refreshToken, expiresIn (\d+)/, (m) => [sessionTokens(), equals('expiresIn', Number(m[1]), bodyField('expiresIn'))]),
  facet(/(?:trae )?accessToken, refreshToken/, () => [sessionTokens()]),
  facet(/(?:trae )?accessToken y refreshToken/, () => [sessionTokens()]),
  facet(/un accessToken y un refreshToken nuevos/, () => [freshSession()]),
  facet(/trae un mfaToken/, () => [present('un mfaToken', ['mfaToken'])]),
  facet(/no trae accessToken ni refreshToken/, () => [absent('sin accessToken ni refreshToken', SESSION_KEYS)]),
  facet(/mfaRequired vale (true|false)/, (m) => [equals('mfaRequired', m[1] === 'true', bodyField('mfaRequired'))]),
  facet(/el usuario con el rol (\w+)/, (m) => [equals('usuario con rol', m[1], userField('role'))]),
  facet(/el usuario del tenant (\w+)/, (m) => [equals('usuario del tenant', m[1], userField('tenant'))]),
  facet(/el usuario ([^\s@]+@[^\s@]+)/, (m) => [equals('usuario con correo', m[1], userField('email'))]),
  facet(/el tenant (\w+)/, (m) => [equals('usuario del tenant', m[1], userField('tenant'))]),
  facet(/el rol (\w+)/, (m) => [equals('usuario con rol', m[1], userField('role'))]),
  facet(/los programas del tenant (\w+)/, (m) => [programs(m[1] ?? '')]),
  facet(/el correo de la respuesta es ([^\s@]+@[^\s@]+)/, (m) => [equals('correo', m[1], userField('email'))]),
  facet(/el motivo del correo es (\w+|\(ninguno\))/, (m) => [reason('email', m[1] ?? '')]),
  facet(/el motivo de la contraseña es (\w+|\(ninguno\))/, (m) => [reason('password', m[1] ?? '')]),
  facet(/un motivo para (\w+)/, (m) => [anyReason(m[1] ?? '')]),
  facet(/el cuerpo lleva error igual a (.+?) y un traceId/, (m) => errorName(m[1] ?? '')),
  // Código de error de la API (snake_case): va el último para que no se confunda con los textos de arriba
  facet(/([a-z]+(?:_[a-z]+)+)/, (m) => [equals('code', m[1], bodyField('code'))]),
];

/** Separadores entre trozos: comas, espacios y los conectores «y» y «con». */
const SEPARATORS = /^(?:[\s,]+|(?:y|con)\s+)+/;

const consume = (text: string, source: string, checks: readonly Check[]): readonly Check[] => {
  const rest = text.replace(SEPARATORS, '');
  if (rest === '') return checks;
  for (const { pattern, build } of FACETS) {
    const match = pattern.exec(rest);
    if (match) return consume(rest.slice(match[0].length), source, [...checks, ...build(match)]);
  }
  throw new Error(`celda sin interpretación: «${source}» (resto sin interpretar: «${rest}»)`);
};

/** Texto que empieza por el código HTTP: «401 invalid_credentials con attempts 1». */
export const parseExpectation = (text: string): Expectation => {
  const match = /^(\d{3})(?=[\s,]|$)/.exec(text.trim());
  if (!match) throw new Error(`celda sin interpretación: «${text}» (no empieza por un código HTTP)`);
  return { status: Number(match[1]), checks: consume(text.trim().slice(match[0].length), text, []) };
};

/**
 * Lo que la historia espera de una fila, leído de sus pasos ya resueltos: el paso «Entonces la respuesta es …» y los «Y …» que
 * le siguen («Y la respuesta no incluye ningún token», «Y mfaRequired vale false»…). Es la fuente de verdad de lo esperado
 * también cuando la fila no tiene una columna con la respuesta.
 */
export const expectationFromSteps = (steps: readonly string[]): Expectation => {
  const index = steps.findIndex((step) => step.startsWith('Entonces '));
  const first = steps[index];
  if (first === undefined) throw new Error(`celda sin interpretación: la fila no tiene paso «Entonces» (${steps.join(' | ')})`);
  const head = first.replace(/^Entonces la (?:última )?respuesta es /, '');
  if (head === first) throw new Error(`celda sin interpretación: paso «${first}» (no empieza por «Entonces la respuesta es»)`);
  const extras = steps.slice(index + 1).map((step) => step.replace(/^Y /, '').replace(/^la respuesta /, ''));
  return parseExpectation([head, ...extras].join(', '));
};

export const describeExpectation = (expectation: Expectation): string => [`HTTP ${expectation.status}`, ...expectation.checks.map((check) => check.label)].join('; ');

export const judge = (expectation: Expectation, result: ApiResult, context: CheckContext = {}): Judgement => {
  const status = result.status === expectation.status ? [] : [`HTTP ${result.status}, no ${expectation.status}`];
  const failed = expectation.checks.flatMap((check) => {
    const mismatch = check.verify(result, context);
    return mismatch === undefined ? [] : [`se esperaba «${check.label}» y se observó «${mismatch}»`];
  });
  const mismatches = [...status, ...failed];
  return { ok: mismatches.length === 0, mismatches };
};

/** Copia del cuerpo con los valores de los tokens sustituidos por su longitud: nunca se guarda un token. */
export const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key, (TOKEN_KEYS as readonly string[]).includes(key) && typeof inner === 'string' ? `<oculto: ${inner.length} caracteres>` : redact(inner)]),
  );
};

const userSummary = (user: Json): string => `usuario con rol ${show(user.role)}, tenant ${show(user.tenant)}, correo ${show(user.email)}`;

/** Lo observado en una respuesta, en una frase y sin tokens: estado, código, intentos, claves del cuerpo y valores relevantes. */
export const describeObserved = (result: ApiResult): string => {
  const body = asRecord(result.body);
  if (body === undefined) return `HTTP ${result.status}; ${result.body === null ? 'sin cuerpo' : `cuerpo no objeto (${typeof result.body})`}`;
  const facts = [
    has(body, 'code') ? `code ${show(body.code)}` : undefined,
    has(body, 'attempts') ? `attempts ${show(body.attempts)}` : undefined,
    has(body, 'mfaRequired') ? `mfaRequired ${show(body.mfaRequired)}` : undefined,
    has(body, 'expiresIn') ? `expiresIn ${show(body.expiresIn)}` : undefined,
    isRecord(body.user) ? userSummary(body.user) : undefined,
    !isRecord(body.user) && has(body, 'email') ? `correo ${show(body.email)}` : undefined,
    has(body, 'errors') ? `errors ${show(body.errors)}` : undefined,
    Array.isArray(body.items) ? `${body.items.length} elementos en items` : undefined,
  ].filter((fact): fact is string => fact !== undefined);
  return [`HTTP ${result.status}`, ...facts, `claves del cuerpo: ${Object.keys(body).join(', ')}`].join('; ');
};
