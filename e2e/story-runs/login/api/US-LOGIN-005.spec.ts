import { call, type ApiResult } from '../../support/api';
import { DEMO, TENANT_A, resetTenants, startSession } from '../../support/prepare';
import { defineApiRows, type ApiRowHandler } from '../../support/rows';
import { cell, finish, premise, requirePreparation, strict, tenantHeaderOf, type Premise } from './common';

// US-LOGIN-005 — Responder que el acceso con certificado digital o SSO no está disponible. Las expectativas salen de los pasos
// «Entonces/Y» de cada fila; la fila con sesión envía el accessToken de gestor@sigpro.test en `Authorization: Bearer`. Si el inicio de
// sesión de preparación no da el token, la preparación lanza: no es una discrepancia de la app.

interface Caller {
  /** `undefined` es «no envía Authorization». */
  readonly token: string | undefined;
  readonly premises: readonly Premise[];
}

/** Quién llama: sin Authorization, o con el accessToken de gestor@sigpro.test en alumno01. */
const CALLERS: ReadonlyMap<string, () => Promise<Caller>> = new Map<string, () => Promise<Caller>>([
  ['no envía Authorization', async () => ({ token: undefined, premises: [] })],
  [
    'envía el accessToken de gestor@sigpro.test en alumno01',
    async () => {
      const started = await startSession(TENANT_A, DEMO.gestor);
      return { token: started.session?.accessToken, premises: [premise('gestor@sigpro.test inicia sesión y recibe su accessToken', started.session !== undefined, `HTTP ${started.result.status}`)] };
    },
  ],
]);

const ssoCall = (tenant: string | undefined, token: string | undefined): Promise<ApiResult> =>
  call('GET', '/auth/sso', { ...(tenant === undefined ? {} : { tenant }), ...(token === undefined ? {} : { token }) });

const ssoNotAvailable: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const caller = await strict('autorizacion', CALLERS, cell(row, 'autorizacion'))();
  const premises = requirePreparation(row, caller.premises);
  const result = await ssoCall(tenantHeaderOf(cell(row, 'tenant')), caller.token);
  return finish(row, result, { premises });
};

defineApiRows({
  story: 'US-LOGIN-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, ssoNotAvailable]]),
});
