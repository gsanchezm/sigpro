// Lista de tenants de alumno para repartirla (comando `pnpm --filter api tenants:list`). Puro: no usa la base de datos.

export interface TenantListRow {
  readonly tenant: string;
  /** Usuario administrador del tenant: el seed lo crea como `<tenant>@sigpro.lab`. */
  readonly email: string;
  /** Enlace de acceso con el tenant ya elegido; vacío si no se indicó la URL de la web. */
  readonly url: string;
}

/** Solo los tenants de alumno: `demo` es público y no se reparte. */
export const tenantRows = (ids: readonly string[], webUrl = ''): readonly TenantListRow[] =>
  ids
    .filter((id) => id.startsWith('alumno'))
    .map((id) => ({ tenant: id, email: `${id}@sigpro.lab`, url: webUrl === '' ? '' : `${webUrl.replace(/\/+$/, '')}/login?tenant=${id}` }));

const COLUMNS = ['tenant', 'email', 'url'] as const;

/** Tabla de texto alineada, lista para pegar en un mensaje o una hoja de cálculo. */
export const toTable = (rows: readonly TenantListRow[]): string => {
  const visible = COLUMNS.filter((column) => rows.some((row) => row[column] !== ''));
  const widths = visible.map((column) => Math.max(column.length, ...rows.map((row) => row[column].length)));
  const line = (cells: readonly string[]): string => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join('  ').trimEnd();
  return [line(visible), line(widths.map((width) => '-'.repeat(width))), ...rows.map((row) => line(visible.map((column) => row[column])))].join('\n');
};

/** CSV con cabecera (RFC 4180: comillas solo si hace falta). */
export const toCsv = (rows: readonly TenantListRow[]): string => {
  const cell = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [COLUMNS.join(','), ...rows.map((row) => COLUMNS.map((column) => cell(row[column])).join(','))].join('\n');
};
