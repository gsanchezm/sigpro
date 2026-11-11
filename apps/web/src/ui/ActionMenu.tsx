import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { useDismiss } from '../lib/hooks';
import { DotsIcon } from './icons';

export interface MenuItemSpec {
  readonly key: string;
  readonly label: string;
  readonly testId: string;
  readonly onSelect?: () => void;
  /** Enlace interno (React Router). */
  readonly to?: string;
  /** Enlace externo o nueva pestaña (`<a target="_blank">`). */
  readonly href?: string;
  readonly newTab?: boolean;
  readonly disabled?: boolean;
  /** Motivo por el que está deshabilitado (`title`). */
  readonly title?: string;
  readonly danger?: boolean;
  readonly separatorBefore?: boolean;
}

export interface MenuPoint {
  readonly x: number;
  readonly y: number;
  /** `right`: el menú termina en `x` (botón ⋯); `left`: empieza en `x` (clic derecho). */
  readonly align: 'left' | 'right';
}

interface ActionMenuProps {
  readonly label: string;
  readonly testId: string;
  readonly items: readonly MenuItemSpec[];
  readonly point: MenuPoint;
  readonly onClose: () => void;
  /** Elemento que recupera el foco al cerrar con Esc o al elegir una opción. */
  readonly returnFocus?: RefObject<HTMLElement | null>;
}

const MENU_WIDTH = 200;
const ITEM = '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])';

/** Menú `role="menu"` con `position: fixed`: lo abren el botón ⋯ de una fila o el clic derecho. Flechas, Inicio/Fin, Esc y Tab. */
export const ActionMenu = ({ label, testId, items, point, onClose, returnFocus }: ActionMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useDismiss(true, [menuRef], close);

  // Se coloca junto al punto y se mantiene dentro de la ventana; el foco va a la primera opción activa
  useLayoutEffect(() => {
    const height = menuRef.current?.offsetHeight ?? 220;
    const left = point.align === 'right' ? point.x - MENU_WIDTH : point.x;
    const top = point.y + height > window.innerHeight ? Math.max(8, point.y - height) : point.y;
    setPosition({ top, left: Math.min(Math.max(8, left), window.innerWidth - MENU_WIDTH - 8) });
    menuRef.current?.querySelector<HTMLElement>(ITEM)?.focus();
  }, [point]);

  useLayoutEffect(() => {
    const dismiss = () => onClose();
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM) ?? []);
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      entries[(to + entries.length) % entries.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(entries.length - 1);
    else if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      returnFocus?.current?.focus();
    } else if (event.key === 'Tab') onClose();
  };

  const select = (item: MenuItemSpec) => () => {
    onClose();
    item.onSelect?.();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-label={label}
      data-testid={testId}
      onKeyDown={onKeyDown}
      className="popover fixed z-40 flex flex-col"
      style={{ width: MENU_WIDTH, top: position?.top ?? -9999, left: position?.left ?? -9999 }}
    >
      {items.map((item) => {
        const className = `menu-item no-underline ${item.danger ? '!text-danger hover:!bg-danger-soft' : '!text-fg'}`;
        const separator = item.separatorBefore ? <div role="separator" className="menu-sep" /> : null;
        if (item.to && !item.disabled) {
          return (
            <span key={item.key} className="contents">
              {separator}
              <Link to={item.to} role="menuitem" data-testid={item.testId} onClick={close} className={className}>
                {item.label}
              </Link>
            </span>
          );
        }
        if (item.href && !item.disabled) {
          return (
            <span key={item.key} className="contents">
              {separator}
              <a
                href={item.href}
                role="menuitem"
                data-testid={item.testId}
                {...(item.newTab ? { target: '_blank', rel: 'noopener' } : {})}
                onClick={close}
                className={className}
              >
                {item.label}
              </a>
            </span>
          );
        }
        return (
          <span key={item.key} className="contents">
            {separator}
            <button type="button" role="menuitem" data-testid={item.testId} disabled={item.disabled} title={item.title} onClick={select(item)} className={className}>
              {item.label}
            </button>
          </span>
        );
      })}
    </div>
  );
};

interface RowMenuButtonProps {
  /** `aria-label` del botón ⋯ y del menú, p. ej. «Acciones para REQ-017». */
  readonly label: string;
  readonly buttonTestId: string;
  readonly menuTestId: string;
  readonly items: readonly MenuItemSpec[];
}

/** Botón ⋯ que abre el `ActionMenu` bajo sí mismo (patrón «Acciones para <código>»). */
export const RowMenuButton = ({ label, buttonTestId, menuTestId, items }: RowMenuButtonProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [point, setPoint] = useState<MenuPoint | null>(null);
  const close = useCallback(() => setPoint(null), []);

  const toggle = () => {
    if (point) return close();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPoint({ x: rect.right, y: rect.bottom + 4, align: 'right' });
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-testid={buttonTestId}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={point !== null}
        onClick={toggle}
        className="grid size-[26px] cursor-pointer place-items-center rounded-ctl border border-transparent bg-transparent text-fg-2 hover:border-border hover:bg-surface"
      >
        <DotsIcon size={14} />
      </button>
      {point ? <ActionMenu label={label} testId={menuTestId} items={items} point={point} onClose={close} returnFocus={buttonRef} /> : null}
    </>
  );
};
