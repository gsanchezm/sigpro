import { TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import {
  DOCUMENTOS,
  LINEA,
  auditCheck,
  cuentaOf,
  documentOf,
  entryNamed,
  finish,
  intOf,
  lastPublishEvent,
  letras,
  loginAs,
  publish,
  quotedList,
  responseChecks,
  thenOf,
  versionMismatch,
  type VersionEntry,
} from './common';

// US-DOC-VERSIONES-001 — Publicar una versión nueva por la API: queda la última, con su nota y su autor. Preparación de cada fila:
// reinicio de alumno01, inicio de sesión de la cuenta de la fila en alumno01 y lectura de la versión de partida. Tras publicar se
// vuelve a leer la ficha con la misma cuenta. Además, cada publicación exitosa debe quedar en la auditoría (regla de la historia).

/** Una publicación de la fila y lo que la historia espera de ella. */
interface Publication {
  readonly expected: string;
  readonly account: Credentials;
  readonly doc: string;
  readonly before: number;
  readonly next: number;
  /** Nota que se envía; `undefined` = el campo no va en el cuerpo. */
  readonly note: string | undefined;
  /** Nota que la historia dice que queda guardada («(vacía)» = cadena vacía). */
  readonly stored: string;
  /** Autor que la historia dice que queda guardado, si la fila lo da. */
  readonly author?: string;
}

const shown = (text: string): string => (text === '' ? '(vacía)' : text);

/** Reinicia alumno01, publica con la cuenta y comprueba la versión nueva, su nota, su autor y la auditoría. */
const publicarYVerificar = async (p: Publication): Promise<Outcome> => {
  await resetTenants([TENANT_A]);
  const login = await loginAs(TENANT_A, p.account);
  if (login.token === undefined) return preparationFailed(p.expected, `${p.account.email} inicia sesión en alumno01`, login.last);
  const start = await documentOf(TENANT_A, login.token, p.doc);
  const mismatch = versionMismatch(p.doc, p.before, start);
  if (mismatch !== undefined) return preparationFailed(p.expected, mismatch, start.result);
  const sent = await publish(TENANT_A, login.token, p.doc, { lines: [LINEA], ...(p.note === undefined ? {} : { note: p.note }) });
  const after = await documentOf(TENANT_A, login.token, p.doc);
  const entry: VersionEntry | undefined = entryNamed(after.versions, p.next);
  const audit = await lastPublishEvent(TENANT_A);
  const checks = [
    ...responseChecks(sent, { status: 201, version: p.next }),
    check(after.version === p.next, `la última versión de ${p.doc} es la ${p.next}`, `la última versión de ${p.doc} es la ${String(after.version)}`),
    check(entry?.note === p.stored, `con la nota ${shown(p.stored)}`, `con la nota ${entry === undefined ? '(sin leer)' : shown(entry.note)}`),
    ...(p.author === undefined
      ? []
      : [check(entry?.authorName === p.author, `y el autor ${p.author}`, `y el autor ${entry?.authorName ?? '(sin leer)'}`)]),
    auditCheck(audit.event, p.doc, p.next),
  ];
  return finish(checks, { evidence: { publicacion: JSON.stringify(sent.body).slice(0, 300), auditoria: audit.result.status } });
};

// --- Esquema 1: la versión nueva pasa a ser la última del documento ---------------------------------------------------------------

const publishesLast: ApiRowHandler = async (row) =>
  publicarYVerificar({
    expected: thenOf(row),
    account: cuentaOf(cell(row, 'cuenta')),
    doc: strict('documento', DOCUMENTOS, cell(row, 'documento')),
    before: intOf(cell(row, 'version_actual')),
    next: intOf(cell(row, 'version_nueva')),
    note: cell(row, 'nota_enviada'),
    stored: cell(row, 'nota_guardada'),
    author: cell(row, 'autor'),
  });

// --- Esquema 2: la nota se guarda sin espacios de los extremos y vacía si no se envía ----------------------------------------------

/** Nota de la celda enviada: `undefined` = el campo no va en el cuerpo. */
const NOTA_ENVIADA: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin el campo)', undefined],
  ['(vacía)', ''],
  ['(dos espacios delante y dos detrás de Revisión final)', '  Revisión final  '],
  ['(200 letras a)', letras(200)],
]);

/** Nota que la historia dice que queda guardada. */
const NOTA_GUARDADA: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacía)', ''],
  ['Revisión final', 'Revisión final'],
  ['(200 letras a)', letras(200)],
]);

const storesNote: ApiRowHandler = async (row) =>
  publicarYVerificar({
    expected: thenOf(row),
    account: cuentaOf('gestor@sigpro.test'),
    doc: 'DOC-004',
    before: 3,
    next: 4,
    note: strict('nota_enviada', NOTA_ENVIADA, cell(row, 'nota_enviada')),
    stored: strict('nota_guardada', NOTA_GUARDADA, cell(row, 'nota_guardada')),
  });

// --- Esquema 3: las versiones anteriores conservan sus notas ----------------------------------------------------------------------

const keepsPreviousNotes: ApiRowHandler = async (row) => {
  const expected = thenOf(row);
  const doc = strict('documento', DOCUMENTOS, cell(row, 'documento'));
  const before = intOf(cell(row, 'version_actual'));
  const next = intOf(cell(row, 'version_nueva'));
  const notes = quotedList(cell(row, 'notas_anteriores'));
  await resetTenants([TENANT_A]);
  const account = cuentaOf('gestor@sigpro.test');
  const login = await loginAs(TENANT_A, account);
  if (login.token === undefined) return preparationFailed(expected, `${account.email} inicia sesión en alumno01`, login.last);
  const start = await documentOf(TENANT_A, login.token, doc);
  const mismatch = versionMismatch(doc, before, start);
  if (mismatch !== undefined) return preparationFailed(expected, mismatch, start.result);
  const sent = await publish(TENANT_A, login.token, doc, { lines: [LINEA], note: 'Revisión de alcance' });
  const after = await documentOf(TENANT_A, login.token, doc);
  const previous = (after.versions ?? []).filter((entry) => entry.version < next).sort((a, b) => a.version - b.version);
  const kept = previous.map((entry) => entry.note);
  const audit = await lastPublishEvent(TENANT_A);
  return finish([
    ...responseChecks(sent, { status: 201, version: next }),
    check(
      previous.length === before && kept.length === notes.length && kept.every((note, index) => note === notes[index]),
      `las versiones anteriores de ${doc} conservan las notas ${notes.map((note) => `«${note}»`).join(', ')}`,
      `las versiones anteriores de ${doc} tienen las notas ${kept.length === 0 ? '(ninguna)' : kept.map((note) => `«${note}»`).join(', ')}`,
    ),
    auditCheck(audit.event, doc, next),
  ]);
};

defineApiRows({
  story: 'US-DOC-VERSIONES-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, publishesLast],
    [2, storesNote],
    [3, keepsPreviousNotes],
  ]),
});
