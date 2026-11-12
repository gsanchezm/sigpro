import type { TestResult } from '@sigpro/shared';
import type { PickedFile } from './files';

// ÚNICO punto donde el móvil distingue plataforma al subir evidencias. El multipart de la API (`api.testCases.execute`)
// recibe un `FormData`, pero el archivo se adjunta distinto:
//  - nativo (iOS/Android): React Native no tiene `File`; un `FormData` entiende una parte `{ uri, name, type }` y la lee
//    del disco al enviar.
//  - web: el navegador solo adjunta `Blob`/`File`. El selector de imágenes entrega el `File` (`asset.file`); si no lo
//    trae, se descarga de su `blob:` con `fetch`.
// `isWeb` se pasa de fuera (`Platform.OS === 'web'`) para que este módulo no importe react-native y se pueda probar.

/** Lo único que se usa de `FormData` (la firma de React Native y la del DOM difieren). */
export interface FormSink {
  append(name: string, value: unknown, fileName?: string): void;
}

export interface UploadOptions {
  readonly isWeb: boolean;
  /** Descarga el contenido de un `blob:`; en las pruebas se sustituye. */
  readonly fetchBlob?: (uri: string) => Promise<Blob>;
}

const defaultFetchBlob = async (uri: string): Promise<Blob> => (await fetch(uri)).blob();

/** Un blob con el tipo correcto: el `File` del navegador a veces lo trae vacío (arrastrar o elegir con algunos gestores). */
const withType = (blob: Blob, mimeType: string): Blob => (mimeType === '' || blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType));

/** Adjunta un archivo como parte `files` del multipart. */
export const appendEvidence = async (form: FormSink, file: PickedFile, { isWeb, fetchBlob = defaultFetchBlob }: UploadOptions): Promise<void> => {
  if (!isWeb) {
    form.append('files', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
    return;
  }
  const blob = file.file ?? (await fetchBlob(file.uri));
  form.append('files', withType(blob, file.mimeType), file.name);
};

/** Multipart de una ejecución: `result`, `notes` y hasta cinco `files` (los mismos campos que la web). */
export const buildRunForm = async (fields: { readonly result: TestResult; readonly notes: string }, files: readonly PickedFile[], options: UploadOptions): Promise<FormData> => {
  const form = new FormData();
  // `append`, no `set`: el `FormData` de React Native solo implementa `append`, `getAll` y `getParts`
  form.append('result', fields.result);
  form.append('notes', fields.notes);
  // En orden: el servidor numera las evidencias (`TC-005-001.png`…) según llegan
  for (const file of files) await appendEvidence(form, file, options);
  return form;
};
