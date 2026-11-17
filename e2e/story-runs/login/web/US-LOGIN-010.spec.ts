import { TENANT_A } from '../../support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../support/rows';
import { cell } from './common';

// US-LOGIN-010 — Entrar con «Acceder con certificado digital / SSO» sin la contraseña de SIGPRO. Es una capacidad futura
// (historia no-implementada): no se prueba contra la app. Cada fila tiene su manejador y su resultado, pero ninguna abre nada.

const notTested: BrowserRowHandler = async (row) =>
  notExecutable(
    `Pulsa «Acceder con certificado digital / SSO» y ${cell(row, 'resultado_proveedor')} en el proveedor de identidad: ${cell(row, 'resultado')}`,
    'capacidad futura (historia no-implementada): no se prueba contra la app',
  );

defineBrowserRows({
  story: 'US-LOGIN-010',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, notTested]]),
});
