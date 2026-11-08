// Texto del `alert()` nativo de «Información del tenant»: función pura, una línea por dato.

export interface TenantInfo {
  readonly tenant: string;
  readonly users: readonly { readonly active: boolean }[];
}

/** Líneas del aviso: título, tenant y recuento de usuarios (total y activos). */
export const tenantInfoLines = (info: TenantInfo, labels: { readonly title: string; readonly tenant: (tenant: string) => string; readonly users: (total: number, active: number) => string }): readonly string[] => [
  labels.title,
  labels.tenant(info.tenant),
  labels.users(info.users.length, info.users.filter((user) => user.active).length),
];

export const tenantInfoMessage = (lines: readonly string[]): string => lines.join('\n');
