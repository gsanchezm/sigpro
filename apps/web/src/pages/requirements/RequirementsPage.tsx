import {
  ApiError,
  DETALLE_TESTIDS,
  PROGRAMAS_TESTIDS,
  REQUIREMENTS_CSV_FILENAME,
  REQUISITOS_TESTIDS,
  buildTree,
  can,
  descendantCodes,
  flattenIssues,
  moveInOrder,
  parentCodes,
  requirementsToCsv,
  siblingsOf,
  stepTarget,
  updateRequirementSchema,
  visibleRows,
  withAncestors,
  type CreateRequirementInput,
  type Placement,
  type RequirementDto,
  type RequirementState,
  type UpdateRequirementInput,
} from '@sigpro/shared';
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { copyText } from '../../lib/clipboard';
import { downloadCsv } from '../../lib/download';
import { formatTrace } from '../../lib/errors';
import { useBreakpoint, useDelayedFlag } from '../../lib/hooks';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { ActionMenu, type MenuItemSpec, type MenuPoint } from '../../ui/ActionMenu';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { DownloadIcon, SearchIcon } from '../../ui/icons';
import { NewRequirementDialog } from './NewRequirementDialog';
import { RequirementDetail } from './RequirementDetail';
import { RequirementsTree } from './RequirementsTree';
import { TraceabilityMatrix } from './TraceabilityMatrix';
import { useProgramOptions, useRequirementsData } from './useRequirementsData';

type Tab = 'tree' | 'matrix';
const TABS: readonly Tab[] = ['tree', 'matrix'];
const NO_CODES: ReadonlySet<string> = new Set();
const SKELETON_DELAY_MS = 250;

const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  const tag = element?.tagName?.toLowerCase() ?? '';
  return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(element?.isContentEditable);
};

/** Requisitos de un programa: árbol colapsable con estados, edición, etiquetas, reordenación y matriz de trazabilidad. */
export const RequirementsPage = () => {
  const { code: programCode = '' } = useParams();
  const { t } = useI18n();
  const { user, api } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const breakpoint = useBreakpoint();
  const mobile = breakpoint === 'mobile';
  const sideBySide = breakpoint === 'desktop';
  const role = user?.role ?? 'consultant';
  const canCreate = can(role, 'requirement.create');
  const canEdit = can(role, 'requirement.edit');
  const canDelete = can(role, 'requirement.delete');

  const { status, data, error, reload, replaceItems } = useRequirementsData(programCode);
  const programs = useProgramOptions();
  const [tab, setTab] = useState<Tab>('tree');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(NO_CODES);
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ code: string; point: MenuPoint } | null>(null);
  const [newFor, setNewFor] = useState<{ parentCode: string | null } | null>(null);
  const [transition, setTransition] = useState<{ code: string; to: RequirementState } | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const items = useMemo(() => data?.items ?? [], [data]);
  const loading = status === 'loading';
  const slow = useDelayedFlag(loading, SKELETON_DELAY_MS);
  const showSkeleton = loading && (data === null || slow);
  const selectedItem = items.find((item) => item.code === selected) ?? null;
  const parents = useMemo(() => parentCodes(items), [items]);

  // Al cambiar de programa se limpia todo el estado de pantalla
  useEffect(() => {
    setSelected(null);
    setRenaming(null);
    setQuery('');
    setCollapsed(NO_CODES);
    setMenu(null);
    setTab('tree');
  }, [programCode]);

  // `?select=REQ-017` (enlace desde Verificación) abre el detalle de ese requisito una vez cargada la lista
  useEffect(() => {
    const wanted = searchParams.get('select');
    if (!wanted || !items.some((item) => item.code === wanted)) return;
    setSelected(wanted);
    setSearchParams({}, { replace: true });
  }, [items, searchParams, setSearchParams]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (needle ? withAncestors(items, (item) => item.code.toLowerCase().includes(needle) || item.title.toLowerCase().includes(needle)) : items),
    [items, needle],
  );
  // Con un filtro activo se despliega todo para ver las coincidencias
  const rows = useMemo(() => visibleRows(buildTree(filtered), needle ? NO_CODES : collapsed), [filtered, needle, collapsed]);

  const fail = useCallback((failure: unknown) => toast.push('danger', t('common', 'genericError'), formatTrace(failure) || t('common', 'networkError')), [toast, t]);
  const applyUpdated = (updated: RequirementDto) => replaceItems(items.map((item) => (item.code === updated.code ? updated : item)));

  const copyCode = async (code: string) => {
    const copied = await copyText(code);
    if (copied) toast.push('info', t('requisitos', 'copiedTitle'), t('requisitos', 'copiedBody', { code }));
    else toast.push('danger', t('requisitos', 'copyFailed'));
  };

  const save = async (code: string, changes: UpdateRequirementInput) => {
    const before = items.find((item) => item.code === code);
    const updated = await api.requirements.update(code, changes);
    applyUpdated(updated);
    const reverted = before !== undefined && before.state !== 'draft' && updated.state === 'draft';
    toast.push('ok', t('requisitos', 'saved'), t('requisitos', reverted ? 'revertedBody' : 'savedBody', { code }));
  };

  const commitRename = async (code: string, title: string): Promise<string | null> => {
    const current = items.find((item) => item.code === code);
    if (!current || title === current.title) {
      setRenaming(null);
      return null;
    }
    const parsed = updateRequirementSchema.safeParse({ title });
    if (!parsed.success) return flattenIssues(parsed.error.issues).title ?? 'titleShort';
    try {
      await save(code, parsed.data);
      setRenaming(null);
      return null;
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 422) return Object.values(failure.body.errors ?? {})[0] ?? 'titleShort';
      fail(failure);
      return null;
    }
  };

  /** Reordena entre hermanos con vista optimista; si la API falla se recarga el orden real. */
  const move = async (code: string, target: string, placement: Placement) => {
    const current = items.find((item) => item.code === code);
    if (!current) return;
    const order = siblingsOf(items, current.parentCode).map((item) => item.code);
    const next = moveInOrder(order, code, target, placement);
    if (!next) return;
    replaceItems(items.map((item) => (next.includes(item.code) ? { ...item, position: next.indexOf(item.code) } : item)));
    try {
      const response = await api.requirements.move(code, { targetCode: target, placement });
      replaceItems(response.items);
      toast.push('ok', t('requisitos', 'moved'), t('requisitos', 'movedBody', { code }));
    } catch (failure) {
      reload();
      fail(failure);
    }
  };

  const create = async (input: CreateRequirementInput) => {
    const created = await api.requirements.create(input);
    setNewFor(null);
    setTab('tree');
    setQuery('');
    // El nuevo requisito debe verse: se despliegan sus ancestros y se abre su detalle
    const ancestors = new Set<string>();
    for (let parent = created.parentCode; parent; parent = items.find((item) => item.code === parent)?.parentCode ?? null) ancestors.add(parent);
    setCollapsed((current) => new Set([...current].filter((code) => !ancestors.has(code))));
    replaceItems([...items, created]);
    setSelected(created.code);
    toast.push('ok', t('requisitos', 'createdTitle'), t('requisitos', 'createdBody', { code: created.code }));
    reload();
  };

  const confirmTransition = async () => {
    if (!transition) return;
    setTransitionBusy(true);
    setTransitionError(null);
    try {
      const updated = await api.requirements.transition(transition.code, transition.to);
      applyUpdated(updated);
      toast.push('ok', t('requisitos', 'transitioned'), t('requisitos', 'transitionedBody', { code: updated.code, state: t('requisitos', `st_${updated.state}`) }));
      setTransition(null);
    } catch (failure) {
      setTransitionError(formatTrace(failure) || t('common', 'genericError'));
    } finally {
      setTransitionBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.requirements.remove(deleting);
      toast.push('ok', t('requisitos', 'deleted'), t('requisitos', 'deletedBody', { code: deleting }));
      if (selected === deleting) setSelected(null);
      setDeleting(null);
      reload();
    } catch (failure) {
      fail(failure);
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const toggle = (code: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(code)) next.add(code);
      return next;
    });

  // Atajos: N nuevo requisito · / buscar · Esc cierra el detalle (los diálogos y menús gestionan su propio Esc)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || newFor || transition || deleting || menu) return;
      if (event.key === 'Escape') {
        // En un campo, el primer Esc solo sale de él; el siguiente cierra el detalle
        if (isTypingTarget(event.target)) (event.target as HTMLElement).blur();
        else if (selected && !renaming) setSelected(null);
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === '/') {
        event.preventDefault();
        document.querySelector<HTMLElement>(`[data-testid="${REQUISITOS_TESTIDS.REQUIREMENTS_SEARCH}"]`)?.focus();
      } else if (event.key.toLowerCase() === 'n' && canCreate && data) {
        event.preventDefault();
        setNewFor({ parentCode: null });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canCreate, data, newFor, transition, deleting, menu, selected, renaming]);

  const closeMenu = useCallback(() => setMenu(null), []);

  const menuItems = (code: string): readonly MenuItemSpec[] => {
    const item = items.find((candidate) => candidate.code === code);
    if (!item) return [];
    const order = siblingsOf(items, item.parentCode).map((sibling) => sibling.code);
    const up = stepTarget(order, code, -1);
    const down = stepTarget(order, code, 1);
    const editTitle = canEdit ? undefined : t('requisitos', 'roleNoEdit');
    return [
      { key: 'open', label: t('requisitos', 'menuOpen'), testId: REQUISITOS_TESTIDS.REQUIREMENT_MENU_OPEN, onSelect: () => setSelected(code) },
      { key: 'rename', label: t('requisitos', 'menuRename'), testId: REQUISITOS_TESTIDS.REQUIREMENT_MENU_RENAME, disabled: !canEdit, title: editTitle, onSelect: () => setRenaming(code) },
      {
        key: 'child',
        label: t('requisitos', 'menuAddChild'),
        testId: REQUISITOS_TESTIDS.REQUIREMENT_MENU_ADD_CHILD,
        disabled: !canCreate,
        title: canCreate ? undefined : t('requisitos', 'roleNoCreate'),
        onSelect: () => setNewFor({ parentCode: code }),
      },
      { key: 'copy', label: t('requisitos', 'menuCopy'), testId: REQUISITOS_TESTIDS.REQUIREMENT_MENU_COPY, onSelect: () => void copyCode(code) },
      {
        key: 'up',
        label: t('requisitos', 'menuMoveUp'),
        testId: REQUISITOS_TESTIDS.REQUIREMENT_MENU_MOVE_UP,
        separatorBefore: true,
        disabled: !canEdit || !up,
        title: editTitle ?? (up ? undefined : t('requisitos', 'atTop')),
        onSelect: () => up && void move(code, up.target, up.placement),
      },
      {
        key: 'down',
        label: t('requisitos', 'menuMoveDown'),
        testId: REQUISITOS_TESTIDS.REQUIREMENT_MENU_MOVE_DOWN,
        disabled: !canEdit || !down,
        title: editTitle ?? (down ? undefined : t('requisitos', 'atBottom')),
        onSelect: () => down && void move(code, down.target, down.placement),
      },
      {
        key: 'delete',
        label: t('requisitos', 'menuDelete'),
        testId: REQUISITOS_TESTIDS.REQUIREMENT_MENU_DELETE,
        separatorBefore: true,
        danger: true,
        disabled: !canDelete,
        title: canDelete ? undefined : t('requisitos', 'roleNoDelete'),
        onSelect: () => setDeleting(code),
      },
    ];
  };

  if (status === 'error' && error instanceof ApiError && error.status === 404) {
    return (
      <section role="alert" data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_NOT_FOUND} className="alert alert-danger flex max-w-[560px] flex-col gap-1">
        <h1 className="m-0 text-[16px] font-semibold">{t('requisitos', 'programNotFound')}</h1>
        <span className="trace">{formatTrace(error)}</span>
        <Link to="/programs" data-testid={DETALLE_TESTIDS.PROGRAM_DETAIL_BACK} className="mt-1 self-start text-[12.5px] font-medium">
          {t('common', 'backToPrograms')}
        </Link>
      </section>
    );
  }

  const programName = data?.program.name ?? '';
  const isEmpty = !loading && status === 'ready' && items.length === 0;
  const noMatch = !loading && items.length > 0 && filtered.length === 0;
  const stateOf = (code: string) => items.find((item) => item.code === code)?.state;
  const transitionTarget = transition ? { from: stateOf(transition.code) ?? 'draft', to: transition.to } : null;

  const detail = selectedItem ? (
    <RequirementDetail
      // Remonta el editor (no controlado) al cambiar de requisito
      key={selectedItem.code}
      requirement={selectedItem}
      role={role}
      onClose={() => setSelected(null)}
      onSave={(changes) => save(selectedItem.code, changes)}
      onTransition={(to) => {
        setTransitionError(null);
        setTransition({ code: selectedItem.code, to });
      }}
      onCopy={() => void copyCode(selectedItem.code)}
    />
  ) : null;

  const onTabKey = (event: ReactKeyboardEvent, key: Tab) => {
    const index = TABS.indexOf(key);
    const next = event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length] : event.key === 'ArrowLeft' ? TABS[(index + TABS.length - 1) % TABS.length] : undefined;
    if (!next) return;
    event.preventDefault();
    setTab(next);
    document.getElementById(`requirements-tab-${next}`)?.focus();
  };

  return (
    <div data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_PAGE} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {!mobile ? <h1 className="page-title">{t('requisitos', 'title')}</h1> : null}
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-2">
            <label htmlFor="requirements-program" className="label">
              {t('requisitos', 'programLabel')}
            </label>
            <select
              id="requirements-program"
              data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_PROGRAM}
              value={programCode}
              onChange={(event) => navigate(`/programs/${event.target.value}/requirements`)}
              className="input input-filter !h-8 !w-auto max-w-[260px]"
            >
              {!programs.some((program) => program.code === programCode) ? <option value={programCode}>{programCode}</option> : null}
              {programs.map((program) => (
                <option key={program.code} value={program.code}>
                  {program.code} · {program.name}
                </option>
              ))}
            </select>
            {programName ? <span className="truncate">{programName}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_EXPORT_CSV}
            disabled={items.length === 0}
            title={items.length === 0 ? t('common', 'exportDisabled') : undefined}
            onClick={() => {
              downloadCsv(requirementsToCsv(items), REQUIREMENTS_CSV_FILENAME);
              toast.push('info', t('programas', 'csvReady'), `${items.length} ${t('programas', 'csvBody')}`);
            }}
            className="btn btn-secondary !h-8 !px-3"
          >
            <DownloadIcon size={12} />
            {t('requisitos', 'exportCsv')}
          </button>
          <button
            type="button"
            data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_NEW}
            disabled={!canCreate || !data}
            title={canCreate ? `${t('requisitos', 'newRequirement')} (N)` : t('requisitos', 'roleNoCreate')}
            onClick={() => setNewFor({ parentCode: null })}
            className="btn btn-primary !h-8 !px-3"
          >
            + {t('requisitos', 'newRequirement')}
            <kbd aria-hidden="true" className="ml-1.5 inline-grid h-4 place-items-center rounded-[3px] border border-white/35 px-[5px] font-mono text-[10px]">
              N
            </kbd>
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        <div role="tablist" aria-label={t('requisitos', 'tabsLabel')} data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_TABS} className="flex gap-1 border-b border-border">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`requirements-tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`requirements-panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              data-testid={key === 'tree' ? REQUISITOS_TESTIDS.REQUIREMENTS_TAB_TREE : REQUISITOS_TESTIDS.REQUIREMENTS_TAB_MATRIX}
              onClick={() => setTab(key)}
              onKeyDown={(event) => onTabKey(event, key)}
              className={`-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-3.5 py-2 text-[12.5px] ${tab === key ? 'border-accent font-medium text-fg' : 'border-transparent text-fg-2 hover:text-fg'}`}
            >
              {key === 'tree' ? t('requisitos', 'tabTree') : t('requisitos', 'tabMatrix')}
            </button>
          ))}
        </div>

        {tab === 'matrix' ? (
          <div role="tabpanel" id="requirements-panel-matrix" aria-labelledby="requirements-tab-matrix" data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_PANEL_MATRIX} className="mt-3">
            <TraceabilityMatrix programCode={programCode} role={role} onChanged={reload} />
          </div>
        ) : (
          <div role="tabpanel" id="requirements-panel-tree" aria-labelledby="requirements-tab-tree" data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_PANEL_TREE} className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 sm:max-w-[360px]">
                <SearchIcon size={13} className="pointer-events-none absolute top-[10px] left-[9px] text-fg-3" />
                <input
                  type="search"
                  data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_SEARCH}
                  aria-label={t('requisitos', 'searchLabel')}
                  placeholder={t('requisitos', 'searchPlaceholder')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="input input-filter !h-8 pl-7"
                />
              </div>
              <button
                type="button"
                data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_EXPAND_ALL}
                disabled={parents.size === 0}
                onClick={() => setCollapsed(NO_CODES)}
                className="btn btn-secondary !h-8 !px-3"
              >
                {t('requisitos', 'expandAll')}
              </button>
              <button
                type="button"
                data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_COLLAPSE_ALL}
                disabled={parents.size === 0}
                onClick={() => setCollapsed(new Set(parents))}
                className="btn btn-secondary !h-8 !px-3"
              >
                {t('requisitos', 'collapseAll')}
              </button>
              <span data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_COUNT} aria-live="polite" className="ml-auto font-mono text-[12px] text-fg-2">
                {data ? t('requisitos', 'count', { shown: filtered.length, total: items.length }) : '…'}
              </span>
            </div>

            {status === 'error' ? (
              <div role="alert" data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_ERROR} className="alert alert-danger flex flex-wrap items-center justify-between gap-3 !px-3.5 !py-3">
                <div>
                  <div className="font-semibold">{t('requisitos', 'errorTitle')}</div>
                  <div className="trace !text-[12.5px]">{error instanceof ApiError ? formatTrace(error) : t('common', 'networkError')}</div>
                </div>
                <button type="button" data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_ERROR_RETRY} onClick={reload} className="btn btn-danger-outline !h-[30px] !px-3">
                  {t('requisitos', 'retry')}
                </button>
              </div>
            ) : null}

            <div className={`flex items-start gap-4 ${sideBySide ? '' : 'flex-col'}`}>
              <div aria-busy={loading} className="min-w-0 flex-1 self-stretch overflow-hidden rounded-card border border-border bg-surface">
                {showSkeleton ? (
                  <div role="status" className="flex flex-col">
                    {Array.from({ length: 6 }, (_, index) => (
                      <div key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} className="flex items-center gap-3 border-b border-border px-3 py-3">
                        <span className="skeleton h-4 w-16" />
                        <span className="skeleton h-4 flex-1" />
                        <span className="skeleton h-4 w-20" />
                      </div>
                    ))}
                  </div>
                ) : isEmpty ? (
                  <div data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_EMPTY} className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
                    <div className="font-medium">{t('requisitos', 'emptyTitle')}</div>
                    <div className="text-[12.5px] text-fg-2">{t('requisitos', 'emptyBody')}</div>
                    {canCreate ? (
                      <button type="button" data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_EMPTY_NEW} onClick={() => setNewFor({ parentCode: null })} className="btn btn-secondary mt-1.5 !h-7 !px-2.5 !text-[12px]">
                        {t('requisitos', 'emptyCreate')}
                      </button>
                    ) : null}
                  </div>
                ) : noMatch ? (
                  <div data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_NO_MATCH} className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                    <div className="font-medium">{t('requisitos', 'noMatchTitle')}</div>
                    <div className="text-[12.5px] text-fg-2">{t('requisitos', 'noMatchBody')}</div>
                  </div>
                ) : (
                  <RequirementsTree
                    rows={rows}
                    items={items}
                    selected={selected}
                    renaming={renaming}
                    menuFor={menu?.code ?? null}
                    role={role}
                    mobile={mobile}
                    label={t('requisitos', 'treeLabel')}
                    onToggle={toggle}
                    onOpen={setSelected}
                    onRenameStart={setRenaming}
                    onRenameCommit={commitRename}
                    onRenameCancel={() => setRenaming(null)}
                    onCopy={(code) => void copyCode(code)}
                    onMove={(code, target, placement) => void move(code, target, placement)}
                    onMenu={(code, point) => setMenu({ code, point })}
                  />
                )}
              </div>
              {sideBySide && detail ? <div className="sticky top-[68px] w-[380px] flex-none">{detail}</div> : null}
            </div>
          </div>
        )}
      </div>

      {!sideBySide && detail ? (
        <>
          <div role="presentation" onClick={() => setSelected(null)} className="fixed inset-0 z-[34] bg-[var(--scrim)]" />
          <div className={`fixed inset-y-0 right-0 z-[35] overflow-auto bg-bg p-3 shadow-pop ${mobile ? 'left-0' : 'w-[min(440px,100%)] border-l border-border'}`}>{detail}</div>
        </>
      ) : null}

      {menu ? <ActionMenu label={t('requisitos', 'rowActions', { code: menu.code })} testId={REQUISITOS_TESTIDS.REQUIREMENT_MENU} items={menuItems(menu.code)} point={menu.point} onClose={closeMenu} /> : null}

      {newFor && data ? <NewRequirementDialog programCode={programCode} items={items} parentCode={newFor.parentCode} onClose={() => setNewFor(null)} onSubmit={create} /> : null}

      {transition && transitionTarget ? (
        <ConfirmDialog
          role="dialog"
          testId={REQUISITOS_TESTIDS.REQUIREMENT_TRANSITION_DIALOG}
          title={t('requisitos', 'transitionDialog', { code: transition.code })}
          body={
            <p className="m-0">
              {t('requisitos', 'transitionBody', {
                code: transition.code,
                from: t('requisitos', `st_${transitionTarget.from}`),
                to: t('requisitos', `st_${transitionTarget.to}`),
              })}
            </p>
          }
          confirmLabel={t('requisitos', 'confirm')}
          cancelLabel={t('requisitos', 'cancel')}
          busy={transitionBusy}
          busyTitle={t('common', 'processing')}
          error={transitionError}
          onCancel={() => setTransition(null)}
          onConfirm={() => void confirmTransition()}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          role="alertdialog"
          testId={REQUISITOS_TESTIDS.REQUIREMENT_DELETE_DIALOG}
          title={t('requisitos', 'deleteDialog')}
          body={(() => {
            const n = descendantCodes(items, deleting).length;
            return <p className="m-0">{n === 0 ? t('requisitos', 'deleteOne', { code: deleting }) : t('requisitos', 'deleteMany', { code: deleting, n })}</p>;
          })()}
          confirmLabel={t('requisitos', 'deleteConfirm')}
          cancelLabel={t('requisitos', 'cancel')}
          tone="danger"
          busy={deleteBusy}
          busyTitle={t('common', 'processing')}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
};
