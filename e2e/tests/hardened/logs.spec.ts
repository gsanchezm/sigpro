import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { HARDENED_ADMIN_KEY, HARDENED_API, HARDENED_LOG, STUDENT_PASSWORD, loginStudent, studentTenants } from '../../support/hardened';

// Despliegue endurecido · el log de la API (lo que Render muestra en su panel) no lleva correos, contraseñas, tokens ni tenants.
// La API endurecida escribe stdout y stderr en HARDENED_LOG. Aquí se ejercitan login, registro, «olvidé mi contraseña» y errores con
// valores inventados e inconfundibles, y después se busca cada uno en el log.

test.describe.configure({ mode: 'serial' });

const PROBE = {
  loginEmail: 'sonda.login@sigpro.test',
  loginPassword: 'Sonda-Clave-Login-4821!',
  registerEmail: 'sonda.registro@example.com',
  registerPassword: 'Sonda-Clave-Registro-7391!',
  realEmail: 'sonda.real@gmail.com',
  forgotEmail: 'sonda.forgot@example.com',
};

const readLog = async (): Promise<string> => readFile(HARDENED_LOG, 'utf8');

// La API abre el puerto y DESPUÉS escribe su línea de arranque, y el archivo se rellena con retraso respecto a esa apertura (Playwright
// da la API por levantada en cuanto /health responde): se espera a que aparezca, no se lee de golpe.
const BOOT_LINE = 'SIGPRO API en http://localhost:3200/api';
const waitForBootLine = () => expect.poll(readLog, { message: 'la línea de arranque de la API en el log', timeout: 20_000 }).toContain(BOOT_LINE);

test('el log existe y es el de esta API (comprobación de que la prueba lee lo que debe)', async () => {
  await waitForBootLine();
});

test('tras login, registro, olvidé mi contraseña y errores, el log no contiene ningún dato sensible', async ({ request }) => {
  await waitForBootLine();
  const [tenant = '', other = ''] = await studentTenants(request);
  const headers = { 'x-tenant': tenant };
  const secrets: string[] = [...Object.values(PROBE), HARDENED_ADMIN_KEY, STUDENT_PASSWORD, 'e2e-endurecido-jwt-secret', tenant, other];

  // Login correcto: recogemos los tokens para buscarlos después en el log
  const login = await loginStudent(request, tenant);
  secrets.push(login.accessToken, login.refreshToken);

  // Login con usuario inexistente y con contraseña incorrecta
  await request.post(`${HARDENED_API}/auth/login`, { headers, data: { email: PROBE.loginEmail, password: PROBE.loginPassword, remember: false } });
  await request.post(`${HARDENED_API}/auth/login`, { headers, data: { email: `${tenant}@sigpro.lab`, password: PROBE.loginPassword, remember: false } });

  // Registro correcto, repetido (409) y con correo real (422); «olvidé mi contraseña» válido e inválido
  const body = { first: 'Sonda', last: 'Prueba', org: 'Unidad', role: 'auditor', confirm: PROBE.registerPassword, password: PROBE.registerPassword, terms: true };
  await request.post(`${HARDENED_API}/auth/register`, { headers, data: { ...body, email: PROBE.registerEmail } });
  await request.post(`${HARDENED_API}/auth/register`, { headers, data: { ...body, email: PROBE.registerEmail } });
  await request.post(`${HARDENED_API}/auth/register`, { headers, data: { ...body, email: PROBE.realEmail } });
  await request.post(`${HARDENED_API}/auth/forgot`, { headers, data: { email: PROBE.forgotEmail } });
  await request.post(`${HARDENED_API}/auth/forgot`, { headers, data: { email: PROBE.realEmail } });

  // Llamadas con credenciales, con clave de administración y con un token roto
  await request.get(`${HARDENED_API}/auth/me`, { headers: { ...headers, Authorization: `Bearer ${login.accessToken}` } });
  await request.get(`${HARDENED_API}/config/tenants`, { headers: { 'x-admin-key': HARDENED_ADMIN_KEY } });
  await request.get(`${HARDENED_API}/auth/me`, { headers: { ...headers, Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.firma-falsa-de-prueba' } });

  // Carrera: varios registros simultáneos con el mismo correo pueden acabar en un error de base de datos (500) que Prisma describe con
  // los argumentos de la llamada. Con o sin 500, el correo no puede aparecer en el log.
  const raceEmail = `sonda.carrera.${Date.now()}@example.com`;
  secrets.push(raceEmail);
  const race = await Promise.all(Array.from({ length: 8 }, () => request.post(`${HARDENED_API}/auth/register`, { headers, data: { ...body, email: raceEmail } })));
  const statuses = race.map((response) => response.status());
  test.info().annotations.push({ type: 'carrera de registros', description: `estados: ${statuses.join(',')}` });
  expect(statuses.every((status) => [201, 409, 500].includes(status))).toBe(true);

  // Dar tiempo a que la salida de la API llegue al archivo
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const log = await readLog();
  for (const secret of secrets) expect(log, `el log contiene un dato sensible (longitud ${secret.length}, empieza por «${secret.slice(0, 4)}»)`).not.toContain(secret);
  expect(log).not.toMatch(/alumno\d{2}-[0-9a-z]{4}/); // ningún id de tenant con sufijo
  expect(log).not.toMatch(/eyJ[A-Za-z0-9_-]{15,}\./); // ningún JWT
  expect(log).not.toMatch(/\$2[aby]\$\d{2}\$/); // ningún hash de bcrypt
});
