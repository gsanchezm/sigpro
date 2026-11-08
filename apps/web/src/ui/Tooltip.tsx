import { cloneElement, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';

const TOOLTIP_OPENED = 'sigpro:tooltip-opened';
const VIEWPORT_MARGIN = 8;

interface TooltipProps {
  /** Id del tooltip: el disparador lo referencia con `aria-describedby` mientras está visible. */
  readonly id: string;
  readonly text: string;
  readonly testId: string;
  /** Un único elemento enfocable (botón, enlace…) que dispara el tooltip. */
  readonly children: ReactElement<{ 'aria-describedby'?: string }>;
  /** Lado en el que aparece (por defecto, debajo). */
  readonly placement?: 'top' | 'bottom';
  /** Clases del contenedor (por defecto en línea; en filas flexibles `flex-1 min-w-0`). */
  readonly className?: string;
}

/**
 * Tooltip `role="tooltip"` que aparece al pasar el ratón o al enfocar el disparador, y se cierra con Esc.
 * Los tooltips mejoran pero nunca bloquean: lo que dicen también está en el texto o la tabla de la pantalla.
 */
export const Tooltip = ({ id, text, testId, children, placement = 'bottom', className = 'inline-flex' }: TooltipProps) => {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const hide = useCallback(() => setOpen(false), []);
  // Solo hay un tooltip abierto a la vez: al abrirse uno se avisa a los demás (un botón con foco y otro con hover no se solapan)
  const show = useCallback(() => {
    window.dispatchEvent(new CustomEvent(TOOLTIP_OPENED, { detail: id }));
    setOpen(true);
  }, [id]);

  useEffect(() => {
    const onOtherOpened = (event: Event) => (event as CustomEvent<string>).detail !== id && hide();
    window.addEventListener(TOOLTIP_OPENED, onOtherOpened);
    return () => window.removeEventListener(TOOLTIP_OPENED, onOtherOpened);
  }, [id, hide]);

  // Si el tooltip se sale de la ventana (móvil, disparador junto al borde) se desplaza lo justo para verse entero
  useLayoutEffect(() => {
    if (!open) return;
    const bubble = bubbleRef.current;
    if (!bubble) return;
    setShift(0);
    const { left, right } = bubble.getBoundingClientRect();
    const overflowLeft = VIEWPORT_MARGIN - left;
    const overflowRight = right - (window.innerWidth - VIEWPORT_MARGIN);
    setShift(overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0);
  }, [open, text]);

  // Esc cierra el tooltip abierto (WCAG 1.4.13: descartable sin mover el puntero ni el foco)
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && hide();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide]);

  return (
    <span className={`relative ${className}`} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      {open ? (
        <span
          ref={bubbleRef}
          role="tooltip"
          id={id}
          style={shift === 0 ? undefined : { marginLeft: shift }}
          data-testid={testId}
          className={`pointer-events-none absolute left-1/2 z-50 w-max max-w-[240px] -translate-x-1/2 rounded-[4px] bg-[var(--text)] px-2 py-1.5 text-left text-[11.5px] leading-[1.35] font-normal text-[var(--bg)] shadow-pop ${
            placement === 'top' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'
          }`}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
};
