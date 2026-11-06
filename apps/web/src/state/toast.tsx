import { ACCESO_TESTIDS, ACCESO_DYNAMIC_TESTIDS, TOAST_MS } from '@sigpro/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from './i18n';

export type ToastTone = 'ok' | 'danger' | 'info' | 'warn';

interface ToastItem {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title: string;
  readonly body?: string;
}

interface ToastValue {
  readonly push: (tone: ToastTone, title: string, body?: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

// Las trazas HTTP ("POST /api/…") van en mono; el resto del cuerpo, en la fuente normal
const TRACE_LIKE = /^(GET|POST|PATCH|PUT|DELETE) \/api\//;

const TONE_COLOR: Readonly<Record<ToastTone, string>> = {
  ok: 'var(--ok)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  warn: 'var(--warn)',
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const { t } = useI18n();

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // Autocierre a 3 s (CLAUDE.md / plan; el prototipo usaba 4,5 s)
  const push = useCallback(
    (tone: ToastTone, title: string, body?: string) => {
      const id = ++nextId.current;
      setToasts((current) => [...current, { id, tone, title, body }]);
      timers.current.set(id, setTimeout(() => dismiss(id), TOAST_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => active.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        data-testid={ACCESO_TESTIDS.TOAST_REGION}
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(360px,calc(100%-32px))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            data-testid={ACCESO_DYNAMIC_TESTIDS.TOAST(toast.tone)}
            className="pointer-events-auto flex items-start gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5 text-[13px] shadow-pop"
            style={{ animation: 'toastIn .18s ease-out', borderLeft: `3px solid ${TONE_COLOR[toast.tone]}` }}
          >
            <span aria-hidden="true" className="mt-[5px] size-2 flex-none rounded-full" style={{ background: TONE_COLOR[toast.tone] }} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{toast.title}</div>
              {toast.body ? <div className={`text-[12px] text-fg-2 ${TRACE_LIKE.test(toast.body) ? 'font-mono' : ''}`}>{toast.body}</div> : null}
            </div>
            <button
              type="button"
              data-testid={ACCESO_TESTIDS.TOAST_CLOSE}
              aria-label={t('acceso', 'close')}
              onClick={() => dismiss(toast.id)}
              className="cursor-pointer border-0 bg-transparent p-0 text-base leading-none text-fg-3"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastValue => {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider');
  return value;
};
