import { formatTrace } from '@sigpro/shared';
import { useCallback, useRef, useState } from 'react';
import { saveFile } from '../../lib/deliver-file';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';

/** Texto de un fallo: la traza de la API, el mensaje de la plataforma (p. ej. «sin hoja de compartir») o el texto de red. */
const failureText = (failure: unknown, networkText: string): string => formatTrace(failure) || (failure instanceof Error ? failure.message : '') || networkText;

/**
 * Descarga del PDF de un documento (`GET /documents/:id/download`). Lo pide con el cliente autenticado y lo guarda con su
 * nombre (`DOC-004-v3.pdf`): descarga del navegador en la web, hoja de compartir en iOS y Android. Avisa con los mismos toasts
 * que la web: «Descarga iniciada» con el nombre o «No se pudo descargar el documento» con la traza. `busy` evita dos
 * descargas a la vez. Sin `version` se descarga la última.
 */
export const useDocumentDownload = () => {
  const { api } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const download = useCallback(
    async (id: string, version?: number): Promise<void> => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      try {
        const { blob, filename } = await api.documents.download(id, version);
        const name = filename ?? (version === undefined ? `${id}.pdf` : `${id}-v${version}.pdf`);
        await saveFile(blob, name, blob.type || 'application/pdf');
        toast.push('info', t('documentos', 'downloadReady'), name);
      } catch (failure) {
        toast.push('danger', t('documentos', 'downloadFailed'), failureText(failure, t('common', 'networkError')));
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [api, t, toast],
  );

  return { download, busy };
};
