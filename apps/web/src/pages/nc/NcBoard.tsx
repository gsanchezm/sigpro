import { NC_DYNAMIC_TESTIDS, NC_STATES, NC_STATE_TONE, NC_TESTIDS, PROGRAMAS_TESTIDS, groupByState, type NcDto, type NcState, type Role } from '@sigpro/shared';
import { useMemo, useState } from 'react';
import { useI18n } from '../../state/i18n';
import { NcCard } from './NcCard';
import { TONE_COLORS, dropHint, type DropHint } from './nc-view';
import { useNcLabels } from './useNcLabels';

interface NcBoardProps {
  readonly items: readonly NcDto[];
  readonly loading: boolean;
  readonly role: Role;
  readonly canMove: boolean;
  readonly plantedBugs: boolean;
  readonly onOpen: (code: string) => void;
  readonly onQuick: (code: string) => void;
  /** El tablero solo avisa del arrastre o del menú «Mover a…»; decide la página (cierre con diálogo, optimista, errores). */
  readonly onMove: (code: string, to: NcState) => void;
}

const SKELETON_CARDS = 2;

/**
 * Tablero kanban de cinco columnas con drag & drop HTML5 entre ellas. Mientras se arrastra, cada columna marca con
 * `data-valid` si la máquina de estados la admite; el servidor sigue decidiendo (un destino inválido responde 409).
 */
export const NcBoard = ({ items, loading, role, canMove, plantedBugs, onOpen, onQuick, onMove }: NcBoardProps) => {
  const { t } = useI18n();
  const labels = useNcLabels();
  const grouped = useMemo(() => groupByState(items), [items]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<NcState | null>(null);
  const source = dragging ? items.find((item) => item.code === dragging) : undefined;

  const endDrag = () => {
    setDragging(null);
    setOver(null);
  };

  const hintFor = (state: NcState): DropHint | undefined => (source ? dropHint(source.state, state) : undefined);

  return (
    <div
      role="group"
      aria-label={t('nc', 'board')}
      aria-busy={loading}
      data-testid={NC_TESTIDS.NC_BOARD}
      className="relative grid snap-x snap-mandatory auto-cols-[minmax(264px,82vw)] grid-flow-col gap-3 overflow-x-auto pb-2 sm:auto-cols-[minmax(212px,1fr)]"
    >
      {NC_STATES.map((state) => {
        const cards = grouped[state];
        const colors = TONE_COLORS[NC_STATE_TONE[state]];
        const stateLabel = labels.state(state);
        const dropTarget = over === state ? hintFor(state) : undefined;
        return (
          <section
            key={state}
            aria-labelledby={`nc-column-title-${state}`}
            data-testid={NC_DYNAMIC_TESTIDS.NC_COLUMN(state)}
            data-state={state}
            data-drop={dropTarget}
            data-valid={dragging ? hintFor(state) : undefined}
            onDragOver={(event) => {
              if (!canMove) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setOver(state);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver((current) => (current === state ? null : current));
            }}
            onDrop={(event) => {
              if (!canMove) return;
              event.preventDefault();
              // `dragging` puede no haberse pintado aún si el arrastre fue muy rápido: se lee también del DataTransfer
              const code = dragging ?? event.dataTransfer.getData('text/plain');
              endDrag();
              if (code) onMove(code, state);
            }}
            className="flex max-h-[calc(100vh-260px)] min-h-[200px] snap-start flex-col gap-2 rounded-[8px] border border-border bg-surface-2 p-2 transition-colors data-[drop=invalid]:border-danger data-[drop=invalid]:bg-danger-soft data-[drop=valid]:border-accent data-[drop=valid]:bg-accent-soft data-[valid=invalid]:opacity-70"
          >
            <h2 id={`nc-column-title-${state}`} className="m-0 flex flex-none items-center gap-2 px-1 pt-1 text-[12.5px] font-semibold">
              <span aria-hidden="true" className="size-2 flex-none rounded-full" style={{ background: colors.fg }} />
              {stateLabel}
              <span data-testid={NC_DYNAMIC_TESTIDS.NC_COLUMN_COUNT(state)} className="ml-auto rounded-full border border-border bg-surface px-2 font-mono text-[11px] font-medium text-fg-2">
                {loading && items.length === 0 ? '…' : cards.length}
              </span>
            </h2>

            {loading && items.length === 0 ? (
              <ul role="presentation" className="m-0 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-hidden p-0">
                {Array.from({ length: SKELETON_CARDS }, (_, index) => (
                  <li key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} className="skeleton h-[96px] w-full !rounded-[6px]" />
                ))}
              </ul>
            ) : (
              // La lista hace scroll dentro de la columna: así la columna entera cabe en la ventana y `dragTo` no desplaza la página
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                <ul aria-label={t('nc', 'columnCards', { state: stateLabel })} className="m-0 flex list-none flex-col gap-2 p-0">
                  {cards.map((nc) => (
                    <NcCard
                      key={nc.code}
                      nc={nc}
                      role={role}
                      canMove={canMove}
                      dragging={dragging === nc.code}
                      plantedBugs={plantedBugs}
                      onOpen={onOpen}
                      onQuick={onQuick}
                      onMove={onMove}
                      onDragStart={setDragging}
                      onDragEnd={endDrag}
                    />
                  ))}
                </ul>
                {cards.length === 0 ? (
                  <p data-testid={NC_DYNAMIC_TESTIDS.NC_COLUMN_EMPTY(state)} className="m-0 px-1 py-4 text-center text-[12px] text-fg-3">
                    {over === state ? t('nc', 'dropHint', { state: stateLabel }) : t('nc', 'columnEmpty')}
                  </p>
                ) : null}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
