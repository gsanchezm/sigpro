import { describe, expect, it } from 'vitest';
import { LABEL_DEFS } from './model';
import { storyMarker, type IssueDraft } from './render';
import { applyOps, describeOp, planSync, RATE_LIMIT_WAIT_MS, summarizeOps, type Gh, type Op, type RemoteIssue } from './sync';

const ME = 'gsanchezm';
const ALL_LABELS = LABEL_DEFS.map((def) => def.name);

const epic: IssueDraft = {
  id: 'EP-LOGIN',
  kind: 'epic',
  title: 'Acceso y sesión',
  body: `${storyMarker('EP-LOGIN')}\n**Id:** EP-LOGIN\n\n## Resumen\nEntrar en la aplicación.`,
  labels: ['epic'],
  epicId: null,
};

const storyOf = (id: string, title: string): IssueDraft => ({
  id,
  kind: 'story',
  title,
  body: `${storyMarker(id)}\n**Id:** ${id} · **Épica:** EP-LOGIN\n\n## Historia\nTexto de ${id}.`,
  labels: ['web'],
  epicId: 'EP-LOGIN',
});

const story1 = storyOf('US-LOGIN-001', '[Web] Iniciar sesión');
const story2 = storyOf('US-LOGIN-002', '[Web] Cerrar sesión');

/** Lo que devolvería GitHub para un borrador ya publicado por `ME`. */
const remoteOf = (draft: IssueDraft, number: number, overrides: Partial<RemoteIssue> = {}): RemoteIssue => ({
  nodeId: `node-${number}`,
  number,
  title: draft.title,
  body: draft.body,
  labels: draft.labels,
  state: 'OPEN',
  author: ME,
  parentNumber: draft.kind === 'story' ? 1 : null,
  ...overrides,
});

const remoteAll = (): readonly RemoteIssue[] => [remoteOf(epic, 1), remoteOf(story1, 2), remoteOf(story2, 3)];

const plan = (drafts: readonly IssueDraft[], remote: readonly RemoteIssue[], remoteLabels: readonly string[] = ALL_LABELS): readonly Op[] =>
  planSync({ drafts, remote, remoteLabels, me: ME });

const types = (ops: readonly Op[]): readonly string[] => ops.map((op) => op.type);

describe('planSync', () => {
  it('sin issues remotos y con una épica y dos historias: etiquetas, épica, historias y enlaces, en ese orden', () => {
    const ops = plan([epic, story1, story2], [], []);
    expect(types(ops)).toEqual([
      ...ALL_LABELS.map(() => 'createLabel'),
      'createIssue',
      'createIssue',
      'createIssue',
      'linkSubIssue',
      'linkSubIssue',
    ]);
    const issues = ops.flatMap((op) => (op.type === 'createIssue' ? [op.draft.id] : []));
    expect(issues).toEqual(['EP-LOGIN', 'US-LOGIN-001', 'US-LOGIN-002']);
    const links = ops.flatMap((op) => (op.type === 'linkSubIssue' ? [[op.epicId, op.storyId]] : []));
    expect(links).toEqual([
      ['EP-LOGIN', 'US-LOGIN-001'],
      ['EP-LOGIN', 'US-LOGIN-002'],
    ]);
  });

  it('las épicas van antes que las historias aunque lleguen después en la lista', () => {
    const ops = plan([story1, story2, epic], [], ALL_LABELS);
    const issues = ops.flatMap((op) => (op.type === 'createIssue' ? [op.draft.id] : []));
    expect(issues).toEqual(['EP-LOGIN', 'US-LOGIN-001', 'US-LOGIN-002']);
  });

  it('crea las ocho etiquetas aunque no haya borradores, con color y descripción de LABEL_DEFS', () => {
    const ops = plan([], [], []);
    expect(ops).toEqual(LABEL_DEFS.map((def) => ({ type: 'createLabel', ...def })));
    expect(ops).toHaveLength(8);
  });

  it('compara las etiquetas sin distinguir mayúsculas y no crea las que ya existen', () => {
    const ops = plan([], [], ['EPIC', 'Api', 'bug', 'No-Implementada']);
    const created = ops.flatMap((op) => (op.type === 'createLabel' ? [op.name] : []));
    expect(created).toEqual(['web', 'movil', 'ios', 'android', 'transversal']);
  });

  it('es idempotente: con los tres issues remotos iguales y enlazados no hay nada que hacer', () => {
    expect(plan([epic, story1, story2], remoteAll())).toEqual([]);
  });

  it('actualiza solo el issue cuyo título cambió', () => {
    const remote = [remoteOf(epic, 1), remoteOf(story1, 2, { title: 'Título viejo' }), remoteOf(story2, 3)];
    expect(plan([epic, story1, story2], remote)).toEqual([{ type: 'updateIssue', number: 2, draft: story1 }]);
  });

  it('actualiza si cambió el cuerpo', () => {
    const remote = [remoteOf(epic, 1), remoteOf(story1, 2), remoteOf(story2, 3, { body: `${story2.body}\nTexto añadido a mano` })];
    expect(plan([epic, story1, story2], remote)).toEqual([{ type: 'updateIssue', number: 3, draft: story2 }]);
  });

  it('actualiza si cambió el conjunto de etiquetas', () => {
    const remote = [remoteOf(epic, 1), remoteOf(story1, 2, { labels: ['web', 'no-implementada'] }), remoteOf(story2, 3, { labels: [] })];
    const ops = plan([epic, story1, story2], remote);
    expect(ops).toEqual([
      { type: 'updateIssue', number: 2, draft: story1 },
      { type: 'updateIssue', number: 3, draft: story2 },
    ]);
  });

  it('no actualiza si solo cambian los saltos de línea (CRLF) o los blancos finales del cuerpo', () => {
    const crlf = `${story1.body.replace(/\n/g, '\r\n')}\r\n\r\n`;
    const remote = [remoteOf(epic, 1), remoteOf(story1, 2, { body: crlf }), remoteOf(story2, 3, { body: `${story2.body.replace(/\n/g, '\r')}  ` })];
    expect(plan([epic, story1, story2], remote)).toEqual([]);
  });

  it('no actualiza si solo cambia el orden o las mayúsculas de las etiquetas', () => {
    const two: IssueDraft = { ...story1, labels: ['web', 'no-implementada'] };
    const remote = [remoteOf(epic, 1), remoteOf(two, 2, { labels: ['No-Implementada', 'Web'] }), remoteOf(story2, 3)];
    expect(plan([epic, two, story2], remote)).toEqual([]);
  });

  it('reanudar: con la épica y una historia ya creadas solo crea la que falta y enlaza las dos historias sin padre', () => {
    const remote = [remoteOf(epic, 1), remoteOf(story1, 2, { parentNumber: null })];
    const ops = plan([epic, story1, story2], remote);
    expect(ops).toEqual([
      { type: 'createIssue', draft: story2 },
      { type: 'linkSubIssue', epicId: 'EP-LOGIN', storyId: 'US-LOGIN-001' },
      { type: 'linkSubIssue', epicId: 'EP-LOGIN', storyId: 'US-LOGIN-002' },
    ]);
  });

  it('reanudar: con la épica creada y ninguna historia crea las dos y las enlaza', () => {
    const ops = plan([epic, story1, story2], [remoteOf(epic, 1)]);
    expect(types(ops)).toEqual(['createIssue', 'createIssue', 'linkSubIssue', 'linkSubIssue']);
  });

  // R9: el plan muestra el enlace (la historia es nuestra y los Markdown mandan) y el ejecutor lo completa con
  // `replaceParent: true` (ver gh.ts), así que el enlace sustituye al padre actual en lugar de fallar.
  it('enlaza la historia cuyo padre no es la épica: el enlace reemplaza al padre actual', () => {
    const remote = [remoteOf(epic, 1), remoteOf(story1, 2, { parentNumber: 99 }), remoteOf(story2, 3)];
    expect(plan([epic, story1, story2], remote)).toEqual([{ type: 'linkSubIssue', epicId: 'EP-LOGIN', storyId: 'US-LOGIN-001' }]);
  });

  it('un issue ajeno con la marca de una historia no se actualiza: se planifica un issue nuevo', () => {
    const foreign = remoteOf(story1, 7, { author: 'otra-persona', title: 'Otro título', parentNumber: null });
    const ops = plan([epic, story1, story2], [remoteOf(epic, 1), foreign, remoteOf(story2, 3)]);
    expect(types(ops)).toEqual(['createIssue', 'linkSubIssue']);
    expect(ops.some((op) => op.type === 'updateIssue')).toBe(false);
    expect(ops[0]).toEqual({ type: 'createIssue', draft: story1 });
  });

  it('un issue sin autor (usuario borrado) cuenta como ajeno', () => {
    const orphan = remoteOf(story1, 7, { author: '' });
    const ops = planSync({ drafts: [epic, story1], remote: [remoteOf(epic, 1), orphan], remoteLabels: ALL_LABELS, me: ME });
    expect(types(ops)).toEqual(['createIssue', 'linkSubIssue']);
  });

  it('con mi cuenta vacía ningún issue es mío', () => {
    const orphan = remoteOf(story1, 7, { author: '' });
    const ops = planSync({ drafts: [story1], remote: [orphan], remoteLabels: ALL_LABELS, me: '' });
    expect(types(ops)).toEqual(['createIssue']);
  });

  it('el autor se compara sin distinguir mayúsculas: los logins de GitHub no las distinguen', () => {
    const remote = [remoteOf(epic, 1, { author: 'GSanchezM' }), remoteOf(story1, 2, { author: 'GSANCHEZM' }), remoteOf(story2, 3)];
    expect(plan([epic, story1, story2], remote)).toEqual([]);
  });

  it('un issue remoto sin marca, o con la marca de una historia que no existe en local, se ignora', () => {
    const manual: RemoteIssue = { ...remoteOf(story1, 5), body: 'Escrito a mano, sin marca', title: story1.title };
    const stray = remoteOf(storyOf('US-LOGIN-099', 'Otra'), 6);
    expect(plan([epic, story1, story2], [...remoteAll(), manual, stray])).toEqual([]);
  });

  it('dos borradores con el mismo título y distinto id no se confunden: se casan por marca', () => {
    const a = storyOf('US-LOGIN-001', '[Web] Mismo título');
    const b = storyOf('US-LOGIN-002', '[Web] Mismo título');
    const remote = [remoteOf(epic, 1), remoteOf(b, 4), remoteOf(a, 9, { title: 'Título cambiado a mano' })];
    expect(plan([epic, a, b], remote)).toEqual([{ type: 'updateIssue', number: 9, draft: a }]);
  });

  it('un issue CLOSED con marca propia se actualiza si cambió, y la operación no lleva estado (no lo reabre)', () => {
    const remote = [remoteOf(epic, 1), remoteOf(story1, 2, { state: 'CLOSED', title: 'Título viejo' }), remoteOf(story2, 3)];
    const ops = plan([epic, story1, story2], remote);
    expect(ops).toEqual([{ type: 'updateIssue', number: 2, draft: story1 }]);
    const [op] = ops;
    expect(Object.keys(op ?? {}).sort()).toEqual(['draft', 'number', 'type']);
    expect(Object.keys(op?.type === 'updateIssue' ? op.draft : {})).not.toContain('state');
  });

  it('un issue CLOSED ya igual no genera operaciones', () => {
    const remote = [remoteOf(epic, 1), remoteOf(story1, 2, { state: 'CLOSED' }), remoteOf(story2, 3)];
    expect(plan([epic, story1, story2], remote)).toEqual([]);
  });

  it('si hay dos issues propios con la misma marca usa el de menor número y no crea otro', () => {
    const remote = [remoteOf(epic, 1), remoteOf(story1, 8, { title: 'Duplicado' }), remoteOf(story1, 2), remoteOf(story2, 3)];
    expect(plan([epic, story1, story2], remote)).toEqual([]);
  });

  it('nunca emite cierres ni borrados: solo los cuatro tipos de operación', () => {
    const remote = [remoteOf(story1, 2, { title: 'Viejo', state: 'CLOSED' })];
    const allowed = new Set(['createLabel', 'createIssue', 'updateIssue', 'linkSubIssue']);
    expect(types(plan([epic, story1, story2], remote, [])).every((type) => allowed.has(type))).toBe(true);
  });
});

describe('describeOp', () => {
  it('describe cada operación en una línea', () => {
    expect(describeOp({ type: 'createLabel', name: 'epic', color: '5319e7', description: 'x' })).toBe('crear etiqueta «epic»');
    expect(describeOp({ type: 'createIssue', draft: story1 })).toBe('crear issue US-LOGIN-001: [Web] Iniciar sesión');
    expect(describeOp({ type: 'updateIssue', number: 12, draft: story1 })).toBe('actualizar issue #12 (US-LOGIN-001): [Web] Iniciar sesión');
    expect(describeOp({ type: 'linkSubIssue', epicId: 'EP-LOGIN', storyId: 'US-LOGIN-001' })).toBe('enlazar US-LOGIN-001 como sub-issue de EP-LOGIN');
  });
});

describe('summarizeOps', () => {
  it('cuenta cada tipo, también los que no aparecen', () => {
    expect(summarizeOps([])).toBe('createLabel: 0, createIssue: 0, updateIssue: 0, linkSubIssue: 0');
    const ops = plan([epic, story1, story2], [], []);
    expect(summarizeOps(ops)).toBe('createLabel: 8, createIssue: 3, updateIssue: 0, linkSubIssue: 2');
  });
});

// ---------------------------------------------------------------------------------------------------------
// applyOps con un Gh falso: nada de esto toca GitHub.
// ---------------------------------------------------------------------------------------------------------

type Call = readonly [string, ...unknown[]];

type FakeOptions = {
  readonly existing?: readonly RemoteIssue[];
  readonly failures?: Readonly<Record<string, readonly unknown[]>>;
};

/** `Gh` falso que anota cada llamada de escritura; `failures` hace fallar las primeras llamadas de un método con los errores dados. */
const fakeGh = (options: FakeOptions = {}): { gh: Gh; calls: Call[] } => {
  const calls: Call[] = [];
  const pending = new Map(Object.entries(options.failures ?? {}).map(([method, errors]) => [method, [...errors]]));
  const maybeFail = (method: string): void => {
    const next = pending.get(method)?.shift();
    if (next !== undefined) throw next;
  };
  let counter = 100;
  const gh: Gh = {
    me: async () => ME,
    listIssues: async () => options.existing ?? [],
    listLabels: async () => [],
    createLabel: async (label) => {
      calls.push(['createLabel', label.name]);
      maybeFail('createLabel');
    },
    createIssue: async (draft) => {
      calls.push(['createIssue', draft.id]);
      maybeFail('createIssue');
      counter += 1;
      return { nodeId: `new-${draft.id}`, number: counter };
    },
    updateIssue: async (number, draft) => {
      calls.push(['updateIssue', number, draft.id]);
      maybeFail('updateIssue');
    },
    addSubIssue: async (parent, child) => {
      calls.push(['addSubIssue', parent, child]);
      maybeFail('addSubIssue');
    },
  };
  return { gh, calls };
};

const sleeper = (): { sleep: (ms: number) => Promise<void>; waits: number[] } => {
  const waits: number[] = [];
  return { sleep: async (ms) => void waits.push(ms), waits };
};

const labelOp: Op = { type: 'createLabel', name: 'web', color: '1d76db', description: 'Interfaz web' };
const createEpic: Op = { type: 'createIssue', draft: epic };
const createStory1: Op = { type: 'createIssue', draft: story1 };
const link1: Op = { type: 'linkSubIssue', epicId: 'EP-LOGIN', storyId: 'US-LOGIN-001' };

describe('applyOps', () => {
  it('ejecuta en orden y resuelve épica e historia a su nodeId con lo que devolvió createIssue', async () => {
    const { gh, calls } = fakeGh();
    const result = await applyOps([labelOp, createEpic, createStory1, link1], gh, { delayMs: 0 });
    expect(result).toEqual({ done: 4, failedAt: null, error: null });
    expect(calls).toEqual([
      ['createLabel', 'web'],
      ['createIssue', 'EP-LOGIN'],
      ['createIssue', 'US-LOGIN-001'],
      ['addSubIssue', 'new-EP-LOGIN', 'new-US-LOGIN-001'],
    ]);
  });

  it('para los issues que ya existían resuelve el nodeId con listIssues (por marca y autor propio)', async () => {
    const { gh, calls } = fakeGh({ existing: [remoteOf(epic, 1), remoteOf(story1, 2, { parentNumber: null })] });
    const result = await applyOps([link1], gh, { delayMs: 0 });
    expect(result).toEqual({ done: 1, failedAt: null, error: null });
    expect(calls).toEqual([['addSubIssue', 'node-1', 'node-2']]);
  });

  it('mezcla lo recién creado con lo que ya existía (reanudar)', async () => {
    const { gh, calls } = fakeGh({ existing: [remoteOf(epic, 1), remoteOf(story1, 2, { parentNumber: null })] });
    const createStory2: Op = { type: 'createIssue', draft: story2 };
    const link2: Op = { type: 'linkSubIssue', epicId: 'EP-LOGIN', storyId: 'US-LOGIN-002' };
    const result = await applyOps([createStory2, link1, link2], gh, { delayMs: 0 });
    expect(result.done).toBe(3);
    expect(calls).toEqual([
      ['createIssue', 'US-LOGIN-002'],
      ['addSubIssue', 'node-1', 'node-2'],
      ['addSubIssue', 'node-1', 'new-US-LOGIN-002'],
    ]);
  });

  it('no usa como padre un issue ajeno que lleva la marca de la épica: falla sin llamar a addSubIssue', async () => {
    const foreignEpic = remoteOf(epic, 1, { author: 'otra-persona' });
    const { gh, calls } = fakeGh({ existing: [foreignEpic, remoteOf(story1, 2)] });
    const result = await applyOps([link1], gh, { delayMs: 0 });
    expect(result.done).toBe(0);
    expect(result.failedAt).toEqual(link1);
    expect(result.error).toContain('EP-LOGIN');
    expect(calls).toEqual([]);
  });

  it('actualizar un issue llama a updateIssue con su número y su borrador', async () => {
    const { gh, calls } = fakeGh();
    const result = await applyOps([{ type: 'updateIssue', number: 12, draft: story1 }], gh, { delayMs: 0 });
    expect(result.done).toBe(1);
    expect(calls).toEqual([['updateIssue', 12, 'US-LOGIN-001']]);
  });

  it('una lista vacía no hace nada', async () => {
    const { gh, calls } = fakeGh();
    expect(await applyOps([], gh, { delayMs: 0 })).toEqual({ done: 0, failedAt: null, error: null });
    expect(calls).toEqual([]);
  });

  it('espera delayMs entre operaciones (no antes de la primera ni después de la última)', async () => {
    const { gh } = fakeGh();
    const { sleep, waits } = sleeper();
    await applyOps([labelOp, createEpic, createStory1], gh, { delayMs: 1500, sleep });
    expect(waits).toEqual([1500, 1500]);
  });

  it('con delayMs 0 no duerme', async () => {
    const { gh } = fakeGh();
    const { sleep, waits } = sleeper();
    await applyOps([labelOp, createEpic], gh, { delayMs: 0, sleep });
    expect(waits).toEqual([]);
  });

  it('reintenta si el error dice «rate limit» y sigue cuando se recupera', async () => {
    const limit = new Error('gh: API rate limit exceeded (HTTP 403)');
    const { gh, calls } = fakeGh({ failures: { createIssue: [limit, limit] } });
    const { sleep, waits } = sleeper();
    const result = await applyOps([createEpic, createStory1], gh, { delayMs: 0, sleep });
    expect(result).toEqual({ done: 2, failedAt: null, error: null });
    expect(waits).toEqual([RATE_LIMIT_WAIT_MS, RATE_LIMIT_WAIT_MS]);
    expect(calls.filter(([method]) => method === 'createIssue')).toHaveLength(4);
  });

  it('también reconoce el límite secundario («secondary rate limit»), sin distinguir mayúsculas', async () => {
    const limit = new Error('You have exceeded a Secondary Rate Limit. Please wait');
    const { gh } = fakeGh({ failures: { createIssue: [limit] } });
    const { sleep, waits } = sleeper();
    const result = await applyOps([createEpic], gh, { delayMs: 0, sleep });
    expect(result.done).toBe(1);
    expect(waits).toEqual([RATE_LIMIT_WAIT_MS]);
  });

  it('reintenta hasta 3 veces (4 intentos en total) y entonces se detiene con failedAt y error', async () => {
    const limit = new Error('rate limit exceeded');
    const { gh, calls } = fakeGh({ failures: { createIssue: [limit, limit, limit, limit, limit] } });
    const { sleep, waits } = sleeper();
    const result = await applyOps([labelOp, createEpic, createStory1], gh, { delayMs: 0, sleep });
    expect(result).toEqual({ done: 1, failedAt: createEpic, error: 'rate limit exceeded' });
    expect(waits).toHaveLength(3);
    expect(calls.filter(([method]) => method === 'createIssue')).toHaveLength(4);
  });

  it('ante cualquier otro error se detiene sin reintentar y devuelve failedAt y error', async () => {
    const { gh, calls } = fakeGh({ failures: { createIssue: [new Error('Validation Failed (HTTP 422)')] } });
    const { sleep, waits } = sleeper();
    const result = await applyOps([labelOp, createEpic, createStory1, link1], gh, { delayMs: 0, sleep });
    expect(result).toEqual({ done: 1, failedAt: createEpic, error: 'Validation Failed (HTTP 422)' });
    expect(waits).toEqual([]);
    expect(calls).toEqual([
      ['createLabel', 'web'],
      ['createIssue', 'EP-LOGIN'],
    ]);
  });

  it('un valor lanzado que no es un Error también se convierte en texto', async () => {
    const { gh } = fakeGh({ failures: { createLabel: ['fallo en texto plano'] } });
    const result = await applyOps([labelOp], gh, { delayMs: 0 });
    expect(result).toEqual({ done: 0, failedAt: labelOp, error: 'fallo en texto plano' });
  });

  it('un enlace cuyo nodeId no se puede resolver falla y no llama a addSubIssue', async () => {
    const { gh, calls } = fakeGh();
    const result = await applyOps([link1], gh, { delayMs: 0 });
    expect(result.failedAt).toEqual(link1);
    expect(result.error).toContain('EP-LOGIN');
    expect(calls).toEqual([]);
  });

  it('si listIssues falla al resolver un enlace, el fallo se devuelve y no se lanza', async () => {
    const { gh } = fakeGh();
    const broken: Gh = { ...gh, listIssues: async () => Promise.reject(new Error('sin red')) };
    const result = await applyOps([link1], broken, { delayMs: 0 });
    expect(result).toEqual({ done: 0, failedAt: link1, error: 'sin red' });
  });
});
