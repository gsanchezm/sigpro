import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { EVIDENCE_MAX_FILES } from '@sigpro/shared';
import { useI18n, useTexts } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { fileKey, formatBytes, isPdf, toPickedFile, type FileError, type PickedFile } from './files';
import { MOVIL_VERIFICATION_DYNAMIC_TESTIDS, MOVIL_VERIFICATION_TESTIDS, VERIFICACION_DYNAMIC_TESTIDS, VERIFICACION_TESTIDS } from './testids';
import { VERIFICATION_TEXTS } from './texts';

interface Props {
  readonly files: readonly PickedFile[];
  readonly errors: readonly FileError[];
  /** Sin permiso `testrun.execute`: los botones quedan deshabilitados (el motivo lo muestra el formulario). */
  readonly disabled: boolean;
  readonly disabledReason?: string;
  /** Archivos recién elegidos, sin validar: el formulario aplica las reglas de `addFiles`. */
  readonly onPick: (incoming: readonly PickedFile[]) => void;
  readonly onRemove: (index: number) => void;
}

const FILE_ERROR_KEY = { badType: 'fileBadType', tooBig: 'fileTooBig', tooMany: 'fileTooMany' } as const;

/**
 * Evidencias de la ejecución. En lugar de las tres entradas de la web (un archivo, varios y una zona para arrastrar) hay tres
 * botones: imagen de la galería, varias imágenes y un PDF (`expo-image-picker` y `expo-document-picker`; en la web abren el
 * selector de archivos del navegador). El arrastre no existe en un móvil. Cada archivo se valida al añadirlo y otra vez en el servidor.
 */
export const EvidencePicker = ({ files, errors, disabled, disabledReason, onPick, onRemove }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(VERIFICATION_TEXTS);
  const { colors } = useTheme();
  const [pickFailed, setPickFailed] = useState(false);

  /** Abre un selector y entrega lo elegido. Cancelar no hace nada; un fallo del selector se avisa con texto. */
  const pick = async (open: () => Promise<readonly PickedFile[]>) => {
    setPickFailed(false);
    try {
      const picked = await open();
      if (picked.length > 0) onPick(picked);
    } catch {
      setPickFailed(true);
    }
  };

  const fromImages = (multiple: boolean) => async (): Promise<readonly PickedFile[]> => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, selectionLimit: multiple ? EVIDENCE_MAX_FILES : 1 });
    if (result.canceled) return [];
    return result.assets.map((asset, index) => toPickedFile({ uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType, size: asset.fileSize, file: asset.file }, files.length + index));
  };

  const fromDocuments = async (): Promise<readonly PickedFile[]> => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return [];
    return result.assets.map((asset, index) => toPickedFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size, file: asset.file }, files.length + index));
  };

  const errorText = (error: FileError): string => t('verificacion', FILE_ERROR_KEY[error.kind], { name: 'name' in error ? error.name : '' });

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="muted">
        {t('verificacion', 'evidenceTitle')}
      </Text>
      <Text variant="small" tone="faint">
        {t('verificacion', 'evidenceHint')}
      </Text>

      <View style={styles.buttons}>
        <Button
          label={t('verificacion', 'evidenceSimple')}
          testID={VERIFICACION_TESTIDS.RUN_EVIDENCE_SIMPLE}
          disabled={disabled}
          disabledReason={disabledReason}
          onPress={() => void pick(fromImages(false))}
        />
        <Button
          label={t('verificacion', 'evidenceMultiple')}
          testID={VERIFICACION_TESTIDS.RUN_EVIDENCE_MULTIPLE}
          disabled={disabled}
          disabledReason={disabledReason}
          onPress={() => void pick(fromImages(true))}
        />
        <Button label={texts.attachPdf} testID={MOVIL_VERIFICATION_TESTIDS.RUN_EVIDENCE_PDF} disabled={disabled} disabledReason={disabledReason} onPress={() => void pick(fromDocuments)} />
      </View>

      {pickFailed ? (
        <Text variant="small" tone="danger" role="alert">
          {texts.pickFailed}
        </Text>
      ) : null}

      {errors.length > 0 ? (
        <View role="alert" testID={VERIFICACION_TESTIDS.RUN_FILES_ERROR} style={styles.errors}>
          {errors.map((error, index) => (
            <Text key={`${error.kind}-${index}`} variant="small" tone="danger">
              {errorText(error)}
            </Text>
          ))}
        </View>
      ) : null}

      <Text variant="label" tone="muted">
        {t('verificacion', 'filesTitle')}
      </Text>
      {files.length === 0 ? (
        <Text variant="small" tone="faint">
          {t('verificacion', 'filesNone')}
        </Text>
      ) : (
        <View role="list" aria-label={t('verificacion', 'filesTitle')} testID={VERIFICACION_TESTIDS.RUN_FILES} style={styles.files}>
          {files.map((file, index) => (
            <View key={fileKey(file)} role="listitem" style={[styles.file, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {isPdf(file.mimeType) ? (
                <View aria-hidden style={[styles.preview, styles.center, { backgroundColor: colors.dangerSoft }]}>
                  <Text variant="small" tone="danger" weight="600">
                    {texts.previewPdf}
                  </Text>
                </View>
              ) : (
                <Image
                  testID={MOVIL_VERIFICATION_DYNAMIC_TESTIDS.RUN_FILE_PREVIEW(index)}
                  source={{ uri: file.uri }}
                  aria-label={t('verificacion', 'previewAlt', { name: file.name })}
                  style={styles.preview}
                  resizeMode="cover"
                />
              )}
              <View style={styles.fileText}>
                <Text variant="label" numberOfLines={1}>
                  {file.name}
                </Text>
                {file.size === null ? null : (
                  <Text variant="mono" tone="faint">
                    {formatBytes(file.size)}
                  </Text>
                )}
              </View>
              <Button
                label="×"
                accessibilityLabel={t('verificacion', 'removeFile', { name: file.name })}
                testID={VERIFICACION_DYNAMIC_TESTIDS.RUN_FILE_REMOVE(index)}
                variant="ghost"
                onPress={() => onRemove(index)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  errors: { gap: 2 },
  files: { gap: 8 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 6, paddingLeft: 8, paddingRight: 4 },
  preview: { width: 40, height: 30, borderRadius: 4 },
  center: { alignItems: 'center', justifyContent: 'center' },
  fileText: { flex: 1, gap: 2 },
});
