// Lectura del texto de los PDF del informe de verificación. El generador de SIGPRO (apps/api/src/common/pdf.ts) escribe el
// contenido SIN comprimir: cada línea visible es un operador `BT … (texto) Tj ET`, con `\`, `(` y `)` escapados. Por eso basta
// con leer los textos entre paréntesis que van seguidos de `Tj`, sin decodificar ningún filtro. Los bytes se leen como latin1
// (WinAnsi coincide con Latin-1 en «Á», «ó», «·»), nunca como UTF-8: la decodificación UTF-8 destruye esos caracteres.
// El pie de página («SIGPRO · … · Página n de N») se quita: no forma parte de lo que describe la historia.

const TEXT_OPERATOR = /\(((?:\\.|[^\\)])*)\) Tj/g;
const FOOTER = /^SIGPRO · .* · Página \d+ de \d+$/;

/** ¿Empieza por la cabecera de un PDF? */
export const isPdf = (bytes: Buffer): boolean => bytes.subarray(0, 5).toString('latin1') === '%PDF-';

/** Líneas de texto del PDF, en el orden en que se escriben, sin espacios sobrantes ni pie de página. */
export const pdfLines = (bytes: Buffer): readonly string[] =>
  [...bytes.toString('latin1').matchAll(TEXT_OPERATOR)]
    .map((match) => (match[1] ?? '').replace(/\\(.)/g, '$1').trim())
    .filter((line) => line !== '' && !FOOTER.test(line));
