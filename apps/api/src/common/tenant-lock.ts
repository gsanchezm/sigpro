import type { Prisma } from '@prisma/client';

/**
 * Serializa, dentro de la transacción, las altas con código correlativo de un tenant (PRG-025, REQ-041, NC-013, RUN-…).
 * Ese código se calcula leyendo los existentes: sin este candado dos altas simultáneas calculan el mismo y la segunda
 * falla con un 500 (clave `(tenant_id, code)` repetida). Debe ser la PRIMERA sentencia de la transacción: la lectura de los
 * códigos que viene después ya ve lo que confirmó la alta anterior. Postgres lo libera solo al terminar la transacción.
 */
export const lockTenantCodes = (tx: Prisma.TransactionClient, tenantId: string): Promise<number> =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('sigpro.codes'), hashtext(${tenantId}))`;
