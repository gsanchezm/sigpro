import { describe, expect, it } from 'vitest';
import { decideNcTransition, type TransitionRequest } from './nc-rules';

const base: TransitionRequest = { role: 'program_manager', from: 'corrective_action', to: 'closed', comment: 'Acción correctiva aplicada y verificada', plantedBugs: false };
const decide = (patch: Partial<TransitionRequest>) => decideNcTransition({ ...base, ...patch });

describe('decideNcTransition', () => {
  it('acepta el paso siguiente con permiso', () => {
    expect(decide({})).toEqual({ ok: true });
    expect(decide({ role: 'consultant', from: 'open', to: 'in_analysis', comment: undefined })).toEqual({ ok: true });
  });

  it('403 si el rol no puede dar el paso (cerrar exige gestor o admin; el auditor no mueve nada)', () => {
    expect(decide({ role: 'consultant' })).toMatchObject({ ok: false, status: 403 });
    expect(decide({ role: 'auditor', from: 'open', to: 'in_analysis' })).toMatchObject({ ok: false, status: 403 });
  });

  it('409 si el paso no existe en la máquina de estados', () => {
    expect(decide({ from: 'open', to: 'closed' })).toMatchObject({ ok: false, status: 409, code: 'invalid_transition' });
    expect(decide({ from: 'open', to: 'rejected', role: 'consultant' })).toMatchObject({ ok: false, status: 409 });
    expect(decide({ from: 'closed', to: 'open' })).toMatchObject({ ok: false, status: 409 });
    expect(decide({ from: 'open', to: 'open', role: 'consultant' })).toMatchObject({ ok: false, status: 409 });
  });

  it('422 al cerrar sin comentario o con menos de 20 caracteres', () => {
    expect(decide({ comment: undefined })).toMatchObject({ ok: false, status: 422, errors: { comment: 'closureRequired' } });
    expect(decide({ comment: '   ' })).toMatchObject({ ok: false, status: 422, errors: { comment: 'closureRequired' } });
    expect(decide({ comment: 'a'.repeat(19) })).toMatchObject({ ok: false, status: 422, errors: { comment: 'closureShort' } });
    expect(decide({ comment: 'a'.repeat(20) })).toEqual({ ok: true });
  });

  it('con PLANTED_BUGS acepta 19 caracteres y el rechazo directo desde «Abierta»', () => {
    expect(decide({ comment: 'a'.repeat(19), plantedBugs: true })).toEqual({ ok: true });
    expect(decide({ comment: 'a'.repeat(18), plantedBugs: true })).toMatchObject({ ok: false, status: 422 });
    expect(decide({ role: 'consultant', from: 'open', to: 'rejected', plantedBugs: true })).toEqual({ ok: true });
    // el defecto no abre otros atajos
    expect(decide({ from: 'open', to: 'closed', plantedBugs: true })).toMatchObject({ ok: false, status: 409 });
  });
});
