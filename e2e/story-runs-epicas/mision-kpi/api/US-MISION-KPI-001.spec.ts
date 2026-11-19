import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { conclude } from './common';
import { cell, check, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { INVENTED_TOKEN, TENANT_A, adminSession, field, kpisOf, listOf, notOkEvidence, resetTenants, seedPresent, summaryOf, failedPreparation } from './common';

// US-MISION-KPI-001 — Forma de la respuesta del resumen de misión y sesión obligatoria (API). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador y comprobación de los 24 programas del seed. Lo que la historia espera sale de su texto,
// nunca de lo que devuelve la API.

/** Las nueve cifras de `kpis`, en el orden de la historia. */
const KPI_KEYS: readonly string[] = ['activePrograms', 'programsTotal', 'programsProgress', 'milestonesDone', 'milestonesTotal', 'ncOpen', 'ncTotal', 'verificationPass', 'casesWithRuns'];
/** Los cinco bloques de primer nivel del resumen, sin ningún otro. */
const TOP_LEVEL: readonly string[] = ['kpis', 'milestonesByProgram', 'ncBySeverity', 'recent', 'simulatorMs'];
const SEVERITY_KEYS: readonly string[] = ['minor', 'major', 'critical'];

/** ¿Trae el objeto exactamente estas claves (ni una más, ni una menos)? */
const sameKeys = (value: unknown, keys: readonly string[]): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...keys].sort();
  return actual.length === wanted.length && wanted.every((key, index) => actual[index] === key);
};

/** Las claves que trae un objeto, para explicar lo observado («(no es un objeto)» si no lo es). */
const keysText = (value: unknown): string => (typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.keys(value).join(', ') : '(no es un objeto)');

/** Para cada bloque de la historia: el texto de su celda `contenido` y la comprobación de su forma. */
interface BlockRule {
  readonly contenido: string;
  readonly check: (summary: unknown) => Check;
}

const BLOCKS: ReadonlyMap<string, BlockRule> = new Map<string, BlockRule>([
  [
    'kpis',
    {
      contenido: 'nueve cifras enteras: activePrograms, programsTotal, programsProgress, milestonesDone, milestonesTotal, ncOpen, ncTotal, verificationPass y casesWithRuns',
      check: (summary) => {
        const kpis = kpisOf(summary);
        const ok = sameKeys(kpis, KPI_KEYS) && KPI_KEYS.every((key) => Number.isInteger(field(kpis, key)));
        return check(ok, 'kpis trae nueve cifras enteras (activePrograms … casesWithRuns)', sameKeys(kpis, KPI_KEYS) ? 'nueve claves, todas enteras' : `claves: ${keysText(kpis)}`);
      },
    },
  ],
  [
    'milestonesByProgram',
    {
      contenido: 'una lista de como mucho 8 elementos',
      check: (summary) => {
        const list = listOf(summary, 'milestonesByProgram');
        return check(list !== undefined && list.length <= 8, 'milestonesByProgram es una lista de como mucho 8 elementos', list === undefined ? 'no es una lista' : `lista de ${list.length} elementos`);
      },
    },
  ],
  [
    'ncBySeverity',
    {
      contenido: 'las claves minor, major y critical, con un número entero cada una',
      check: (summary) => {
        const bySeverity = field(summary, 'ncBySeverity');
        const ok = sameKeys(bySeverity, SEVERITY_KEYS) && SEVERITY_KEYS.every((key) => Number.isInteger(field(bySeverity, key)));
        return check(ok, 'ncBySeverity trae las claves minor, major y critical, cada una con un entero', sameKeys(bySeverity, SEVERITY_KEYS) ? 'tres claves, todas enteras' : `claves: ${keysText(bySeverity)}`);
      },
    },
  ],
  [
    'recent',
    {
      contenido: 'una lista de como mucho 20 eventos, el más reciente primero',
      check: (summary) => {
        const list = listOf(summary, 'recent');
        const seqs = (list ?? []).map((event) => field(event, 'seq'));
        const newestFirst = seqs.every((seq, index) => {
          const previous = seqs[index - 1];
          return index === 0 || (typeof seq === 'number' && typeof previous === 'number' && previous > seq);
        });
        return check(list !== undefined && list.length <= 20 && newestFirst, 'recent es una lista de como mucho 20 eventos, el más reciente primero', list === undefined ? 'no es una lista' : `${list.length} eventos, seq ${seqs.join(' > ')}`);
      },
    },
  ],
  [
    'simulatorMs',
    {
      contenido: 'un número entero',
      check: (summary) => {
        const value = field(summary, 'simulatorMs');
        return check(Number.isInteger(value), 'simulatorMs es un número entero', `simulatorMs ${String(value)}`);
      },
    },
  ],
]);

// --- Esquema 1: el resumen trae los bloques del panel y ninguno más ----------------------------------------------------------

const blocksOfSummary: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const rule = strict('bloque', BLOCKS, cell(row, 'bloque'));
  if (cell(row, 'contenido') !== rule.contenido) throw new Error(`la celda contenido de ${cell(row, 'bloque')} no coincide con la historia`);
  const expected = `la respuesta es 200 y tiene el bloque ${cell(row, 'bloque')} con ${rule.contenido}; el resumen no trae ningún otro bloque de primer nivel`;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const seeded = await seedPresent(admin.token);
  if (seeded !== undefined) return failedPreparation(expected, seeded);
  const result = await summaryOf(admin.token);
  const topLevel = check(sameKeys(result.body, TOP_LEVEL), 'el resumen no trae ningún otro bloque de primer nivel (solo kpis, milestonesByProgram, ncBySeverity, recent y simulatorMs)', sameKeys(result.body, TOP_LEVEL) ? 'solo esos cinco bloques' : `bloques: ${keysText(result.body)}`);
  return conclude([responseCheck(result, { status: 200 }), rule.check(result.body), topLevel], { evidence: notOkEvidence(result) });
};

// --- Esquema 2: sin una sesión válida no hay resumen ------------------------------------------------------------------------

/** Cabecera `Authorization` de la celda: sin cabecera, o un token que la API no ha emitido. */
const HEADERS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['(token inventado)', INVENTED_TOKEN],
]);

const requiresSession: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const seeded = await seedPresent(admin.token);
  if (seeded !== undefined) return failedPreparation(expected, seeded);
  const result = await summaryOf(strict('cabecera', HEADERS, cell(row, 'cabecera')));
  return conclude([responseCheck(result, parseResponse(cell(row, 'respuesta')))], { evidence: notOkEvidence(result) });
};

defineApiRows({
  story: 'US-MISION-KPI-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, blocksOfSummary],
    [2, requiresSession],
  ]),
});
