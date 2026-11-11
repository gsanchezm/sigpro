import { sanitizeRichText } from '@sigpro/shared';
import { useEffect, useRef, useState, type ClipboardEvent } from 'react';

interface Toolbar {
  readonly label: string;
  readonly bold: string;
  readonly italic: string;
  readonly list: string;
  readonly testId: string;
  readonly boldTestId: string;
  readonly italicTestId: string;
  readonly listTestId: string;
}

interface RichTextEditorProps {
  readonly id: string;
  /** Id del elemento que nombra el editor (`aria-labelledby`): un `<div>` no se enlaza con `<label for>`. */
  readonly labelledBy: string;
  readonly testId: string;
  readonly toolbar: Toolbar;
  readonly placeholder: string;
  /** HTML inicial; el editor no es controlado: para cargar otro contenido hay que remontarlo (`key`). */
  readonly initialHtml: string;
  readonly readOnly?: boolean;
  readonly readOnlyTitle?: string;
  /** Recibe el HTML saneado en cada cambio. */
  readonly onChange: (html: string) => void;
}

type Command = 'bold' | 'italic' | 'insertUnorderedList';
const COMMANDS: readonly Command[] = ['bold', 'italic', 'insertUnorderedList'];

/**
 * Editor enriquecido mínimo con `contenteditable` (sin librería): negrita/cursiva con botones o Ctrl+B / Ctrl+I y lista.
 * No es controlado: el DOM es la fuente de la verdad mientras se escribe, así el cursor no salta; el HTML que sale se sanea.
 */
export const RichTextEditor = ({ id, labelledBy, testId, toolbar, placeholder, initialHtml, readOnly = false, readOnlyTitle, onChange }: RichTextEditorProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Readonly<Record<Command, boolean>>>({ bold: false, italic: false, insertUnorderedList: false });

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeRichText(initialHtml);
    // Solo al montar: el contenido posterior lo gobierna el usuario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El estado de los botones (aria-pressed) sigue a la selección mientras está dentro del editor
  useEffect(() => {
    const onSelection = () => {
      const node = document.getSelection()?.anchorNode;
      if (!node || !ref.current?.contains(node)) return;
      setActive(Object.fromEntries(COMMANDS.map((command) => [command, document.queryCommandState(command)])) as Record<Command, boolean>);
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  const emit = () => onChange(sanitizeRichText(ref.current?.innerHTML ?? ''));

  const run = (command: Command) => {
    ref.current?.focus();
    document.execCommand(command);
    emit();
  };

  // Pegar siempre como texto plano: nada de HTML ajeno dentro del editor
  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    emit();
  };

  const buttons: readonly { readonly command: Command; readonly label: string; readonly testId: string; readonly glyph: string; readonly className: string }[] = [
    { command: 'bold', label: toolbar.bold, testId: toolbar.boldTestId, glyph: 'B', className: 'font-bold' },
    { command: 'italic', label: toolbar.italic, testId: toolbar.italicTestId, glyph: 'I', className: 'italic' },
    { command: 'insertUnorderedList', label: toolbar.list, testId: toolbar.listTestId, glyph: '•', className: '' },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <div role="toolbar" aria-label={toolbar.label} data-testid={toolbar.testId} className="flex gap-1">
        {buttons.map((button) => (
          <button
            key={button.command}
            type="button"
            data-testid={button.testId}
            aria-label={button.label}
            aria-pressed={active[button.command]}
            disabled={readOnly}
            title={readOnly ? readOnlyTitle : button.label}
            // Evita que el botón le quite la selección al editor
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(button.command)}
            className={`grid size-7 cursor-pointer place-items-center rounded-ctl-sm border border-border bg-surface text-[12.5px] text-fg hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-accent aria-pressed:bg-accent-soft ${button.className}`}
          >
            {button.glyph}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        id={id}
        role="textbox"
        tabIndex={0}
        aria-multiline="true"
        aria-labelledby={labelledBy}
        aria-readonly={readOnly || undefined}
        data-testid={testId}
        data-placeholder={placeholder}
        title={readOnly ? readOnlyTitle : undefined}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={emit}
        onPaste={onPaste}
        className="rich-text input !h-auto min-h-[104px] cursor-text overflow-auto px-2.5 py-2 leading-[1.5]"
      />
    </div>
  );
};
