import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, TENANT_B, bearer, dispositionChecks, endsWithIend, expectChecks, getRaw, loginAs, pngDimensions, sendRun, verdict, type Expect, type Fetched } from './common';
import { isPng, upload, type Upload } from './files';
import type { ApiResult } from '../../../story-runs/support/api';

// US-VER-EJECUCION-004 — Descarga de una evidencia por su identificador, dentro de su tenant (API). Preparación de cada fila: reinicio
// de alumno01 (y de alumno02 en la E4) con su administrador. «(captura recién subida)» y «(PDF recién subido)» las crea la propia fila
// con alumno01 (ejecución con resultado pass, EV-014). La descarga se pide con la cuenta de la fila; la cabecera x-tenant no cambia
// el tenant del token. Cada 200 se comprueba también con Cache-Control (Regla 004:19).

const ALUMNO_A = 'alumno01@sigpro.lab';

/** Cabeceras de caché que la historia fija para toda descarga correcta. */
const CACHE = 'private, max-age=300';

/** Archivo que la fila sube como evidencia recién subida (EV-014). */
const SUBIDA: ReadonlyMap<string, Upload> = new Map<string, Upload>([
  ['(captura recién subida)', upload('captura.png', 'image/png', 'png', 1024)], // strict: 004/E2/evidencia
  ['(PDF recién subido)', upload('informe.pdf', 'application/pdf', 'pdf', 1024)],
]);

/** Tipo de la E2 (columna «tipo»): el que la historia espera en la cabecera Content-Type. */
const TIPO: ReadonlyMap<string, string> = new Map<string, string>([
  ['image/png', 'image/png'], // strict: 004/E2/tipo
  ['application/pdf', 'application/pdf'],
]);

/** Nombre de la E2 (columna «nombre»): el que la historia espera en Content-Disposition. */
const NOMBRE: ReadonlyMap<string, string> = new Map<string, string>([
  ['captura.png', 'captura.png'], // strict: 004/E2/nombre
  ['informe.pdf', 'informe.pdf'],
]);

/** Sube el archivo con alumno01 en una ejecución (resultado pass). `saved` si la subida responde 201; si no, la respuesta que lo explica. */
const registerEvidence = async (file: Upload): Promise<{ readonly saved: boolean; readonly answer: ApiResult }> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, ALUMNO_A));
  if (session.token === undefined) return { saved: false, answer: session.last };
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result: 'pass' }, files: [file], headers: bearer(session.token) });
  return { saved: answer.status === 201, answer };
};

// --- E1: cualquier rol autenticado descarga la evidencia del seed ------------------------------------------------------------------

/** EV-001 con la cuenta de la fila: 200, PNG válido de la imagen del seed (160 × 100), cabeceras y nombre TC-001-001.png. */
const seedDownload: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta')));
  if (session.token === undefined) return preparationFailed(`${cell(row, 'cuenta')} inicia sesión en alumno01`, `${cell(row, 'cuenta')} no obtiene accessToken en alumno01`, session.last);
  const answer = await getRaw('/evidence/EV-001', TENANT_A, bearer(session.token));
  const length = answer.headers?.get('content-length') ?? null;
  const dims = pngDimensions(answer.bytes);
  const checks: Check[] = [
    ...expectChecks({ status: 200 }, answer),
    check(answer.headers?.get('content-type') === 'image/png', 'Content-Type image/png', `Content-Type ${answer.headers?.get('content-type') ?? '(sin cabecera)'}`),
    ...dispositionChecks(answer.headers?.get('content-disposition'), 'TC-001-001.png'),
    check(answer.headers?.get('cache-control') === CACHE, `Cache-Control ${CACHE}`, `Cache-Control ${answer.headers?.get('cache-control') ?? '(sin cabecera)'}`),
    // El PNG válido: firma, IHDR de la imagen del seed (160 × 100), fin IEND y, si viene, el Content-Length de los bytes
    check(isPng(answer.bytes), 'el cuerpo es un PNG válido (firma PNG)', isPng(answer.bytes) ? 'empieza por la firma PNG' : 'no empieza por la firma PNG'),
    check(dims?.width === 160 && dims?.height === 100, 'la imagen del seed mide 160 × 100', dims === undefined ? 'sin cabecera IHDR' : `imagen de ${dims.width} × ${dims.height}`),
    check(endsWithIend(answer.bytes), 'el PNG termina en el fragmento IEND', endsWithIend(answer.bytes) ? 'termina en IEND' : 'no termina en IEND (archivo truncado)'),
    check(length === null || Number(length) === answer.bytes.length, 'Content-Length (si viene) coincide con los bytes recibidos', length === null ? 'sin Content-Length' : `Content-Length ${length} y ${answer.bytes.length} bytes`),
  ];
  return verdict(checks);
};

// --- E2: una evidencia recién subida conserva su tipo y su nombre -------------------------------------------------------------------

/** La evidencia que la fila sube: su tipo y su nombre (de la historia) y el mismo archivo que se adjuntó. */
const freshDownload: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const file = strict('evidencia', SUBIDA, cell(row, 'evidencia'));
  const made = await registerEvidence(file);
  if (!made.saved) return preparationFailed(`${cell(row, 'evidencia')} queda guardada en TC-001 como EV-014`, 'la subida con alumno01 no responde 201', made.answer);
  const reader = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  if (reader.token === undefined) return preparationFailed('gestor@sigpro.test inicia sesión en alumno01', 'gestor@sigpro.test no obtiene accessToken en alumno01', reader.last);
  const answer = await getRaw('/evidence/EV-014', TENANT_A, bearer(reader.token));
  const wantedType = strict('tipo', TIPO, cell(row, 'tipo'));
  const wantedName = strict('nombre', NOMBRE, cell(row, 'nombre'));
  const checks: Check[] = [
    ...expectChecks({ status: 200 }, answer),
    check(answer.headers?.get('content-type') === wantedType, `Content-Type ${wantedType}`, `Content-Type ${answer.headers?.get('content-type') ?? '(sin cabecera)'}`),
    ...dispositionChecks(answer.headers?.get('content-disposition'), wantedName),
    check(answer.headers?.get('cache-control') === CACHE, `Cache-Control ${CACHE}`, `Cache-Control ${answer.headers?.get('cache-control') ?? '(sin cabecera)'}`),
    check(answer.bytes.equals(file.bytes), 'el cuerpo es el mismo archivo que se adjuntó', answer.bytes.equals(file.bytes) ? 'el cuerpo es idéntico al adjuntado' : `el cuerpo tiene ${answer.bytes.length} bytes y el adjuntado ${file.bytes.length}`),
  ];
  return verdict(checks);
};

// --- E3: sin una sesión válida la evidencia no se entrega -------------------------------------------------------------------------

/** Cabecera `Authorization` de la E3: ninguna, o un Bearer que no es un token. */
const CABECERA: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map<string, Readonly<Record<string, string>>>([
  ['(sin cabecera)', {}], // strict: 004/E3/cabecera_authorization
  ['(Bearer con un texto que no es un token)', { authorization: 'Bearer texto-que-no-es-un-token' }],
]);

const RESPUESTA_E3: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['401 missing_token', { status: 401, code: 'missing_token' }], // strict: 004/E3/respuesta
  ['401 invalid_token', { status: 401, code: 'invalid_token' }],
]);

/** Sin token válido la API no entrega el archivo: el cuerpo no es la imagen de la evidencia. EV-001 existe (se comprueba antes). */
const sinSesion: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const headers = strict('cabecera_authorization', CABECERA, cell(row, 'cabecera_authorization'));
  const expect = strict('respuesta', RESPUESTA_E3, cell(row, 'respuesta'));
  const admin = await loginAs(strict('cuenta', ACCOUNT_OF, ALUMNO_A));
  if (admin.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', admin.last);
  const seen = await getRaw('/evidence/EV-001', TENANT_A, bearer(admin.token));
  if (seen.status !== 200) return preparationFailed('la evidencia EV-001 existe en alumno01', `GET /evidence/EV-001 responde ${seen.status}`, { status: seen.status, body: seen.body, ms: 0 });
  const answer = await getRaw('/evidence/EV-001', TENANT_A, headers);
  const notFile: Check = check(!isPng(answer.bytes), 'el cuerpo de la respuesta no es el archivo de la evidencia', isPng(answer.bytes) ? 'el cuerpo es el archivo de la evidencia' : 'el cuerpo no es el archivo de la evidencia');
  return verdict([...expectChecks(expect, answer), notFile]);
};

// --- E4: una evidencia solo es visible dentro de su tenant -----------------------------------------------------------------------

/** Cabecera `x-tenant` de la petición: el tenant de alumno01 o el de alumno02. */
const CABECERA_TENANT: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A], // strict: 004/E4/cabecera
  ['alumno02', TENANT_B],
]);

/** Identificador de la evidencia que pide la E4 (la que la fila sube en alumno01). */
const ID_E4: ReadonlyMap<string, string> = new Map<string, string>([['EV-014', 'EV-014']]); // strict: 004/E4/id

const RESPUESTA_E4: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['200 con Content-Type image/png y el nombre captura.png', { status: 200 }], // strict: 004/E4/respuesta
  ['404 evidence_not_found', { status: 404, code: 'evidence_not_found' }],
]);

/** Cuenta de la fila: alumno01 (su evidencia) o alumno02 (otro tenant). Ambas inician sesión en su tenant, como dice la historia. */
const aislamiento: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const expect = strict('respuesta', RESPUESTA_E4, cell(row, 'respuesta'));
  const headerTenant = strict('cabecera', CABECERA_TENANT, cell(row, 'cabecera'));
  const account = strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta'));
  const id = strict('id', ID_E4, cell(row, 'id'));
  const made = await registerEvidence(upload('captura.png', 'image/png', 'png', 1024));
  if (!made.saved) return preparationFailed('(captura recién subida) queda guardada en alumno01 como EV-014', 'la subida con alumno01 no responde 201', made.answer);
  const sessionA = await loginAs(strict('cuenta', ACCOUNT_OF, ALUMNO_A));
  const sessionB = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno02@sigpro.lab'));
  if (sessionA.token === undefined || sessionB.token === undefined) return preparationFailed('alumno01 y alumno02 inician sesión en su propio tenant', 'alumno01 o alumno02 no obtienen accessToken', sessionA.token === undefined ? sessionA.last : sessionB.last);
  const token = account.tenant === TENANT_A ? sessionA.token : sessionB.token;
  const answer: Fetched = await getRaw(`/evidence/${id}`, headerTenant, bearer(token));
  const checks: Check[] = [...expectChecks(expect, answer)];
  if (expect.status === 200) {
    checks.push(check(answer.headers?.get('content-type') === 'image/png', 'Content-Type image/png', `Content-Type ${answer.headers?.get('content-type') ?? '(sin cabecera)'}`));
    checks.push(...dispositionChecks(answer.headers?.get('content-disposition'), 'captura.png'));
    checks.push(check(answer.headers?.get('cache-control') === CACHE, `Cache-Control ${CACHE}`, `Cache-Control ${answer.headers?.get('cache-control') ?? '(sin cabecera)'}`));
  }
  return verdict(checks);
};

defineApiRows({
  story: 'US-VER-EJECUCION-004',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, seedDownload],
    [2, freshDownload],
    [3, sinSesion],
    [4, aislamiento],
  ]),
});
