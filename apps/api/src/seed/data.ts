import type {
  AuditLog,
  Contract,
  Document,
  Milestone,
  NonConformity,
  Program,
  Requirement,
  RequirementTestCase,
  Supplier,
  Tenant,
  TestCase,
  TestRun,
  User,
} from '@prisma/client';
import type { Role } from '@sigpro/shared';

// Seed determinista: ninguna función usa Date.now() ni Math.random().
// La misma entrada produce siempre las mismas filas (códigos PRG-001…, REQ-001…, TC-001…, NC-001…).

export type TenantRow = Pick<Tenant, 'id' | 'name' | 'seedVersion'>;

export interface SeedRows {
  readonly tenant: TenantRow;
  readonly users: readonly User[];
  readonly programs: readonly Program[];
  readonly milestones: readonly Milestone[];
  readonly requirements: readonly Requirement[];
  readonly testCases: readonly TestCase[];
  readonly requirementTestCases: readonly RequirementTestCase[];
  readonly testRuns: readonly TestRun[];
  readonly nonConformities: readonly NonConformity[];
  readonly documents: readonly Document[];
  readonly auditLogs: readonly AuditLog[];
  readonly suppliers: readonly Supplier[];
  readonly contracts: readonly Contract[];
}

export const SEED_VERSION = 1;
export const MFA_CODE = '123456';

/** Fecha base fija para createdAt y marcas de tiempo del seed. */
const EPOCH = new Date('2026-01-05T09:00:00.000Z');
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const addDays = (base: Date, days: number): Date => new Date(base.getTime() + days * 86_400_000);
const pad = (n: number, width = 3): string => String(n).padStart(width, '0');
const range = (count: number): readonly number[] => Array.from({ length: count }, (_, i) => i + 1);
const pick = <T>(items: readonly T[], index: number): T => items[index % items.length] as T;

// --- Usuarios --------------------------------------------------------------

export interface DemoUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly role: Role;
  readonly mfa: boolean;
  readonly status: 'active' | 'locked' | 'pending';
}

/** Usuarios de prueba del handoff (Acceso). Los 6 son también los responsables de programas. */
export const DEMO_USERS: readonly DemoUser[] = [
  { id: 'u1', name: 'Marta Ruiz', email: 'admin@sigpro.test', password: 'Admin1234!', role: 'admin', mfa: true, status: 'active' },
  { id: 'u2', name: 'Javier Ortega', email: 'gestor@sigpro.test', password: 'Gestor1234!', role: 'program_manager', mfa: false, status: 'active' },
  { id: 'u3', name: 'Lucía Fernández', email: 'consultor@sigpro.test', password: 'Consul1234!', role: 'consultant', mfa: false, status: 'active' },
  { id: 'u4', name: 'Andrés Molina', email: 'auditor@sigpro.test', password: 'Audit1234!', role: 'auditor', mfa: false, status: 'active' },
  { id: 'u5', name: 'Carmen Vidal', email: 'bloqueado@sigpro.test', password: 'Block1234!', role: 'consultant', mfa: false, status: 'locked' },
  { id: 'u6', name: 'Pablo Serrano', email: 'pendiente@sigpro.test', password: 'Pend1234!', role: 'consultant', mfa: false, status: 'pending' },
];

export const STUDENT_PASSWORD = 'Alumno1234!';

export const tenantIds = (students: number): readonly string[] => ['demo', ...range(students).map((n) => `alumno${pad(n, 2)}`)];

const buildUsers = (tenantId: string, hash: (plain: string) => string): readonly User[] => {
  const demo: readonly User[] = DEMO_USERS.map((u) => ({
    tenantId,
    id: u.id,
    name: u.name,
    email: u.email,
    passwordHash: hash(u.password),
    role: u.role,
    mfaCode: u.mfa ? MFA_CODE : null,
    active: true,
    pendingApproval: u.status === 'pending',
    failedAttempts: u.status === 'locked' ? 5 : 0,
    lockedAt: u.status === 'locked' ? addDays(EPOCH, 1) : null,
    org: 'Oficina de programas',
    createdAt: EPOCH,
  }));
  const isStudent = tenantId.startsWith('alumno');
  const student: readonly User[] = isStudent
    ? [
        {
          tenantId,
          id: 'u7',
          name: `Alumno ${tenantId.slice('alumno'.length)}`,
          email: `${tenantId}@sigpro.lab`,
          passwordHash: hash(STUDENT_PASSWORD),
          role: 'admin',
          mfaCode: null,
          active: true,
          pendingApproval: false,
          failedAttempts: 0,
          lockedAt: null,
          org: 'Curso Playwright',
          createdAt: EPOCH,
        },
      ]
    : [];
  return [...demo, ...student];
};

// --- Programas e hitos -----------------------------------------------------

const PROGRAM_NAMES = [
  'Sistema de mando táctico Ártemis', 'Radar de vigilancia costera RVC-2', 'Enlace de datos seguro LD-9', 'Plataforma UAV Cóndor',
  'Centro de control de misión CCM', 'Simulador de adiestramiento naval', 'Sensor electroóptico EO-7', 'Red de comunicaciones satelitales',
  'Vehículo blindado modular VBM', 'Suite de guerra electrónica SGE', 'Defensa antiaérea de corto alcance', 'Gestión logística integrada',
  'Sonar pasivo remolcado SPR-3', 'Sistema de navegación inercial', 'Torre de control móvil TCM', 'Infraestructura C4I',
  'Estación terrena portátil ETP', 'Munición guiada de precisión', 'Sistema de identificación IFF', 'Buque de apoyo logístico BAL',
  'Ciberdefensa de red táctica', 'Puesto de mando desplegable PMD', 'Sistema de misión helicóptero', 'Protección balística personal',
] as const;

const STATUS_CYCLE: readonly Program['status'][] = ['active', 'active', 'draft', 'on_hold', 'active', 'closed', 'active', 'cancelled'];
const PRIORITY_CYCLE: readonly Program['priority'][] = ['medium', 'high', 'low'];
const MILESTONE_NAMES = ['SRR', 'PDR', 'CDR', 'TRR', 'FAT', 'SAT', 'Entrega', 'Cierre', 'Garantía', 'Transferencia'] as const;

/** Porcentaje de avance del prototipo para el programa i (0-based). */
const targetProgress = (i: number): number => (i * 37 + 11) % 100;

/** Elige 5–10 hitos que aproximen mejor el porcentaje objetivo (el avance se deriva de los hitos). */
export const milestoneSplit = (target: number): { total: number; done: number } => {
  const best = [5, 6, 7, 8, 9, 10]
    .map((total) => {
      const done = Math.round((target * total) / 100);
      return { total, done, error: Math.abs((done / total) * 100 - target) };
    })
    .reduce((current, candidate) => (candidate.error < current.error ? candidate : current));
  return { total: best.total, done: best.done };
};

const buildPrograms = (tenantId: string): readonly Program[] =>
  PROGRAM_NAMES.map((name, i) => {
    const startMonth = (i * 5) % 12;
    const startYear = 2023 + Math.floor(i / 9);
    return {
      tenantId,
      code: `PRG-${pad(i + 1)}`,
      name,
      description: `Programa «${name}»: alcance, hitos, requisitos y verificación del sistema.`,
      status: pick(STATUS_CYCLE, i),
      priority: pick(PRIORITY_CYCLE, i),
      classified: i % 4 === 0,
      budgetEur: 450_000 + ((i * 7919) % 23) * 185_000,
      startDate: day(`${startYear}-${pad(startMonth + 1, 2)}-${pad(((i * 7) % 27) + 1, 2)}`),
      endDate: day(`${startYear + 1 + (i % 3)}-${pad(((startMonth + 6) % 12) + 1, 2)}-${pad(((i * 3) % 27) + 1, 2)}`),
      ownerId: `u${(i % 6) + 1}`,
      createdAt: addDays(EPOCH, i),
    };
  });

const buildMilestones = (tenantId: string, programs: readonly Program[]): readonly Milestone[] =>
  programs.flatMap((program, i) => {
    const { total, done } = milestoneSplit(targetProgress(i));
    const span = Math.max(1, Math.round((program.endDate.getTime() - program.startDate.getTime()) / 86_400_000));
    return range(total).map((k) => ({
      tenantId,
      id: `${program.code}-M${pad(k, 2)}`,
      programCode: program.code,
      name: pick(MILESTONE_NAMES, k - 1),
      dueDate: addDays(program.startDate, Math.round((span * k) / total)),
      done: k <= done,
    }));
  });

// --- Requisitos, casos de prueba y ejecuciones -----------------------------

const REQUIREMENT_STATES: readonly Requirement['state'][] = ['draft', 'approved', 'verified', 'validated'];
const REQUIREMENT_TOPICS = ['Disponibilidad', 'Latencia', 'Cifrado', 'Trazabilidad', 'Interfaz operador', 'Redundancia', 'Registro de eventos', 'Autenticación'] as const;

const buildRequirements = (tenantId: string): readonly Requirement[] =>
  range(40).map((n) => ({
    tenantId,
    code: `REQ-${pad(n)}`,
    programCode: `PRG-${pad(Math.floor((n - 1) / 14) + 1)}`,
    title: `${pick(REQUIREMENT_TOPICS, n - 1)} del subsistema ${pad(n)}`,
    description: `El sistema debe cumplir el requisito ${pad(n)} de ${pick(REQUIREMENT_TOPICS, n - 1).toLowerCase()} en condiciones nominales.`,
    priority: pick(PRIORITY_CYCLE, n),
    // REQ-017 nace en borrador: es el requisito de los ejercicios de aprobación
    state: n === 17 ? 'draft' : pick(REQUIREMENT_STATES, n),
    parentCode: n % 4 === 0 ? `REQ-${pad(n - 1)}` : null,
  }));

const buildTestCases = (tenantId: string): readonly TestCase[] =>
  range(25).map((n) => ({
    tenantId,
    code: `TC-${pad(n)}`,
    programCode: `PRG-${pad(Math.floor((n - 1) / 9) + 1)}`,
    title: `Verificar ${pick(REQUIREMENT_TOPICS, n - 1).toLowerCase()} (caso ${pad(n)})`,
    steps: ['Preparar el entorno de pruebas', 'Ejecutar el escenario nominal', 'Registrar las mediciones'],
    expected: 'Los valores medidos cumplen el umbral definido en el requisito.',
  }));

/** TC-n cubre REQ-n y REQ-(n+12): así REQ-017 queda enlazado con TC-005. */
const buildRequirementTestCases = (tenantId: string): readonly RequirementTestCase[] =>
  range(25).flatMap((n) =>
    [n, n + 12]
      .filter((r) => r <= 40)
      .map((r) => ({ tenantId, requirementCode: `REQ-${pad(r)}`, testCaseCode: `TC-${pad(n)}` })),
  );

const RESULT_CYCLE: readonly TestRun['result'][] = ['pass', 'pass', 'fail', 'blocked', 'pass'];

const buildTestRuns = (tenantId: string): readonly TestRun[] =>
  range(25)
    .flatMap((tc) => range(1 + (tc % 3)).map((k) => ({ tc, k })))
    .map(({ tc, k }, index) => ({
      tenantId,
      id: `RUN-${pad(index + 1)}`,
      testCaseCode: `TC-${pad(tc)}`,
      executedAt: addDays(EPOCH, 30 + index),
      result: pick(RESULT_CYCLE, index + k),
      evidenceUrl: index % 4 === 0 ? `/files/evidence/TC-${pad(tc)}-${k}.png` : null,
      executedById: 'u3',
    }));

// --- No conformidades, documentos, proveedores, contratos, auditoría -------

const NC_SEVERITY: readonly NonConformity['severity'][] = ['minor', 'major', 'critical'];
const NC_STATE: readonly NonConformity['state'][] = ['open', 'in_analysis', 'corrective_action', 'closed', 'rejected', 'open'];

const buildNonConformities = (tenantId: string): readonly NonConformity[] =>
  range(12).map((n) => ({
    tenantId,
    code: `NC-${pad(n)}`,
    programCode: `PRG-${pad(Math.floor((n - 1) / 4) + 1)}`,
    severity: pick(NC_SEVERITY, n - 1),
    description: `Desviación detectada en la ejecución ${pad(n)}: el resultado no cumple el criterio de aceptación.`,
    state: pick(NC_STATE, n - 1),
    // Cada quinta NC queda sin asignar (tarjetas kanban sin responsable)
    assigneeId: n % 5 === 0 ? null : `u${(n % 4) + 1}`,
    testRunId: n % 2 === 0 ? `RUN-${pad(n * 2)}` : null,
  }));

const DOCUMENT_KINDS = ['Plan de verificación', 'Especificación técnica'] as const;

const buildDocuments = (tenantId: string, programs: readonly Program[]): readonly Document[] =>
  programs.slice(0, 6).flatMap((program, p) =>
    DOCUMENT_KINDS.map((kind, k) => {
      const n = p * 2 + k + 1;
      return {
        tenantId,
        id: `DOC-${pad(n)}`,
        programCode: program.code,
        title: `${kind} ${program.code}`,
        classification: n % 3 === 0 ? ('restricted' as const) : ('public' as const),
        fileUrl: `/files/docs/DOC-${pad(n)}.pdf`,
        version: 1 + (n % 3),
      };
    }),
  );

const SUPPLIER_NAMES = ['Aeronáutica Levante S.L.', 'Sistemas Ibéricos S.A.', 'Electrónica del Cantábrico', 'Optrónica Meseta S.L.', 'Cibertáctica Norte', 'Logística Marítima Atlas'] as const;

const buildSuppliers = (tenantId: string): readonly Supplier[] =>
  SUPPLIER_NAMES.map((name, i) => ({
    tenantId,
    id: `s${i + 1}`,
    name,
    nif: `B${String(10_000_000 + (i + 1) * 1_111_111).slice(0, 8)}`,
    contactEmail: `contacto@proveedor${i + 1}.example`,
    approved: i !== 4,
  }));

const buildContracts = (tenantId: string, suppliers: readonly Supplier[]): readonly Contract[] =>
  suppliers.flatMap((supplier, i) =>
    [i * 2 + 1, i * 2 + 2].map((programNumber) => ({
      tenantId,
      programCode: `PRG-${pad(programNumber)}`,
      supplierId: supplier.id,
      amountEur: 100_000 + (i + 1) * 50_000,
      signedAt: day(`2025-0${(i % 9) + 1}-15`),
    })),
  );

const buildAuditLogs = (tenantId: string): readonly AuditLog[] =>
  range(5).map((n) => ({
    tenantId,
    id: `AL-${pad(n)}`,
    actorId: 'u1',
    action: 'program.created',
    entity: 'program',
    entityId: `PRG-${pad(n)}`,
    at: addDays(EPOCH, n),
    diff: { name: pick(PROGRAM_NAMES, n - 1) },
  }));

// --- Composición -----------------------------------------------------------

export const buildTenantSeed = (tenantId: string, hash: (plain: string) => string): SeedRows => {
  const programs = buildPrograms(tenantId);
  const suppliers = buildSuppliers(tenantId);
  return {
    tenant: { id: tenantId, name: tenantId === 'demo' ? 'Demo' : `Alumno ${tenantId.slice('alumno'.length)}`, seedVersion: SEED_VERSION },
    users: buildUsers(tenantId, hash),
    programs,
    milestones: buildMilestones(tenantId, programs),
    requirements: buildRequirements(tenantId),
    testCases: buildTestCases(tenantId),
    requirementTestCases: buildRequirementTestCases(tenantId),
    testRuns: buildTestRuns(tenantId),
    nonConformities: buildNonConformities(tenantId),
    documents: buildDocuments(tenantId, programs),
    auditLogs: buildAuditLogs(tenantId),
    suppliers,
    contracts: buildContracts(tenantId, suppliers),
  };
};
