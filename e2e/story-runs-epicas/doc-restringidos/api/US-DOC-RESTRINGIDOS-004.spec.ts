import { field } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { CUENTA, COBERTURA_GESTOR, TENANT_A, answerCheck, codeOf, codesCheck, finishNoted, jsonOf, rawGet, resetAlumno, sessionFor, thenOf } from './common';

// US-DOC-RESTRINGIDOS-004 — La búsqueda global no devuelve los restringidos a quien no los ve. Preparación de cada fila: reinicio de
// alumno01 con su administrador y, después, la cuenta de la fila inicia sesión en alumno01 (admin con el segundo factor). El texto
// se envía URL-codificado (los espacios y las tildes de «Plan de verificación» llegan íntegros).

/** Texto de búsqueda de la celda «texto». */
const TEXTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-003', 'DOC-003'],
  ['Plan de verificación', 'Plan de verificación'],
]);

/** Grupo de documentos esperado (`null` = la historia dice que no hay grupo de documentos). */
interface Grupo {
  readonly total: number;
  readonly items: readonly string[];
}

/** Grupo de documentos de la celda «grupo», con el total y los ítems que dice la historia. */
const GRUPO: ReadonlyMap<string, Grupo | null> = new Map<string, Grupo | null>([
  ['el grupo de documentos con total 1 y el ítem DOC-003', { total: 1, items: ['DOC-003'] }],
  ['ningún grupo de documentos', null],
  ['el grupo de documentos con total 6 y los ítems DOC-001, DOC-003, DOC-005, DOC-007 y DOC-009', { total: 6, items: ['DOC-001', 'DOC-003', 'DOC-005', 'DOC-007', 'DOC-009'] }],
  ['el grupo de documentos con total 4 y los ítems DOC-001, DOC-005, DOC-007 y DOC-011', { total: 4, items: ['DOC-001', 'DOC-005', 'DOC-007', 'DOC-011'] }],
]);

/** Grupo de documentos de una respuesta de búsqueda (`groups` con `kind` «document»), o `undefined` si no hay. */
const documentGroupOf = (body: unknown): unknown => {
  const groups = field(body, 'groups');
  return Array.isArray(groups) ? groups.find((group) => field(group, 'kind') === 'document') : undefined;
};

// --- Esquema 1: el grupo de documentos incluye solo los que el rol puede ver ---------------------------------------------------

const documentsInSearch: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const texto = strict('texto', TEXTO, cell(row, 'texto'));
  const grupo = strict('grupo', GRUPO, cell(row, 'grupo'));
  await resetAlumno();
  const session = await sessionFor(account);
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en alumno01`, session.last);
  const raw = await rawGet('/search', session.token, `q=${encodeURIComponent(texto)}`);
  const body = jsonOf(raw.bytes);
  const groups = field(body, 'groups');
  const group = documentGroupOf(body);
  const ids = Array.isArray(field(group, 'items')) ? (field(group, 'items') as unknown[]).map((item) => String(field(item, 'id'))) : [];
  const checks: Check[] = [answerCheck(raw.status, codeOf(body), { status: 200 }), check(Array.isArray(groups), 'la respuesta trae la lista groups', Array.isArray(groups) ? 'la respuesta trae la lista groups' : 'la respuesta no trae la lista groups')];
  if (grupo === null) {
    checks.push(check(Array.isArray(groups) && group === undefined, cell(row, 'grupo'), group === undefined ? 'ningún grupo de documentos' : `hay un grupo de documentos con total ${String(field(group, 'total'))}`));
  } else {
    const total = field(group, 'total');
    const same = group !== undefined && total === grupo.total && ids.length === grupo.items.length && grupo.items.every((code, index) => ids[index] === code);
    checks.push(
      check(
        same,
        cell(row, 'grupo'),
        group === undefined ? 'ningún grupo de documentos' : `el grupo de documentos con total ${String(total)} y los ítems ${ids.length === 0 ? '(ninguno)' : ids.join(', ')}`,
      ),
    );
    checks.push(codesCheck('los ítems del grupo son', ids, grupo.items));
  }
  // Control positivo del caso «ningún grupo» (consultor, DOC-003): la misma búsqueda del consultor sí trae DOC-004, así que el buscador
  // responde y el grupo vacío no es un buscador roto
  if (grupo === null) {
    const control = await rawGet('/search', session.token, 'q=DOC-004');
    const controlGroup = documentGroupOf(jsonOf(control.bytes));
    const controlItems = Array.isArray(field(controlGroup, 'items')) ? (field(controlGroup, 'items') as unknown[]).map((item) => String(field(item, 'id'))) : [];
    checks.push(codesCheck('el control de búsqueda q=DOC-004 trae en el grupo de documentos', controlItems, ['DOC-004']));
  }
  return finishNoted(checks, COBERTURA_GESTOR, { cuenta: cell(row, 'cuenta'), texto, estado: raw.status });
};

defineApiRows({
  story: 'US-DOC-RESTRINGIDOS-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, documentsInSearch]]),
});
