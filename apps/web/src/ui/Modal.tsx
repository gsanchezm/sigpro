import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  readonly role: 'dialog' | 'alertdialog';
  readonly testId: string;
  readonly scrimTestId?: string;
  readonly labelledBy: string;
  readonly describedBy?: string;
  readonly onClose: () => void;
  /** Elemento que recibe el foco al abrir (por defecto, el primer enfocable). */
  readonly initialFocus?: RefObject<HTMLElement | null>;
  /** Clases de posición y tamaño del cuadro (el resto del estilo es común). */
  readonly className: string;
  readonly children: ReactNode;
}

/** Diálogo modal: scrim, foco atrapado, Esc cierra y el foco vuelve al disparador al cerrar. */
export const Modal = ({ role, testId, scrimTestId, labelledBy, describedBy, onClose, initialFocus, className, children }: ModalProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const box = boxRef.current;
    const first = initialFocus?.current ?? box?.querySelector<HTMLElement>(FOCUSABLE) ?? box;
    first?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !box) return;
      const focusable = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (!firstEl || !lastEl) return;
      const active = document.activeElement;
      if (event.shiftKey && active === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
    // Solo al montar/desmontar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div role="presentation" data-testid={scrimTestId} onClick={onClose} className="fixed inset-0 z-50 bg-[var(--scrim)]" />
      <div
        ref={boxRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        data-testid={testId}
        className={`fixed z-[51] flex flex-col border border-border bg-surface text-fg shadow-pop ${className}`}
      >
        {children}
      </div>
    </>
  );
};
