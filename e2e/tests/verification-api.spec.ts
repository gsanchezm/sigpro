import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL, loginByApi, resetTenant, type RoleName } from '../support/auth';
import { PNG_BUFFER, bigPng, fakePng, jpeg, pdf, png, text, type UploadFile } from '../support/files';

// Pruebas de API de Verificación con `request`: lista, detalle, ejecución multipart con evidencias (validación de tipo real,
// tamaño y número), descarga de evidencias, informe PDF y aislamiento por tenant. Tenant propio: alumno15 (y alumno16 de lectura).

const TENANT = 'alumno15';
const OTHER_TENANT = 'alumno16';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const tokens = new Map<string, string>();
const headersFor = async (request: APIRequestContext, role: RoleName, tenant: string): Promise<Record<string, string>> => {
  const key = `${tenant}|${role}`;
  if (!tokens.has(key)) tokens.set(key, (await loginByApi(request, role, tenant)).accessToken);
  return { Authorization: `Bearer ${tokens.get(key)}`, 'x-tenant': tenant };
};

const get = async (request: APIRequestContext, role: RoleName, path: string, tenant = TENANT) => request.get(`${API_URL}${path}`, { headers: await headersFor(request, role, tenant) });

/** multipart/form-data a mano: `files` se repite como campo (Playwright no admite varios archivos con el mismo nombre). */
const multipart = (fields: Readonly<Record<string, string>>, files: readonly UploadFile[]) => {
  const boundary = `----sigpro${Date.now()}`;
  const parts = [
    ...Object.entries(fields).map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)),
    ...files.map((file) => Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${file.name}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`), file.buffer, Buffer.from('\r\n')])),
    Buffer.from(`--${boundary}--\r\n`),
  ];
  return { data: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
};

const execute = async (request: APIRequestContext, role: RoleName, code: string, fields: Readonly<Record<string, string>>, files: readonly UploadFile[] = [], tenant = TENANT) => {
  const body = multipart(fields, files);
  return request.post(`${API_URL}/test-cases/${code}/runs`, { headers: { ...(await headersFor(request, role, tenant)), 'Content-Type': body.contentType }, data: body.data });
};

interface Run {
  id: string;
  result: string;
  notes: string;
  executedByName: string | null;
  evidences: { id: string; filename: string; mimeType: string; size: number; url: string }[];
}

test('GET /test-cases: forma de cada caso, filtros, orden y paginación de 10', async ({ request }) => {
  const response = await get(request, 'auditor', '/test-cases');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { items: { code: string; programCode: string; steps: string[]; requirementCodes: string[]; runCount: number; lastResult: string | null }[]; total: number; totalAll: number; totalRuns: number; page: number; pages: number; pageSize: number };
  expect(body).toMatchObject({ total: 25, totalAll: 25, totalRuns: 50, page: 1, pages: 3, pageSize: 10 });
  expect(body.items).toHaveLength(10);
  expect(body.items[0]).toMatchObject({ code: 'TC-001', programCode: 'PRG-001', requirementCodes: ['REQ-001', 'REQ-008'], runCount: 2 });
  expect(body.items[0]?.steps).toHaveLength(3);

  const byProgram = (await (await get(request, 'auditor', '/test-cases?program=PRG-003&pageSize=100')).json()) as { items: { code: string }[]; total: number };
  expect(byProgram.items.map((c) => c.code)).toEqual(['TC-019', 'TC-020', 'TC-021', 'TC-022', 'TC-023', 'TC-024', 'TC-025']);

  const desc = (await (await get(request, 'auditor', '/test-cases?sort=code&dir=desc&pageSize=3')).json()) as { items: { code: string }[] };
  expect(desc.items.map((c) => c.code)).toEqual(['TC-025', 'TC-024', 'TC-023']);
  const page3 = (await (await get(request, 'auditor', '/test-cases?page=3')).json()) as { items: unknown[]; page: number };
  expect(page3.items).toHaveLength(5);
  expect((await (await get(request, 'auditor', '/test-cases?page=99')).json()) as { page: number }).toMatchObject({ page: 3 }); // se acota

  const fails = (await (await get(request, 'auditor', '/test-cases?result=fail&pageSize=100')).json()) as { items: { lastResult: string }[] };
  expect(fails.items.length).toBeGreaterThan(0);
  expect(fails.items.every((c) => c.lastResult === 'fail')).toBe(true);
  expect(((await (await get(request, 'auditor', '/test-cases?result=none')).json()) as { total: number }).total).toBe(0);
  const search = (await (await get(request, 'auditor', '/test-cases?q=cifrado')).json()) as { items: { code: string }[] };
  expect(search.items.map((c) => c.code)).toEqual(['TC-003', 'TC-011', 'TC-019']);
  // Parámetros no válidos se ignoran (no rompen la lista)
  expect(((await (await get(request, 'auditor', '/test-cases?result=roto&sort=nada&dir=sideways&page=abc')).json()) as { total: number }).total).toBe(25);
});

test('GET /test-cases/:code: pasos, requisitos y historial (más reciente primero) con metadatos de evidencias', async ({ request }) => {
  const response = await get(request, 'consultant', '/test-cases/TC-001');
  expect(response.status()).toBe(200);
  const detail = (await response.json()) as { code: string; requirements: { code: string; title: string }[]; runs: Run[]; expected: string };
  expect(detail.requirements.map((r) => r.code)).toEqual(['REQ-001', 'REQ-008']);
  expect(detail.runs.map((r) => r.id)).toEqual(['RUN-002', 'RUN-001']);
  expect(detail.runs[1]?.evidences).toEqual([expect.objectContaining({ id: 'EV-001', filename: 'TC-001-001.png', mimeType: 'image/png', url: '/evidence/EV-001' })]);
  expect(detail.runs[0]?.evidences).toEqual([]);
  expect(detail.runs[1]?.executedByName).toBe('Lucía Fernández');
  expect((await get(request, 'consultant', '/test-cases/TC-999')).status()).toBe(404);
});

test('POST /test-cases/:code/runs: registra una ejecución multipart con varias evidencias y actualiza el último resultado', async ({ request }) => {
  const response = await execute(request, 'consultant', 'TC-002', { result: 'blocked', notes: '  Sin entorno disponible  ' }, [png('captura.png'), jpeg('foto.jpg'), pdf('informe.pdf')]);
  expect(response.status()).toBe(201);
  const run = (await response.json()) as Run;
  expect(run).toMatchObject({ id: 'RUN-051', result: 'blocked', notes: 'Sin entorno disponible', executedByName: 'Lucía Fernández' });
  expect(run.evidences.map((e) => [e.id, e.filename, e.mimeType])).toEqual([
    ['EV-014', 'captura.png', 'image/png'],
    ['EV-015', 'foto.jpg', 'image/jpeg'],
    ['EV-016', 'informe.pdf', 'application/pdf'],
  ]);

  const detail = (await (await get(request, 'consultant', '/test-cases/TC-002')).json()) as { lastResult: string; runCount: number; runs: Run[] };
  expect(detail).toMatchObject({ lastResult: 'blocked', runCount: 4 });
  expect(detail.runs[0]?.id).toBe('RUN-051');

  // Sin evidencias también vale; el admin puede ejecutar
  const bare = await execute(request, 'admin', 'TC-002', { result: 'pass' });
  expect(bare.status()).toBe(201);
  expect(((await bare.json()) as Run).evidences).toEqual([]);
});

test('GET /evidence/:id devuelve los bytes con su tipo y Content-Disposition inline; 404 si no existe', async ({ request }) => {
  const image = await get(request, 'auditor', '/evidence/EV-014');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/png');
  expect(image.headers()['content-disposition']).toContain('inline; filename="captura.png"');
  expect((await image.body()).equals(PNG_BUFFER)).toBe(true);

  const document = await get(request, 'auditor', '/evidence/EV-016');
  expect(document.headers()['content-type']).toBe('application/pdf');
  expect((await document.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');

  const seeded = await get(request, 'auditor', '/evidence/EV-001'); // captura del seed
  expect(seeded.headers()['content-type']).toBe('image/png');
  expect((await seeded.body()).subarray(1, 4).toString('latin1')).toBe('PNG');

  expect((await get(request, 'auditor', '/evidence/EV-999')).status()).toBe(404);
  expect((await request.get(`${API_URL}/evidence/EV-014`, { headers: { 'x-tenant': TENANT } })).status()).toBe(401); // sin token
});

test('validación de la ejecución (422): resultado, notas y evidencias (tipo real, tamaño y número)', async ({ request }) => {
  const errorsOf = async (response: Awaited<ReturnType<typeof execute>>) => ((await response.json()) as { errors: Record<string, string> }).errors;

  const noResult = await execute(request, 'consultant', 'TC-003', { notes: 'sin resultado' });
  expect(noResult.status()).toBe(422);
  expect(await errorsOf(noResult)).toEqual({ result: 'resultRequired' });
  expect((await execute(request, 'consultant', 'TC-003', { result: 'quizás' })).status()).toBe(422);
  const longNotes = await execute(request, 'consultant', 'TC-003', { result: 'pass', notes: 'x'.repeat(1001) });
  expect(await errorsOf(longNotes)).toEqual({ notes: 'notesLong' });

  // Tipo: debe estar permitido Y coincidir con el contenido real
  expect(await errorsOf(await execute(request, 'consultant', 'TC-003', { result: 'pass' }, [text('notas.txt')]))).toEqual({ files: 'fileBadTypeServer' });
  expect(await errorsOf(await execute(request, 'consultant', 'TC-003', { result: 'pass' }, [fakePng('falso.png')]))).toEqual({ files: 'fileBadTypeServer' });
  expect(await errorsOf(await execute(request, 'consultant', 'TC-003', { result: 'pass' }, [{ name: 'doc.png', mimeType: 'image/png', buffer: pdf().buffer }]))).toEqual({ files: 'fileBadTypeServer' });

  // Tamaño: más de 2 MB → 422; exactamente 2 MB → válido
  expect(await errorsOf(await execute(request, 'consultant', 'TC-003', { result: 'pass' }, [bigPng('grande.png', 2.1 * 1024 * 1024)]))).toEqual({ files: 'fileTooBigServer' });
  const exact = await execute(request, 'consultant', 'TC-003', { result: 'pass' }, [bigPng('justo.png', 2 * 1024 * 1024 - PNG_BUFFER.length)]);
  expect(exact.status()).toBe(201);
  expect(((await exact.json()) as Run).evidences[0]?.size).toBe(2 * 1024 * 1024);

  // Número: hasta 5; con 6 → 422 y no se crea nada
  const six = Array.from({ length: 6 }, (_, i) => png(`c${i}.png`));
  expect(await errorsOf(await execute(request, 'consultant', 'TC-003', { result: 'pass' }, six))).toEqual({ files: 'tooManyFiles' });
  const five = await execute(request, 'consultant', 'TC-003', { result: 'fail' }, six.slice(0, 5));
  expect(five.status()).toBe(201);
  expect(((await five.json()) as Run).evidences).toHaveLength(5);
  const runs = ((await (await get(request, 'consultant', '/test-cases/TC-003')).json()) as { runs: Run[] }).runs;
  expect(runs.filter((run) => run.notes === '')).toHaveLength(2); // solo las dos ejecuciones válidas de arriba (las rechazadas no dejan rastro)

  // Un archivo de más de 5 MB ni siquiera llega al servicio (límite de multer → 413)
  expect((await execute(request, 'consultant', 'TC-003', { result: 'pass' }, [bigPng('descomunal.png', 6 * 1024 * 1024)])).status()).toBe(413);
});

test('permisos y 404 al ejecutar: auditor y gestor reciben 403; caso inexistente, 404', async ({ request }) => {
  expect((await execute(request, 'auditor', 'TC-004', { result: 'pass' })).status()).toBe(403);
  expect((await execute(request, 'program_manager', 'TC-004', { result: 'pass' })).status()).toBe(403);
  expect((await execute(request, 'consultant', 'TC-999', { result: 'pass' })).status()).toBe(404);
});

test('GET /verification/report: PDF de todos los casos, de un programa o de una selección', async ({ request }) => {
  const all = await get(request, 'auditor', '/verification/report');
  expect(all.status()).toBe(200);
  expect(all.headers()['content-type']).toBe('application/pdf');
  expect(all.headers()['content-disposition']).toContain('attachment; filename="informe-verificacion.pdf"');
  const bytes = await all.body();
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(bytes.toString('latin1')).toContain('Todos los programas');

  const program = await get(request, 'auditor', '/verification/report?program=PRG-003');
  expect(program.headers()['content-disposition']).toContain('informe-verificacion-prg-003.pdf');
  const programText = (await program.body()).toString('latin1');
  expect(programText).toContain('TC-019');
  expect(programText).not.toContain('TC-001 ');

  const selection = await get(request, 'auditor', '/verification/report?codes=TC-002,TC-005,TC-999');
  expect(selection.headers()['content-disposition']).toContain('informe-verificacion-seleccion.pdf');
  const selectionText = (await selection.body()).toString('latin1');
  expect(selectionText).toContain('Selecci\xf3n de 2 caso\\(s\\)');
  expect(selectionText).toContain('Bloqueado'); // TC-002 acaba de registrar un bloqueo

  expect((await get(request, 'auditor', '/verification/report?program=PRG-004')).status()).toBe(404); // sin casos de prueba
  expect((await get(request, 'auditor', '/verification/report?codes=TC-999')).status()).toBe(404);
});

test('aislamiento por tenant: una evidencia y una ejecución de un tenant no existen en otro', async ({ request }) => {
  // EV-014 y RUN-051 se crearon en alumno15; alumno16 solo tiene las del seed (EV-001…013, RUN-001…050)
  expect((await get(request, 'admin', '/evidence/EV-014', OTHER_TENANT)).status()).toBe(404);
  const other = (await (await get(request, 'admin', '/test-cases/TC-002', OTHER_TENANT)).json()) as { runCount: number; runs: Run[] };
  expect(other.runCount).toBe(3);
  expect(other.runs.map((r) => r.id)).not.toContain('RUN-051');
});
