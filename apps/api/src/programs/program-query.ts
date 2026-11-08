import type { Prisma } from '@prisma/client';
import { PAGE_SIZE, PROGRAM_SORT_COLUMNS, PROGRAM_STATUSES, type ProgramListQuery, type ProgramSortColumn, type ProgramStatus, type SortDir } from '@sigpro/shared';

const MAX_PAGE_SIZE = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const asEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

const asPositiveInt = (value: unknown): number | undefined => {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  return Number.isInteger(n) ? n : undefined;
};

const asDate = (value: unknown): string | undefined => (typeof value === 'string' && ISO_DATE.test(value) ? value : undefined);

const asText = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

/** Query string cruda → `ProgramListQuery` tipado; lo inválido se descarta en lugar de fallar. */
export const parseListQuery = (raw: Readonly<Record<string, unknown>>): ProgramListQuery => {
  const parsed = {
    q: asText(raw.q),
    status: asEnum<ProgramStatus>(raw.status, PROGRAM_STATUSES),
    from: asDate(raw.from),
    to: asDate(raw.to),
    owner: asText(raw.owner),
    sort: asEnum<ProgramSortColumn>(raw.sort, PROGRAM_SORT_COLUMNS),
    dir: asEnum<SortDir>(raw.dir, ['asc', 'desc']),
    page: asPositiveInt(raw.page),
    pageSize: asPositiveInt(raw.pageSize),
  };
  return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined)) as ProgramListQuery;
};

export const normalizePaging = (query: Pick<ProgramListQuery, 'page' | 'pageSize'>): { page: number; pageSize: number } => ({
  page: Math.max(1, query.page ?? 1),
  pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? PAGE_SIZE)),
});

const utcDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export interface WhereOptions {
  /** Defecto plantado del laboratorio (`PLANTED_BUGS`): el filtro «Hasta» deja fuera el último día del rango. */
  readonly plantedBugs?: boolean;
}

export const buildWhere = (tenantId: string, query: ProgramListQuery, options: WhereOptions = {}): Prisma.ProgramWhereInput => ({
  tenantId,
  ...(query.status ? { status: query.status } : {}),
  ...(query.owner ? { ownerId: query.owner } : {}),
  ...(query.from ? { startDate: { gte: utcDate(query.from) } } : {}),
  ...(query.to ? { endDate: options.plantedBugs ? { lt: utcDate(query.to) } : { lte: utcDate(query.to) } } : {}),
  ...(query.q
    ? {
        OR: [
          { code: { contains: query.q, mode: 'insensitive' as const } },
          { name: { contains: query.q, mode: 'insensitive' as const } },
        ],
      }
    : {}),
});

// Mapa de despacho columna → orden de Prisma (sin switch)
const ORDER_BY: Readonly<Record<ProgramSortColumn, (dir: SortDir) => Prisma.ProgramOrderByWithRelationInput>> = {
  code: (dir) => ({ code: dir }),
  name: (dir) => ({ name: dir }),
  status: (dir) => ({ status: dir }),
  owner: (dir) => ({ owner: { name: dir } }),
  dates: (dir) => ({ startDate: dir }),
  budget: (dir) => ({ budgetEur: dir }),
};

/** Orden pedido + desempate por código para que la paginación sea estable. */
export const buildOrderBy = (sort: ProgramSortColumn | undefined, dir: SortDir | undefined): Prisma.ProgramOrderByWithRelationInput[] => {
  const column: ProgramSortColumn = sort ?? 'code';
  const primary = ORDER_BY[column](dir ?? 'asc');
  return column === 'code' ? [primary] : [primary, { code: 'asc' }];
};

/**
 * Orden de la lista según la página. Defecto plantado (`PLANTED_BUGS`): al pasar de la primera página se pierde el orden
 * pedido y vuelve el orden por código.
 */
export const listOrderBy = (query: Pick<ProgramListQuery, 'sort' | 'dir'>, page: number, plantedBugs: boolean): Prisma.ProgramOrderByWithRelationInput[] =>
  plantedBugs && page > 1 ? buildOrderBy(undefined, undefined) : buildOrderBy(query.sort, query.dir);

export const progressOf = (done: number, total: number): number => (total === 0 ? 0 : Math.round((done / total) * 100));

export { nextProgramCode } from '@sigpro/shared';
