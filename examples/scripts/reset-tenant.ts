// Restaura el seed de tu tenant (`POST /api/admin/reset`, < 2 s). Úsalo antes de lanzar la suite: `npm run reset`.
// Entra con tu usuario `alumnoNN@sigpro.lab` (admin de tu tenant), así no hace falta ninguna clave de administración.
import { API_URL, ROLES, STUDENT, STUDENT_USER, TENANT } from '../support/env';

interface Login {
  readonly mfaRequired?: boolean;
  readonly mfaToken?: string;
  readonly accessToken?: string;
}

const post = async (path: string, init: { data?: unknown; token?: string }): Promise<Response> =>
  fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant': TENANT, ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) },
    body: init.data === undefined ? undefined : JSON.stringify(init.data),
  });

const main = async (): Promise<void> => {
  // Si trabajas en otro tenant que el tuyo (p. ej. `demo`), tu usuario no existe allí: se usa el admin del seed
  const credentials = TENANT === STUDENT ? STUDENT_USER : ROLES.admin;
  const login = await post('/auth/login', { data: { email: credentials.email, password: credentials.password } });
  if (!login.ok) throw new Error(`Login de ${credentials.email} en ${TENANT}: ${login.status} ${await login.text()}`);
  const body = (await login.json()) as Login;

  const token = body.mfaRequired
    ? ((await (await post('/auth/mfa', { data: { mfaToken: body.mfaToken, code: '123456' } })).json()) as Login).accessToken
    : body.accessToken;
  if (!token) throw new Error('No se obtuvo el token de acceso');

  const started = Date.now();
  const reset = await post('/admin/reset', { token });
  if (!reset.ok) throw new Error(`Reset de ${TENANT}: ${reset.status} ${await reset.text()}`);
  console.log(`Tenant ${TENANT} restaurado en ${Date.now() - started} ms (${API_URL})`);

  // El reset conserva el modo caos del tenant (a propósito: un alumno no apaga el caos del instructor).
  // Para una ejecución limpia de la suite lo apagamos aquí; la sesión 10 lo enciende y lo apaga ella misma.
  const chaos = await fetch(`${API_URL}/admin/chaos`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-tenant': TENANT, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ latencyMs: 0, errorRate: 0, flakyLabels: false }),
  });
  if (!chaos.ok) throw new Error(`No se pudo apagar el modo caos de ${TENANT}: ${chaos.status} ${await chaos.text()}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
