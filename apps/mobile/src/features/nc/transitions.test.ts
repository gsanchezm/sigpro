import { describe, expect, it } from 'vitest';
import { moveOptions } from './transitions';

describe('moveOptions', () => {
  it('ofrece solo los destinos que la máquina de estados permite desde el estado actual', () => {
    expect(moveOptions('in_analysis', 'admin').map((option) => option.to)).toEqual(['corrective_action', 'rejected', 'open']);
    expect(moveOptions('open', 'admin').map((option) => option.to)).toEqual(['in_analysis']);
  });

  it('un estado terminal no tiene destinos', () => {
    expect(moveOptions('closed', 'admin')).toEqual([]);
  });

  it('el auditor no puede mover: todos los destinos quedan deshabilitados con el motivo de movimiento', () => {
    const options = moveOptions('in_analysis', 'auditor');
    expect(options.every((option) => !option.allowed)).toBe(true);
    expect(options.every((option) => option.deniedKey === 'menuMoveDenied')).toBe(true);
  });

  it('el consultor mueve, pero no puede cerrar: «Cerrada» queda deshabilitada con el motivo de cierre', () => {
    const options = moveOptions('corrective_action', 'consultant');
    expect(options.find((option) => option.to === 'closed')).toEqual({ to: 'closed', allowed: false, deniedKey: 'closeDenied' });
    expect(options.find((option) => option.to === 'in_analysis')).toEqual({ to: 'in_analysis', allowed: true, deniedKey: null });
  });

  it('el gestor de programa puede cerrar', () => {
    const closed = moveOptions('corrective_action', 'program_manager').find((option) => option.to === 'closed');
    expect(closed?.allowed).toBe(true);
  });
});
