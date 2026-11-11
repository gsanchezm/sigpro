import { NC_DYNAMIC_TESTIDS, NC_SEVERITY_TONE, NC_TESTIDS, ncNextStates, canNcTransition, richTextToPlain, type NcDto, type NcState, type Role } from '@sigpro/shared';
import { useI18n } from '../../state/i18n';
import { Avatar } from '../../ui/Avatar';
import { RowMenuButton, type MenuItemSpec } from '../../ui/ActionMenu';
import { TONE_COLORS, commentBadgeCount, truncateText } from './nc-view';
import { useNcLabels } from './useNcLabels';

const QuickCommentIcon = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
    <path d="M5.5 6.5h5" />
  </svg>
);

const CommentsIcon = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
  </svg>
);

interface NcCardProps {
  readonly nc: NcDto;
  readonly role: Role;
  /** `can(role, 'nc.transition')`: sin permiso la tarjeta no se arrastra. */
  readonly canMove: boolean;
  readonly dragging: boolean;
  readonly plantedBugs: boolean;
  readonly onOpen: (code: string) => void;
  readonly onQuick: (code: string) => void;
  readonly onMove: (code: string, to: NcState) => void;
  readonly onDragStart: (code: string) => void;
  readonly onDragEnd: () => void;
}

/** Tarjeta del tablero: severidad por color (borde y badge con `data-severity`), asignado, comentarios y acciones. */
export const NcCard = ({ nc, role, canMove, dragging, plantedBugs, onOpen, onQuick, onMove, onDragStart, onDragEnd }: NcCardProps) => {
  const { t } = useI18n();
  const labels = useNcLabels();
  const colors = TONE_COLORS[NC_SEVERITY_TONE[nc.severity]];
  const comments = commentBadgeCount(nc.commentCount, plantedBugs);
  const commentsLabel = comments === 1 ? t('nc', 'commentsOne') : t('nc', 'comments', { count: comments });

  // «Mover a…» es la alternativa de teclado al arrastre: solo los estados que la máquina permite desde el actual
  const moves: readonly MenuItemSpec[] = ncNextStates(nc.state).map((state, index) => {
    const allowed = canNcTransition(role, state);
    return {
      key: `move-${state}`,
      label: t('nc', 'menuMove', { state: labels.state(state) }),
      testId: NC_DYNAMIC_TESTIDS.NC_MENU_MOVE(state),
      disabled: !allowed,
      title: allowed ? undefined : t('nc', state === 'closed' ? 'closeDenied' : 'menuMoveDenied'),
      separatorBefore: index === 0,
      onSelect: () => onMove(nc.code, state),
    };
  });
  const items: readonly MenuItemSpec[] = [
    { key: 'open', label: t('nc', 'menuOpen'), testId: NC_TESTIDS.NC_MENU_OPEN, onSelect: () => onOpen(nc.code) },
    { key: 'quick', label: t('nc', 'menuQuick'), testId: NC_TESTIDS.NC_MENU_QUICK, onSelect: () => onQuick(nc.code) },
    ...moves,
  ];

  return (
    // El clic en la tarjeta es una comodidad para el ratón: el teclado abre el detalle con el botón del código
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <li
      data-testid={NC_DYNAMIC_TESTIDS.NC_CARD(nc.code)}
      data-severity={nc.severity}
      data-state={nc.state}
      data-dragging={dragging}
      draggable={canMove}
      title={canMove ? undefined : t('nc', 'dragDenied')}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', nc.code);
        onDragStart(nc.code);
      }}
      onDragEnd={onDragEnd}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button, a, img')) onOpen(nc.code);
      }}
      className={`flex flex-col gap-2 rounded-card border border-border bg-surface py-2.5 pr-2.5 pl-3 shadow-card data-[dragging=true]:opacity-40 ${canMove ? 'cursor-grab' : 'cursor-default'}`}
      style={{ borderLeft: `4px solid ${colors.fg}` }}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid={NC_DYNAMIC_TESTIDS.NC_CARD_OPEN(nc.code)}
          aria-label={t('nc', 'openCard', { code: nc.code })}
          onClick={() => onOpen(nc.code)}
          className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[12px] font-semibold text-fg hover:underline"
        >
          {nc.code}
        </button>
        <span
          data-testid={NC_DYNAMIC_TESTIDS.NC_CARD_SEVERITY(nc.code)}
          data-severity={nc.severity}
          data-tone={NC_SEVERITY_TONE[nc.severity]}
          className="badge badge-row"
        >
          {labels.severity(nc.severity)}
        </span>
        <span className="flex-1" />
        <RowMenuButton
          label={t('nc', 'cardActions', { code: nc.code })}
          buttonTestId={NC_DYNAMIC_TESTIDS.NC_CARD_MENU(nc.code)}
          menuTestId={NC_TESTIDS.NC_MENU}
          items={items}
        />
      </div>

      <p className="m-0 line-clamp-2 text-[12.5px] leading-[1.45] text-fg-2">{truncateText(richTextToPlain(nc.description), 110)}</p>

      <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
        <span className="font-mono whitespace-nowrap">{nc.programCode}</span>
        <span className="flex-1" />
        <span data-testid={NC_DYNAMIC_TESTIDS.NC_CARD_COMMENTS(nc.code)} title={commentsLabel} className="flex flex-none items-center gap-1 font-mono">
          <CommentsIcon />
          <span aria-hidden="true">{comments}</span>
          <span className="sr-only">{commentsLabel}</span>
        </span>
        <button
          type="button"
          data-testid={NC_DYNAMIC_TESTIDS.NC_CARD_QUICK(nc.code)}
          aria-label={t('nc', 'quickComment', { code: nc.code })}
          title={t('nc', 'quickComment', { code: nc.code })}
          onClick={() => onQuick(nc.code)}
          className="grid size-[26px] flex-none cursor-pointer place-items-center rounded-ctl border border-transparent bg-transparent text-fg-2 hover:border-border hover:bg-surface-2"
        >
          <QuickCommentIcon />
        </button>
      </div>

      <div data-testid={NC_DYNAMIC_TESTIDS.NC_CARD_ASSIGNEE(nc.code)} className="flex min-w-0 items-center gap-1.5 text-[11.5px]">
        {nc.assigneeName ? (
          <>
            <Avatar name={nc.assigneeName} size={20} fontPx={9} shape="circle" />
            <span className="truncate text-fg-2">{nc.assigneeName}</span>
          </>
        ) : (
          <span className="text-fg-3">{t('nc', 'unassigned')}</span>
        )}
      </div>
    </li>
  );
};
