import { VERIFICACION_DYNAMIC_TESTIDS, type EvidenceDto } from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { downloadBlob } from '../../lib/download';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';

const toUri = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
const FRAME = '<rect width="64" height="48" rx="4" fill="#f4f0f6" stroke="#cfc4d6"/>';
/** Mientras llega la imagen (o si falla) se muestra un marco gris; el `alt` y el `data-state` siguen siendo observables. */
const PLACEHOLDER = toUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48">${FRAME}<path d="M12 36l12-14 9 10 6-6 13 10z" fill="#cfc4d6"/></svg>`);
const FAILED = toUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48">${FRAME}<path d="M22 14l20 20M42 14L22 34" stroke="#b93232" stroke-width="3"/></svg>`);
const PDF_ICON = toUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect width="64" height="48" rx="4" fill="#fbe4e4" stroke="#b93232"/><text x="32" y="29" text-anchor="middle" font-family="Geist Sans, sans-serif" font-size="14" font-weight="700" fill="#b93232">PDF</text></svg>`,
);

export const formatBytes = (bytes: number): string => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`);

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Miniatura de una evidencia. `<img src>` no puede llevar el Bearer, así que la imagen se pide con fetch, se convierte
 * en un `blob:` y se libera al desmontar. Los PDF muestran un icono con su propio `alt`.
 */
export const EvidenceImage = ({ evidence, testCaseCode }: { evidence: EvidenceDto; testCaseCode: string }) => {
  const { api } = useAuth();
  const { t } = useI18n();
  const isPdf = evidence.mimeType === 'application/pdf';
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>(isPdf ? 'ready' : 'loading');

  useEffect(() => {
    if (isPdf) return;
    let cancelled = false;
    let url: string | null = null;
    api.evidence.download(evidence.id).then(
      ({ blob }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
        setState('ready');
      },
      () => !cancelled && setState('error'),
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [api, evidence.id, isPdf]);

  const alt = isPdf ? t('verificacion', 'pdfAlt', { name: evidence.filename }) : t('verificacion', 'evidenceAlt', { code: testCaseCode });
  const resolved = isPdf ? PDF_ICON : state === 'error' ? FAILED : (src ?? PLACEHOLDER);

  return (
    <img
      src={resolved}
      alt={alt}
      width={64}
      height={48}
      data-testid={VERIFICACION_DYNAMIC_TESTIDS.EVIDENCE_THUMB(evidence.id)}
      data-state={state}
      title={state === 'error' ? t('verificacion', 'evidenceFailed') : evidence.filename}
      className="h-12 w-16 flex-none rounded-ctl-sm border border-border bg-surface-2 object-cover"
    />
  );
};

/** Miniatura + nombre, tamaño y botón de descarga de una evidencia. */
export const EvidenceItem = ({ evidence, testCaseCode }: { evidence: EvidenceDto; testCaseCode: string }) => {
  const { api } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const download = async () => {
    try {
      const { blob, filename } = await api.evidence.download(evidence.id);
      downloadBlob(blob, filename ?? evidence.filename);
    } catch {
      toast.push('danger', t('verificacion', 'evidenceFailed'));
    }
  };

  return (
    <figure className="m-0 flex items-center gap-2">
      <EvidenceImage evidence={evidence} testCaseCode={testCaseCode} />
      <figcaption className="flex min-w-0 flex-col gap-0.5 text-[11.5px]">
        <span className="max-w-[160px] truncate font-medium" title={evidence.filename}>
          {evidence.filename}
        </span>
        <span className="font-mono text-fg-3">{formatBytes(evidence.size)}</span>
        <button
          type="button"
          data-testid={VERIFICACION_DYNAMIC_TESTIDS.EVIDENCE_DOWNLOAD(evidence.id)}
          aria-label={t('verificacion', 'downloadFile', { name: evidence.filename })}
          onClick={() => void download()}
          className="cursor-pointer self-start border-0 bg-transparent p-0 text-[11.5px] text-accent hover:underline"
        >
          {t('verificacion', 'download')}
        </button>
      </figcaption>
    </figure>
  );
};
