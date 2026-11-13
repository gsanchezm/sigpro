// Borde con GitHub: implementa `Gh` con `gh api`. No lleva lógica de negocio: cada método es una llamada
// (o, al listar, una por página) y la validación de lo que vuelve. Los cuerpos JSON van por stdin (`--input -`)
// para no pelearse con las comillas de cuerpos de varias líneas. El repositorio es público: aquí está toda la
// escritura contra GitHub, y solo se invoca desde `applyOps` (`stories sync --apply`).
import { execFile } from 'node:child_process';
import { z } from 'zod';
import type { IssueDraft } from './render';
import type { Gh, RemoteIssue } from './sync';

/** Repositorio por defecto de la sincronización. */
export const DEFAULT_REPO = 'gsanchezm/sigpro';

/** Ejecuta `gh <args>` con `input` por stdin y devuelve stdout. Inyectable para probar los argumentos sin red. */
export type RunGh = (args: readonly string[], input?: string) => Promise<string>;

/** Las páginas de 100 issues con cuerpo completo superan con holgura el límite por defecto (1 MB). */
const MAX_BUFFER = 64 * 1024 * 1024;

/** Ejecuta `gh` sin shell. Si falla, el mensaje lleva stderr y stdout: ahí aparece el texto de «rate limit» que `applyOps` reconoce. */
export const runGh: RunGh = (args, input) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      'gh',
      [...args],
      { maxBuffer: MAX_BUFFER, windowsHide: true, encoding: 'utf8', env: { ...process.env, GH_PROMPT_DISABLED: '1' } },
      (error, stdout, stderr) => {
        if (error === null) return resolve(stdout);
        const detail = [stderr, stdout].map((text) => text.trim()).filter((text) => text !== '').join(' ');
        return reject(new Error(`gh ${args.slice(0, 4).join(' ')} falló: ${detail === '' ? error.message : detail}`));
      },
    );
    // Si gh termina antes de leer stdin, el EPIPE no debe tumbar el proceso: el fallo real llega por el callback.
    child.stdin?.on('error', () => undefined);
    child.stdin?.end(input ?? '');
  });

// ---------------------------------------------------------------------------------------------------------
// Respuestas que se leen (validadas con Zod: nada de `any`)
// ---------------------------------------------------------------------------------------------------------

const createdSchema = z.object({ node_id: z.string().min(1), number: z.number().int() });

const issueNodeSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  title: z.string(),
  body: z.string(),
  state: z.enum(['OPEN', 'CLOSED']),
  author: z.object({ login: z.string() }).nullable(),
  labels: z.object({ nodes: z.array(z.object({ name: z.string() }).nullable()) }),
  parent: z.object({ number: z.number().int() }).nullable(),
});

const issuesPageSchema = z.object({
  data: z.object({
    repository: z.object({
      issues: z.object({
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
        nodes: z.array(issueNodeSchema.nullable()),
      }),
    }),
  }),
});

type IssueNode = z.infer<typeof issueNodeSchema>;

/** Una autoría borrada (`null`) llega como cadena vacía: la sincronización nunca la toma por mía. */
const toRemoteIssue = (node: IssueNode): RemoteIssue => ({
  nodeId: node.id,
  number: node.number,
  title: node.title,
  body: node.body,
  labels: node.labels.nodes.flatMap((label) => (label === null ? [] : [label.name])),
  state: node.state,
  author: node.author?.login ?? '',
  parentNumber: node.parent?.number ?? null,
});

// ---------------------------------------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------------------------------------

const LIST_ISSUES_QUERY = `query ListIssues($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    issues(first: 100, after: $cursor, orderBy: { field: CREATED_AT, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id number title body state
        author { login }
        labels(first: 20) { nodes { name } }
        parent { number }
      }
    }
  }
}`;

const ADD_SUB_ISSUE_MUTATION = `mutation AddSubIssue($issueId: ID!, $subIssueId: ID!) {
  addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId }) { issue { id } }
}`;

const splitRepo = (repo: string): { owner: string; name: string } => {
  const [owner, name, ...rest] = repo.split('/');
  if (owner === undefined || owner === '' || name === undefined || name === '' || rest.length > 0) {
    throw new Error(`repositorio inválido «${repo}»: se esperaba propietario/nombre`);
  }
  return { owner, name };
};

/** Un error dentro de una respuesta GraphQL con estado HTTP 200 también es un fallo. */
const graphqlErrors = (raw: unknown): string | null => {
  const parsed = z.object({ errors: z.array(z.object({ message: z.string() })).min(1) }).safeParse(raw);
  return parsed.success ? parsed.data.errors.map((error) => error.message).join('; ') : null;
};

// ---------------------------------------------------------------------------------------------------------
// Gh
// ---------------------------------------------------------------------------------------------------------

/** Cuerpo de crear o editar un issue: nunca lleva `state`, así que un issue cerrado no se reabre. */
const issuePayload = (draft: IssueDraft): string => JSON.stringify({ title: draft.title, body: draft.body, labels: draft.labels });

export const makeGh = (repo: string = DEFAULT_REPO, run: RunGh = runGh): Gh => {
  const { owner, name } = splitRepo(repo);

  const graphql = async (query: string, variables: Record<string, unknown>): Promise<unknown> => {
    const raw: unknown = JSON.parse(await run(['api', 'graphql', '--input', '-'], JSON.stringify({ query, variables })));
    const errors = graphqlErrors(raw);
    if (errors !== null) throw new Error(`GraphQL falló: ${errors}`);
    return raw;
  };

  const fetchPages = async (cursor: string | null, acc: readonly RemoteIssue[]): Promise<readonly RemoteIssue[]> => {
    const { issues } = issuesPageSchema.parse(await graphql(LIST_ISSUES_QUERY, { owner, name, cursor })).data.repository;
    const all = [...acc, ...issues.nodes.flatMap((node) => (node === null ? [] : [toRemoteIssue(node)]))];
    const { hasNextPage, endCursor } = issues.pageInfo;
    return hasNextPage && endCursor !== null ? fetchPages(endCursor, all) : all;
  };

  return {
    me: async () => {
      const login = (await run(['api', '--method', 'GET', 'user', '--jq', '.login'])).trim();
      if (login === '') throw new Error('gh no devolvió el usuario autenticado: ejecuta `gh auth login`');
      return login;
    },
    listIssues: () => fetchPages(null, []),
    listLabels: async () => {
      const out = await run(['api', '--method', 'GET', `repos/${repo}/labels?per_page=100`, '--paginate', '--jq', '.[].name']);
      return out.split(/\r?\n/).filter((line) => line !== '');
    },
    createLabel: async (label) => {
      await run(['api', '--method', 'POST', `repos/${repo}/labels`, '--input', '-'], JSON.stringify(label));
    },
    createIssue: async (draft) => {
      const created = createdSchema.parse(JSON.parse(await run(['api', '--method', 'POST', `repos/${repo}/issues`, '--input', '-'], issuePayload(draft))));
      return { nodeId: created.node_id, number: created.number };
    },
    updateIssue: async (number, draft) => {
      await run(['api', '--method', 'PATCH', `repos/${repo}/issues/${number}`, '--input', '-'], issuePayload(draft));
    },
    addSubIssue: async (parentNodeId, childNodeId) => {
      await graphql(ADD_SUB_ISSUE_MUTATION, { issueId: parentNodeId, subIssueId: childNodeId });
    },
  };
};
