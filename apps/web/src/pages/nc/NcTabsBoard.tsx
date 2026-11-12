import {
  NC_SEVERITY_TONE,
  NC_STATES,
  NC_STATE_TONE,
  PROGRAMAS_TESTIDS,
  RESPONSIVE_DYNAMIC_TESTIDS,
  RESPONSIVE_TESTIDS,
  canNcTransition,
  groupByState,
  ncNextStates,
  richTextToPlain,
  type NcDto,
  type NcState,
  type Role,
} from '@sigpro/shared';
import { useMemo, useState } from 'react';
import { useI18n } from '../../state/i18n';
import { ActionSheet, type SheetAction } from '../../ui/ActionSheet';
import { Avatar } from '../../ui/Avatar';
import { TONE_COLORS, commentBadgeCount, truncateText } from './nc-view';
import { useNcLabels } from './useNcLabels';

interface NcTabsBoardProps {
  readonly items: readonly NcDto[];
  readonly loading: boolean;
  readonly role: Role;
  readonly canMove: boolean;
  readonly plantedBugs: boolean;
  readonly onOpen: (code: string) => void;
  readonly onQuick: (code: string) => void;
  /** Igual que en el tablero de escritorio: avisa de la transición y decide la página (cierre con diálogo, errores…). */
  readonly onMove: (code: string, to: NcState) => void;
}

const SKELETON_CARDS = 2;

const CommentsIcon = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
  </svg>
);

interface CardProps {
  readonly nc: NcDto;
  readonly canMove: boolean;
  readonly plantedBugs: boolean;
  readonly onOpen: (code: string) => void;
  readonly onQuick: (code: string) => void;
  readonly onMoveSheet: (code: string) => void;
}

/** Tarjeta del DISEÑO RESPONSIVE: sin arrastre; el botón «Mover a…» abre una hoja con los estados de destino. */
const NcCardMobile = ({ nc, canMove, plantedBugs, onOpen, onQuick, onMoveSheet }: CardProps) => {
  const { t } = useI18n();
  const labels = useNcLabels();
  const colors = TONE_COLORS[NC_SEVERITY_TONE[nc.severity]];
  const comments = commentBadgeCount(nc.commentCount, plantedBugs);
  const commentsLabel = comments === 1 ? t('nc', 'commentsOne') : t('nc', 'comments', { count: comments });
  const hasTargets = ncNextStates(nc.state).length > 0;
  const moveDisabled = !canMove || !hasTargets;

  return (
    <li
      data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NC_CARD(nc.code)}
      data-severity={nc.severity}
      data-state={nc.state}
      className="flex flex-col gap-2 rounded-card border border-border bg-surface py-2.5 pr-2.5 pl-3 shadow-card"
      style={{ borderLeft: `4px solid ${colors.fg}` }}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NC_CARD_OPEN(nc.code)}
          aria-label={t('nc', 'openCard', { code: nc.code })}
          onClick={() => onOpen(nc.code)}
          className="min-h-11 cursor-pointer border-0 bg-transparent p-0 pr-2 font-mono text-[13px] font-semibold text-fg hover:underline"
        >
          {nc.code}
        </button>
        <span data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NC_CARD_SEVERITY(nc.code)} data-severity={nc.severity} data-tone={NC_SEVERITY_TONE[nc.severity]} className="badge badge-row">
          {labels.severity(nc.severity)}
        </span>
      </div>

      <p className="m-0 line-clamp-3 text-[13px] leading-[1.45] text-fg-2">{truncateText(richTextToPlain(nc.description), 140)}</p>

      <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
        <span className="font-mono whitespace-nowrap">{nc.programCode}</span>
        <span className="flex-1" />
        <span data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NC_CARD_COMMENTS(nc.code)} title={commentsLabel} className="flex flex-none items-center gap-1 font-mono">
          <CommentsIcon />
          <span aria-hidden="true">{comments}</span>
          <span className="sr-only">{commentsLabel}</span>
        </span>
      </div>

      <div data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NC_CARD_ASSIGNEE(nc.code)} className="flex min-w-0 items-center gap-1.5 text-[12px]">
        {nc.assigneeName ? (
          <>
            <Avatar name={nc.assigneeName} size={20} fontPx={9} shape="circle" />
            <span className="truncate text-fg-2">{nc.assigneeName}</span>
          </>
        ) : (
          <span className="text-fg-3">{t('nc', 'unassigned')}</span>
        )}
      </div>

      <div className="flex gap-2 border-t border-border pt-2">
        <button
          type="button"
          data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NC_CARD_QUICK(nc.code)}
          aria-label={t('nc', 'quickComment', { code: nc.code })}
          onClick={() => onQuick(nc.code)}
          className="btn btn-secondary flex-1 justify-center !h-10"
        >
          {t('nc', 'menuQuick')}
        </button>
        <button
          type="button"
          data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NC_CARD_MOVE(nc.code)}
          aria-label={t('nc', 'moveToCard', { code: nc.code })}
          aria-haspopup="dialog"
          disabled={moveDisabled}
          title={moveDisabled ? t('nc', canMove ? 'moveNone' : 'menuMoveDenied') : undefined}
          onClick={() => onMoveSheet(nc.code)}
          className="btn btn-primary flex-1 justify-center !h-10"
        >
          {t('nc', 'moveTo')}
        </button>
      </div>
    </li>
  );
};

/**
 * Tablero de NC del DISEÑO RESPONSIVE (< 1024 px): una pestaña por estado (solo se monta la lista del estado elegido) y,
 * en cada tarjeta, «Mover a…» en lugar de arrastrar. En escritorio se monta `NcBoard` (cinco columnas con drag & drop).
 */
export const NcTabsBoard = ({ items, loading, role, canMove, plantedBugs, onOpen, onQuick, onMove }: NcTabsBoardProps) => {
  const { t } = useI18n();
  const labels = useNcLabels();
  const grouped = useMemo(() => groupByState(items), [items]);
  const [tab, setTab] = useState<NcState>(NC_STATES[0]);
  const [moving, setMoving] = useState<string | null>(null);
  const movingNc = moving ? items.find((item) => item.code === moving) : undefined;
  const waiting = loading && items.length === 0;
  const cards = grouped[tab];
  const colors = TONE_COLORS[NC_STATE_TONE[tab]];

  const moveActions = (nc: NcDto): readonly SheetAction[] =>
    ncNextStates(nc.state).map((state) => {
      const allowed = canNcTransition(role, state);
      return {
        key: `move-${state}`,
        label: t('nc', 'menuMove', { state: labels.state(state) }),
        testId: RESPONSIVE_DYNAMIC_TESTIDS.NC_MENU_MOVE(state),
        disabled: !allowed,
        title: allowed ? undefined : t('nc', state === 'closed' ? 'closeDenied' : 'menuMoveDenied'),
        onSelect: () => onMove(nc.code, state),
      };
    });

  return (
    <div role="group" aria-label={t('nc', 'board')} aria-busy={loading} data-testid={RESPONSIVE_TESTIDS.NC_BOARD} className="flex flex-col gap-3">
      <div role="tablist" aria-label={t('nc', 'tabsLabel')} data-testid={RESPONSIVE_TESTIDS.NC_BOARD_TABS} className="flex gap-1 overflow-x-auto border-b border-border">
        {NC_STATES.map((state) => (
          <button
            key={state}
            type="button"
            role="tab"
            id={`nc-tab-${state}`}
            aria-selected={tab === state}
            aria-controls={`nc-tabpanel-${state}`}
            tabIndex={tab === state ? 0 : -1}
            data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NC_TAB(state)}
            data-state={state}
            onClick={() => setTab(state)}
            onKeyDown={(event) => {
              const index = NC_STATES.indexOf(state);
              const next = event.key === 'ArrowRight' ? NC_STATES[(index + 1) % NC_STATES.length] : event.key === 'ArrowLeft' ? NC_STATES[(index + NC_STATES.length - 1) % NC_STATES.length] : undefined;
              if (!next) return;
              event.preventDefault();
              setTab(next);
              document.getElementById(`nc-tab-${next}`)?.focus();
            }}
            className={`-mb-px flex min-h-11 flex-none cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent px-3 text-[13px] whitespace-nowrap ${
              tab === state ? 'border-accent font-medium text-fg' : 'border-transparent text-fg-2 hover:text-fg'
            }`}
          >
            {labels.state(state)}
            <span data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NC_COLUMN_COUNT(state)} className="rounded-full border border-border bg-surface px-2 font-mono text-[11px] font-medium text-fg-2">
              {waiting ? '…' : grouped[state].length}
            </span>
          </button>
        ))}
      </div>

      <section
        role="tabpanel"
        id={`nc-tabpanel-${tab}`}
        aria-labelledby={`nc-tab-${tab}`}
        data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NC_COLUMN(tab)}
        data-state={tab}
        className="flex flex-col gap-2 rounded-[8px] border border-border bg-surface-2 p-2"
      >
        <span aria-hidden="true" className="h-1 w-8 rounded-full" style={{ background: colors.fg }} />
        {waiting ? (
          <ul role="presentation" className="m-0 flex list-none flex-col gap-2 p-0">
            {Array.from({ length: SKELETON_CARDS }, (_, index) => (
              <li key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} className="skeleton h-[96px] w-full !rounded-card" />
            ))}
          </ul>
        ) : cards.length === 0 ? (
          <p data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NC_COLUMN_EMPTY(tab)} className="m-0 px-1 py-4 text-center text-[12px] text-fg-3">
            {t('nc', 'columnEmpty')}
          </p>
        ) : (
          <ul aria-label={t('nc', 'columnCards', { state: labels.state(tab) })} className="m-0 flex list-none flex-col gap-2 p-0">
            {cards.map((nc) => (
              <NcCardMobile key={nc.code} nc={nc} canMove={canMove} plantedBugs={plantedBugs} onOpen={onOpen} onQuick={onQuick} onMoveSheet={setMoving} />
            ))}
          </ul>
        )}
      </section>

      {movingNc ? (
        <ActionSheet
          title={t('nc', 'moveSheetTitle', { code: movingNc.code })}
          testId={RESPONSIVE_TESTIDS.NC_MENU}
          closeTestId={RESPONSIVE_TESTIDS.NC_MENU_CLOSE}
          closeLabel={t('nc', 'moveClose')}
          actions={moveActions(movingNc)}
          onClose={() => setMoving(null)}
        />
      ) : null}
    </div>
  );
};
