import { formatTrace } from '@sigpro/shared';
import { useCallback, useRef, useState } from 'react';
import { deliverFile } from '../../lib/deliver-file';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { REPORT_FALLBACK_NAME } from './view';

export interface ReportScope {
  readonly program?: string;
  /** Códigos separados por coma (un caso, o la selección). */
  readonly codes?: string;
}

/** Texto de un fallo: la traza de la API, el mensaje de la plataforma (p. ej. «sin hoja de compartir») o el texto de red. */
const failureText = (failure: unknown, networkText: string): string => formatTrace(failure) || (failure instanceof Error ? failure.message : '') || networkText;

/**
 * Informe PDF del plan de verificación (`GET /verification/report`). Lo pide con el cliente autenticado y lo entrega con la
 * hoja de compartir (iOS/Android) o en una pestaña nueva (web). Avisa con los mismos toasts que la web: «Informe generado»
 * con el nombre del archivo o «No se pudo generar el informe» con la traza. `busy` evita lanzar dos informes a la vez.
 */
export const useReport = () => {
  const { api } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const download = useCallback(
    async (scope: ReportScope, fallbackName: string = REPORT_FALLBACK_NAME): Promise<void> => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      try {
        const { blob, filename } = await api.testCases.report(scope);
        const name = filename ?? fallbackName;
        await deliverFile(blob, name, blob.type || 'application/pdf');
        toast.push('info', t('verificacion', 'reportReady'), t('verificacion', 'reportReadyBody', { name }));
      } catch (failure) {
        toast.push('danger', t('verificacion', 'reportFailed'), failureText(failure, t('common', 'networkError')));
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [api, t, toast],
  );

  return { download, busy };
};
