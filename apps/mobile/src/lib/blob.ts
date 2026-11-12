/**
 * Contenido de un `Blob` como `data:<tipo>;base64,<datos>`. `FileReader` existe en React Native y en la web, así que es el
 * mismo camino en las tres plataformas (un `blob:` de `URL.createObjectURL` solo existe en el navegador).
 */
export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onloadend = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo leer el archivo')));
    reader.readAsDataURL(blob);
  });
