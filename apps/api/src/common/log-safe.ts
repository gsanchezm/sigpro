// Qué llega al log de la API. Regla: ni correos, ni contraseñas (ni sus hashes), ni tokens, ni claves.
//
// Un error de Prisma (`PrismaClientKnownRequestError`, `…ValidationError`) trae en `message` la llamada completa con sus
// argumentos —`prisma.user.create({ data: { email, passwordHash, … } })`—, y `error.stack` repite ese mensaje. Por eso el log de
// un 500 describe el error SIN su mensaje (nombre, código y modelo) y deja solo las líneas de la pila.

const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g;
const BEARER = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const BCRYPT = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const SECRET_FIELD = /\b(password|passwordHash|token|accessToken|refreshToken|mfaToken|secret|authorization|x-admin-key|adminKey|apiKey)\b(["']?\s*[:=]\s*)(["'`]?)[^\s,"'`})\]]+\3/gi;

/** Tapa correos, tokens, hashes y valores de campos sensibles en un texto libre. */
export const redact = (text: string): string =>
  text
    .replace(JWT, '<jwt>')
    .replace(BEARER, '$1 <token>')
    .replace(BCRYPT, '<hash>')
    .replace(SECRET_FIELD, (_match, key: string, separator: string) => `${key}${separator}<redactado>`)
    .replace(EMAIL, '<correo>');

const isPrismaError = (error: Error): boolean => error.name.startsWith('PrismaClient');

const prismaSummary = (error: Error & { code?: unknown; meta?: unknown }): string => {
  const meta = typeof error.meta === 'object' && error.meta !== null ? (error.meta as { modelName?: unknown; target?: unknown }) : {};
  const parts = [typeof error.code === 'string' ? `[${error.code}]` : '', typeof meta.modelName === 'string' ? `modelo=${meta.modelName}` : '', Array.isArray(meta.target) ? `campos=${meta.target.join(',')}` : ''];
  return `${error.name} ${parts.filter(Boolean).join(' ')}`.trim();
};

/** Solo las líneas `at …` de la pila: el mensaje (que puede llevar datos) no se repite. */
const stackFrames = (error: Error): string =>
  (error.stack ?? '')
    .split('\n')
    .filter((line) => /^\s+at\s/.test(line))
    .join('\n');

/** Texto seguro para `Logger.error` de cualquier excepción. */
export const describeError = (error: unknown): string => {
  if (!(error instanceof Error)) return redact(String(error));
  const head = isPrismaError(error) ? prismaSummary(error) : `${error.name}: ${redact(error.message)}`;
  const frames = stackFrames(error);
  return frames === '' ? head : `${head}\n${frames}`;
};
