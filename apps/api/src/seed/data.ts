import type {
  AuditLog,
  Contract,
  Document,
  DocumentVersion,
  Evidence,
  Milestone,
  NcComment,
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
import { REQUIREMENT_TAGS, type Role } from '@sigpro/shared';
import { evidencePng } from './png';

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
  readonly evidences: readonly Evidence[];
  readonly nonConformities: readonly NonConformity[];
  readonly ncComments: readonly NcComment[];
  readonly documents: readonly Document[];
  readonly documentVersions: readonly DocumentVersion[];
  readonly auditLogs: readonly AuditLog[];
  readonly suppliers: readonly Supplier[];
  readonly contracts: readonly Contract[];
}

/** v3 (fase 3): avance (`progress`) de los hitos, `createdAt` y comentarios de las NC. v2 (fase 2): árbol de requisitos con etiquetas, casos enlazados por programa, evidencias, versiones de documentos y 130 eventos de auditoría. */
export const SEED_VERSION = 3;
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
      // Cumplidos al 100 %; el primero pendiente va «en curso» (10–60 %) y el resto sin empezar
      progress: k <= done ? 100 : k === done + 1 ? 10 + ((i * 17) % 11) * 5 : 0,
    }));
  });

// --- Requisitos, casos de prueba y ejecuciones -----------------------------

const REQUIREMENT_STATES: readonly Requirement['state'][] = ['draft', 'approved', 'verified', 'validated'];
const REQUIREMENT_TOPICS = ['Disponibilidad', 'Latencia', 'Cifrado', 'Trazabilidad', 'Interfaz operador', 'Redundancia', 'Registro de eventos', 'Autenticación'] as const;
const REQUIREMENTS_PER_PROGRAM = 14;

/** Árbol de hasta 3 niveles dentro de cada programa: una raíz cada 5 requisitos; el 4.º de cada grupo cuelga del 3.º. */
const requirementParent = (n: number): number | null => {
  const group = ((n - 1) % REQUIREMENTS_PER_PROGRAM) % 5;
  if (group === 0) return null;
  return group === 3 ? n - 1 : n - group;
};

/** Etiquetas deterministas: un tercio sin etiquetas, el resto con una (o dos cada quinto). */
const requirementTags = (n: number): string[] => {
  if (n % 3 === 0) return [];
  const tags = [REQUIREMENT_TAGS[n % REQUIREMENT_TAGS.length], ...(n % 5 === 0 ? [REQUIREMENT_TAGS[(n + 3) % REQUIREMENT_TAGS.length]] : [])];
  return Array.from(new Set(tags.filter((tag): tag is (typeof REQUIREMENT_TAGS)[number] => tag !== undefined)));
};

const buildRequirements = (tenantId: string): readonly Requirement[] => {
  const rows: readonly Requirement[] = range(40).map((n) => {
    const parent = requirementParent(n);
    const topic = pick(REQUIREMENT_TOPICS, n - 1);
    return {
      tenantId,
      code: `REQ-${pad(n)}`,
      programCode: `PRG-${pad(Math.floor((n - 1) / REQUIREMENTS_PER_PROGRAM) + 1)}`,
      title: `${topic} del subsistema ${pad(n)}`,
      description: `<p>El sistema debe cumplir el requisito ${pad(n)} de <strong>${topic.toLowerCase()}</strong> en condiciones nominales.</p>`,
      priority: pick(PRIORITY_CYCLE, n),
      // REQ-017 nace en borrador: es el requisito de los ejercicios de aprobación
      state: n === 17 ? 'draft' : pick(REQUIREMENT_STATES, n),
      parentCode: parent === null ? null : `REQ-${pad(parent)}`,
      tags: requirementTags(n),
      position: 0,
    };
  });
  // Posición = nº de hermanos anteriores (mismo programa y mismo padre)
  return rows.map((row, index) => ({ ...row, position: rows.slice(0, index).filter((other) => other.programCode === row.programCode && other.parentCode === row.parentCode).length }));
};

const buildTestCases = (tenantId: string): readonly TestCase[] =>
  range(25).map((n) => ({
    tenantId,
    code: `TC-${pad(n)}`,
    programCode: `PRG-${pad(Math.floor((n - 1) / 9) + 1)}`,
    title: `Verificar ${pick(REQUIREMENT_TOPICS, n - 1).toLowerCase()} (caso ${pad(n)})`,
    steps: ['Preparar el entorno de pruebas', 'Ejecutar el escenario nominal', 'Registrar las mediciones'],
    expected: 'Los valores medidos cumplen el umbral definido en el requisito.',
  }));

/**
 * Matriz de trazabilidad dentro de cada programa: el caso nº j de un programa cubre el requisito nº j y, si no es
 * de los dos últimos, el nº j+7. El último requisito de cada programa queda sin cobertura (hueco que la matriz enseña).
 * REQ-017 queda enlazado con TC-012.
 */
const buildRequirementTestCases = (tenantId: string, requirements: readonly Requirement[], testCases: readonly TestCase[]): readonly RequirementTestCase[] =>
  testCases.flatMap((testCase) => {
    const codes = requirements.filter((r) => r.programCode === testCase.programCode).map((r) => r.code);
    const j = testCases.filter((other) => other.programCode === testCase.programCode && other.code < testCase.code).length;
    const targets = [codes[j], j + 7 < codes.length - 1 ? codes[j + 7] : undefined].filter((code): code is string => code !== undefined);
    return targets.map((requirementCode) => ({ tenantId, requirementCode, testCaseCode: testCase.code }));
  });

const RESULT_CYCLE: readonly TestRun['result'][] = ['pass', 'pass', 'fail', 'blocked', 'pass'];
const RESULT_NOTES: Readonly<Record<TestRun['result'], string>> = {
  pass: 'Resultado conforme con el criterio de aceptación.',
  fail: 'Desviación respecto al criterio de aceptación; se abrirá una no conformidad.',
  blocked: 'Ejecución bloqueada: el entorno de pruebas no estaba disponible.',
};

interface RunPlan {
  readonly run: TestRun;
  /** Id de la evidencia del seed (una de cada cuatro ejecuciones lleva una captura). */
  readonly evidenceId: string | null;
  readonly index: number;
}

const planTestRuns = (tenantId: string): readonly RunPlan[] =>
  range(25)
    .flatMap((tc) => range(1 + (tc % 3)).map((k) => ({ tc, k })))
    .map(({ tc, k }, index) => {
      const result = pick(RESULT_CYCLE, index + k);
      const evidenceId = index % 4 === 0 ? `EV-${pad(index / 4 + 1)}` : null;
      return {
        index,
        evidenceId,
        run: {
          tenantId,
          id: `RUN-${pad(index + 1)}`,
          testCaseCode: `TC-${pad(tc)}`,
          executedAt: addDays(EPOCH, 30 + index),
          result,
          notes: RESULT_NOTES[result],
          evidenceUrl: evidenceId ? `/api/evidence/${evidenceId}` : null,
          executedById: 'u3',
        },
      };
    });

const buildTestRuns = (tenantId: string): readonly TestRun[] => planTestRuns(tenantId).map((plan) => plan.run);

const buildEvidences = (tenantId: string): readonly Evidence[] =>
  planTestRuns(tenantId).flatMap(({ run, evidenceId, index }) => {
    if (!evidenceId) return [];
    const data = new Uint8Array(evidencePng(run.result, index));
    return [
      {
        tenantId,
        id: evidenceId,
        testRunId: run.id,
        filename: `${run.testCaseCode}-${run.id.slice(-3)}.png`,
        mimeType: 'image/png',
        size: data.length,
        data,
        createdAt: run.executedAt,
      },
    ];
  });

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
    createdAt: addDays(EPOCH, 20 + n),
  }));

const NC_COMMENT_BODIES = [
  'Se revisa el informe de la ejecución y se confirma la desviación.',
  'Pendiente de confirmar con el proveedor el plazo de la acción correctiva.',
  'Se adjunta el análisis de causa raíz al expediente.',
  'El equipo de verificación repetirá la prueba tras el parche.',
] as const;
const NC_CLOSURE_BODY = 'Acción correctiva verificada por el equipo de calidad; se aprueba el cierre.';

/** 0–3 comentarios por NC (según su número) y, en las cerradas, el comentario de cierre (≥ 20 caracteres). */
const buildNcComments = (tenantId: string, ncs: readonly NonConformity[]): readonly NcComment[] =>
  ncs.flatMap((nc) => {
    const n = Number.parseInt(nc.code.replace(/\D/g, ''), 10);
    const regular = range(n % 4).map((k) => ({
      tenantId,
      id: `NCC-${pad(n)}-${k}`,
      ncCode: nc.code,
      authorId: `u${((n + k) % 6) + 1}`,
      body: pick(NC_COMMENT_BODIES, n + k),
      kind: (n + k) % 5 === 0 ? ('quick' as const) : ('comment' as const),
      createdAt: new Date(addDays(EPOCH, 21 + n).getTime() + k * 3_600_000),
    }));
    const closure =
      nc.state === 'closed'
        ? [{ tenantId, id: `NCC-${pad(n)}-C`, ncCode: nc.code, authorId: 'u2', body: NC_CLOSURE_BODY, kind: 'closure' as const, createdAt: new Date(addDays(EPOCH, 25 + n).getTime()) }]
        : [];
    return [...regular, ...closure];
  });

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
        // 1–3 versiones: DOC-001 y DOC-004 tienen 3; los restringidos (DOC-003, 006…) tienen 2; DOC-002 y DOC-005, solo 1
        version: 1 + ((n + 1) % 3),
      };
    }),
  );

/** Contenido base de un documento (v1): 18 líneas, dos páginas en el visor. */
const baseDocumentLines = (title: string, programCode: string): readonly string[] => [
  title,
  `Programa ${programCode} · documento ficticio del laboratorio`,
  '',
  '1. Objeto',
  'Este documento define el alcance de la verificación del sistema.',
  '',
  '2. Alcance',
  'Aplica a todos los subsistemas del programa.',
  'Se excluyen los equipos de apoyo en tierra.',
  '',
  '3. Responsabilidades',
  'El gestor del programa aprueba el plan.',
  'El consultor ejecuta las pruebas.',
  'El auditor valida los resultados.',
  '',
  '4. Criterios de aceptación',
  'Todas las pruebas deben terminar en estado superado.',
  'Las desviaciones se registran como no conformidades.',
];

type LineEdit = (lines: readonly string[]) => readonly string[];

/** Cambios que introduce cada versión sobre la anterior (v2, v3…): una línea modificada, una añadida, una eliminada y una sección nueva. */
const VERSION_EDITS: readonly LineEdit[] = [
  (lines) =>
    lines.flatMap((line) =>
      line === 'Se excluyen los equipos de apoyo en tierra.'
        ? ['Se excluyen los equipos de apoyo en tierra y los simuladores.']
        : line === 'El auditor valida los resultados.'
          ? [line, 'El director técnico supervisa la ejecución.']
          : [line],
    ),
  (lines) => [
    ...lines
      .filter((line) => line !== 'Se excluyen los equipos de apoyo en tierra y los simuladores.')
      .map((line) => (line === 'Todas las pruebas deben terminar en estado superado.' ? 'Al menos el 95 % de las pruebas debe terminar en estado superado.' : line)),
    '',
    '5. Anexos',
    'Anexo A: matriz de trazabilidad.',
  ],
];

const VERSION_NOTES: readonly string[] = ['Versión inicial', 'Ajuste de alcance y responsabilidades', 'Nuevos criterios de aceptación y anexos'];

/** Líneas del documento en la versión `version` (la usan el seed y los tests). */
export const documentLines = (title: string, programCode: string, version: number): readonly string[] =>
  VERSION_EDITS.slice(0, Math.max(0, version - 1)).reduce<readonly string[]>((lines, edit) => edit(lines), baseDocumentLines(title, programCode));

const buildDocumentVersions = (tenantId: string, documents: readonly Document[]): readonly DocumentVersion[] =>
  documents.flatMap((document) =>
    range(document.version).map((version) => ({
      tenantId,
      documentId: document.id,
      version,
      lines: [...documentLines(document.title, document.programCode, version)],
      note: pick(VERSION_NOTES, version - 1),
      authorId: 'u2',
      createdAt: addDays(EPOCH, 10 + version * 7),
    })),
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

interface AuditTemplate {
  readonly action: string;
  readonly entity: string;
  readonly actorId: string;
  readonly entityId: (n: number) => string;
  readonly diff: (n: number) => Readonly<Record<string, string | number | string[]>>;
}

const programRef = (n: number): string => `PRG-${pad((n % 24) + 1)}`;
const requirementRef = (n: number): string => `REQ-${pad((n % 40) + 1)}`;

/** Plantillas de los 130 eventos del seed (suficientes para que el feed de Auditoría necesite scroll infinito). */
const AUDIT_TEMPLATES: readonly AuditTemplate[] = [
  { action: 'program.created', entity: 'program', actorId: 'u1', entityId: programRef, diff: (n) => ({ name: pick(PROGRAM_NAMES, n) }) },
  { action: 'program.updated', entity: 'program', actorId: 'u2', entityId: programRef, diff: () => ({ fields: ['name', 'budget'] }) },
  { action: 'program.archived', entity: 'program', actorId: 'u2', entityId: programRef, diff: () => ({ status: 'closed' }) },
  { action: 'requirement.created', entity: 'requirement', actorId: 'u3', entityId: requirementRef, diff: (n) => ({ title: `${pick(REQUIREMENT_TOPICS, n)} del subsistema ${pad((n % 40) + 1)}` }) },
  { action: 'requirement.updated', entity: 'requirement', actorId: 'u3', entityId: requirementRef, diff: () => ({ fields: ['title'] }) },
  { action: 'requirement.state_changed', entity: 'requirement', actorId: 'u2', entityId: requirementRef, diff: (n) => ({ from: pick(REQUIREMENT_STATES, n), to: pick(REQUIREMENT_STATES, n + 1) }) },
  { action: 'requirement.moved', entity: 'requirement', actorId: 'u3', entityId: requirementRef, diff: () => ({ placement: 'before' }) },
  { action: 'requirement.linked', entity: 'requirement', actorId: 'u3', entityId: requirementRef, diff: (n) => ({ testCase: `TC-${pad((n % 25) + 1)}` }) },
  { action: 'testrun.executed', entity: 'testrun', actorId: 'u3', entityId: (n) => `RUN-${pad((n % 50) + 1)}`, diff: (n) => ({ result: pick(RESULT_CYCLE, n) }) },
  { action: 'document.version_published', entity: 'document', actorId: 'u2', entityId: (n) => `DOC-${pad((n % 12) + 1)}`, diff: (n) => ({ version: (n % 3) + 1 }) },
];

const AUDIT_EVENTS = 130;
/** 2,5 h entre eventos: fechas distintas y en orden, para que la paginación por cursor sea estable. */
const AUDIT_STEP_MS = 9_000_000;

const buildAuditLogs = (tenantId: string): readonly AuditLog[] =>
  range(AUDIT_EVENTS).map((n) => {
    const template = pick(AUDIT_TEMPLATES, n * 7 + 3);
    return {
      tenantId,
      id: `AL-${pad(n)}`,
      actorId: template.actorId,
      action: template.action,
      entity: template.entity,
      entityId: template.entityId(n),
      at: new Date(EPOCH.getTime() + 86_400_000 + n * AUDIT_STEP_MS),
      diff: { ...template.diff(n) },
    };
  });

// --- Composición -----------------------------------------------------------

export const buildTenantSeed = (tenantId: string, hash: (plain: string) => string): SeedRows => {
  const programs = buildPrograms(tenantId);
  const suppliers = buildSuppliers(tenantId);
  const requirements = buildRequirements(tenantId);
  const testCases = buildTestCases(tenantId);
  const documents = buildDocuments(tenantId, programs);
  const nonConformities = buildNonConformities(tenantId);
  return {
    tenant: { id: tenantId, name: tenantId === 'demo' ? 'Demo' : `Alumno ${tenantId.slice('alumno'.length)}`, seedVersion: SEED_VERSION },
    users: buildUsers(tenantId, hash),
    programs,
    milestones: buildMilestones(tenantId, programs),
    requirements,
    testCases,
    requirementTestCases: buildRequirementTestCases(tenantId, requirements, testCases),
    testRuns: buildTestRuns(tenantId),
    evidences: buildEvidences(tenantId),
    nonConformities,
    ncComments: buildNcComments(tenantId, nonConformities),
    documents,
    documentVersions: buildDocumentVersions(tenantId, documents),
    auditLogs: buildAuditLogs(tenantId),
    suppliers,
    contracts: buildContracts(tenantId, suppliers),
  };
};
