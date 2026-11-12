interface MetricProps {
  readonly testId: string;
  readonly label: string;
  readonly value: string;
  readonly aux: string;
  /** Si se indica, la tarjeta lleva una barra de progreso de 6 px (con `title` y `aria-valuenow`). */
  readonly percent?: number;
}

/** Tarjeta de métrica del design system: etiqueta, cifra grande, línea auxiliar y barra opcional. Un grupo con nombre accesible. */
export const Metric = ({ testId, label, value, aux, percent }: MetricProps) => (
  <div role="group" aria-label={label} data-testid={testId} className="metric">
    <span className="metric-label">{label}</span>
    <span className="metric-value">{value}</span>
    {percent === undefined ? null : (
      <div role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} title={`${percent} %`} className="metric-bar">
        <span style={{ width: `${percent}%` }} />
      </div>
    )}
    <span className="metric-aux">{aux}</span>
  </div>
);
