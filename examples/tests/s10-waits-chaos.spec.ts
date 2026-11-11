import { test, expect } from '../fixtures';
import { MissionPage } from '../pages/MissionPage';
import { ProfilePage } from '../pages/ProfilePage';
import { CHAOS_OFF, adminApi, readChaos, setChaos, sharedChaos, withChaos } from '../support/chaos';
import { emitMissionEvent } from '../support/mission-api';

// SESIÓN 10 · Esperas, flakiness, retries y modo caos
// Ejercicio tipo: una suite estable con el caos activado.
//
// Escenario: el Panel de misión (/mission) recibe eventos por Socket.IO y el Perfil (/profile) tiene un botón
// «Guardar» cuyo texto alterna con el modo caos. Se practica:
//   1. Auto-espera: las aserciones de Playwright reintentan solas hasta su timeout. Describe el estado final y no
//      añadas esperas fijas («sleep»): fallan lentas en CI y pasan de largo en local, y es la causa más común de flakiness.
//   2. Condiciones sobre valores que cambian solos: `expect.poll` (un valor) y `expect(...).toPass()` (un bloque).
//   3. Esperar al hecho de red en lugar de a la pantalla: `waitForEvent('websocket')` y `framereceived`.
//   4. Modo caos: latencia y textos alternos. Se enciende por API (`PATCH /api/admin/chaos`), nunca desde la UI.
//   5. `test.step`, `expect.soft`, `test.slow()`, `retries` y `testInfo.retry`.
//
// Fallo frente a inestable. Un FALLO es una comprobación que no se cumple (un locator que no existe, un texto distinto).
// Un test INESTABLE pasa o falla según el momento. Es peor que un fallo: si los reintentos lo tapan, la CI lo da por
// bueno. Por eso los reintentos no esconden nada: el test que pasa tras reintentar queda anotado como «inestable».
//
// Convivencia. El caos es del TENANT entero y otros specs corren contra el mismo tenant a la vez. Aquí solo usamos
// latencias ≤ 400 ms y `flakyLabels`, nunca `errorRate`. Cada bloque enciende el caos con `withChaos` (que lo apaga
// en un `finally`) y el bloque lo apaga también en `afterAll`. Solo leemos o emitimos eventos del simulador: no se
// escribe nada en la base de datos, así que no se pisan datos de otros tests.

const KPI_NAMES = ['Programas activos', 'Hitos cumplidos', 'NC abiertas', 'Verificación superada'] as const;

test.describe('esperas y auto-espera', () => {
  test('auto-espera: toBeVisible reintenta hasta que el evento aparece en el feed', async ({ page, apiAs }) => {
    // Playwright reintenta cada aserción hasta su timeout. El evento llega por el socket unos milisegundos después
    // del POST, así que no hace falta esperar en ningún sitio: se describe lo que debe verse y ya.
    const mission = new MissionPage(page);
    await mission.goto();
    await mission.waitUntilLive();

    const emitted = await emitMissionEvent(await apiAs('admin'));

    await expect(mission.event(emitted.seq)).toBeVisible();
    await expect(mission.event(emitted.seq)).toHaveAttribute('data-origin', emitted.origin);
    await expect(mission.event(emitted.seq)).toHaveAttribute('data-severity', emitted.severity);
  });

  test('expect.poll: espera a que cambie un valor que nadie toca (el número de secuencia más alto)', async ({ page, apiAs }) => {
    // Contar filas no sirve: el simulador añade eventos cada pocos segundos, así que el número de filas puede subir
    // o quedarse en el máximo sin que nada falle. El `seq` solo sube: es un valor fiable para esperar.
    const mission = new MissionPage(page);
    await mission.goto();
    await mission.waitUntilLive();

    const emitted = await emitMissionEvent(await apiAs('admin'));

    await expect
      .poll(() => mission.latestSeq(), { message: 'llega el evento emitido al feed', timeout: 10_000, intervals: [100, 250, 500] })
      .toBeGreaterThanOrEqual(emitted.seq);
  });

  test('expect(...).toPass(): reintenta un bloque entero de aserciones hasta que todas se cumplen a la vez', async ({ page, apiAs }) => {
    // `expect.poll` vigila UN valor; `toPass` reintenta un bloque con varias comprobaciones y da el bloque por bueno
    // cuando TODAS pasan en la misma vuelta. El bloque debe ser idempotente: solo lee, nunca escribe.
    const mission = new MissionPage(page);
    await mission.goto();
    await mission.waitUntilLive();

    const emitted = await emitMissionEvent(await apiAs('admin'));

    await expect(async () => {
      expect(await mission.connection.getAttribute('data-state')).toBe('live');
      expect(await mission.latestSeq()).toBeGreaterThanOrEqual(emitted.seq);
      expect(await mission.event(emitted.seq).isVisible()).toBe(true);
    }).toPass({ timeout: 10_000, intervals: [200, 500, 1000] });
  });

  test('waitForEvent: espera al WebSocket y a la trama del evento, no a la pantalla', async ({ page, apiAs }) => {
    // Los oyentes de red se registran ANTES de la acción que los dispara (el `goto` o el `POST`); si no, se pierden.
    // Una trama `mission:event` puede ser de un evento del simulador, así que la prueba real es la fila con nuestro `seq`.
    const socketOpened = page.waitForEvent('websocket', (socket) => socket.url().includes('/socket.io/'));
    const mission = new MissionPage(page);
    await mission.goto();
    const socket = await socketOpened;
    await mission.waitUntilLive();

    const frameReceived = socket.waitForEvent('framereceived', (frame) => String(frame.payload).includes('mission:event'));
    const emitted = await emitMissionEvent(await apiAs('admin'));
    await frameReceived;

    await expect(mission.event(emitted.seq)).toBeVisible();
  });

  test('test.step y expect.soft: el recorrido se lee por pasos y las comprobaciones blandas no se detienen en la primera', async ({ page }) => {
    const mission = new MissionPage(page);

    await test.step('abrir el panel en directo', async () => {
      await mission.goto();
      await mission.waitUntilLive();
    });

    await test.step('comprobar la cabecera, las acciones y los cuatro indicadores', async () => {
      // `expect.soft` registra el fallo y sigue: el informe lista TODAS las comprobaciones que no se cumplen
      await expect.soft(mission.heading).toBeVisible();
      await expect.soft(mission.simulate).toBeEnabled();
      for (const name of KPI_NAMES) {
        await expect.soft(mission.kpi(name)).toBeVisible();
      }
      await expect.soft(mission.kpis.getByRole('article')).toHaveCount(KPI_NAMES.length);
    });

    await test.step('el feed es una lista con su nombre accesible y su contador', async () => {
      await expect.soft(mission.feed).toBeVisible();
      await expect.soft(mission.feedCount).toContainText('eventos');
    });
  });

  test('pausa del feed: lo visible no cambia mientras llegan eventos, y al reanudar aparecen', async ({ page, apiAs }) => {
    // Para comprobar algo «quieto» se lee ANTES y DESPUÉS de provocar el evento. Con la pausa, el servidor sigue
    // emitiendo pero la pantalla se congela: la comparación es exacta y no necesita esperas.
    const mission = new MissionPage(page);
    await mission.goto();
    await mission.waitUntilLive();
    const api = await apiAs('admin');

    await mission.pauseToggle.click();
    await expect(page.getByRole('button', { name: 'Reanudar feed' })).toHaveAttribute('aria-pressed', 'true');
    const frozen = await mission.latestSeq();

    const emitted = await emitMissionEvent(api);
    await expect(mission.pausedNote).toContainText('en espera');
    expect(await mission.latestSeq()).toBe(frozen);

    await page.getByRole('button', { name: 'Reanudar feed' }).click();
    await expect(mission.pausedNote).toBeHidden();
    await expect(mission.event(emitted.seq)).toBeVisible();
  });
});

test.describe('modo caos (tenant compartido)', () => {
  // Los tests de caos comparten el interruptor del tenant: van en serie. El `retries: 1` admite un reintento por
  // la latencia, pero un test que pasa en el segundo intento se anota como inestable (ver `afterEach`).
  test.describe.configure({ mode: 'serial', retries: 1 });

  test.beforeAll(async ({ request }) => {
    // Estado conocido al empezar: si una ejecución anterior se cortó con el caos encendido, lo apagamos aquí.
    await setChaos(await adminApi(request), CHAOS_OFF);
  });

  test.afterAll(async ({ request }) => {
    // Red de seguridad: `withChaos` ya apaga en su `finally`, pero si el proceso muere no hay `finally` que valga.
    await setChaos(await adminApi(request), CHAOS_OFF);
  });

  test.afterEach(async ({}, testInfo) => {
    // Un test que solo pasa tras reintentar no es sano: lo anotamos para que aparezca como inestable en el informe.
    if (testInfo.retry > 0) {
      testInfo.annotations.push({ type: 'inestable', description: `pasó en el intento ${testInfo.retry + 1}: revisar antes de darlo por bueno` });
    }
  });

  test('withChaos apaga el caos aunque el cuerpo falle (finally) y no deja el tenant sucio', async ({ apiAs }) => {
    // Sin navegador: solo API. Es la forma más habitual de dejar un tenant sucio: un test que enciende el caos y falla a medias.
    const api = await apiAs('admin');

    await expect(
      withChaos(api, sharedChaos({ latencyMs: 200 }), async () => {
        expect(await readChaos(api)).toMatchObject({ latencyMs: 200, flakyLabels: true });
        throw new Error('fallo a propósito dentro del bloque');
      }),
    ).rejects.toThrow('fallo a propósito dentro del bloque');

    expect(await readChaos(api)).toEqual(CHAOS_OFF);
  });

  test('un locator por rol con regex sobrevive a los dos textos del caos; el de nombre exacto parpadea', async ({ page, apiAs }) => {
    // El caos alterna «Guardar» y «Guardar cambios» cada 2,5 s:
    //  - /^Guardar( cambios)?$/ encuentra el botón en las dos fases: sobrevive.
    //  - { name: 'Guardar', exact: true } solo lo encuentra en la fase «Guardar»: parpadea.
    // No dependemos del momento: como un ciclo dura 5 s, esperamos a VER los dos textos (`expect.poll`) y contamos
    // mientras tanto cuántas veces acierta el locator frágil.
    const api = await apiAs('admin');

    await withChaos(api, sharedChaos({ latencyMs: 0 }), async () => {
      const profile = new ProfilePage(page);
      await profile.goto();

      const labels = new Set<string>();
      const exactHits = new Set<number>();
      await expect
        .poll(
          async () => {
            labels.add(((await profile.save.textContent()) ?? '').trim());
            exactHits.add(await profile.saveExact.count());
            return labels.size;
          },
          { message: 'se ven los dos textos alternos', timeout: 15_000, intervals: [200] },
        )
        .toBe(2);

      expect(labels).toEqual(new Set(['Guardar', 'Guardar cambios']));
      expect(exactHits).toEqual(new Set([0, 1]));

      // El locator resiliente encuentra el botón con cualquiera de los dos textos y comprueba su estado real
      await expect(profile.save).toBeDisabled();
      await expect(profile.save).toHaveAttribute('title', 'No hay cambios que guardar');
    });
  });

  test('test.slow(): el panel carga con hasta 300 ms de latencia aleatoria por petición', async ({ page, apiAs }) => {
    // `test.slow()` triplica el timeout del TEST entero, no el de cada aserción. Úsalo cuando el caos añade una latencia
    // conocida y acotada. Si un test tarda siempre, lo honesto es medirlo y revisarlo, no subir timeouts a ciegas.
    test.slow();
    const api = await apiAs('admin');

    await withChaos(api, sharedChaos({ latencyMs: 300 }), async () => {
      const mission = new MissionPage(page);
      await mission.goto();
      await mission.waitUntilLive();

      // Valor fiable aunque otros specs muevan datos: solo comprobamos que es un número
      await expect(mission.kpiValues.first()).toHaveText(/^\d+$/);
      await expect(mission.kpi('Programas activos')).toBeVisible();
    });
  });
});
