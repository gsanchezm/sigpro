import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object del Panel de misión (`/mission`), para las sesiones 10 y 11.
 *
 * Lo que hay que saber del DOM real:
 *  - el feed es una LISTA ORDENADA (`<ol>` con `<li>`), no un `role="feed"`: se localiza por su nombre accesible;
 *  - cada evento lleva `data-testid="mission-event-<seq>"`; el `seq` solo sube, así que es la referencia estable;
 *  - el simulador emite un evento cada pocos segundos mientras haya un navegador conectado: el número de filas
 *    cambia solo. Por eso se compara el `seq` más alto y no el número de filas.
 *  - las aserciones viven en los specs; aquí solo hay las esperas necesarias para que la página esté lista.
 */
export class MissionPage {
  readonly heading: Locator;
  readonly connection: Locator;
  readonly simulate: Locator;
  readonly pauseToggle: Locator;
  readonly kpis: Locator;
  readonly kpiValues: Locator;
  readonly feedSection: Locator;
  readonly feed: Locator;
  readonly feedRows: Locator;
  readonly feedCount: Locator;
  readonly pausedNote: Locator;
  readonly charts: Locator;
  readonly bell: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Panel de misión' });
    // Indicador de conexión: un `role="status"` con el texto «En vivo». Su `data-state` dice el estado real
    this.connection = page.getByRole('status').filter({ hasText: 'En vivo' });
    this.simulate = page.getByRole('button', { name: 'Simular evento' });
    // Un único botón que cambia de nombre: «Pausar feed» ↔ «Reanudar feed»
    this.pauseToggle = page.getByRole('button', { name: /^(Pausar|Reanudar) feed$/ });
    this.kpis = page.getByRole('region', { name: 'Indicadores clave' });
    this.kpiValues = page.getByTestId(/^mission-kpi-value-/); // respaldo: el valor grande no tiene nombre accesible
    this.feedSection = page.getByRole('region', { name: 'Eventos en directo' });
    this.feed = page.getByRole('list', { name: 'Eventos de misión en directo' });
    this.feedRows = page.getByTestId(/^mission-event-\d+$/); // respaldo: cada fila se identifica por su número de secuencia
    this.feedCount = page.getByTestId('mission-feed-count'); // respaldo: «N eventos» no es un nombre accesible
    this.pausedNote = page.getByTestId('mission-feed-paused-note');
    this.charts = page.getByTestId(/^mission-chart-/); // respaldo: las gráficas se nombran con texto largo y variable
    this.bell = page.getByRole('button', { name: /^Notificaciones/ });
  }

  /** Abre el panel y espera a que los indicadores terminen de cargar. */
  async goto(): Promise<void> {
    await this.page.goto('/mission');
    await expect(this.heading).toBeVisible();
    await expect(this.kpis).toHaveAttribute('aria-busy', 'false');
  }

  /** Espera a que el socket esté conectado. Hasta entonces, un evento emitido podría perderse en pantalla. */
  async waitUntilLive(): Promise<void> {
    await expect(this.connection).toHaveAttribute('data-state', 'live');
  }

  /** Fila de un evento concreto del feed. */
  event(seq: number): Locator {
    return this.page.getByTestId(`mission-event-${seq}`);
  }

  /** Indicador clave por su título visible («Programas activos»…): cada uno es un `article` con `aria-labelledby`. */
  kpi(name: string): Locator {
    return this.page.getByRole('article', { name });
  }

  /** Número de secuencia más alto pintado en el feed (0 si no hay ninguno). Es una lectura puntual: no espera. */
  async latestSeq(): Promise<number> {
    return this.feedRows.evaluateAll((rows) => {
      const seqs = rows.map((row) => Number((row.getAttribute('data-testid') ?? '').replace('mission-event-', '')));
      return Math.max(0, ...seqs);
    });
  }
}
