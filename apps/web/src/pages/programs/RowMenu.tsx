import { PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS, can, permissionDeniedReason, type ProgramDto, type Role } from '@sigpro/shared';
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useDismiss } from '../../lib/hooks';
import { useI18n } from '../../state/i18n';
import { DotsIcon } from '../../ui/icons';

interface RowMenuProps {
  readonly program: ProgramDto;
  readonly role: Role;
  readonly onEdit: (program: ProgramDto) => void;
  readonly onDuplicate: (program: ProgramDto) => void;
  readonly onArchive: (program: ProgramDto) => void;
  readonly onDelete: (program: ProgramDto) => void;
}

const MENU_WIDTH = 190;

/** Menú ⋯ de fila: se posiciona con `position: fixed` para que el scroll de la tabla no lo recorte. */
export const RowMenu = ({ program, role, onEdit, onDuplicate, onArchive, onDelete }: RowMenuProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, [buttonRef, menuRef], close);

  // Coloca el menú bajo el botón (o encima si no cabe) y alineado a su borde derecho
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchor = buttonRef.current?.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 190;
    if (!anchor) return;
    const below = anchor.bottom + 4;
    const top = below + height > window.innerHeight ? Math.max(8, anchor.top - 4 - height) : below;
    setPosition({ top, left: Math.max(8, anchor.right - MENU_WIDTH) });
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => setOpen(false);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(items.length - 1);
    else if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'Tab') setOpen(false);
  };

  const run = (action: (program: ProgramDto) => void) => () => {
    setOpen(false);
    action(program);
  };

  const item = (permission: Parameters<typeof can>[1]) => ({
    disabled: !can(role, permission),
    title: can(role, permission) ? undefined : t('programas', permissionDeniedReason(permission)),
  });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-testid={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW_MENU(program.code)}
        aria-label={t('common', 'actionsFor', { code: program.code })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="grid size-[26px] cursor-pointer place-items-center rounded-[4px] border border-transparent bg-transparent text-fg-2 hover:border-border hover:bg-surface"
      >
        <DotsIcon size={14} />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          aria-label={t('common', 'actionsFor', { code: program.code })}
          data-testid={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU}
          onKeyDown={onKeyDown}
          className="popover fixed z-30 flex flex-col"
          style={{ width: MENU_WIDTH, top: position?.top ?? -9999, left: position?.left ?? -9999 }}
        >
          <Link to={`/programs/${program.code}`} role="menuitem" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU_VIEW} onClick={close} className="menu-item !text-fg no-underline">
            {t('programas', 'viewDetail')}
          </Link>
          <button type="button" role="menuitem" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU_EDIT} {...item('program.edit')} onClick={run(onEdit)} className="menu-item">
            {t('programas', 'edit')}
          </button>
          <button type="button" role="menuitem" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU_DUPLICATE} {...item('program.create')} onClick={run(onDuplicate)} className="menu-item">
            {t('programas', 'duplicate')}
          </button>
          <button type="button" role="menuitem" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU_ARCHIVE} {...item('program.archive')} onClick={run(onArchive)} className="menu-item">
            {t('programas', 'archive')}
          </button>
          <div role="separator" className="menu-sep" />
          <button
            type="button"
            role="menuitem"
            data-testid={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU_DELETE}
            {...item('program.delete')}
            onClick={run(onDelete)}
            className="menu-item !text-danger hover:!bg-danger-soft"
          >
            {t('programas', 'delete')}
          </button>
        </div>
      ) : null}
    </>
  );
};
