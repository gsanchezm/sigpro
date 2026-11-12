import { ApiError, type AdminUserDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_TABS,
  ERROR_STEP,
  LATENCY_MAX,
  LATENCY_STEP,
  NO_CHAOS,
  USER_STATUS_TONE,
  applyChange,
  filterUsers,
  isChaosActive,
  parseTab,
  rateOf,
  rejectionKey,
  replaceUser,
  sameConfig,
  tabParam,
  tenantInfoLines,
  toPercent,
  traceOr,
  userStatus,
} from './view';

const user = (id: string, overrides: Partial<AdminUserDto> = {}): AdminUserDto => ({
  id,
  name: 'Marta Ruiz',
  email: 'admin@sigpro.test',
  role: 'admin',
  active: true,
  locked: false,
  pending: false,
  org: null,
  ...overrides,
});

const apiError = (status: number, code?: string): ApiError => new ApiError(status, { statusCode: status, error: 'Conflict', message: 'x', ...(code ? { code } : {}) }, `PATCH /api/admin/users/u3 → ${status}`);

describe('pestañas', () => {
  it('son las cuatro de la web y parseTab cae en «Usuarios» si la URL no trae una conocida', () => {
    expect(ADMIN_TABS).toEqual(['users', 'audit', 'chaos', 'data']);
    expect(parseTab('chaos')).toBe('chaos');
    expect(parseTab('data')).toBe('data');
    expect(parseTab('nada')).toBe('users');
    expect(parseTab(undefined)).toBe('users');
  });

  it('tabParam no escribe la sección por defecto en la URL', () => {
    expect(tabParam('users')).toBeUndefined();
    expect(tabParam('audit')).toBe('audit');
  });
});

describe('userStatus', () => {
  it('prioriza pendiente → bloqueado → desactivado → normal', () => {
    expect(userStatus(user('a', { pending: true, locked: true, active: false }))).toBe('pending');
    expect(userStatus(user('a', { locked: true, active: false }))).toBe('locked');
    expect(userStatus(user('a', { active: false }))).toBe('inactive');
    expect(userStatus(user('a'))).toBe('ok');
  });

  it('cada estado tiene su tono', () => {
    expect(USER_STATUS_TONE).toEqual({ ok: 'ok', locked: 'danger', pending: 'warn', inactive: 'neutral' });
  });
});

describe('filterUsers', () => {
  const users = [user('u1'), user('u4', { name: 'Andrés Molina', email: 'andres.molina@sigpro.test' }), user('u7', { name: 'Alumno 24', email: 'alumno24@sigpro.lab' })];

  it('busca por nombre o correo, sin distinguir mayúsculas ni espacios de los extremos', () => {
    expect(filterUsers(users, ' MOLINA ').map((item) => item.id)).toEqual(['u4']);
    expect(filterUsers(users, '@sigpro.lab').map((item) => item.id)).toEqual(['u7']);
  });

  it('sin texto devuelve la misma lista y sin coincidencias, vacío', () => {
    expect(filterUsers(users, '   ')).toBe(users);
    expect(filterUsers(users, 'nadie')).toEqual([]);
  });
});

describe('cambios de usuario', () => {
  it('applyChange aplica solo lo que viene y no muta el original', () => {
    const original = user('u3', { role: 'consultant' });
    expect(applyChange(original, { role: 'auditor' })).toMatchObject({ role: 'auditor', active: true });
    expect(applyChange(original, { active: false })).toMatchObject({ role: 'consultant', active: false });
    expect(original).toMatchObject({ role: 'consultant', active: true });
  });

  it('replaceUser sustituye solo el usuario indicado', () => {
    const list = [user('u1'), user('u3', { role: 'consultant' })];
    const next = replaceUser(list, 'u3', (item) => ({ ...item, role: 'auditor' }));
    expect(next.map((item) => item.role)).toEqual(['admin', 'auditor']);
    expect(list[1]?.role).toBe('consultant');
    expect(replaceUser(list, 'u9', (item) => ({ ...item, role: 'auditor' }))).toEqual(list);
  });
});

describe('rejectionKey', () => {
  it('traduce los códigos de la API a la clave del texto', () => {
    expect(rejectionKey(apiError(409, 'self_change'))).toBe('errorSelfChange');
    expect(rejectionKey(apiError(409, 'last_admin'))).toBe('errorLastAdmin');
    expect(rejectionKey(apiError(404, 'user_not_found'))).toBe('errorUserNotFound');
  });

  it('un código desconocido, un error sin código o un fallo de red no tienen clave', () => {
    expect(rejectionKey(apiError(500, 'chaos_error'))).toBeUndefined();
    expect(rejectionKey(apiError(500))).toBeUndefined();
    expect(rejectionKey(new TypeError('Failed to fetch'))).toBeUndefined();
  });
});

describe('traceOr', () => {
  it('usa la traza o, si no hay, el texto de respaldo', () => {
    expect(traceOr('GET /api/admin/chaos → 503', 'sin red')).toBe('GET /api/admin/chaos → 503');
    expect(traceOr('', 'sin red')).toBe('sin red');
    expect(traceOr('error', 'sin red')).toBe('sin red');
  });
});

describe('modo caos', () => {
  it('los deslizadores tienen el rango de la web', () => {
    expect([LATENCY_MAX, LATENCY_STEP, ERROR_STEP]).toEqual([5000, 100, 5]);
  });

  it('toPercent y rateOf se corresponden', () => {
    expect(toPercent(0.5)).toBe(50);
    expect(toPercent(0.05)).toBe(5);
    expect(rateOf(50)).toBe(0.5);
    expect(rateOf(toPercent(0.35))).toBe(0.35);
  });

  it('está activo si cualquiera de las tres palancas no está en reposo', () => {
    expect(isChaosActive(NO_CHAOS)).toBe(false);
    expect(isChaosActive({ ...NO_CHAOS, latencyMs: 100 })).toBe(true);
    expect(isChaosActive({ ...NO_CHAOS, errorRate: 0.05 })).toBe(true);
    expect(isChaosActive({ ...NO_CHAOS, flakyLabels: true })).toBe(true);
  });

  it('sameConfig compara la tasa como porcentaje entero', () => {
    expect(sameConfig(NO_CHAOS, { latencyMs: 0, errorRate: 0, flakyLabels: false })).toBe(true);
    expect(sameConfig({ ...NO_CHAOS, errorRate: 0.5 }, { ...NO_CHAOS, errorRate: 0.501 })).toBe(true);
    expect(sameConfig({ ...NO_CHAOS, errorRate: 0.5 }, { ...NO_CHAOS, errorRate: 0.55 })).toBe(false);
    expect(sameConfig({ ...NO_CHAOS, latencyMs: 100 }, NO_CHAOS)).toBe(false);
    expect(sameConfig({ ...NO_CHAOS, flakyLabels: true }, NO_CHAOS)).toBe(false);
  });
});

describe('tenantInfoLines', () => {
  const labels = { tenant: (tenant: string) => `Tenant: ${tenant}`, users: (total: number, active: number) => `Usuarios: ${total} (${active} activos)` };

  it('compone el tenant y el recuento de usuarios totales y activos', () => {
    expect(tenantInfoLines({ tenant: 'alumno24', users: [{ active: true }, { active: false }, { active: true }] }, labels)).toEqual(['Tenant: alumno24', 'Usuarios: 3 (2 activos)']);
  });

  it('sin usuarios, cero de cero', () => {
    expect(tenantInfoLines({ tenant: 'demo', users: [] }, labels)).toEqual(['Tenant: demo', 'Usuarios: 0 (0 activos)']);
  });
});
