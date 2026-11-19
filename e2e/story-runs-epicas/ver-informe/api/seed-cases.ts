// Datos del seed de la API (apps/api/src/seed/data.ts), generados con el seed real y contrastados por la épica. Son el valor
// esperado de las fichas del informe: salen del seed, no de la app. Cada caso: código, programa, título, requisitos enlazados (en orden),
// último resultado con su etiqueta, fecha (día UTC de la última ejecución) y número de ejecuciones.

export interface SeedCase {
  readonly code: string;
  readonly programCode: string;
  readonly title: string;
  readonly requirements: readonly string[];
  readonly label: string;
  readonly date: string;
  readonly runs: number;
}

/** Casos TC-001 a TC-025 en orden de código. */
export const SEED_CASES: readonly SeedCase[] = [
  { code: 'TC-001', programCode: 'PRG-001', title: 'Verificar disponibilidad (caso 001)', requirements: ['REQ-001', 'REQ-008'], label: 'Bloqueado', date: '2026-02-05', runs: 2 },
  { code: 'TC-002', programCode: 'PRG-001', title: 'Verificar latencia (caso 002)', requirements: ['REQ-002', 'REQ-009'], label: 'Fallido', date: '2026-02-08', runs: 3 },
  { code: 'TC-003', programCode: 'PRG-001', title: 'Verificar cifrado (caso 003)', requirements: ['REQ-003', 'REQ-010'], label: 'Superado', date: '2026-02-09', runs: 1 },
  { code: 'TC-004', programCode: 'PRG-001', title: 'Verificar trazabilidad (caso 004)', requirements: ['REQ-004', 'REQ-011'], label: 'Superado', date: '2026-02-11', runs: 2 },
  { code: 'TC-005', programCode: 'PRG-001', title: 'Verificar interfaz operador (caso 005)', requirements: ['REQ-005', 'REQ-012'], label: 'Bloqueado', date: '2026-02-14', runs: 3 },
  { code: 'TC-006', programCode: 'PRG-001', title: 'Verificar redundancia (caso 006)', requirements: ['REQ-006', 'REQ-013'], label: 'Fallido', date: '2026-02-15', runs: 1 },
  { code: 'TC-007', programCode: 'PRG-001', title: 'Verificar registro de eventos (caso 007)', requirements: ['REQ-007'], label: 'Superado', date: '2026-02-17', runs: 2 },
  { code: 'TC-008', programCode: 'PRG-001', title: 'Verificar autenticación (caso 008)', requirements: ['REQ-008'], label: 'Superado', date: '2026-02-20', runs: 3 },
  { code: 'TC-009', programCode: 'PRG-001', title: 'Verificar disponibilidad (caso 009)', requirements: ['REQ-009'], label: 'Bloqueado', date: '2026-02-21', runs: 1 },
  { code: 'TC-010', programCode: 'PRG-002', title: 'Verificar latencia (caso 010)', requirements: ['REQ-015', 'REQ-022'], label: 'Superado', date: '2026-02-23', runs: 2 },
  { code: 'TC-011', programCode: 'PRG-002', title: 'Verificar cifrado (caso 011)', requirements: ['REQ-016', 'REQ-023'], label: 'Superado', date: '2026-02-26', runs: 3 },
  { code: 'TC-012', programCode: 'PRG-002', title: 'Verificar trazabilidad (caso 012)', requirements: ['REQ-017', 'REQ-024'], label: 'Superado', date: '2026-02-27', runs: 1 },
  { code: 'TC-013', programCode: 'PRG-002', title: 'Verificar interfaz operador (caso 013)', requirements: ['REQ-018', 'REQ-025'], label: 'Fallido', date: '2026-03-01', runs: 2 },
  { code: 'TC-014', programCode: 'PRG-002', title: 'Verificar redundancia (caso 014)', requirements: ['REQ-019', 'REQ-026'], label: 'Superado', date: '2026-03-04', runs: 3 },
  { code: 'TC-015', programCode: 'PRG-002', title: 'Verificar registro de eventos (caso 015)', requirements: ['REQ-020', 'REQ-027'], label: 'Superado', date: '2026-03-05', runs: 1 },
  { code: 'TC-016', programCode: 'PRG-002', title: 'Verificar autenticación (caso 016)', requirements: ['REQ-021'], label: 'Bloqueado', date: '2026-03-07', runs: 2 },
  { code: 'TC-017', programCode: 'PRG-002', title: 'Verificar disponibilidad (caso 017)', requirements: ['REQ-022'], label: 'Fallido', date: '2026-03-10', runs: 3 },
  { code: 'TC-018', programCode: 'PRG-002', title: 'Verificar latencia (caso 018)', requirements: ['REQ-023'], label: 'Superado', date: '2026-03-11', runs: 1 },
  { code: 'TC-019', programCode: 'PRG-003', title: 'Verificar cifrado (caso 019)', requirements: ['REQ-029', 'REQ-036'], label: 'Superado', date: '2026-03-13', runs: 2 },
  { code: 'TC-020', programCode: 'PRG-003', title: 'Verificar trazabilidad (caso 020)', requirements: ['REQ-030', 'REQ-037'], label: 'Bloqueado', date: '2026-03-16', runs: 3 },
  { code: 'TC-021', programCode: 'PRG-003', title: 'Verificar interfaz operador (caso 021)', requirements: ['REQ-031', 'REQ-038'], label: 'Fallido', date: '2026-03-17', runs: 1 },
  { code: 'TC-022', programCode: 'PRG-003', title: 'Verificar redundancia (caso 022)', requirements: ['REQ-032', 'REQ-039'], label: 'Superado', date: '2026-03-19', runs: 2 },
  { code: 'TC-023', programCode: 'PRG-003', title: 'Verificar registro de eventos (caso 023)', requirements: ['REQ-033'], label: 'Superado', date: '2026-03-22', runs: 3 },
  { code: 'TC-024', programCode: 'PRG-003', title: 'Verificar autenticación (caso 024)', requirements: ['REQ-034'], label: 'Bloqueado', date: '2026-03-23', runs: 1 },
  { code: 'TC-025', programCode: 'PRG-003', title: 'Verificar disponibilidad (caso 025)', requirements: ['REQ-035'], label: 'Superado', date: '2026-03-25', runs: 2 },
];

/** Nombre de cada programa del seed. */
export const PROGRAM_NAMES: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'Sistema de mando táctico Ártemis'],
  ['PRG-002', 'Radar de vigilancia costera RVC-2'],
  ['PRG-003', 'Enlace de datos seguro LD-9'],
  ['PRG-004', 'Plataforma UAV Cóndor'],
]);

/** Los tres pasos de cada caso del seed y su resultado esperado (iguales en todos los casos). */
export const STEPS: readonly string[] = ['Preparar el entorno de pruebas', 'Ejecutar el escenario nominal', 'Registrar las mediciones'];
export const EXPECTED_TEXT = 'Los valores medidos cumplen el umbral definido en el requisito.';

/** Ejecuciones del seed tras reiniciar alumno01 (suma de las de cada caso). */
export const SEED_RUNS = 50;
