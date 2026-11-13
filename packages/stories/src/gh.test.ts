import { describe, expect, it } from 'vitest';
import { DEFAULT_REPO, makeGh, type RunGh } from './gh';
import type { IssueDraft } from './render';

// Todo con un ejecutor falso: ninguna de estas pruebas llama al `gh` real ni toca GitHub.

type Call = { args: readonly string[]; input: string | undefined };

/** Ejecutor que anota cada llamada y responde con las salidas dadas, en orden. */
const fakeRun = (...outputs: readonly string[]): { run: RunGh; calls: Call[] } => {
  const calls: Call[] = [];
  const queue = [...outputs];
  const run: RunGh = async (args, input) => {
    calls.push({ args, input });
    return queue.shift() ?? '';
  };
  return { run, calls };
};

const draft: IssueDraft = {
  id: 'US-LOGIN-001',
  kind: 'story',
  title: '[Web] Iniciar sesión',
  body: '<!-- sigpro-story-id: US-LOGIN-001 -->\n**Id:** US-LOGIN-001',
  labels: ['web', 'no-implementada'],
  epicId: 'EP-LOGIN',
};

const node = (n: number, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: `node-${n}`,
  number: n,
  title: `Título ${n}`,
  body: `Cuerpo ${n}\r\nsegunda línea`,
  state: 'OPEN',
  author: { login: 'gsanchezm' },
  labels: { nodes: [{ name: 'web' }, null, { name: 'api' }] },
  parent: { number: 1 },
  ...overrides,
});

const page = (nodes: readonly unknown[], next: string | null): string =>
  JSON.stringify({ data: { repository: { issues: { pageInfo: { hasNextPage: next !== null, endCursor: next }, nodes } } } });

describe('makeGh: lecturas', () => {
  it('el repositorio por defecto es gsanchezm/sigpro', () => {
    expect(DEFAULT_REPO).toBe('gsanchezm/sigpro');
  });

  it('rechaza un repositorio que no es propietario/nombre', () => {
    expect(() => makeGh('sigpro', fakeRun().run)).toThrow('propietario/nombre');
    expect(() => makeGh('a/b/c', fakeRun().run)).toThrow('propietario/nombre');
  });

  it('me() pide el usuario con GET y recorta el salto de línea', async () => {
    const { run, calls } = fakeRun('gsanchezm\n');
    expect(await makeGh('gsanchezm/sigpro', run).me()).toBe('gsanchezm');
    expect(calls[0]?.args).toEqual(['api', '--method', 'GET', 'user', '--jq', '.login']);
  });

  it('me() falla si gh no devuelve usuario: así un autor vacío nunca coincide', async () => {
    await expect(makeGh('gsanchezm/sigpro', fakeRun('\n').run).me()).rejects.toThrow('gh auth login');
  });

  it('listLabels() pagina con GET y separa por líneas (también con CRLF)', async () => {
    const { run, calls } = fakeRun('bug\r\ngood first issue\nepic\n');
    expect(await makeGh('gsanchezm/sigpro', run).listLabels()).toEqual(['bug', 'good first issue', 'epic']);
    expect(calls[0]?.args).toEqual(['api', '--method', 'GET', 'repos/gsanchezm/sigpro/labels?per_page=100', '--paginate', '--jq', '.[].name']);
  });

  it('listIssues() sigue el cursor hasta la última página y convierte cada nodo', async () => {
    const { run, calls } = fakeRun(page([node(1), null], 'cursor-1'), page([node(2, { author: null, parent: null, state: 'CLOSED' })], null));
    const issues = await makeGh('gsanchezm/sigpro', run).listIssues();
    expect(issues).toEqual([
      { nodeId: 'node-1', number: 1, title: 'Título 1', body: 'Cuerpo 1\r\nsegunda línea', labels: ['web', 'api'], state: 'OPEN', author: 'gsanchezm', parentNumber: 1 },
      { nodeId: 'node-2', number: 2, title: 'Título 2', body: 'Cuerpo 2\r\nsegunda línea', labels: ['web', 'api'], state: 'CLOSED', author: '', parentNumber: null },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.args)).toEqual([
      ['api', 'graphql', '--input', '-'],
      ['api', 'graphql', '--input', '-'],
    ]);
    const bodies = calls.map((call) => JSON.parse(call.input ?? '{}') as { query: string; variables: Record<string, unknown> });
    expect(bodies[0]?.variables).toEqual({ owner: 'gsanchezm', name: 'sigpro', cursor: null });
    expect(bodies[1]?.variables).toEqual({ owner: 'gsanchezm', name: 'sigpro', cursor: 'cursor-1' });
    expect(bodies[0]?.query).toContain('pageInfo { hasNextPage endCursor }');
    expect(bodies[0]?.query).toContain('parent { number }');
    expect(bodies[0]?.query).not.toContain('mutation');
  });

  it('listIssues() sin issues devuelve una lista vacía', async () => {
    expect(await makeGh('gsanchezm/sigpro', fakeRun(page([], null)).run).listIssues()).toEqual([]);
  });

  it('listIssues() no entra en bucle si dice que hay otra página pero no da cursor', async () => {
    const { run, calls } = fakeRun(JSON.stringify({ data: { repository: { issues: { pageInfo: { hasNextPage: true, endCursor: null }, nodes: [node(1)] } } } }));
    expect(await makeGh('gsanchezm/sigpro', run).listIssues()).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it('un error dentro de la respuesta GraphQL se convierte en excepción', async () => {
    const run = fakeRun(JSON.stringify({ errors: [{ message: 'Field parent doesn\'t exist' }] })).run;
    await expect(makeGh('gsanchezm/sigpro', run).listIssues()).rejects.toThrow("Field parent doesn't exist");
  });

  it('una respuesta con otra forma se rechaza en lugar de colarse', async () => {
    await expect(makeGh('gsanchezm/sigpro', fakeRun(JSON.stringify({ data: {} })).run).listIssues()).rejects.toThrow();
  });
});

describe('makeGh: escrituras (solo se comprueban los argumentos y el cuerpo, con un ejecutor falso)', () => {
  it('createLabel() hace POST a /labels con nombre, color y descripción por stdin', async () => {
    const { run, calls } = fakeRun('{}');
    await makeGh('gsanchezm/sigpro', run).createLabel({ name: 'web', color: '1d76db', description: 'Interfaz web' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toEqual(['api', '--method', 'POST', 'repos/gsanchezm/sigpro/labels', '--input', '-']);
    expect(JSON.parse(calls[0]?.input ?? '')).toEqual({ name: 'web', color: '1d76db', description: 'Interfaz web' });
  });

  it('createIssue() hace POST a /issues con título, cuerpo y etiquetas, y devuelve node_id y número', async () => {
    const { run, calls } = fakeRun(JSON.stringify({ node_id: 'I_kwDOabc', number: 42, id: 1, html_url: 'x' }));
    const created = await makeGh('gsanchezm/sigpro', run).createIssue(draft);
    expect(created).toEqual({ nodeId: 'I_kwDOabc', number: 42 });
    expect(calls[0]?.args).toEqual(['api', '--method', 'POST', 'repos/gsanchezm/sigpro/issues', '--input', '-']);
    expect(JSON.parse(calls[0]?.input ?? '')).toEqual({ title: draft.title, body: draft.body, labels: ['web', 'no-implementada'] });
  });

  it('updateIssue() hace PATCH al issue indicado y nunca envía state (no reabre ni cierra)', async () => {
    const { run, calls } = fakeRun('{}');
    await makeGh('gsanchezm/sigpro', run).updateIssue(12, draft);
    expect(calls[0]?.args).toEqual(['api', '--method', 'PATCH', 'repos/gsanchezm/sigpro/issues/12', '--input', '-']);
    const payload = JSON.parse(calls[0]?.input ?? '') as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['body', 'labels', 'title']);
  });

  it('addSubIssue() envía la mutación con el padre en issueId y el hijo en subIssueId', async () => {
    const { run, calls } = fakeRun(JSON.stringify({ data: { addSubIssue: { issue: { id: 'epic-node' } } } }));
    await makeGh('gsanchezm/sigpro', run).addSubIssue('epic-node', 'story-node');
    expect(calls[0]?.args).toEqual(['api', 'graphql', '--input', '-']);
    const body = JSON.parse(calls[0]?.input ?? '') as { query: string; variables: Record<string, unknown> };
    expect(body.variables).toEqual({ issueId: 'epic-node', subIssueId: 'story-node' });
    expect(body.query).toContain('addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId, replaceParent: true })');
  });

  it('addSubIssue() reemplaza el padre actual (replaceParent: true) y la única mutación es addSubIssue', async () => {
    const { run, calls } = fakeRun(JSON.stringify({ data: { addSubIssue: { issue: { id: 'epic-node' } } } }));
    await makeGh('gsanchezm/sigpro', run).addSubIssue('epic-node', 'story-node');
    const { query } = JSON.parse(calls[0]?.input ?? '') as { query: string };
    expect(query).toMatch(/\breplaceParent:\s*true\b/);
    expect(query.match(/\bmutation\b/g)).toHaveLength(1);
    expect(query).not.toMatch(/\b(removeSubIssue|reprioritizeSubIssue|closeIssue|deleteIssue|updateIssue)\b/);
    // El campo raíz de la mutación es solo addSubIssue.
    expect(query.match(/\b\w+\(input:/g)).toEqual(['addSubIssue(input:']);
  });

  it('un error en la mutación GraphQL se propaga', async () => {
    const run = fakeRun(JSON.stringify({ errors: [{ message: 'Sub-issue already has a parent' }] })).run;
    await expect(makeGh('gsanchezm/sigpro', run).addSubIssue('a', 'b')).rejects.toThrow('already has a parent');
  });

  it('un fallo del ejecutor (por ejemplo «rate limit») llega tal cual a quien llama', async () => {
    const run: RunGh = () => Promise.reject(new Error('gh api --method POST failed: API rate limit exceeded (HTTP 403)'));
    await expect(makeGh('gsanchezm/sigpro', run).createIssue(draft)).rejects.toThrow(/rate limit/i);
  });
});
