import { NC_DYNAMIC_TESTIDS, NC_SEVERITIES, NC_SEVERITY_TONE, NC_TESTIDS, type NcSeverity, type Tone } from '@sigpro/shared';
import { isSelectKey, isSeverity, moveFocusIndex, parseSeverityLabels, tabStopIndex } from './severity-picker-rules';

// Web component `<sigpro-severity-picker>`: selector de severidad de las no conformidades con Shadow DOM ABIERTO.
// Dentro del shadow hay un `role="listbox"` con tres `role="option"`; Playwright los atraviesa por defecto
// (`getByRole('option', { name: 'Crítica' })`). Atributos: `value`, `disabled`, `label` (nombre accesible del listbox)
// y `labels` (JSON con los textos ya traducidos). Emite `change` (CustomEvent, `detail.value`, `bubbles` y `composed`).

export const SEVERITY_PICKER_TAG = 'sigpro-severity-picker';

const TONE_VARS: Readonly<Record<Tone, { readonly fg: string; readonly soft: string }>> = {
  neutral: { fg: 'var(--neutral)', soft: 'var(--neutral-soft)' },
  info: { fg: 'var(--info)', soft: 'var(--info-soft)' },
  warn: { fg: 'var(--warn)', soft: 'var(--warn-soft)' },
  ok: { fg: 'var(--ok)', soft: 'var(--ok-soft)' },
  danger: { fg: 'var(--danger)', soft: 'var(--danger-soft)' },
  purple: { fg: 'var(--purple)', soft: 'var(--purple-soft)' },
};

/** Estilos del shadow: las variables CSS del design system heredan a través de la frontera del Shadow DOM. */
const STYLE = `
  :host { display: inline-block; }
  [role='listbox'] { display: flex; flex-wrap: wrap; gap: 6px; }
  [role='option'] {
    display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; box-sizing: border-box;
    border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--text);
    font-size: 12.5px; line-height: 1; cursor: pointer; user-select: none; outline: none;
  }
  [role='option']::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--tone-fg); flex: none; }
  [role='option']:hover { background: var(--surface-2); }
  [role='option'][aria-selected='true'] { border-color: var(--tone-fg); background: var(--tone-soft); color: var(--tone-fg); font-weight: 600; }
  [role='option']:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
  [role='listbox'][aria-disabled='true'] [role='option'] { opacity: 0.55; cursor: not-allowed; }
`;

export class SigproSeverityPicker extends HTMLElement {
  static readonly observedAttributes = ['value', 'disabled', 'labels', 'label'];

  private listbox: HTMLElement | null = null;
  private readonly options = new Map<NcSeverity, HTMLElement>();

  connectedCallback(): void {
    this.build();
    this.sync();
  }

  attributeChangedCallback(): void {
    if (this.listbox) this.sync();
  }

  /** Severidad elegida (o `null`); escribirla refleja el atributo `value`. */
  get value(): NcSeverity | null {
    const raw = this.getAttribute('value');
    return isSeverity(raw) ? raw : null;
  }

  set value(next: NcSeverity | null) {
    if (next === null) this.removeAttribute('value');
    else this.setAttribute('value', next);
  }

  private get isDisabled(): boolean {
    return this.hasAttribute('disabled') && this.getAttribute('disabled') !== 'false';
  }

  private build(): void {
    if (this.listbox) return;
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    listbox.setAttribute('data-testid', NC_TESTIDS.SEVERITY_PICKER_LISTBOX);
    listbox.addEventListener('keydown', (event) => this.onKeyDown(event));

    NC_SEVERITIES.forEach((severity) => {
      const option = document.createElement('div');
      const tone = TONE_VARS[NC_SEVERITY_TONE[severity]];
      option.setAttribute('role', 'option');
      option.setAttribute('data-severity', severity);
      option.setAttribute('data-testid', NC_DYNAMIC_TESTIDS.SEVERITY_OPTION(severity));
      option.style.setProperty('--tone-fg', tone.fg);
      option.style.setProperty('--tone-soft', tone.soft);
      option.addEventListener('click', () => this.select(severity));
      this.options.set(severity, option);
      listbox.append(option);
    });
    root.replaceChildren(style, listbox);
    this.listbox = listbox;
  }

  /** Vuelca los atributos al DOM del shadow: textos, `aria-selected`, `aria-disabled` y el tabindex itinerante. */
  private sync(): void {
    const listbox = this.listbox;
    if (!listbox) return;
    const labels = parseSeverityLabels(this.getAttribute('labels'));
    const { value, isDisabled } = this;
    const tabStop = tabStopIndex(value);
    listbox.setAttribute('aria-label', this.getAttribute('label') ?? '');
    listbox.setAttribute('aria-disabled', String(isDisabled));
    NC_SEVERITIES.forEach((severity, index) => {
      const option = this.options.get(severity);
      if (!option) return;
      option.textContent = labels[severity];
      option.setAttribute('aria-selected', String(value === severity));
      option.setAttribute('aria-disabled', String(isDisabled));
      option.tabIndex = !isDisabled && index === tabStop ? 0 : -1;
    });
  }

  private select(severity: NcSeverity): void {
    if (this.isDisabled || this.value === severity) return;
    this.value = severity;
    this.dispatchEvent(new CustomEvent('change', { detail: { value: severity }, bubbles: true, composed: true }));
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.isDisabled) return;
    const focused = NC_SEVERITIES.findIndex((severity) => this.options.get(severity) === this.shadowRoot?.activeElement);
    if (focused < 0) return;
    if (isSelectKey(event.key)) {
      event.preventDefault();
      const severity = NC_SEVERITIES[focused];
      if (severity) this.select(severity);
      return;
    }
    const next = moveFocusIndex(event.key, focused, NC_SEVERITIES.length);
    if (next === null) return;
    event.preventDefault();
    const target = NC_SEVERITIES[next];
    const option = target ? this.options.get(target) : undefined;
    if (!option) return;
    // Roving tabindex: el foco se mueve sin cambiar la elección (Enter o Espacio eligen)
    this.options.forEach((candidate) => (candidate.tabIndex = -1));
    option.tabIndex = 0;
    option.focus();
  }
}

/** Registra el elemento una sola vez (idempotente: HMR y varios imports no lo definen dos veces). */
export const defineSeverityPicker = (): void => {
  if (typeof customElements === 'undefined' || customElements.get(SEVERITY_PICKER_TAG)) return;
  customElements.define(SEVERITY_PICKER_TAG, SigproSeverityPicker);
};
