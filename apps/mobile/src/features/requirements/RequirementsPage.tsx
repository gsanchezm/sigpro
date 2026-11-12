import { ApiError, REQUISITOS_TESTIDS, can, formatTrace, type CreateRequirementInput, type Placement, type RequirementDto, type RequirementState, type Role, type UpdateRequirementInput } from '@sigpro/shared';
import { Link } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { useToast } from '../../state/toast';
import { FONT_FAMILY } from '../../theme/fonts';
import { RADIUS } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { RequirementCreateDialog } from './RequirementCreateDialog';
import { RequirementMatrix } from './RequirementMatrix';
import { RequirementRow } from './RequirementRow';
import { RequirementSheet } from './RequirementSheet';
import { RequirementsDocument } from './RequirementsDocument';
import { RequirementsMetrics } from './RequirementsMetrics';
import { MOVIL_REQUIREMENTS_TESTIDS } from './testids';
import { useRequirementsData } from './useRequirementsData';
import { NO_CODES, expandAncestors, failureTrace, filterRequirements, normalizeQuery, requirementRows, toggleCollapsed } from './view';

const NO_ITEMS: readonly RequirementDto[] = [];

type ViewMode = 'tree' | 'document' | 'matrix';

/**
 * `/programs/:code/requirements`: árbol con sangría, plegado y búsqueda; documento; matriz de trazabilidad. Tocar una fila
 * abre el detalle en una hoja, donde se cambia el estado, se edita, se reordena y se borra. «Nuevo requisito» da de alta.
 * Las acciones llaman a la API con los mismos permisos y avisos que la web (`toast`).
 */
export const RequirementsPage = ({ programCode }: { readonly programCode: string }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { user, api } = useAuth();
  const toast = useToast();
  // Sin sesión no se llega a esta pantalla; por seguridad se asume el rol con menos permisos de escritura
  const role: Role = user?.role ?? 'auditor';
  const canCreate = can(role, 'requirement.create');
  const { status, data, failure, reload, replaceItems } = useRequirementsData(programCode);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(NO_CODES);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('tree');
  const [creating, setCreating] = useState(false);

  const items = data?.items ?? NO_ITEMS;
  const needle = normalizeQuery(query);
  const rows = useMemo(() => requirementRows(items, needle, collapsed), [items, needle, collapsed]);
  const filtered = useMemo(() => filterRequirements(items, needle), [items, needle]);
  const shown = filtered.length;
  const selectedItem = useMemo(() => items.find((item) => item.code === selected) ?? null, [items, selected]);
  const toggle = useCallback((code: string) => setCollapsed((current) => toggleCollapsed(current, code)), []);
  const open = useCallback((code: string) => setSelected(code), []);
  const close = useCallback(() => setSelected(null), []);

  const loading = status === 'loading';
  const notFound = status === 'error' && failure instanceof ApiError && failure.status === 404;
  const title = t('requisitos', 'title');
  const programName = data?.program.name ?? '';

  /** Aviso de error con la traza de la API (o el texto de red) y el título genérico. */
  const fail = (failureValue: unknown) => toast.push('danger', t('common', 'genericError'), failureTrace(failureValue, t('common', 'networkError')));

  /** Sustituye un requisito por su versión de la API (guardar, transicionar). */
  const applyUpdated = (updated: RequirementDto) => replaceItems(items.map((item) => (item.code === updated.code ? updated : item)));

  const save = async (code: string, changes: UpdateRequirementInput) => {
    const before = items.find((item) => item.code === code);
    const updated = await api.requirements.update(code, changes);
    applyUpdated(updated);
    const reverted = before !== undefined && before.state !== 'draft' && updated.state === 'draft';
    toast.push('ok', t('requisitos', 'saved'), t('requisitos', reverted ? 'revertedBody' : 'savedBody', { code }));
  };

  /** Rechaza con el error de la API: la hoja muestra la traza dentro del diálogo, como la web. */
  const transition = async (code: string, to: RequirementState) => {
    const updated = await api.requirements.transition(code, to);
    applyUpdated(updated);
    toast.push('ok', t('requisitos', 'transitioned'), t('requisitos', 'transitionedBody', { code: updated.code, state: t('requisitos', `st_${updated.state}`) }));
  };

  /** Borra el requisito y sus descendientes. Resuelve `false` si falló (con su aviso). */
  const remove = async (code: string): Promise<boolean> => {
    try {
      await api.requirements.remove(code);
      toast.push('ok', t('requisitos', 'deleted'), t('requisitos', 'deletedBody', { code }));
      if (selected === code) setSelected(null);
      reload();
      return true;
    } catch (failureValue) {
      fail(failureValue);
      return false;
    }
  };

  /** Reordena entre hermanos (la API rechaza otro padre con 422). Si falla, se recarga el orden real, como la web. */
  const move = async (code: string, targetCode: string, placement: Placement): Promise<boolean> => {
    try {
      const response = await api.requirements.move(code, { targetCode, placement });
      replaceItems(response.items);
      toast.push('ok', t('requisitos', 'moved'), t('requisitos', 'movedBody', { code }));
      return true;
    } catch (failureValue) {
      reload();
      fail(failureValue);
      return false;
    }
  };

  /** Alta en borrador: se despliegan sus ancestros, se limpian filtros y se abre su detalle (como la web). */
  const create = async (input: CreateRequirementInput) => {
    const created = await api.requirements.create(input);
    setCreating(false);
    setView('tree');
    setQuery('');
    setCollapsed((current) => expandAncestors(current, [...items, created], created.code));
    replaceItems([...items, created]);
    setSelected(created.code);
    toast.push('ok', t('requisitos', 'createdTitle'), t('requisitos', 'createdBody', { code: created.code }));
    reload();
  };

  if (notFound) {
    return (
      <Screen title={title} testID={REQUISITOS_TESTIDS.REQUIREMENTS_PAGE}>
        <View role="alert" testID={REQUISITOS_TESTIDS.REQUIREMENTS_NOT_FOUND} style={styles.notFound}>
          <Text variant="heading" tone="danger">
            {t('requisitos', 'programNotFound')}
          </Text>
          <Text variant="mono" tone="muted" style={styles.centered}>
            {formatTrace(failure)}
          </Text>
          <Link href="/programs" testID={MOVIL_REQUIREMENTS_TESTIDS.NOT_FOUND_BACK} style={{ color: colors.accent }}>
            {t('common', 'backToPrograms')}
          </Link>
        </View>
      </Screen>
    );
  }

  const createReason = canCreate ? (loading ? t('common', 'loading') : undefined) : t('requisitos', 'roleNoCreate');

  return (
    <Screen
      title={title}
      testID={REQUISITOS_TESTIDS.REQUIREMENTS_PAGE}
      right={
        <Button
          label={t('requisitos', 'newRequirement')}
          testID={REQUISITOS_TESTIDS.REQUIREMENTS_NEW}
          variant="primary"
          disabled={!canCreate || data === null}
          disabledReason={createReason}
          onPress={() => setCreating(true)}
        />
      }
    >
      <Card aria-label={`${t('requisitos', 'programLabel')} ${programCode}`} style={styles.header}>
        <Text variant="mono" tone="muted" testID={REQUISITOS_TESTIDS.REQUIREMENTS_PROGRAM}>
          {programCode}
        </Text>
        {programName ? (
          <Text variant="heading" testID={MOVIL_REQUIREMENTS_TESTIDS.PROGRAM_NAME}>
            {programName}
          </Text>
        ) : null}
        <Link href={`/programs/${programCode}`} testID={MOVIL_REQUIREMENTS_TESTIDS.BACK_TO_PROGRAM} style={{ color: colors.accent, fontSize: 13, fontFamily: FONT_FAMILY.medium }}>
          {t('programas', 'backToDetail')}
        </Link>
      </Card>

      {status === 'error' ? null : <RequirementsMetrics items={items} loading={loading} />}

      {canCreate ? null : (
        <Text variant="small" tone="faint" testID={MOVIL_REQUIREMENTS_TESTIDS.NEW_REASON}>
          {t('requisitos', 'roleNoCreate')}
        </Text>
      )}

      <Segmented
        testID={REQUISITOS_TESTIDS.REQUIREMENTS_TABS}
        label={t('requisitos', 'tabsLabel')}
        value={view}
        onChange={setView}
        options={[
          { value: 'tree', label: t('requisitos', 'tabTree'), testID: REQUISITOS_TESTIDS.REQUIREMENTS_TAB_TREE },
          { value: 'document', label: t('requisitos', 'tabDocument'), testID: REQUISITOS_TESTIDS.REQUIREMENTS_TAB_DOCUMENT },
          { value: 'matrix', label: t('requisitos', 'tabMatrix'), testID: REQUISITOS_TESTIDS.REQUIREMENTS_TAB_MATRIX },
        ]}
      />

      {view === 'matrix' ? (
        <View testID={REQUISITOS_TESTIDS.REQUIREMENTS_PANEL_MATRIX}>
          <RequirementMatrix programCode={programCode} role={role} onChanged={reload} />
        </View>
      ) : (
        <>
          <TextField
            label={t('requisitos', 'searchLabel')}
            placeholder={t('requisitos', 'searchPlaceholder')}
            testID={REQUISITOS_TESTIDS.REQUIREMENTS_SEARCH}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />

          <View aria-live="polite">
            <Text variant="small" tone="muted" testID={REQUISITOS_TESTIDS.REQUIREMENTS_COUNT}>
              {data ? t('requisitos', 'count', { shown, total: items.length }) : ''}
            </Text>
          </View>

          {loading && data === null ? <LoadingState testID={MOVIL_REQUIREMENTS_TESTIDS.LOADING} /> : null}

          {status === 'error' ? (
            <ErrorState
              testID={REQUISITOS_TESTIDS.REQUIREMENTS_ERROR}
              retryTestID={REQUISITOS_TESTIDS.REQUIREMENTS_ERROR_RETRY}
              title={t('requisitos', 'errorTitle')}
              trace={failureTrace(failure, t('common', 'networkError'))}
              onRetry={reload}
            />
          ) : null}

          {status === 'ready' && items.length === 0 ? (
            <EmptyState
              testID={REQUISITOS_TESTIDS.REQUIREMENTS_EMPTY}
              title={t('requisitos', 'emptyTitle')}
              hint={t('requisitos', 'emptyBody')}
              action={canCreate ? { label: t('requisitos', 'emptyCreate'), testID: REQUISITOS_TESTIDS.REQUIREMENTS_EMPTY_NEW, onPress: () => setCreating(true) } : undefined}
            />
          ) : null}

          {status === 'ready' && items.length > 0 && shown === 0 ? (
            <EmptyState testID={REQUISITOS_TESTIDS.REQUIREMENTS_NO_MATCH} title={t('requisitos', 'noMatchTitle')} hint={t('requisitos', 'noMatchBody')} />
          ) : null}

          {view === 'document' && shown > 0 ? <RequirementsDocument items={filtered} onOpen={open} /> : null}

          {view === 'tree' && rows.length > 0 ? (
            <View
              role="list"
              aria-label={t('requisitos', 'treeLabel')}
              aria-busy={loading}
              testID={REQUISITOS_TESTIDS.REQUIREMENTS_TREE}
              style={[styles.tree, { borderColor: colors.border, backgroundColor: colors.surface, boxShadow: colors.shadow }]}
            >
              {rows.map((row) => (
                <RequirementRow key={row.item.code} row={row} onToggle={toggle} onOpen={open} />
              ))}
            </View>
          ) : null}
        </>
      )}

      <RequirementSheet
        item={selectedItem}
        items={items}
        role={role}
        onClose={close}
        onSave={save}
        onTransition={transition}
        onDelete={remove}
        onMove={move}
      />

      {creating && data ? <RequirementCreateDialog programCode={programCode} items={items} parentCode={null} onClose={() => setCreating(false)} onSubmit={create} /> : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: { gap: 4 },
  tree: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: 'hidden' },
  notFound: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 16 },
  centered: { textAlign: 'center' },
});
