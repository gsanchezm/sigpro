import { CSV_FILENAME, MOVIL_TESTIDS, PROGRAMAS_TESTIDS, formatTrace, programsToCsv, type CreateProgramInput, type ProgramDto } from '@sigpro/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n, useTexts } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { Button } from '../../ui/Button';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { Screen } from '../../ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { ToggleButton } from '../../ui/ToggleButton';
import { ProgramCard } from './ProgramCard';
import { ProgramRowMenu } from './ProgramRowMenu';
import { ProgramWizard } from './ProgramWizard';
import { ProgramsBulkBar } from './ProgramsBulkBar';
import { ProgramsFilterBar } from './ProgramsFilterBar';
import { ProgramsMetrics } from './ProgramsMetrics';
import { NO_FILTERS, SEARCH_DEBOUNCE_MS, choiceOf, choiceToStatus, filtersToParams, firstParam, hasActiveFilters, hasMorePages, parseProgramsFilters, rangeLabel, toProgramsQuery, type ListOrder, type StatusChoice } from './params';
import { PROGRAMS_TEXTS } from './texts';
import { MOVIL_PROGRAMS_DYNAMIC_TESTIDS, MOVIL_PROGRAMS_TESTIDS } from './testids';
import { usePagedPrograms } from './usePagedPrograms';
import { programPermissionsOf, toggleAllSelection, toggleSelection } from './view';

/**
 * Lista de programas (`/programs`): tarjetas con filtros por estado y búsqueda, y las acciones de la web. Cada tarjeta tiene su
 * menú ⋯ (abrir, editar, duplicar, archivar, eliminar); «Seleccionar» activa la selección múltiple con archivar, eliminar y
 * exportar en lote; «Exportar CSV» comparte el archivo con la hoja del sistema; «Nuevo programa» abre el asistente de alta.
 * El estado de los filtros vive en la URL (`/programs?status=on_hold&q=gestión`); el buscador escribe en ella tras 250 ms.
 */
export const ProgramsScreen = () => {
  const { t } = useI18n();
  const texts = useTexts(PROGRAMS_TEXTS);
  const router = useRouter();
  const { user, api } = useAuth();
  const toast = useToast();
  // Sin sesión no se llega aquí; por seguridad se asume el rol con menos permisos de escritura
  const permissions = programPermissionsOf(user?.role ?? 'auditor');
  const params = useLocalSearchParams<{ status?: string; q?: string }>();
  const urlQ = firstParam(params.q) ?? '';
  const urlStatus = firstParam(params.status) ?? '';
  const filters = useMemo(() => parseProgramsFilters(urlQ, urlStatus), [urlQ, urlStatus]);
  const [order, setOrder] = useState<ListOrder>('asc');
  const list = usePagedPrograms(filters, order);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [menuCode, setMenuCode] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteCodes, setDeleteCodes] = useState<readonly string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Las tarjetas de métricas se vuelven a pedir cuando cambia esta clave (tras cada mutación, como la web)
  const [metricsKey, setMetricsKey] = useState(0);

  // Buscador: `draft` es lo que se ve; `pushed` recuerda el último texto que se escribió en la URL.
  // Así, la URL que vuelve tras un `setParams` no pisa lo que el usuario sigue escribiendo.
  const [draft, setDraft] = useState(filters.q);
  const pushed = useRef(filters.q);

  // La URL cambió por otro lado (atrás/adelante): el buscador sigue a la URL
  useEffect(() => {
    if (filters.q === pushed.current) return;
    pushed.current = filters.q;
    setDraft(filters.q);
  }, [filters.q]);

  // Tras 250 ms sin teclear, el texto va a la URL (la lista se vuelve a pedir con el nuevo `q`)
  useEffect(() => {
    const value = draft.trim();
    if (value === pushed.current) return;
    const timer = setTimeout(() => {
      pushed.current = value;
      router.setParams({ q: value || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, router]);

  // Cambiar filtros u orden vacía la selección (como la web)
  useEffect(() => setSelected([]), [filters, order]);

  const { phase, items, meta, error, loadingMore, moreError } = list;
  const total = meta?.total ?? 0;
  const codes = items.map((program) => program.code);
  const menuProgram = items.find((program) => program.code === menuCode) ?? null;
  const choice = choiceOf(filters);
  const filtered = hasActiveFilters(filters);
  const canLoadMore = meta !== null && hasMorePages(meta.page, meta.pages) && moreError === null;
  const subtitle = meta ? `${meta.totalAll} ${t('programas', 'programs').toLowerCase()} · ${meta.activeCount} ${t('programas', 'st_active').toLowerCase()}` : '…';
  const exportDisabled = phase !== 'ready' || total === 0;
  const traceOf = (failure: unknown): string => formatTrace(failure) || t('common', 'networkError');

  /** Aviso de error con la traza de la API (o el texto de red) y el título genérico (como la web). */
  const attempt = async (work: () => Promise<void>): Promise<void> => {
    try {
      await work();
    } catch (failure) {
      toast.push('danger', t('common', 'genericError'), traceOf(failure));
    }
  };

  /** Tras una mutación: vacía la selección, vuelve a pedir la lista y las métricas. */
  const refresh = () => {
    setSelected([]);
    setMetricsKey((key) => key + 1);
    list.reload();
  };

  /** Tras un alta o una copia, la lista pasa a orden descendente: el programa nuevo sale el primero (como la web). */
  const showNewFirst = () => {
    setMetricsKey((key) => key + 1);
    if (order === 'desc') list.reload();
    else setOrder('desc');
  };

  const chooseStatus = (option: StatusChoice) => router.setParams({ status: choiceToStatus(option) || undefined });

  const clearFilters = () => {
    pushed.current = '';
    setDraft('');
    router.setParams(filtersToParams(NO_FILTERS));
  };

  const openProgram = (code: string) => router.push(`/programs/${encodeURIComponent(code)}`);
  const editProgram = (code: string) => router.push(`/programs/${encodeURIComponent(code)}/edit`);

  const archive = (archiveCodes: readonly string[]) =>
    attempt(async () => {
      await Promise.all(archiveCodes.map((code) => api.programs.archive(code)));
      const [only] = archiveCodes;
      toast.push('ok', archiveCodes.length === 1 && only !== undefined ? `${only} ${t('programas', 'archived')}` : `${archiveCodes.length} ${t('programas', 'archivedN')}`);
      refresh();
    });

  const duplicate = (program: ProgramDto) =>
    attempt(async () => {
      const copy = await api.programs.duplicate(program.code);
      toast.push('ok', `${copy.code} ${t('programas', 'created').toLowerCase()}`, t('programas', 'duplicatedBody'));
      showNewFirst();
    });

  const confirmDelete = async () => {
    if (!deleteCodes) return;
    setDeleting(true);
    await attempt(async () => {
      await Promise.all(deleteCodes.map((code) => api.programs.remove(code)));
      const [only] = deleteCodes;
      toast.push('ok', deleteCodes.length === 1 && only !== undefined ? `${only} ${t('programas', 'deleted')}` : `${deleteCodes.length} ${t('programas', 'deletedN')}`);
      refresh();
    });
    setDeleting(false);
    setDeleteCodes(null);
  };

  /** Alta desde el asistente: la API asigna el código; el asistente muestra los 422 y esta función deja pasar el error. */
  const createProgram = async (input: CreateProgramInput) => {
    const created = await api.programs.create(input);
    setWizardOpen(false);
    toast.push('ok', t('programas', 'created'), `${created.code} ${t('programas', 'addedToList')}`);
    showNewFirst();
  };

  /** Hoja de compartir del sistema con el CSV. Sin soporte (navegador de escritorio) avisa, no falla en silencio. */
  const shareCsv = async (csv: string, count: number) => {
    try {
      await Share.share({ title: CSV_FILENAME, message: csv });
      toast.push('info', t('programas', 'csvReady'), `${count} ${t('programas', 'csvBody')}`);
    } catch (failure) {
      toast.push('danger', t('common', 'genericError'), failure instanceof Error ? failure.message : '');
    }
  };

  const exportFiltered = async () => {
    let csv: string;
    try {
      csv = await api.programs.exportCsv(toProgramsQuery(filters, 1, order));
    } catch (failure) {
      toast.push('danger', t('common', 'genericError'), traceOf(failure));
      return;
    }
    await shareCsv(csv, total);
  };

  const exportSelected = () => {
    const picked = items.filter((program) => selected.includes(program.code));
    void shareCsv(programsToCsv(picked), picked.length);
  };

  const toggleSelectMode = () => {
    setSelectMode((current) => !current);
    setSelected([]);
  };

  const deleteMessage = (codesToDelete: readonly string[]): string => {
    const [only] = codesToDelete;
    return codesToDelete.length === 1 && only !== undefined ? `${only} ${t('programas', 'deleteDescOne')}` : `${codesToDelete.length} ${t('programas', 'deleteDescMany')}`;
  };

  const createReason = permissions.create ? null : t('programas', 'roleNoCreate');
  const loadingFirst = phase === 'loading';

  return (
    <Screen
      title={t('programas', 'programs')}
      subtitle={subtitle}
      testID={MOVIL_TESTIDS.PROGRAMS_PAGE}
      right={
        <Button
          label={t('programas', 'newProgram')}
          testID={PROGRAMAS_TESTIDS.PROGRAMS_NEW}
          variant="primary"
          disabled={!permissions.create}
          disabledReason={createReason ?? undefined}
          onPress={() => setWizardOpen(true)}
        />
      }
    >
      <ProgramsMetrics refreshKey={metricsKey} />

      <ProgramsFilterBar query={draft} onQueryChange={setDraft} choice={choice} onChoice={chooseStatus} filtered={filtered} onClear={clearFilters} />

      {permissions.create ? null : (
        <Text variant="small" tone="faint" testID={MOVIL_PROGRAMS_TESTIDS.NEW_REASON}>
          {createReason}
        </Text>
      )}

      <View style={styles.toolbar}>
        <ToggleButton label={texts.select} pressed={selectMode} onPress={toggleSelectMode} testID={MOVIL_PROGRAMS_TESTIDS.SELECT_MODE} />
        <View style={styles.exportBox}>
          <Button
            label={t('programas', 'exportCsv')}
            testID={PROGRAMAS_TESTIDS.PROGRAMS_EXPORT_CSV}
            disabled={exportDisabled}
            disabledReason={exportDisabled ? t('common', 'exportDisabled') : undefined}
            onPress={() => void exportFiltered()}
          />
          {exportDisabled ? (
            <Text variant="small" tone="faint" testID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('export')}>
              {t('common', 'exportDisabled')}
            </Text>
          ) : null}
        </View>
      </View>

      {selectMode && items.length > 0 ? (
        <Button
          label={texts.selectAll}
          testID={PROGRAMAS_TESTIDS.PROGRAMS_SELECT_ALL}
          variant="ghost"
          onPress={() => setSelected((current) => toggleAllSelection(current, codes))}
        />
      ) : null}

      {selected.length > 0 ? (
        <ProgramsBulkBar
          count={selected.length}
          permissions={permissions}
          onExport={exportSelected}
          onArchive={() => void archive(selected)}
          onDelete={() => setDeleteCodes([...selected])}
          onClear={() => setSelected([])}
        />
      ) : null}

      {loadingFirst ? <LoadingState testID={MOVIL_PROGRAMS_TESTIDS.PROGRAMS_LOADING} /> : null}

      {phase === 'error' ? (
        <ErrorState
          testID={PROGRAMAS_TESTIDS.PROGRAMS_ERROR}
          retryTestID={PROGRAMAS_TESTIDS.PROGRAMS_ERROR_RETRY}
          title={t('programas', 'errorTitle')}
          trace={traceOf(error)}
          onRetry={list.reload}
        />
      ) : null}

      {phase === 'ready' && items.length === 0 ? (
        <EmptyState
          testID={PROGRAMAS_TESTIDS.PROGRAMS_EMPTY}
          title={t('programas', 'emptyTitle')}
          hint={filtered ? t('programas', 'emptyFiltered') : t('programas', 'emptyNone')}
          action={filtered ? { label: t('programas', 'clearFilters'), testID: PROGRAMAS_TESTIDS.PROGRAMS_EMPTY_CLEAR, onPress: clearFilters } : undefined}
        />
      ) : null}

      {phase === 'ready' && items.length > 0 ? (
        <View style={styles.block}>
          <Text variant="small" tone="muted" testID={PROGRAMAS_TESTIDS.PROGRAMS_COUNT} aria-live="polite">
            {rangeLabel(items.length, total, t('programas', 'shown'))}
          </Text>
          <View role="list" testID={MOVIL_TESTIDS.PROGRAMS_CARDS} aria-busy={loadingMore} style={styles.block}>
            {items.map((program) => (
              <ProgramCard
                key={program.code}
                program={program}
                selectMode={selectMode}
                selected={selected.includes(program.code)}
                onOpen={openProgram}
                onToggle={(code) => setSelected((current) => toggleSelection(current, code))}
                onMenu={setMenuCode}
              />
            ))}
          </View>
          {moreError !== null ? (
            <ErrorState
              testID={PROGRAMAS_TESTIDS.PROGRAMS_ERROR}
              retryTestID={PROGRAMAS_TESTIDS.PROGRAMS_ERROR_RETRY}
              title={t('programas', 'errorTitle')}
              trace={traceOf(moreError)}
              onRetry={list.loadMore}
            />
          ) : null}
          {canLoadMore ? <Button label={texts.loadMore} testID={MOVIL_TESTIDS.PROGRAMS_LOAD_MORE} busy={loadingMore} onPress={list.loadMore} /> : null}
        </View>
      ) : null}

      <ProgramRowMenu
        program={menuProgram}
        permissions={permissions}
        onClose={() => setMenuCode(null)}
        onOpen={openProgram}
        onEdit={editProgram}
        onDuplicate={(program) => void duplicate(program)}
        onArchive={(code) => void archive([code])}
        onDelete={(code) => setDeleteCodes([code])}
      />

      {wizardOpen ? <ProgramWizard onClose={() => setWizardOpen(false)} onSubmit={createProgram} /> : null}

      <ConfirmSheet
        visible={deleteCodes !== null}
        title={t('programas', 'deleteTitle')}
        message={deleteCodes ? deleteMessage(deleteCodes) : ''}
        confirmLabel={t('programas', 'delete')}
        cancelLabel={t('programas', 'cancel')}
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteCodes(null)}
        testID={PROGRAMAS_TESTIDS.PROGRAMS_DELETE_DIALOG}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8 },
  exportBox: { gap: 4 },
});
