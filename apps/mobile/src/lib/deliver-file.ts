import { File as FsFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
import { blobToDataUrl } from './blob';

// Entrega al usuario un archivo que la API sirve con Bearer (informe PDF, evidencias): la web lo descarga con un enlace `blob:`;
// en el móvil no hay descargas del navegador, así que se guarda en la caché y se abre la hoja de compartir del sistema.
// El texto sí cabe en `Share.share` (el CSV de Programas), pero un PDF o una imagen son binarios: ese módulo solo comparte texto
// y URL, y no existe una URL pública con la que compartirlos. Por eso se usa `expo-sharing`, que comparte un archivo local.

/** Cuánto se conserva un `blob:` abierto en el navegador antes de liberarlo. */
const REVOKE_AFTER_MS = 60_000;

/** `data:image/png;base64,AAAA` → `AAAA`. */
const base64Of = (dataUrl: string): string => dataUrl.slice(dataUrl.indexOf(',') + 1);

/** Nombre apto para un archivo en la caché (sin separadores de ruta). */
const safeName = (name: string): string => name.replace(/[\\/:*?"<>|]/g, '_') || 'archivo';

const openInBrowser = async (blob: Blob): Promise<void> => {
  const url = URL.createObjectURL(blob);
  await Linking.openURL(url);
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
};

const shareFromCache = async (blob: Blob, filename: string, mimeType: string): Promise<void> => {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  const target = new FsFile(Paths.cache, safeName(filename));
  target.create({ overwrite: true });
  await target.write(base64Of(await blobToDataUrl(blob)), { encoding: 'base64' });
  await Sharing.shareAsync(target.uri, { mimeType, dialogTitle: filename });
};

/**
 * Web: abre el archivo en una pestaña nueva (el visor de PDF o de imágenes del navegador permite guardarlo).
 * iOS y Android: lo guarda en la caché y abre la hoja de compartir. Falla si la plataforma no puede.
 */
export const deliverFile = (blob: Blob, filename: string, mimeType: string): Promise<void> => (Platform.OS === 'web' ? openInBrowser(blob) : shareFromCache(blob, filename, mimeType));

/** Descarga de la web: un `<a download>` temporal, así el navegador guarda el archivo con su nombre (como la web de escritorio). */
const downloadInBrowser = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
};

/**
 * Guarda el archivo con su nombre. Web: descarga del navegador (`<a download>`; `page.waitForEvent('download')` en las pruebas).
 * iOS y Android: igual que `deliverFile` (caché + hoja de compartir), porque no hay carpeta de descargas a la que escribir sin
 * permisos. Es el único sitio de la app que toca `document`, protegido por `Platform.OS`.
 */
export const saveFile = async (blob: Blob, filename: string, mimeType: string): Promise<void> => {
  if (Platform.OS === 'web') return downloadInBrowser(blob, filename);
  return shareFromCache(blob, filename, mimeType);
};

