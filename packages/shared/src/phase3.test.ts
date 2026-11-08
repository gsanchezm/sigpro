import { describe, expect, it } from 'vitest';
import { can } from './permissions';
import { messages } from './i18n';
import { FEED_MAX_ITEMS, isNotifiable, percentOf, prependEvent, type MissionEventDto } from './mission';
import { isMilestoneDone, milestoneStatus, nextMilestoneId, snapProgress } from './milestones';
import {
  NC_STATES,
  canNcTransition,
  countBySeverity,
  groupByState,
  isClosureComment,
  isNcOpen,
  isNcTransition,
  ncClosureMinLength,
  ncNextStates,
  nextNcCode,
} from './nc';
import { createNcSchema, ncCommentSchema, transitionNcSchema, updateMilestoneSchema, updateNcSchema, updateUserSchema } from './schemas';

describe('máquina de estados de las NC', () => {
  it('open → in_analysis → corrective_action → closed, con rejected desde in_analysis', () => {
    expect(ncNextStates('open')).toEqual(['in_analysis']);
    expect(ncNextStates('in_analysis')).toEqual(['corrective_action', 'rejected', 'open']);
    expect(ncNextStates('corrective_action')).toEqual(['closed', 'in_analysis']);
  });

  it('closed es terminal y rejected solo se reabre', () => {
    expect(ncNextStates('closed')).toEqual([]);
    expect(ncNextStates('rejected')).toEqual(['open']);
  });

  it('no se puede saltar pasos', () => {
    expect(isNcTransition('open', 'closed')).toBe(false);
    expect(isNcTransition('open', 'rejected')).toBe(false);
    expect(isNcTransition('in_analysis', 'rejected')).toBe(true);
  });

  it('cada estado tiene entrada en el mapa', () => {
    NC_STATES.forEach((state) => expect(ncNextStates(state)).toBeDefined());
  });

  it('solo cuentan como abiertas las que no están cerradas ni rechazadas', () => {
    expect(NC_STATES.filter(isNcOpen)).toEqual(['open', 'in_analysis', 'corrective_action']);
  });
});

describe('permisos de NC por rol', () => {
  it('todos abren y comentan; el auditor no mueve ni edita', () => {
    (['admin', 'program_manager', 'consultant', 'auditor'] as const).forEach((role) => {
      expect(can(role, 'nc.create')).toBe(true);
      expect(can(role, 'nc.comment')).toBe(true);
    });
    expect(can('auditor', 'nc.transition')).toBe(false);
    expect(can('auditor', 'nc.edit')).toBe(false);
    expect(can('consultant', 'nc.transition')).toBe(true);
  });

  it('cerrar exige admin o gestor', () => {
    expect(canNcTransition('consultant', 'closed')).toBe(false);
    expect(canNcTransition('consultant', 'in_analysis')).toBe(true);
    expect(canNcTransition('program_manager', 'closed')).toBe(true);
    expect(canNcTransition('auditor', 'in_analysis')).toBe(false);
  });

  it('hitos: solo admin y gestor', () => {
    expect(can('program_manager', 'milestone.edit')).toBe(true);
    expect(can('consultant', 'milestone.edit')).toBe(false);
    expect(can('auditor', 'milestone.delete')).toBe(false);
  });
});

describe('cierre de NC', () => {
  it('exige 20 caracteres (19 si se aplica el defecto plantado)', () => {
    expect(ncClosureMinLength()).toBe(20);
    expect(ncClosureMinLength(true)).toBe(19);
    expect(isClosureComment('a'.repeat(19))).toBe(false);
    expect(isClosureComment('a'.repeat(20))).toBe(true);
    expect(isClosureComment('a'.repeat(19), true)).toBe(true);
    expect(isClosureComment('a'.repeat(18), true)).toBe(false);
  });

  it('los espacios de los extremos no cuentan', () => {
    expect(isClosureComment(`   ${'a'.repeat(5)}   `)).toBe(false);
  });
});

describe('utilidades del tablero', () => {
  const items = [
    { code: 'NC-001', state: 'open', severity: 'minor', assigneeId: null },
    { code: 'NC-002', state: 'closed', severity: 'critical', assigneeId: 'u1' },
    { code: 'NC-003', state: 'open', severity: 'critical', assigneeId: 'u2' },
  ] as const;

  it('agrupa por columna y conserva el orden; siempre devuelve las cinco columnas', () => {
    const grouped = groupByState(items);
    expect(Object.keys(grouped)).toEqual([...NC_STATES]);
    expect(grouped.open.map((item) => item.code)).toEqual(['NC-001', 'NC-003']);
    expect(grouped.in_analysis).toEqual([]);
  });

  it('cuenta por severidad', () => {
    expect(countBySeverity(items)).toEqual({ minor: 1, major: 0, critical: 2 });
  });

  it('siguiente código con huecos', () => {
    expect(nextNcCode(['NC-001', 'NC-012', 'NC-003'])).toBe('NC-013');
    expect(nextNcCode([])).toBe('NC-001');
  });
});

describe('esquemas de NC', () => {
  it('alta: severidad, programa y descripción de al menos 10 caracteres (el HTML se sanea)', () => {
    const ok = createNcSchema.safeParse({ programCode: 'PRG-001', severity: 'major', description: '<p>Desviación en el <b>enlace</b></p><script>x</script>' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.description).not.toContain('<script');
    const short = createNcSchema.safeParse({ programCode: 'PRG-001', severity: 'major', description: '<p>corta</p>' });
    expect(short.success).toBe(false);
    expect(createNcSchema.safeParse({ programCode: 'PRG-001', severity: 'enorme', description: 'Descripción suficiente' }).success).toBe(false);
  });

  it('edición: al menos un campo; la asignación puede quitarse con null', () => {
    expect(updateNcSchema.safeParse({}).success).toBe(false);
    expect(updateNcSchema.safeParse({ assigneeId: null }).success).toBe(true);
    expect(updateNcSchema.safeParse({ severity: 'critical' }).success).toBe(true);
  });

  it('transición: valida el estado destino y la longitud máxima del comentario', () => {
    expect(transitionNcSchema.safeParse({ to: 'closed', comment: 'Resuelta con la acción correctiva' }).success).toBe(true);
    expect(transitionNcSchema.safeParse({ to: 'cerrada' }).success).toBe(false);
    expect(transitionNcSchema.safeParse({ to: 'closed', comment: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('comentario: obligatorio, sin espacios sobrantes y con tipo por defecto', () => {
    const parsed = ncCommentSchema.parse({ body: '  hola  ' });
    expect(parsed).toEqual({ body: 'hola', kind: 'comment' });
    expect(ncCommentSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(ncCommentSchema.parse({ body: 'ok', kind: 'quick' }).kind).toBe('quick');
  });
});

describe('hitos', () => {
  it('cumplido con el 100 %; en curso entre 1 y 99', () => {
    expect(isMilestoneDone(100)).toBe(true);
    expect(milestoneStatus(100)).toBe('done');
    expect(milestoneStatus(40)).toBe('in_progress');
    expect(milestoneStatus(0)).toBe('pending');
  });

  it('el slider se ajusta a pasos de 5 y se acota a 0–100', () => {
    expect(snapProgress(47)).toBe(45);
    expect(snapProgress(48)).toBe(50);
    expect(snapProgress(-9)).toBe(0);
    expect(snapProgress(140)).toBe(100);
  });

  it('siguiente id con huecos', () => {
    expect(nextMilestoneId('PRG-001', ['PRG-001-M01', 'PRG-001-M07', 'PRG-001-M03'])).toBe('PRG-001-M08');
    expect(nextMilestoneId('PRG-002', [])).toBe('PRG-002-M01');
  });

  it('edición: avance entero entre 0 y 100 y al menos un campo', () => {
    expect(updateMilestoneSchema.safeParse({ progress: 60 }).success).toBe(true);
    expect(updateMilestoneSchema.safeParse({ progress: 101 }).success).toBe(false);
    expect(updateMilestoneSchema.safeParse({ progress: 12.5 }).success).toBe(false);
    expect(updateMilestoneSchema.safeParse({}).success).toBe(false);
    expect(updateMilestoneSchema.safeParse({ dueDate: '31/12/2026' }).success).toBe(false);
  });
});

describe('usuarios (administración)', () => {
  it('acepta activo y/o rol válido, nunca vacío', () => {
    expect(updateUserSchema.safeParse({ active: false }).success).toBe(true);
    expect(updateUserSchema.safeParse({ role: 'auditor' }).success).toBe(true);
    expect(updateUserSchema.safeParse({ role: 'dios' }).success).toBe(false);
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });
});

describe('feed de misión', () => {
  const event = (seq: number, severity: MissionEventDto['severity'] = 'info'): MissionEventDto => ({
    id: `EV-${seq}`,
    seq,
    at: '2026-11-07T10:00:00.000Z',
    type: 'link',
    severity,
    programCode: 'PRG-001',
    vars: {},
    origin: 'simulator',
  });

  it('añade al principio sin duplicar y recorta', () => {
    const list = prependEvent([event(1)], event(2));
    expect(list.map((item) => item.seq)).toEqual([2, 1]);
    expect(prependEvent(list, event(2))).toBe(list);
    const long = Array.from({ length: FEED_MAX_ITEMS + 5 }, (_, i) => event(i + 1)).reduce<readonly MissionEventDto[]>((acc, item) => prependEvent(acc, item), []);
    expect(long).toHaveLength(FEED_MAX_ITEMS);
    expect(long[0]?.seq).toBe(FEED_MAX_ITEMS + 5);
  });

  it('solo los avisos generan notificación', () => {
    expect(isNotifiable(event(1, 'info'))).toBe(false);
    expect(isNotifiable(event(1, 'ok'))).toBe(false);
    expect(isNotifiable(event(1, 'warn'))).toBe(true);
    expect(isNotifiable(event(1, 'danger'))).toBe(true);
  });

  it('porcentaje seguro', () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe('i18n de la fase 3', () => {
  it('cada espacio tiene las mismas claves en español e inglés', () => {
    (['nc', 'mision', 'admin', 'hitos', 'perfil'] as const).forEach((ns) => {
      expect(Object.keys(messages.en[ns]).sort()).toEqual(Object.keys(messages.es[ns]).sort());
    });
  });

  it('cada tipo de evento y estado de NC tiene su texto', () => {
    ['link', 'telemetry', 'thermal', 'link_lost', 'milestone', 'test_pass', 'heartbeat', 'nc_created', 'nc_updated', 'nc_moved', 'nc_closed', 'nc_commented'].forEach((type) =>
      expect(messages.es.mision).toHaveProperty(`ev_${type}`),
    );
    NC_STATES.forEach((state) => expect(messages.es.nc).toHaveProperty(`state_${state}`));
  });
});
