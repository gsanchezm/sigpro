import { ACCESO_TESTIDS } from '@sigpro/shared';

/** Spinner de 12 px para botones primarios (aria-hidden: el estado se anuncia con aria-busy). */
export const Spinner = ({ large = false }: { large?: boolean }) => (
  <span aria-hidden="true" data-testid={ACCESO_TESTIDS.SPINNER} className={large ? 'spinner spinner-lg' : 'spinner'} />
);
