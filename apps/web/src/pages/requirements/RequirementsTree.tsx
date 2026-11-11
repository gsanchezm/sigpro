import {
  REQUISITOS_DYNAMIC_TESTIDS,
  REQUISITOS_TESTIDS,
  REQUIREMENT_STATE_TONE,
  can,
  siblingsOf,
  stepTarget,
  type MessageKey,
  type Placement,
  type RequirementDto,
  type Role,
  type VisibleRow,
} from '@sigpro/shared';
import { useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { useI18n } from '../../state/i18n';
import type { MenuPoint } from '../../ui/ActionMenu';
import { ChevronIcon, DotsIcon } from '../../ui/icons';
import { ToneBadge } from '../../ui/ToneBadge';

interface RequirementsTreeProps {
  readonly rows: readonly VisibleRow<RequirementDto>[];
  /** Todos los requisitos del programa (para conocer el orden de los hermanos). */
  readonly items: readonly RequirementDto[];
  readonly selected: string | null;
  readonly renaming: string | null;
  readonly menuFor: string | null;
  readonly role: Role;
  readonly mobile: boolean;
  readonly label: string;
  readonly onToggle: (code: string) => void;
  readonly onOpen: (code: string) => void;
  readonly onRenameStart: (code: string) => void;
  /** Devuelve la clave i18n del error (para dejar la edición abierta) o `null` si se guardó. */
  readonly onRenameCommit: (code: string, title: string) => Promise<string | null>;
  readonly onRenameCancel: () => void;
  readonly onCopy: (code: string) => void;
  readonly onMove: (code: string, target: string, placement: Placement) => void;
  readonly onMenu: (code: string, point: MenuPoint) => void;
}

interface DropHint {
  readonly code: string;
  readonly placement: Placement;
}

/** Título editable en línea: Enter guarda, Esc cancela, salir del campo cancela (no se guarda nada por accidente). */
const InlineTitle = ({ requirement, onCommit, onCancel }: { requirement: RequirementDto; onCommit: RequirementsTreeProps['onRenameCommit']; onCancel: () => void }) => {
  const { t } = useI18n();
  const [value, setValue] = useState(requirement.title);
  const [error, setError] = useState<string | null>(null);
  const message = error ? t('requisitos', error as MessageKey<'requisitos'>) : undefined;

  return (
    <input
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      data-testid={REQUISITOS_TESTIDS.REQUIREMENT_INLINE_INPUT}
      aria-label={t('requisitos', 'inlineLabel', { code: requirement.code })}
      aria-invalid={error ? true : undefined}
      title={message}
      value={value}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        setValue(event.target.value);
        setError(null);
      }}
      onBlur={onCancel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          void onCommit(requirement.code, value).then(setError);
        }
      }}
      className={`input !h-7 min-w-0 flex-1 !bg-surface ${error ? '!border-danger' : ''}`}
    />
  );
};

/** Árbol `role="tree"`: filas `treeitem` con teclado (flechas, Enter, F2, Alt+↑↓), arrastrar y soltar, menú contextual y edición en línea. */
export const RequirementsTree = ({
  rows,
  items,
  selected,
  renaming,
  menuFor,
  role,
  mobile,
  label,
  onToggle,
  onOpen,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onCopy,
  onMove,
  onMenu,
}: RequirementsTreeProps) => {
  const { t } = useI18n();
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropHint | null>(null);
  const canEdit = can(role, 'requirement.edit');
  const rovingCode = rows.some((row) => row.item.code === focusCode) ? focusCode : (rows[0]?.item.code ?? null);

  const focusRow = (code: string | undefined) => {
    if (!code) return;
    setFocusCode(code);
    requestAnimationFrame(() => rowRefs.current.get(code)?.focus());
  };

  const siblingOrder = (parentCode: string | null): readonly string[] => siblingsOf(items, parentCode).map((item) => item.code);

  const placementFor = (event: DragEvent<HTMLLIElement>, source: RequirementDto, target: RequirementDto): Placement => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
    if (ratio < 0.25) return 'before';
    if (ratio > 0.75) return 'after';
    // En la zona central, soltar sobre una fila ocupa su sitio: hacia abajo va detrás; hacia arriba, delante
    const order = siblingOrder(target.parentCode);
    return order.indexOf(source.code) < order.indexOf(target.code) ? 'after' : 'before';
  };

  const byCode = new Map(items.map((item) => [item.code, item]));

  const menuAtRow = (code: string): void => {
    const rect = rowRefs.current.get(code)?.getBoundingClientRect();
    if (rect) onMenu(code, { x: rect.left + 48, y: rect.bottom, align: 'left' });
  };

  const onRowKeyDown = (event: KeyboardEvent<HTMLLIElement>, row: VisibleRow<RequirementDto>, index: number) => {
    // Las teclas de las filas no deben secuestrar las de los botones o el campo de edición que contiene
    if (event.target !== event.currentTarget) return;
    const { code, parentCode } = row.item;

    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const next = canEdit ? stepTarget(siblingOrder(parentCode), code, event.key === 'ArrowUp' ? -1 : 1) : null;
      if (next) onMove(code, next.target, next.placement);
      return;
    }
    if (event.key === 'F10' && event.shiftKey) {
      event.preventDefault();
      menuAtRow(code);
      return;
    }

    const actions: Readonly<Record<string, () => void>> = {
      ArrowDown: () => focusRow(rows[index + 1]?.item.code),
      ArrowUp: () => focusRow(rows[index - 1]?.item.code),
      Home: () => focusRow(rows[0]?.item.code),
      End: () => focusRow(rows[rows.length - 1]?.item.code),
      ArrowRight: () => (row.hasChildren ? (row.expanded ? focusRow(rows[index + 1]?.item.code) : onToggle(code)) : undefined),
      ArrowLeft: () => (row.hasChildren && row.expanded ? onToggle(code) : focusRow(parentCode ?? undefined)),
      Enter: () => onOpen(code),
      F2: () => (canEdit ? onRenameStart(code) : undefined),
      ContextMenu: () => menuAtRow(code),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const endDrag = () => {
    setDragging(null);
    setDrop(null);
  };

  const onDragOver = (event: DragEvent<HTMLLIElement>, target: RequirementDto) => {
    const source = dragging ? byCode.get(dragging) : undefined;
    // Solo entre hermanos (mismo padre): otro destino no acepta la caída
    if (!source || source.code === target.code || source.parentCode !== target.parentCode) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const placement = placementFor(event, source, target);
    setDrop((current) => (current?.code === target.code && current.placement === placement ? current : { code: target.code, placement }));
  };

  const onDrop = (event: DragEvent<HTMLLIElement>, target: RequirementDto) => {
    event.preventDefault();
    if (dragging && drop?.code === target.code) onMove(dragging, target.code, drop.placement);
    endDrag();
  };

  const openContextMenu = (event: MouseEvent<HTMLLIElement>, code: string) => {
    event.preventDefault();
    onMenu(code, { x: event.clientX, y: event.clientY, align: 'left' });
  };

  const stateLabels: Readonly<Record<RequirementDto['state'], string>> = {
    draft: t('requisitos', 'st_draft'),
    approved: t('requisitos', 'st_approved'),
    verified: t('requisitos', 'st_verified'),
    validated: t('requisitos', 'st_validated'),
  };

  return (
    <ul role="tree" aria-label={label} data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_TREE} className="m-0 flex list-none flex-col p-0">
      {rows.map((row, index) => {
        const { item } = row;
        const isRenaming = renaming === item.code;
        const tagLabels = item.tags.map((tag) => t('requisitos', `tag_${tag}`));
        return (
          <li
            key={item.code}
            ref={(element) => {
              if (element) rowRefs.current.set(item.code, element);
              else rowRefs.current.delete(item.code);
            }}
            role="treeitem"
            aria-label={`${item.code} ${item.title}`}
            aria-level={row.depth + 1}
            aria-posinset={row.posInSet}
            aria-setsize={row.setSize}
            aria-expanded={row.hasChildren ? row.expanded : undefined}
            aria-selected={selected === item.code}
            tabIndex={rovingCode === item.code ? 0 : -1}
            draggable={canEdit && !isRenaming}
            data-testid={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW(item.code)}
            data-state={item.state}
            data-priority={item.priority}
            data-dragging={dragging === item.code}
            data-drop={drop?.code === item.code ? drop.placement : undefined}
            className="tree-row border-b border-border outline-none last:border-b-0 hover:bg-surface-2"
            onFocus={(event) => event.target === event.currentTarget && setFocusCode(item.code)}
            onKeyDown={(event) => onRowKeyDown(event, row, index)}
            onClick={(event) => {
              if (!(event.target as HTMLElement).closest('button, input, a')) onOpen(item.code);
            }}
            onContextMenu={(event) => openContextMenu(event, item.code)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', item.code);
              setDragging(item.code);
            }}
            onDragOver={(event) => onDragOver(event, item)}
            onDrop={(event) => onDrop(event, item)}
            onDragEnd={endDrag}
          >
            <div className={`flex items-center gap-2 py-1.5 pr-2 ${mobile ? 'flex-wrap' : ''}`} style={{ paddingLeft: 8 + row.depth * 20 }}>
              <span
                role="img"
                aria-label={t('requisitos', 'dragHandle', { code: item.code })}
                data-testid={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_HANDLE(item.code)}
                title={canEdit ? t('requisitos', 'dragHandle', { code: item.code }) : t('requisitos', 'roleNoEdit')}
                className={`flex-none select-none text-[12px] leading-none ${canEdit ? 'cursor-grab text-fg-3' : 'cursor-not-allowed text-border-strong'}`}
              >
                ⋮⋮
              </span>
              {row.hasChildren ? (
                <button
                  type="button"
                  data-testid={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TOGGLE(item.code)}
                  aria-label={t('requisitos', row.expanded ? 'collapse' : 'expand', { code: item.code })}
                  onClick={() => onToggle(item.code)}
                  className="grid size-6 flex-none cursor-pointer place-items-center rounded-ctl-sm border-0 bg-transparent text-fg-2 hover:bg-border"
                >
                  <ChevronIcon size={12} style={{ transform: row.expanded ? 'none' : 'rotate(-90deg)' }} />
                </button>
              ) : (
                <span aria-hidden="true" className="size-6 flex-none" />
              )}
              <span className="flex flex-none items-center gap-1 font-mono text-[12px] font-medium text-fg-2">
                {item.code}
                <button
                  type="button"
                  data-testid={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW_COPY(item.code)}
                  aria-label={t('requisitos', 'copyCode', { code: item.code })}
                  title={t('requisitos', 'copyCode', { code: item.code })}
                  onClick={() => onCopy(item.code)}
                  className="grid size-5 cursor-pointer place-items-center rounded-ctl-sm border-0 bg-transparent text-[11px] text-fg-3 hover:bg-border"
                >
                  ⧉
                </button>
              </span>
              <div className={`flex min-w-0 items-center ${mobile ? 'order-last basis-full pl-8' : 'flex-1'}`}>
                {isRenaming ? (
                  <InlineTitle requirement={item} onCommit={onRenameCommit} onCancel={onRenameCancel} />
                ) : (
                  <button
                    type="button"
                    data-testid={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_OPEN(item.code)}
                    title={canEdit ? `${item.title} · ${t('requisitos', 'inlineHint')}` : item.title}
                    onClick={() => onOpen(item.code)}
                    onDoubleClick={() => canEdit && onRenameStart(item.code)}
                    className="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[13px] text-fg"
                  >
                    {item.title}
                  </button>
                )}
              </div>
              {!mobile && tagLabels.length > 0 ? (
                <span className="flex flex-none gap-1">
                  {item.tags.slice(0, 2).map((tag, tagIndex) => (
                    <span key={tag} data-tag={tag} className="rounded-full border border-border bg-surface-2 px-2 text-[11px] text-fg-2">
                      {tagLabels[tagIndex]}
                    </span>
                  ))}
                  {item.tags.length > 2 ? <span className="px-1 text-[11px] text-fg-3">+{item.tags.length - 2}</span> : null}
                </span>
              ) : null}
              <ToneBadge state={item.state} tone={REQUIREMENT_STATE_TONE[item.state]} label={stateLabels[item.state]} testId={REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE} />
              <button
                type="button"
                data-testid={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW_MENU(item.code)}
                aria-label={t('requisitos', 'rowActions', { code: item.code })}
                aria-haspopup="menu"
                aria-expanded={menuFor === item.code}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  onMenu(item.code, { x: rect.right, y: rect.bottom + 4, align: 'right' });
                }}
                className="grid size-[26px] flex-none cursor-pointer place-items-center rounded-ctl border border-transparent bg-transparent text-fg-2 hover:border-border hover:bg-surface"
              >
                <DotsIcon size={14} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
