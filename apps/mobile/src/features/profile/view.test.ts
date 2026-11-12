import { perfilEn, perfilEs } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { EMPTY_DRAFT, flagValue, isDirty, parseDigest, parseLive, permissionRows, resolveDraft, setDraftField, type Preferences } from './view';

const applied: Preferences = { lang: 'es', theme: 'light', live: true, digest: false };

describe('permissionRows', () => {
  const allowed = (role: Parameters<typeof permissionRows>[0]) => permissionRows(role).map((row) => row.allowed);

  it('son seis, en el orden de la web: nc.create · nc.transition · nc.close · milestone.edit · users.manage · audit.view', () => {
    expect(permissionRows('admin').map((row) => row.permission)).toEqual(['nc.create', 'nc.transition', 'nc.close', 'milestone.edit', 'users.manage', 'audit.view']);
  });

  it('marca lo que permite cada rol (los mismos valores que el spec de la web)', () => {
    expect(allowed('admin')).toEqual([true, true, true, true, true, true]);
    expect(allowed('program_manager')).toEqual([true, true, true, true, false, false]);
    expect(allowed('consultant')).toEqual([true, true, false, false, false, false]);
    expect(allowed('auditor')).toEqual([true, false, false, false, false, true]);
  });

  it('cada fila tiene su texto en español y en inglés', () => {
    for (const row of permissionRows('admin')) {
      expect(perfilEs[row.labelKey]).toBeTruthy();
      expect(perfilEn[row.labelKey]).toBeTruthy();
    }
  });
});

describe('borrador de preferencias', () => {
  it('sin cambios no hay borrador y «Guardar» está desactivado', () => {
    expect(isDirty(EMPTY_DRAFT)).toBe(false);
    expect(resolveDraft(applied, EMPTY_DRAFT)).toEqual(applied);
  });

  it('un cambio entra en el borrador y no toca lo aplicado', () => {
    const draft = setDraftField(EMPTY_DRAFT, applied, 'live', false);
    expect(draft).toEqual({ live: false });
    expect(isDirty(draft)).toBe(true);
    expect(resolveDraft(applied, draft)).toEqual({ ...applied, live: false });
    expect(applied.live).toBe(true);
  });

  it('volver al valor aplicado saca el campo del borrador (idioma, interruptor y casilla)', () => {
    let draft = setDraftField(EMPTY_DRAFT, applied, 'lang', 'en');
    draft = setDraftField(draft, applied, 'digest', true);
    expect(draft).toEqual({ lang: 'en', digest: true });
    draft = setDraftField(draft, applied, 'lang', 'es');
    expect(draft).toEqual({ digest: true });
    draft = setDraftField(draft, applied, 'digest', false);
    expect(isDirty(draft)).toBe(false);
  });

  it('acumula varios cambios (idioma, tema, avisos y resumen) para guardarlos de una vez', () => {
    let draft = setDraftField(EMPTY_DRAFT, applied, 'lang', 'en');
    draft = setDraftField(draft, applied, 'theme', 'dark');
    draft = setDraftField(draft, applied, 'live', false);
    draft = setDraftField(draft, applied, 'digest', true);
    expect(resolveDraft(applied, draft)).toEqual({ lang: 'en', theme: 'dark', live: false, digest: true });
  });

  it('un valor aplicado después de abrir la pantalla (idioma leído del almacenamiento) no queda como cambio pendiente', () => {
    const late: Preferences = { ...applied, lang: 'en' };
    expect(isDirty(EMPTY_DRAFT)).toBe(false);
    expect(resolveDraft(late, EMPTY_DRAFT).lang).toBe('en');
  });
});

describe('valores guardados (`sigpro.live` y `sigpro.digest`, los de la web)', () => {
  it('los avisos están activos salvo que se guarde `off`', () => {
    expect(parseLive(null)).toBe(true);
    expect(parseLive('on')).toBe(true);
    expect(parseLive('off')).toBe(false);
  });

  it('el resumen está inactivo salvo que se guarde `on`', () => {
    expect(parseDigest(null)).toBe(false);
    expect(parseDigest('off')).toBe(false);
    expect(parseDigest('on')).toBe(true);
  });

  it('escribe `on` / `off`', () => {
    expect(flagValue(true)).toBe('on');
    expect(flagValue(false)).toBe('off');
  });
});
