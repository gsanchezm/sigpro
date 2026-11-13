// Sincronización de las historias con los issues de GitHub. `planSync` es puro: compara los borradores locales
// con lo que hay en el repositorio y devuelve las operaciones que faltan (idempotente: si todo está al día, ninguna).
// `applyOps` las ejecuta contra un `Gh` inyectado; el módulo no sabe nada de `gh` ni de la red (eso vive en `gh.ts`).
// Nunca cierra ni borra issues: no existe ninguna operación que lo haga.
import { LABEL_DEFS } from './model';
import { markerOf, type IssueDraft } from './render';

/** Issue tal como lo devuelve GitHub. `author` va vacío si la cuenta del autor se borró (nunca coincide con la mía). */
export type RemoteIssue = {
  nodeId: string;
  number: number;
  title: string;
  body: string;
  labels: readonly string[];
  state: 'OPEN' | 'CLOSED';
  author: string;
  parentNumber: number | null;
};

/**
 * Operación de escritura. `linkSubIssue` lleva ids de historia (`EP-…`, `US-…`), no ids de nodo: `applyOps` los
 * resuelve al ejecutarla. Ninguna operación lleva `state`, así que actualizar un issue cerrado no lo reabre.
 */
export type Op =
  | { type: 'createLabel'; name: string; color: string; description: string }
  | { type: 'createIssue'; draft: IssueDraft }
  | { type: 'updateIssue'; number: number; draft: IssueDraft }
  | { type: 'linkSubIssue'; epicId: string; storyId: string };

/** Lo único que la sincronización necesita de GitHub. `gh.ts` lo implementa con `gh api`; los tests, con un falso. */
export type Gh = {
  me(): Promise<string>;
  listIssues(): Promise<readonly RemoteIssue[]>;
  listLabels(): Promise<readonly string[]>;
  createLabel(label: { name: string; color: string; description: string }): Promise<void>;
  createIssue(draft: IssueDraft): Promise<{ nodeId: string; number: number }>;
  updateIssue(number: number, draft: IssueDraft): Promise<void>;
  addSubIssue(parentNodeId: string, childNodeId: string): Promise<void>;
};

// ---------------------------------------------------------------------------------------------------------
// Planificación (pura)
// ---------------------------------------------------------------------------------------------------------

/** Los logins de GitHub no distinguen mayúsculas; uno vacío (autor borrado o cuenta desconocida) nunca coincide. */
const sameLogin = (a: string, b: string): boolean => a !== '' && b !== '' && a.toLowerCase() === b.toLowerCase();

/**
 * Issues míos por id de la marca del cuerpo. Solo cuentan los de mi cuenta: `markerOf` lee la primera marca de
 * cualquier cuerpo, y un issue ajeno que la copie no debe actualizarse (el repositorio es público). Si hay dos
 * míos con la misma marca gana el de menor número (el `Map` se queda con la última entrada, de ahí el orden descendente).
 */
const indexOwnIssues = (remote: readonly RemoteIssue[], me: string): ReadonlyMap<string, RemoteIssue> =>
  new Map(
    [...remote]
      .filter((issue) => sameLogin(issue.author, me))
      .sort((a, b) => b.number - a.number)
      .flatMap((issue): readonly (readonly [string, RemoteIssue])[] => {
        const id = markerOf(issue.body);
        return id === null ? [] : [[id, issue]];
      }),
  );

/** GitHub devuelve CRLF en los cuerpos editados en la web y recorta el final: se compara sin esas diferencias. */
const normalizeText = (text: string): string => text.replace(/\r\n?/g, '\n').trimEnd();

const labelSet = (labels: readonly string[]): ReadonlySet<string> => new Set(labels.map((label) => label.toLowerCase()));

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => a.size === b.size && [...a].every((item) => b.has(item));

const isUpToDate = (draft: IssueDraft, remote: RemoteIssue): boolean =>
  normalizeText(draft.title) === normalizeText(remote.title) &&
  normalizeText(draft.body) === normalizeText(remote.body) &&
  sameSet(labelSet(draft.labels), labelSet(remote.labels));

/** Etiquetas de `LABEL_DEFS` que el repositorio no tiene (sin distinguir mayúsculas), con su color y descripción. */
const labelOps = (remoteLabels: readonly string[]): readonly Op[] => {
  const present = labelSet(remoteLabels);
  return LABEL_DEFS.filter((def) => !present.has(def.name.toLowerCase())).map((def) => ({ type: 'createLabel', ...def }));
};

/** Crear si no existe, actualizar si cambió y nada si ya está igual. */
const issueOps = (draft: IssueDraft, existing: RemoteIssue | undefined): readonly Op[] => {
  if (existing === undefined) return [{ type: 'createIssue', draft }];
  return isUpToDate(draft, existing) ? [] : [{ type: 'updateIssue', number: existing.number, draft }];
};

/**
 * Enlaza la historia con su épica salvo que ya cuelgue de ella. Una épica desconocida (ni local ni remota) no se
 * enlaza: el linter ya la rechaza y `applyOps` no podría resolver su nodo.
 */
const linkOps = (story: IssueDraft, own: ReadonlyMap<string, RemoteIssue>, draftIds: ReadonlySet<string>): readonly Op[] => {
  if (story.epicId === null) return [];
  const epic = own.get(story.epicId);
  if (epic === undefined && !draftIds.has(story.epicId)) return [];
  const linked = epic !== undefined && own.get(story.id)?.parentNumber === epic.number;
  return linked ? [] : [{ type: 'linkSubIssue', epicId: story.epicId, storyId: story.id }];
};

/**
 * Operaciones que llevan GitHub al estado de los borradores, en este orden: etiquetas, épicas, historias, enlaces.
 * Los issues se casan por la marca del cuerpo (no por título) y solo si son de `me`. Un `Op` por cada diferencia:
 * al reanudar una sincronización interrumpida solo salen las que faltan.
 */
export const planSync = (input: {
  drafts: readonly IssueDraft[];
  remote: readonly RemoteIssue[];
  remoteLabels: readonly string[];
  me: string;
}): readonly Op[] => {
  const own = indexOwnIssues(input.remote, input.me);
  const epics = input.drafts.filter((draft) => draft.kind === 'epic');
  const stories = input.drafts.filter((draft) => draft.kind === 'story');
  const draftIds = new Set(input.drafts.map((draft) => draft.id));
  return [
    ...labelOps(input.remoteLabels),
    ...epics.flatMap((draft) => issueOps(draft, own.get(draft.id))),
    ...stories.flatMap((draft) => issueOps(draft, own.get(draft.id))),
    ...stories.flatMap((draft) => linkOps(draft, own, draftIds)),
  ];
};

// ---------------------------------------------------------------------------------------------------------
// Presentación (pura)
// ---------------------------------------------------------------------------------------------------------

type OpOf<K extends Op['type']> = Extract<Op, { type: K }>;

/** Un manejador por tipo de operación: el mapa sustituye al `switch` y TypeScript exige que no falte ninguno. */
type ByType<Args extends readonly unknown[], R> = { readonly [K in Op['type']]: (op: OpOf<K>, ...args: Args) => R };

const DESCRIBE: ByType<[], string> = {
  createLabel: (op) => `crear etiqueta «${op.name}»`,
  createIssue: (op) => `crear issue ${op.draft.id}: ${op.draft.title}`,
  updateIssue: (op) => `actualizar issue #${op.number} (${op.draft.id}): ${op.draft.title}`,
  linkSubIssue: (op) => `enlazar ${op.storyId} como sub-issue de ${op.epicId}`,
};

/** Una línea legible por operación, para el plan y para el informe de fallo. */
export const describeOp = (op: Op): string => (DESCRIBE[op.type] as (op: Op) => string)(op);

/** Los tipos de operación, en el orden en que se ejecutan (las claves de `DESCRIBE` no pueden quedarse cortas). */
const OP_TYPES = Object.keys(DESCRIBE) as readonly Op['type'][];

/** Recuento por tipo, también los que son cero: `createLabel: 8, createIssue: 0, updateIssue: 0, linkSubIssue: 0`. */
export const summarizeOps = (ops: readonly Op[]): string =>
  OP_TYPES.map((type) => `${type}: ${ops.filter((op) => op.type === type).length}`).join(', ');

// ---------------------------------------------------------------------------------------------------------
// Ejecución (efectos en los bordes: solo habla con el `Gh` recibido)
// ---------------------------------------------------------------------------------------------------------

/** Espera por defecto entre operaciones de escritura: GitHub limita la creación de contenido (límite secundario). */
export const DEFAULT_DELAY_MS = 1500;

/** Espera antes de reintentar tras un error de límite de uso (GitHub pide al menos un minuto). */
export const RATE_LIMIT_WAIT_MS = 60_000;

/** Reintentos tras el primer intento: con 3 son 4 intentos en total. */
export const MAX_RATE_LIMIT_RETRIES = 3;

const RATE_LIMIT = /rate limit/i;

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Id de historia → nodeId de los issues propios que ya existen en GitHub. */
const listOwnNodeIds = async (gh: Gh): Promise<ReadonlyMap<string, string>> => {
  const [me, remote] = await Promise.all([gh.me(), gh.listIssues()]);
  return new Map([...indexOwnIssues(remote, me)].map(([id, issue]) => [id, issue.nodeId]));
};

/** Resuelve un id de historia a su nodeId: primero lo creado en esta ejecución, luego lo que ya había (se consulta una vez y solo si hace falta). */
const makeResolver = (gh: Gh, created: ReadonlyMap<string, string>): ((id: string) => Promise<string>) => {
  let existing: Promise<ReadonlyMap<string, string>> | undefined;
  // Si la consulta falla no se recuerda el fallo: un reintento por límite de uso debe poder repetirla.
  const loadExisting = (): Promise<ReadonlyMap<string, string>> => {
    existing ??= listOwnNodeIds(gh).catch((error: unknown) => {
      existing = undefined;
      throw error;
    });
    return existing;
  };
  return async (id) => {
    const nodeId = created.get(id) ?? (await loadExisting()).get(id);
    if (nodeId === undefined) throw new Error(`no se encontró en GitHub un issue propio con la marca ${id}`);
    return nodeId;
  };
};

type Exec = { readonly gh: Gh; readonly created: Map<string, string>; readonly resolve: (id: string) => Promise<string> };

const EXECUTE: ByType<[Exec], Promise<void>> = {
  createLabel: (op, { gh }) => gh.createLabel({ name: op.name, color: op.color, description: op.description }),
  createIssue: async (op, { gh, created }) => {
    const { nodeId } = await gh.createIssue(op.draft);
    created.set(op.draft.id, nodeId);
  },
  updateIssue: (op, { gh }) => gh.updateIssue(op.number, op.draft),
  linkSubIssue: async (op, { gh, resolve }) => {
    const parent = await resolve(op.epicId);
    const child = await resolve(op.storyId);
    await gh.addSubIssue(parent, child);
  },
};

const execute = (op: Op, exec: Exec): Promise<void> => (EXECUTE[op.type] as (op: Op, exec: Exec) => Promise<void>)(op, exec);

/** Repite la acción si falla por límite de uso, con espera inyectable; cualquier otro error se propaga tal cual. */
const withRateLimitRetry = async (action: () => Promise<void>, sleep: (ms: number) => Promise<void>, retriesLeft: number): Promise<void> => {
  try {
    await action();
  } catch (error) {
    if (retriesLeft === 0 || !RATE_LIMIT.test(messageOf(error))) throw error;
    await sleep(RATE_LIMIT_WAIT_MS);
    await withRateLimitRetry(action, sleep, retriesLeft - 1);
  }
};

/**
 * Ejecuta las operaciones en orden, con `delayMs` entre ellas. Se detiene en el primer error (tras agotar los
 * reintentos por límite de uso) y lo devuelve junto a la operación que falló; lo ya hecho queda hecho y el
 * siguiente `planSync` solo propondrá lo que falte.
 */
export const applyOps = async (
  ops: readonly Op[],
  gh: Gh,
  opts: { delayMs: number; sleep?: (ms: number) => Promise<void> },
): Promise<{ done: number; failedAt: Op | null; error: string | null }> => {
  const sleep = opts.sleep ?? realSleep;
  // Nodos creados en esta ejecución: los enlaces de la misma pasada los necesitan antes de que GitHub los liste.
  const created = new Map<string, string>();
  const exec: Exec = { gh, created, resolve: makeResolver(gh, created) };
  for (const [index, op] of ops.entries()) {
    if (index > 0 && opts.delayMs > 0) await sleep(opts.delayMs);
    try {
      await withRateLimitRetry(() => execute(op, exec), sleep, MAX_RATE_LIMIT_RETRIES);
    } catch (error) {
      return { done: index, failedAt: op, error: messageOf(error) };
    }
  }
  return { done: ops.length, failedAt: null, error: null };
};
