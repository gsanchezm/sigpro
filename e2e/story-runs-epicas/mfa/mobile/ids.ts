// Respaldo por id de prueba, solo donde la pantalla no ofrece otro rastro: el aviso de error del servidor se lee por su id (los
// avisos de campo también son `role="alert"`). El id sale del fichero compartido (se amplía, nunca se renombra).
import { ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';

export const ACID = { mfaError: ACCESO_TESTIDS.MFA_ERROR } as const;
