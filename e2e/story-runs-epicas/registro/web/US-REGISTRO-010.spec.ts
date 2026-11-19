import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, runSteps } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/framework';
import { actionMissing, afterObserving, barColors, expectedRuleStates, expectedStrength, field, filledBars, meterOf, openRegister, plainValue, rulesNamed, ruleChecks, ruleStates, strengthWordsIn, watchSubmissions } from './common';

// US-REGISTRO-010 — Medidor de fuerza de la contraseña y sus cuatro reglas (web). Preparación de cada fila: reinicio de alumno01
// con su administrador y /register?tenant=alumno01 en un navegador sin sesión. Las barras se cuentan frente a las de la contraseña
// vacía (medidas antes de escribir): las cuatro barras son el primer bloque oculto a la vista del medidor.

const BARS: ReadonlyMap<string, number> = new Map([
  ['0', 0],
  ['1', 1],
  ['2', 2],
  ['3', 3],
  ['4', 4],
]);

const meterRow: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const password = plainValue(cell(row, 'contraseña'));
  const named = rulesNamed(cell(row, 'reglas'));
  const strength = expectedStrength(cell(row, 'fuerza'));
  const bars = BARS.get(cell(row, 'barras'));
  if (bars === undefined) throw new Error(`celda sin interpretación: barras «${cell(row, 'barras')}»`);
  const expected = `reglas ${cell(row, 'reglas')}; fuerza ${cell(row, 'fuerza')}; ${bars} de 4 barras`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const meter = meterOf(page);
  const baseline = await barColors(meter);
  const count = watchSubmissions(page);
  const typed = await runSteps([['escribir «Contraseña»', () => field(page, 'Contraseña').fill(password, ACTION)]]);
  if (typed) return actionMissing(expected, typed);
  const states = await ruleStates(meter);
  const words = await strengthWordsIn(meter);
  const colors = await barColors(meter);
  const filled = filledBars(baseline, colors);
  const strengthOk = strength === undefined ? words.length === 0 : words.length === 1 && words[0] === strength;
  const dataStrength = await attrOf(meter, 'data-strength');
  const sent = await afterObserving(count);
  return conclude(
    [
      ...ruleChecks(states, expectedRuleStates(named)),
      check(sent === 0, 'escribir en «Contraseña» no envía el formulario', `solicitudes enviadas: ${sent}`),
      check(strengthOk, strength === undefined ? 'sin texto de fuerza' : `la fuerza es «${strength}»`, `texto de fuerza: ${words.length === 0 ? 'ninguno' : words.join(', ')}`),
      check(colors.length === 4 && filled === bars, `el medidor rellena ${bars} de sus cuatro barras`, `rellena ${filled} de ${colors.length} barras`),
    ],
    { evidence: { dataStrength: dataStrength ?? '(sin atributo)' } },
  );
};

defineBrowserRows({
  story: 'US-REGISTRO-010',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, meterRow]]),
});
