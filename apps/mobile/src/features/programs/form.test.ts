import { ApiError, type MilestoneDto, type ProgramDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { EMPTY_DRAFT, draftOfProgram, fieldErrorsOf, hasMilestoneChanges, isDirty, milestoneChanges, stepErrors, validateCreate, validateMilestoneCreate, validateMilestoneUpdate, validateUpdate, withoutErrors, type ProgramDraft } from './form';

const program: ProgramDto = {
  code: 'PRG-003',
  name: 'Enlace de datos seguro LD-9',
  description: 'Descripción original',
  status: 'active',
  priority: 'high',
  classified: false,
  ownerId: 'u4',
  ownerName: 'Andrés Molina',
  startDate: '2026-01-10',
  endDate: '2026-12-31',
  budgetEur: 250000,
  progress: 40,
  milestonesDone: 2,
  milestonesTotal: 5,
};

/** Borrador válido del alta: todos los pasos rellenos como los pediría un usuario. */
const filled: ProgramDraft = {
  ...EMPTY_DRAFT,
  name: 'Programa de pruebas móvil',
  description: 'Creado desde el móvil.',
  ownerId: 'u1',
  startDate: '2026-03-01',
  endDate: '2027-09-30',
  budget: '1500000',
  priority: 'high',
  classified: true,
};

describe('stepErrors (pasos del asistente, con los esquemas de la API)', () => {
  it('paso 1: el nombre necesita tres caracteres y el responsable es obligatorio', () => {
    expect(stepErrors(1, { ...filled, name: 'ab' })).toEqual({ name: 'requiredName' });
    expect(stepErrors(1, { ...filled, ownerId: '' })).toEqual({ ownerId: 'requiredOwner' });
    expect(stepErrors(1, EMPTY_DRAFT)).toEqual({ name: 'requiredName', ownerId: 'requiredOwner' });
    expect(stepErrors(1, filled)).toEqual({});
  });

  it('paso 2: fecha de inicio obligatoria, fin posterior al inicio y presupuesto positivo', () => {
    expect(stepErrors(2, { ...filled, startDate: '' })).toMatchObject({ startDate: 'requiredStart' });
    expect(stepErrors(2, { ...filled, endDate: '2026-03-01' })).toEqual({ endDate: 'endAfterStart' });
    expect(stepErrors(2, { ...filled, budget: '0' })).toEqual({ budget: 'budgetPositive' });
    expect(stepErrors(2, { ...filled, budget: '' })).toEqual({ budget: 'budgetPositive' });
    expect(stepErrors(2, filled)).toEqual({});
  });

  it('paso 3 no tiene campos: su validación es la del envío', () => {
    expect(stepErrors(3, EMPTY_DRAFT)).toEqual({});
  });
});

describe('validateCreate', () => {
  it('convierte el presupuesto a número y aplica el aviso por defecto', () => {
    const result = validateCreate(filled);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ name: 'Programa de pruebas móvil', ownerId: 'u1', budget: 1500000, status: 'draft', priority: 'high', classified: true, notify: true });
  });

  it('devuelve los errores por campo del alta incompleta', () => {
    const result = validateCreate(EMPTY_DRAFT);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toMatchObject({ name: 'requiredName', ownerId: 'requiredOwner', startDate: 'requiredStart', budget: 'budgetPositive' });
  });
});

describe('edición de un programa', () => {
  it('el borrador arranca del programa guardado: sin cambios no hay nada que enviar', () => {
    const baseline = draftOfProgram(program);
    expect(baseline).toMatchObject({ name: program.name, budget: '250000', ownerId: 'u4', status: 'active' });
    expect(isDirty(baseline, baseline)).toBe(false);
  });

  it('cualquier campo editable cuenta como cambio; el aviso por correo del alta no', () => {
    const baseline = draftOfProgram(program);
    expect(isDirty({ ...baseline, status: 'on_hold' }, baseline)).toBe(true);
    expect(isDirty({ ...baseline, classified: true }, baseline)).toBe(true);
    expect(isDirty({ ...baseline, notify: false }, baseline)).toBe(false);
  });

  it('validateUpdate aplica el esquema PATCH: presupuesto a número y el error de fechas incoherentes', () => {
    const baseline = draftOfProgram(program);
    const ok = validateUpdate({ ...baseline, budget: '300000' });
    expect(ok.success && ok.data).toMatchObject({ budget: 300000, name: program.name });
    expect(validateUpdate({ ...baseline, budget: '0' })).toEqual({ success: false, errors: { budget: 'budgetPositive' } });
    expect(validateUpdate({ ...baseline, endDate: '2025-01-01' })).toEqual({ success: false, errors: { endDate: 'endAfterStart' } });
  });
});

describe('fieldErrorsOf (422 de la API)', () => {
  const body = (errors?: Record<string, string>) => ({ statusCode: 422, error: 'Unprocessable', message: 'validation', errors });

  it('un 422 devuelve sus errores por campo', () => {
    expect(fieldErrorsOf(new ApiError(422, body({ name: 'dupName' }), 'POST /api/programs → 422'))).toEqual({ name: 'dupName' });
  });

  it('un 422 sin errores por campo devuelve un objeto vacío, y otros fallos no son de validación', () => {
    expect(fieldErrorsOf(new ApiError(422, body(), 'x'))).toEqual({});
    expect(fieldErrorsOf(new ApiError(500, body(), 'x'))).toBeNull();
    expect(fieldErrorsOf(new Error('red'))).toBeNull();
  });
});

describe('withoutErrors', () => {
  it('quita el error de los campos que cambiaron y conserva el resto', () => {
    expect(withoutErrors({ name: 'requiredName', budget: 'budgetPositive' }, ['name'])).toEqual({ budget: 'budgetPositive' });
  });
});

describe('hitos: alta y edición', () => {
  const milestone: MilestoneDto = { id: 'PRG-003-M02', programCode: 'PRG-003', name: 'Revisión de diseño', dueDate: '2026-05-01', progress: 40, done: false };

  it('el alta valida el nombre (2 caracteres) y la fecha (AAAA-MM-DD)', () => {
    expect(validateMilestoneCreate({ name: 'a', dueDate: '2026-05-01' })).toEqual({ success: false, errors: { name: 'nameShort' } });
    expect(validateMilestoneCreate({ name: 'Hito', dueDate: '01/05/2026' })).toEqual({ success: false, errors: { dueDate: 'dateInvalid' } });
    expect(validateMilestoneCreate({ name: '  Hito  ', dueDate: '2026-05-01' })).toEqual({ success: true, data: { name: 'Hito', dueDate: '2026-05-01' } });
  });

  it('solo viajan los campos que cambiaron, con el nombre sin espacios sobrantes', () => {
    expect(milestoneChanges(milestone, { name: milestone.name, dueDate: milestone.dueDate })).toEqual({});
    expect(milestoneChanges(milestone, { name: '  Revisión de diseño  ', dueDate: milestone.dueDate })).toEqual({});
    expect(milestoneChanges(milestone, { name: 'Revisión crítica', dueDate: milestone.dueDate })).toEqual({ name: 'Revisión crítica' });
    expect(milestoneChanges(milestone, { name: milestone.name, dueDate: '2026-06-01' })).toEqual({ dueDate: '2026-06-01' });
  });

  it('sin cambios no hay nada que guardar; con cambios, el esquema PATCH los valida', () => {
    expect(hasMilestoneChanges({})).toBe(false);
    expect(hasMilestoneChanges({ name: 'x' })).toBe(true);
    expect(validateMilestoneUpdate({ name: 'a' })).toEqual({ success: false, errors: { name: 'nameShort' } });
    expect(validateMilestoneUpdate({ dueDate: '2026-06-01' })).toEqual({ success: true, data: { dueDate: '2026-06-01' } });
  });
});
