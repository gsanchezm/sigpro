import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS, REQUIREMENT_STATE_TONE, buildTree, sanitizeRichText, sectionNumbers, visibleRows, type RequirementDto } from '@sigpro/shared';
import { useMemo } from 'react';
import { useI18n } from '../../state/i18n';
import { ToneBadge } from '../../ui/ToneBadge';

const NONE: ReadonlySet<string> = new Set();

interface RequirementsDocumentProps {
  /** Requisitos a mostrar (ya filtrados); se leen como un documento, en el orden del árbol. */
  readonly items: readonly RequirementDto[];
  readonly selected: string | null;
  readonly onOpen: (code: string) => void;
}

/**
 * Vista Documento: los requisitos como un texto continuo. Cada uno es un párrafo numerado (1, 1.1, 1.2…) con el código en el margen
 * izquierdo, el título, la descripción (HTML saneado con la misma lista blanca que el editor) y su estado a la derecha.
 */
export const RequirementsDocument = ({ items, selected, onOpen }: RequirementsDocumentProps) => {
  const { t } = useI18n();
  const tree = useMemo(() => buildTree(items), [items]);
  const numbers = useMemo(() => sectionNumbers(tree), [tree]);
  const rows = useMemo(() => visibleRows(tree, NONE), [tree]);

  return (
    <div data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_DOCUMENT} className="card !p-0">
      <h2 className="sr-only">{t('requisitos', 'docTitle')}</h2>
      <div className="px-5 sm:px-8">
        {rows.map(({ item, depth }) => {
          const number = numbers.get(item.code) ?? '';
          const html = sanitizeRichText(item.description);
          return (
            <article
              key={item.code}
              aria-labelledby={`requirement-doc-title-${item.code}`}
              data-testid={REQUISITOS_DYNAMIC_TESTIDS.DOC_SECTION(item.code)}
              data-state={item.state}
              data-depth={depth}
              data-selected={selected === item.code}
              className="doc-section"
            >
              <div className="doc-margin">
                <div>{number}</div>
                <div>{item.code}</div>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <h3 id={`requirement-doc-title-${item.code}`} className={`m-0 ${depth === 0 ? 'text-[16px]' : 'text-[14px]'} font-semibold`}>
                  <button
                    type="button"
                    data-testid={REQUISITOS_DYNAMIC_TESTIDS.DOC_OPEN(item.code)}
                    aria-label={t('requisitos', 'docOpen', { code: item.code })}
                    title={t('requisitos', 'docOpen', { code: item.code })}
                    onClick={() => onOpen(item.code)}
                    className="cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] text-fg hover:text-accent"
                  >
                    {number} {item.title}
                  </button>
                </h3>
                {html === '' ? null : <div className="rich-text !min-h-0 !border-0 !p-0 text-[14px] text-fg-2" dangerouslySetInnerHTML={{ __html: html }} />}
              </div>
              <ToneBadge state={item.state} tone={REQUIREMENT_STATE_TONE[item.state]} label={t('requisitos', `st_${item.state}`)} testId={REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE} />
            </article>
          );
        })}
      </div>
    </div>
  );
};
