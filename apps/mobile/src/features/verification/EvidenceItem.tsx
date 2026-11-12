import { type EvidenceDto } from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { blobToDataUrl } from '../../lib/blob';
import { deliverFile } from '../../lib/deliver-file';
import { useAuth } from '../../state/auth';
import { useI18n, useTexts } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { useToast } from '../../state/toast';
import { RADIUS } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { formatBytes, isPdf, toDataUri } from './files';
import { MOVIL_VERIFICATION_TESTIDS, VERIFICACION_DYNAMIC_TESTIDS } from './testids';
import { VERIFICATION_TEXTS } from './texts';

type LoadState = 'loading' | 'ready' | 'error';

interface Source {
  readonly state: LoadState;
  /** `data:` URI de la imagen cuando está lista (los PDF y los fallos no tienen). */
  readonly uri: string | null;
}

/**
 * Pide la evidencia con el cliente autenticado (`GET /evidence/:id` exige el Bearer, y una `<Image source={{ uri }}>` no lo
 * lleva) y la convierte en una `data:` URI, que sirve en iOS, Android y web (un `blob:` solo existe en el navegador).
 * Los PDF no se descargan: se pintan con un icono.
 */
const useEvidenceSource = (evidence: EvidenceDto): Source => {
  const { api } = useAuth();
  const pdf = isPdf(evidence.mimeType);
  const [source, setSource] = useState<Source>({ state: pdf ? 'ready' : 'loading', uri: null });

  useEffect(() => {
    if (pdf) return;
    let cancelled = false;
    setSource({ state: 'loading', uri: null });
    api.evidence
      .download(evidence.id)
      .then(({ blob }) => blobToDataUrl(blob))
      .then(
        (dataUrl) => !cancelled && setSource({ state: 'ready', uri: toDataUri(dataUrl, evidence.mimeType) }),
        () => !cancelled && setSource({ state: 'error', uri: null }),
      );
    return () => {
      cancelled = true;
    };
  }, [api, evidence.id, evidence.mimeType, pdf]);

  return source;
};

interface Props {
  readonly evidence: EvidenceDto;
  readonly testCaseCode: string;
}

/**
 * Evidencia de una ejecución: miniatura (con `data-state` loading/ready/error y su texto alternativo), nombre, tamaño y botón
 * «Descargar». Tocar la miniatura de una imagen la amplía en una hoja; la de un PDF es un icono con su propio nombre.
 */
export const EvidenceItem = ({ evidence, testCaseCode }: Props) => {
  const { api } = useAuth();
  const { t } = useI18n();
  const texts = useTexts(VERIFICATION_TEXTS);
  const { colors } = useTheme();
  const toast = useToast();
  const source = useEvidenceSource(evidence);
  const [zoom, setZoom] = useState(false);
  const pdf = isPdf(evidence.mimeType);
  const alt = pdf ? t('verificacion', 'pdfAlt', { name: evidence.filename }) : t('verificacion', 'evidenceAlt', { code: testCaseCode });

  const download = async () => {
    try {
      const { blob, filename } = await api.evidence.download(evidence.id);
      await deliverFile(blob, filename ?? evidence.filename, evidence.mimeType);
    } catch {
      toast.push('danger', t('verificacion', 'evidenceFailed'));
    }
  };

  const frame = [styles.frame, { borderColor: colors.border, backgroundColor: colors.surface2 }];
  const thumbId = VERIFICACION_DYNAMIC_TESTIDS.EVIDENCE_THUMB(evidence.id);

  const thumb = () => {
    if (pdf) {
      return (
        <View testID={thumbId} dataSet={{ state: source.state }} role="img" aria-label={alt} style={[frame, styles.center, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
          <Text variant="label" tone="danger" weight="600" aria-hidden>
            {texts.previewPdf}
          </Text>
        </View>
      );
    }
    if (source.state === 'ready' && source.uri) {
      return (
        <Pressable testID={thumbId} dataSet={{ state: 'ready' }} role="button" aria-label={`${texts.enlarge} · ${alt}`} onPress={() => setZoom(true)} style={frame}>
          <Image source={{ uri: source.uri }} aria-label={alt} style={styles.image} resizeMode="cover" />
        </Pressable>
      );
    }
    return (
      <View testID={thumbId} dataSet={{ state: source.state }} role="img" aria-label={alt} aria-busy={source.state === 'loading'} style={[frame, styles.center]}>
        {source.state === 'loading' ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Text variant="heading" tone="danger" aria-hidden>
            ✕
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.item}>
      {thumb()}
      <View style={styles.caption}>
        <Text variant="label" numberOfLines={1}>
          {evidence.filename}
        </Text>
        <Text variant="mono" tone="faint">
          {formatBytes(evidence.size)}
        </Text>
        {source.state === 'error' ? (
          <Text variant="small" tone="danger" role="alert">
            {t('verificacion', 'evidenceFailed')}
          </Text>
        ) : null}
        <View style={styles.download}>
          <Button
            label={t('verificacion', 'download')}
            accessibilityLabel={t('verificacion', 'downloadFile', { name: evidence.filename })}
            testID={VERIFICACION_DYNAMIC_TESTIDS.EVIDENCE_DOWNLOAD(evidence.id)}
            variant="ghost"
            onPress={() => void download()}
          />
        </View>
      </View>

      <Sheet visible={zoom} title={evidence.filename} onClose={() => setZoom(false)} testID={MOVIL_VERIFICATION_TESTIDS.EVIDENCE_ZOOM}>
        {source.uri ? <Image testID={MOVIL_VERIFICATION_TESTIDS.EVIDENCE_ZOOM_IMAGE} aria-label={alt} source={{ uri: source.uri }} style={styles.zoom} resizeMode="contain" /> : null}
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  frame: { width: 64, height: 48, borderRadius: RADIUS.sm, borderWidth: 1, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  caption: { flex: 1, gap: 2 },
  download: { alignSelf: 'flex-start' },
  zoom: { width: '100%', height: 320 },
});
