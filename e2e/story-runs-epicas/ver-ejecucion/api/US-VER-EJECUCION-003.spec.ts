import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, bearer, caseOf, expectChecks, field, getRaw, loginAs, runCountOf, sendRun, verdict, type Expect, type EvidenceExpect } from './common';
import { upload, type FileKind, type Upload } from './files';

// US-VER-EJECUCION-003 — Validación de las evidencias de una ejecución por la API: tipo real, tamaño, cantidad, nombre guardado y
// orden de las comprobaciones. Preparación de cada fila: reinicio de alumno01 con su administrador y login de alumno01 en x-tenant
// alumno01. Los contenidos (PNG, JPEG, PDF, texto) y sus tamaños exactos los fabrica `files.ts`. Los nombres de la fila (con ruta)
// se envían tal cual y el servidor debe guardarlos sin ella.

const ADMIN = 'alumno01@sigpro.lab';
const NOMBRE_PNG = 'captura.png';

// --- E1: el tipo se comprueba por el contenido real -------------------------------------------------------------------------------

/** Contenido de la celda «contenido» (tipo y tamaño exactos). */
const CONTENIDO: ReadonlyMap<string, { readonly kind: FileKind; readonly size: number }> = new Map<string, { readonly kind: FileKind; readonly size: number }>([
  ['un PNG válido de 1.024 bytes', { kind: 'png', size: 1024 }], // strict: 003/E1/contenido
  ['un JPEG válido de 1.024 bytes', { kind: 'jpeg', size: 1024 }],
  ['un PDF válido de 1.024 bytes', { kind: 'pdf', size: 1024 }],
  ['un texto plano de 1.024 bytes', { kind: 'texto', size: 1024 }],
]);

/** Tipo que declara el cliente (celda «tipo»). */
const TIPO: ReadonlyMap<string, string> = new Map<string, string>([
  ['image/png', 'image/png'], // strict: 003/E1/tipo
  ['image/jpeg', 'image/jpeg'],
  ['application/pdf', 'application/pdf'],
  ['text/plain', 'text/plain'],
]);

/** Tipo que queda en la evidencia (celda «evidencia»); «ninguno» si no se guarda ninguna. */
const EVIDENCIA: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['la evidencia queda con el tipo image/png', 'image/png'], // strict: 003/E1/evidencia
  ['la evidencia queda con el tipo image/jpeg', 'image/jpeg'],
  ['la evidencia queda con el tipo application/pdf', 'application/pdf'],
  ['no se guarda ninguna evidencia', undefined],
]);

/** Respuesta de la E1: 201 con la evidencia EV-014, o el 422 de un tipo no válido. */
const RESPUESTA_E1: ReadonlyMap<string, 'creada' | 'tipo'> = new Map<string, 'creada' | 'tipo'>([
  ['201 con una evidencia EV-014', 'creada'], // strict: 003/E1/respuesta
  ['422 validation_failed con el motivo fileBadTypeServer en files', 'tipo'],
]);

const TIPO_ERRONEO: Expect = { status: 422, code: 'validation_failed', errors: { files: 'fileBadTypeServer' } };

/** Comprobaciones de que ninguna evidencia quedó guardada: EV-014 no existe y el caso sigue con 2 ejecuciones. */
const nothingSaved = async (token: string): Promise<Check[]> => {
  const evidence = await getRaw('/evidence/EV-014', TENANT_A, bearer(token));
  const after = await caseOf(token);
  return [
    check(evidence.status === 404 && field(evidence.body, 'code') === 'evidence_not_found', 'no se guarda ninguna evidencia (EV-014 no existe)', `EV-014 responde ${evidence.status}${typeof field(evidence.body, 'code') === 'string' ? ` ${String(field(evidence.body, 'code'))}` : ''}`),
    check(runCountOf(after) === 2, 'el caso TC-001 sigue con 2 ejecuciones', `el caso TC-001 con ${String(runCountOf(after))} ejecuciones`),
  ];
};

const tipo: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, ADMIN));
  if (session.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', session.last);
  const name = cell(row, 'archivo');
  const declared = strict('tipo', TIPO, cell(row, 'tipo'));
  const content = strict('contenido', CONTENIDO, cell(row, 'contenido'));
  const created = strict('respuesta', RESPUESTA_E1, cell(row, 'respuesta')) === 'creada';
  const evidenceType = strict('evidencia', EVIDENCIA, cell(row, 'evidencia'));
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result: 'pass' }, files: [upload(name, declared, content.kind, content.size)], headers: bearer(session.token) });
  if (created) {
    const expect: Expect = {
      status: 201,
      evidencias: [{ id: 'EV-014', filename: name, mimeType: evidenceType, size: content.size }],
    };
    return verdict(expectChecks(expect, answer));
  }
  return verdict([...expectChecks(TIPO_ERRONEO, answer), ...(await nothingSaved(session.token))]);
};

// --- E2: el tamaño con el límite de 2 MB y con el de transporte de 5 MB -----------------------------------------------------------

/** Tamaños de la celda «tamano» (bytes exactos, sin los puntos de miles). */
const TAMANO: ReadonlyMap<string, number> = new Map<string, number>([
  ['2.097.151 bytes', 2097151], // strict: 003/E2/tamano
  ['2.097.152 bytes (2 MB exactos)', 2097152],
  ['2.097.153 bytes', 2097153],
  ['3.145.728 bytes', 3145728],
  ['5.242.881 bytes', 5242881],
]);

/** Respuesta de la E2 según el tamaño: 201 con la evidencia EV-014 (con su tamaño), 422 o 413 sin `code`. */
const RESPUESTA_TAMANO: ReadonlyMap<string, (name: string, size: number) => Expect> = new Map<string, (name: string, size: number) => Expect>([
  ['201 con una evidencia EV-014', (name, size) => ({ status: 201, evidencias: [{ id: 'EV-014', filename: name, mimeType: 'image/png', size }] })], // strict: 003/E2/respuesta
  ['422 validation_failed con el motivo fileTooBigServer en files', () => ({ status: 422, code: 'validation_failed', errors: { files: 'fileTooBigServer' } })],
  ['413 con el mensaje File too large', () => ({ status: 413, bare: true, fields: { message: 'File too large' } })],
]);

const tamano: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, ADMIN));
  if (session.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', session.last);
  const name = cell(row, 'archivo');
  const size = strict('tamano', TAMANO, cell(row, 'tamano'));
  const expect = strict('respuesta', RESPUESTA_TAMANO, cell(row, 'respuesta'))(name, size);
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result: 'pass' }, files: [upload(name, 'image/png', 'png', size)], headers: bearer(session.token) });
  return verdict(expectChecks(expect, answer));
};

// --- E3: la cantidad de archivos se limita a cinco -------------------------------------------------------------------------------

/** Cantidad de la celda «archivos» (cuántos PNG de 1.024 bytes se envían). */
const CANTIDAD: ReadonlyMap<string, number> = new Map<string, number>([
  ['4 PNG válidos de 1.024 bytes cada uno, con nombres distintos', 4], // strict: 003/E3/archivos
  ['5 PNG válidos de 1.024 bytes cada uno, con nombres distintos', 5],
  ['6 PNG válidos de 1.024 bytes cada uno, con nombres distintos', 6],
  ['11 PNG válidos de 1.024 bytes cada uno, con nombres distintos', 11],
]);

/** Respuesta de la E3 según la cantidad: 201 con sus evidencias consecutivas, 422 (más de cinco) o 400 (más de diez partes). */
const RESPUESTA_CANTIDAD: ReadonlyMap<string, (count: number) => Expect> = new Map<string, (count: number) => Expect>([
  ['201 con cuatro evidencias, de EV-014 a EV-017', (count) => ({ status: 201, evidencias: sequence(count) })], // strict: 003/E3/respuesta
  ['201 con cinco evidencias, de EV-014 a EV-018', (count) => ({ status: 201, evidencias: sequence(count) })],
  ['422 validation_failed con el motivo tooManyFiles en files', () => ({ status: 422, code: 'validation_failed', errors: { files: 'tooManyFiles' } })],
  ['400 con el mensaje Too many files', () => ({ status: 400, bare: true, fields: { message: 'Too many files' } })],
]);

/** Evidencias consecutivas a partir de EV-014, con su nombre y su tamaño (1.024 bytes, PNG). */
const sequence = (count: number): EvidenceExpect[] =>
  Array.from({ length: count }, (_, index) => ({ id: `EV-${String(14 + index).padStart(3, '0')}`, filename: `foto-${index + 1}.png`, mimeType: 'image/png', size: 1024 }));

const cantidad: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, ADMIN));
  if (session.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', session.last);
  const count = strict('archivos', CANTIDAD, cell(row, 'archivos'));
  const expect = strict('respuesta', RESPUESTA_CANTIDAD, cell(row, 'respuesta'))(count);
  const files: Upload[] = Array.from({ length: count }, (_, index) => upload(`foto-${index + 1}.png`, 'image/png', 'png', 1024));
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result: 'pass' }, files, headers: bearer(session.token) });
  return verdict(expectChecks(expect, answer));
};

// --- E4: el nombre guardado no incluye la ruta -------------------------------------------------------------------------------------

/** Nombre enviado de la celda «nombre_enviado» (con ruta de Windows o relativa). */
const NOMBRE_ENVIADO: ReadonlyMap<string, string> = new Map<string, string>([
  ['C:\\Users\\yo\\captura.png', 'C:\\Users\\yo\\captura.png'], // strict: 003/E4/nombre_enviado
  ['../../captura.png', '../../captura.png'],
]);

/** Nombre guardado de la celda «nombre_guardado»: solo el último tramo. */
const NOMBRE_GUARDADO: ReadonlyMap<string, string> = new Map<string, string>([['captura.png', 'captura.png']]); // strict: 003/E4/nombre_guardado

const nombre: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, ADMIN));
  if (session.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', session.last);
  const sent = strict('nombre_enviado', NOMBRE_ENVIADO, cell(row, 'nombre_enviado'));
  const saved = strict('nombre_guardado', NOMBRE_GUARDADO, cell(row, 'nombre_guardado'));
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result: 'pass' }, files: [upload(sent, 'image/png', 'png', 1024)], headers: bearer(session.token) });
  return verdict(expectChecks({ status: 201, evidencias: [{ id: 'EV-014', filename: saved, mimeType: 'image/png', size: 1024 }] }, answer));
};

// --- E5: un rechazo por archivos no deja ejecución ni evidencias ------------------------------------------------------------------

/** Archivos rechazados de la celda «archivos_rechazados». */
const RECHAZADOS: ReadonlyMap<string, () => Upload[]> = new Map<string, () => Upload[]>([
  ['6 PNG válidos de 1.024 bytes cada uno, con nombres distintos', () => Array.from({ length: 6 }, (_, index) => upload(`foto-${index + 1}.png`, 'image/png', 'png', 1024))], // strict: 003/E5/archivos_rechazados
  ['un PNG válido de 5.242.881 bytes', () => [upload('enorme.png', 'image/png', 'png', 5242881)]],
  ['un texto plano de 1.024 bytes llamado texto.txt de tipo text/plain', () => [upload('texto.txt', 'text/plain', 'texto', 1024)]],
]);

/** Respuesta del rechazo de la celda «respuesta_rechazo» (el mismo texto que la historia). */
const RESPUESTA_RECHAZO: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['422 validation_failed con el motivo tooManyFiles en files', { status: 422, code: 'validation_failed', errors: { files: 'tooManyFiles' } }], // strict: 003/E5/respuesta_rechazo
  ['413 con el mensaje File too large', { status: 413, bare: true, fields: { message: 'File too large' } }],
  ['422 validation_failed con el motivo fileBadTypeServer en files', { status: 422, code: 'validation_failed', errors: { files: 'fileBadTypeServer' } }],
]);

const rechazo: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, ADMIN));
  if (session.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', session.last);
  const before = await caseOf(session.token);
  if (runCountOf(before) !== 2) return preparationFailed('el caso TC-001 tiene 2 ejecuciones', `TC-001 con ${String(runCountOf(before))} ejecuciones`, before);
  const rejected = strict('archivos_rechazados', RECHAZADOS, cell(row, 'archivos_rechazados'))();
  const expect = strict('respuesta_rechazo', RESPUESTA_RECHAZO, cell(row, 'respuesta_rechazo'));
  const first = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result: 'pass' }, files: rejected, headers: bearer(session.token) });
  const second = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result: 'pass' }, files: [upload(NOMBRE_PNG, 'image/png', 'png', 1024)], headers: bearer(session.token) });
  const after = await caseOf(session.token);
  const checks: Check[] = [
    ...expectChecks(expect, first).map((entry) => ({ ...entry, expected: `primera respuesta ${entry.expected}`, observed: `primera ${entry.observed}` })),
    ...expectChecks({ status: 201, runId: 'RUN-051', evidencias: [{ id: 'EV-014', filename: NOMBRE_PNG, mimeType: 'image/png', size: 1024 }] }, second).map((entry) => ({ ...entry, expected: `última respuesta ${entry.expected}`, observed: `última ${entry.observed}` })),
    check(runCountOf(after) === 3, 'el caso TC-001 tiene 3 ejecuciones', `el caso TC-001 con ${String(runCountOf(after))} ejecuciones`),
  ];
  return verdict(checks);
};

// --- E6: el caso se busca antes que los archivos ------------------------------------------------------------------------------------

const CASO_E6: ReadonlyMap<string, string> = new Map<string, string>([
  ['TC-999', 'TC-999'], // strict: 003/E6/caso
  ['TC-001', 'TC-001'],
]);

const RESPUESTA_E6: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['404 test_case_not_found', { status: 404, code: 'test_case_not_found' }], // strict: 003/E6/respuesta
  ['422 validation_failed con el motivo fileBadTypeServer en files', { status: 422, code: 'validation_failed', errors: { files: 'fileBadTypeServer' } }],
]);

const caso: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, ADMIN));
  if (session.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', session.last);
  const code = strict('caso', CASO_E6, cell(row, 'caso'));
  const expect = strict('respuesta', RESPUESTA_E6, cell(row, 'respuesta'));
  const answer = await sendRun({ tenant: TENANT_A, code, fields: { result: 'pass' }, files: [upload('texto.txt', 'text/plain', 'texto', 1024)], headers: bearer(session.token) });
  return verdict(expectChecks(expect, answer));
};

defineApiRows({
  story: 'US-VER-EJECUCION-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, tipo],
    [2, tamano],
    [3, cantidad],
    [4, nombre],
    [5, rechazo],
    [6, caso],
  ]),
});
