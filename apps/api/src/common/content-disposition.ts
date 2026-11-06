/** `Content-Disposition` con nombre ASCII de respaldo y `filename*` UTF-8 (el cliente compartido prefiere este último). */
export const contentDisposition = (type: 'inline' | 'attachment', filename: string): string => {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

/** Nombre de archivo seguro: sin rutas ni caracteres de control, con un máximo de 120 caracteres. */
export const safeFilename = (name: string, fallback = 'archivo'): string => {
  const base = name.split(/[\\/]/).pop() ?? '';
  // Sin caracteres de control (0x00–0x1f y 0x7f)
  const clean = Array.from(base)
    .filter((char) => char.charCodeAt(0) >= 0x20 && char.charCodeAt(0) !== 0x7f)
    .join('')
    .trim()
    .slice(0, 120);
  return clean.length > 0 ? clean : fallback;
};
