import {
  DOCUMENTOS_DYNAMIC_TESTIDS,
  DOCUMENTOS_TESTIDS,
  formatTrace,
  type DiffRow,
  type DocumentCompareDto,
  type DocumentDetailDto,
} from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING } from '../../theme/tokens';
import { Card } from '../../ui/Card';
import { SelectField } from '../../ui/SelectField';
import { Text } from '../../ui/Text';
import { KIND_LABEL_KEY, MARKER, cellsOf, defaultRange, isComparable, isStale, isStruck, versionOptions, type DiffCell, type VersionRange } from './compare';
import { MOVIL_DOCUMENTS_DYNAMIC_TESTIDS, MOVIL_DOCUMENTS_TESTIDS } from './testids';

/** `data-testid` de la línea de una celda según su lado (mapa de despacho). */
const CELL_TESTID: Readonly<Record<DiffCell['side'], (n: number) => string>> = {
  old: MOVIL_DOCUMENTS_DYNAMIC_TESTIDS.DIFF_OLD,
  new: MOVIL_DOCUMENTS_DYNAMIC_TESTIDS.DIFF_NEW,
  same: MOVIL_DOCUMENTS_DYNAMIC_TESTIDS.DIFF_SAME,
};

/**
 * «Comparar versiones»: selectores Desde / Hasta (por defecto, la anterior contra la última) y el diff alineado del servidor.
 * Las filas van apiladas (antigua tachada y, debajo, la nueva), con el tipo en texto y `data-diff`, para que se lea a 390 px.
 * No pide nada con una sola versión o con dos iguales elegidas; mientras llega un resultado nuevo, el anterior sigue a la
 * vista con `aria-busy`.
 */
export const DocumentCompare = ({ doc }: { readonly doc: DocumentDetailDto }) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const latest = doc.version;
  const [range, setRange] = useState<VersionRange>(() => defaultRange(latest));
  const [result, setResult] = useState<DocumentCompareDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Al publicar una versión nueva, la comparación por defecto pasa a «anterior → última»
  useEffect(() => setRange(defaultRange(latest)), [latest, doc.id]);

  const comparable = isComparable(doc.versions.length, range);
  const { from, to } = range;

  useEffect(() => {
    if (!comparable) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setError(null);
    api.documents.compare(doc.id, from, to).then(
      (data) => !cancelled && setResult(data),
      (failure: unknown) => {
        if (cancelled) return;
        setResult(null);
        setError(formatTrace(failure) || t('common', 'genericError'));
      },
    );
    return () => {
      cancelled = true;
    };
    // `t` cambia con el idioma, pero no debe volver a pedir la comparación
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, doc.id, from, to, comparable]);

  const options = versionOptions(doc.versions).map(({ value }) => ({ value, label: t('documentos', 'versionN', { n: Number(value) }) }));
  const stale = isStale(result, range);

  return (
    <Card testID={DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE} aria-label={t('documentos', 'compareTitle')} style={styles.card}>
      <Text variant="heading" role="heading" aria-level={2}>
        {t('documentos', 'compareTitle')}
      </Text>

      {doc.versions.length < 2 ? (
        <Text variant="body" tone="muted" testID={DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_ONE}>
          {t('documentos', 'compareOne')}
        </Text>
      ) : (
        <>
          <View style={styles.selectors}>
            <View style={styles.selector}>
              <SelectField<string> label={t('documentos', 'compareFrom')} value={String(from)} options={options} onChange={(value) => setRange({ from: Number(value), to })} testID={DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_FROM} />
            </View>
            <View style={styles.selector}>
              <SelectField<string> label={t('documentos', 'compareTo')} value={String(to)} options={options} onChange={(value) => setRange({ from, to: Number(value) })} testID={DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_TO} />
            </View>
          </View>

          {result ? (
            <Text variant="mono" tone="muted" aria-live="polite" testID={DOCUMENTOS_TESTIDS.DOCUMENT_DIFF_STATS}>
              {t('documentos', 'diffStats', { added: result.stats.added, removed: result.stats.removed, changed: result.stats.changed })}
            </Text>
          ) : null}

          {from === to ? (
            <Text variant="body" tone="muted" testID={MOVIL_DOCUMENTS_TESTIDS.COMPARE_SAME}>
              {t('documentos', 'compareSame')}
            </Text>
          ) : null}
          {error ? (
            <Text variant="small" tone="danger" role="alert" testID={MOVIL_DOCUMENTS_TESTIDS.COMPARE_ERROR}>
              {error}
            </Text>
          ) : null}
          {comparable && !result && !error ? (
            <Text variant="body" tone="muted" role="status" aria-busy testID={MOVIL_DOCUMENTS_TESTIDS.COMPARE_LOADING}>
              {t('documentos', 'compareLoading')}
            </Text>
          ) : null}

          {result ? <DiffTable result={result} stale={stale} /> : null}
        </>
      )}
    </Card>
  );
};

/** Tabla del diff: cabecera con las dos versiones y una fila por cambio, apiladas. */
const DiffTable = ({ result, stale }: { readonly result: DocumentCompareDto; readonly stale: boolean }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View role="table" aria-label={t('documentos', 'compareTitle')} aria-busy={stale} testID={DOCUMENTOS_TESTIDS.DOCUMENT_DIFF} style={[styles.table, { borderColor: colors.border }]}>
      <View role="row" testID={MOVIL_DOCUMENTS_TESTIDS.DIFF_HEADER} style={[styles.header, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
        <View role="columnheader" style={styles.heading}>
          <View aria-hidden style={[styles.swatch, { backgroundColor: colors.danger }]} />
          <Text variant="label">{t('documentos', 'diffOld', { n: result.from })}</Text>
        </View>
        <View role="columnheader" style={styles.heading}>
          <View aria-hidden style={[styles.swatch, { backgroundColor: colors.ok }]} />
          <Text variant="label">{t('documentos', 'diffNew', { n: result.to })}</Text>
        </View>
      </View>
      {result.rows.map((row, index) => (
        <DiffRowView key={index} n={index + 1} row={row} />
      ))}
    </View>
  );
};

/** Una fila del diff: el tipo en texto (salvo «sin cambios») y sus líneas, con `data-diff` para los locators. */
const DiffRowView = ({ n, row }: { readonly n: number; readonly row: DiffRow }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const tint: Readonly<Record<DiffRow['kind'], string>> = { same: 'transparent', added: colors.okSoft, removed: colors.dangerSoft, changed: colors.warnSoft };
  return (
    <View
      role="row"
      testID={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_DIFF_ROW(n)}
      dataSet={{ diff: row.kind }}
      style={[styles.row, row.kind === 'same' ? styles.rowSame : null, { backgroundColor: tint[row.kind], borderColor: colors.border }]}
    >
      {row.kind === 'same' ? null : (
        <Text variant="small" tone="muted">
          {t('documentos', KIND_LABEL_KEY[row.kind])}
        </Text>
      )}
      {cellsOf(row).map((cell) => (
        <View key={cell.side} role="cell" style={styles.cell}>
          <Text variant="mono" tone="faint" style={styles.gutter}>
            {`${MARKER[cell.side]}${cell.line}`}
          </Text>
          <Text variant="body" tone={cell.side === 'same' ? 'muted' : 'default'} style={[styles.text, isStruck(cell) ? styles.struck : null]} testID={CELL_TESTID[cell.side](n)}>
            {cell.text || ' '}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { gap: SPACING.md },
  selectors: { flexDirection: 'row', gap: SPACING.sm },
  selector: { flex: 1 },
  table: { borderWidth: 1, borderRadius: RADIUS.md, overflow: 'hidden' },
  header: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  swatch: { width: 8, height: 8, borderRadius: RADIUS.pill },
  row: { gap: 2, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth },
  // Las filas sin cambios son las más numerosas: más compactas y en gris, para que lo que cambió destaque
  rowSame: { paddingVertical: SPACING.xs },
  cell: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  gutter: { width: 34, textAlign: 'right' },
  text: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
});
