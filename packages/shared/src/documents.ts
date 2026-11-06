import { DOCUMENT_PAGE_LINES } from './domain';

// Contenido de los documentos: paginación del visor y comparación de versiones (diff por líneas).

/** Reparte las líneas en páginas del visor (`Página 1`, `Página 2`…); un documento vacío tiene una página en blanco. */
export const paginateLines = (lines: readonly string[], perPage: number = DOCUMENT_PAGE_LINES): readonly (readonly string[])[] => {
  const pages = Array.from({ length: Math.ceil(lines.length / perPage) }, (_, index) => lines.slice(index * perPage, (index + 1) * perPage));
  return pages.length > 0 ? pages : [[]];
};

export type DiffType = 'same' | 'add' | 'del';

export interface DiffOp {
  readonly type: DiffType;
  readonly text: string;
  /** Nº de línea (1-based) en la versión antigua; `null` si es una línea añadida. */
  readonly oldLine: number | null;
  /** Nº de línea (1-based) en la versión nueva; `null` si es una línea eliminada. */
  readonly newLine: number | null;
}

/** Diff por líneas (subsecuencia común más larga). En un cambio, las eliminaciones van antes que las altas. */
export const diffLines = (before: readonly string[], after: readonly string[]): readonly DiffOp[] => {
  const n = before.length;
  const m = after.length;
  // lcs[i][j] = longitud de la subsecuencia común de before[i..] y after[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = before[i] === after[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && before[i] === after[j]) {
      ops.push({ type: 'same', text: before[i]!, oldLine: i + 1, newLine: j + 1 });
      i++;
      j++;
    } else if (i < n && (j >= m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      ops.push({ type: 'del', text: before[i]!, oldLine: i + 1, newLine: null });
      i++;
    } else {
      ops.push({ type: 'add', text: after[j]!, oldLine: null, newLine: j + 1 });
      j++;
    }
  }
  return ops;
};

export type DiffRowKind = 'same' | 'changed' | 'added' | 'removed';

export interface DiffRow {
  readonly kind: DiffRowKind;
  readonly left: { readonly line: number; readonly text: string } | null;
  readonly right: { readonly line: number; readonly text: string } | null;
}

/** Alinea el diff en dos columnas: un bloque de bajas y altas consecutivas se empareja como «cambiada». */
export const alignDiff = (ops: readonly DiffOp[]): readonly DiffRow[] => {
  const rows: DiffRow[] = [];
  let removed: DiffOp[] = [];
  let added: DiffOp[] = [];

  const flush = (): void => {
    const paired = Math.min(removed.length, added.length);
    removed.forEach((op, index) => {
      const partner = index < paired ? added[index] : undefined;
      rows.push({
        kind: partner ? 'changed' : 'removed',
        left: { line: op.oldLine ?? 0, text: op.text },
        right: partner ? { line: partner.newLine ?? 0, text: partner.text } : null,
      });
    });
    added.slice(paired).forEach((op) => rows.push({ kind: 'added', left: null, right: { line: op.newLine ?? 0, text: op.text } }));
    removed = [];
    added = [];
  };

  for (const op of ops) {
    if (op.type === 'del') removed.push(op);
    else if (op.type === 'add') added.push(op);
    else {
      flush();
      rows.push({ kind: 'same', left: { line: op.oldLine ?? 0, text: op.text }, right: { line: op.newLine ?? 0, text: op.text } });
    }
  }
  flush();
  return rows;
};

export interface DiffStats {
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly same: number;
}

export const diffStats = (rows: readonly DiffRow[]): DiffStats =>
  rows.reduce<DiffStats>((acc, row) => ({ ...acc, [row.kind]: acc[row.kind] + 1 }), { added: 0, removed: 0, changed: 0, same: 0 });
