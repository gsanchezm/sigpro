import { readFile } from 'node:fs/promises';
import { test, expect } from '../fixtures';

// SESIÓN 5 · Tablas, filtros, paginación y orden
// Ejercicio tipo: comprobar que los filtros y el orden de la lista muestran exactamente lo que deben.
//
// Qué se practica:
//  - paginación: «Página siguiente», número de página con `aria-current` y la URL que lo recoge;
//  - orden por columna con `aria-sort` y `toHaveText([...])` sobre la lista completa de filas;
//  - filtros: `selectOption`, búsqueda por texto, combobox ARIA 1.2 del responsable y «Limpiar filtros»;
//  - selección múltiple, barra de acciones masivas y descarga de CSV (`waitForEvent('download')`);
//  - encadenar fila → botón ⋯ → menú, y `filter({ has })`, `filter({ hasText })`, `first()`, `nth()`, `last()`, `count()`.
//
// Solo lectura: ningún test crea, edita ni borra nada, así que puede correr a la vez que los specs de escritura.
// Por eso NO afirma totales exactos (el seed tiene 24 programas, pero otro spec puede tener uno extra en ese instante):
// afirma sobre CÓDIGOS CONCRETOS del seed, sobre subconjuntos filtrados o de forma relativa.
// Subconjunto estable: «En pausa» = PRG-004, PRG-012 y PRG-020 (los únicos programas de ese estado en el seed).

const SEED_FIRST_PAGE = ['PRG-001', 'PRG-002', 'PRG-003', 'PRG-004', 'PRG-005', 'PRG-006', 'PRG-007', 'PRG-008', 'PRG-009', 'PRG-010'];
const ON_HOLD = ['PRG-004', 'PRG-012', 'PRG-020'];

test.describe('lista de programas: paginación y orden', () => {
  test('paginación: página 1 con PRG-001…010; «Página siguiente» y el número de página con aria-current', async ({ page, programsPage }) => {
    await programsPage.goto();
    await expect(programsPage.previousPage).toBeDisabled();
    await expect(programsPage.previousPage).toHaveAttribute('title', 'Ya estás en la primera página');
    await expect(programsPage.rowLinks).toHaveText(SEED_FIRST_PAGE);
    await expect(programsPage.count).toHaveText(/^1–10 de \d+$/);

    await programsPage.nextPage.click();
    await expect(programsPage.rowLinks.first()).toHaveText('PRG-011');
    await expect(programsPage.count).toHaveText(/^11–20 de \d+$/);

    // El número de página es un botón: el activo lleva `aria-current="page"` y la URL guarda `page=3`
    await page.getByRole('button', { name: 'Página 3' }).click();
    await expect(page.getByRole('button', { name: 'Página 3' })).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveURL(/page=3/);
    await expect(programsPage.count).toHaveText(/^21–\d+ de \d+$/);
    await expect(programsPage.rowLinks.first()).toHaveText('PRG-021');
  });

  test('orden por columna: aria-sort indica el criterio y las filas cambian de orden', async ({ page, programsPage }) => {
    // Se ordena dentro de un filtro para que la lista sea de tres filas fijas (ver la cabecera del archivo)
    await programsPage.goto();
    await programsPage.filterByStatus('on_hold');
    const codeHeader = page.getByRole('columnheader', { name: 'Código' });
    await expect(codeHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(programsPage.rowLinks).toHaveText(ON_HOLD);

    await page.getByRole('button', { name: /^Código/ }).click();
    await expect(codeHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(programsPage.rowLinks).toHaveText([...ON_HOLD].reverse());

    // Cambiar de columna quita el orden de la anterior: solo una columna lleva aria-sort distinto de «none»
    await page.getByRole('button', { name: /^Nombre/ }).click();
    await expect(page.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'ascending');
    await expect(codeHeader).toHaveAttribute('aria-sort', 'none');
    await expect(programsPage.rowLinks).toHaveCount(3);
  });
});

test.describe('filtros', () => {
  test('estado con selectOption, búsqueda por texto combinada y «Limpiar filtros»', async ({ page, programsPage }) => {
    await programsPage.goto();
    await programsPage.filterByStatus('on_hold');
    await expect(programsPage.rowLinks).toHaveText(ON_HOLD);
    await expect(programsPage.count).toHaveText('1–3 de 3');
    await expect(programsPage.statusFilter).toHaveValue('on_hold');

    // El texto se suma al estado: solo «gestión» dentro de «En pausa»
    await programsPage.searchFor('gestión');
    await expect(programsPage.rowLinks).toHaveText(['PRG-012']);

    // Sin coincidencias, el estado vacío explica el motivo
    await programsPage.searchFor('zzzz-no-existe');
    await expect(programsPage.empty).toContainText('Ningún programa coincide con los filtros aplicados.');

    // «Limpiar filtros» vuelve a la lista sin filtros: la página 1 del seed y el estado sin valor
    await page.getByTestId('programs-empty-clear').click();
    await expect(programsPage.rowLinks).toHaveText(SEED_FIRST_PAGE);
    await expect(programsPage.statusFilter).toHaveValue('');
    await expect(page.getByTestId('programs-filters-clear')).toBeHidden();
  });

  test('combobox ARIA de responsable: opciones, teclado (↓ e Intro) y «Quitar responsable»', async ({ page, programsPage }) => {
    await programsPage.goto();
    const owner = page.getByRole('combobox', { name: 'Responsable' });
    await owner.click();
    const listbox = page.getByRole('listbox', { name: 'Responsable' });
    await expect(owner).toHaveAttribute('aria-expanded', 'true');
    // Las opciones son las personas del tenant: no conviene contarlas (otros specs pueden registrar usuarios).
    // Se comprueba que estén los seis responsables del seed; cada opción lleva su número de programas.
    for (const name of ['Marta Ruiz', 'Javier Ortega', 'Lucía Fernández', 'Andrés Molina', 'Carmen Vidal', 'Pablo Serrano']) {
      await expect(listbox.getByRole('option', { name: new RegExp(name) })).toBeVisible();
    }
    await expect(listbox.getByRole('option', { name: /Marta Ruiz/ })).toContainText('4');

    // Escribir filtra las opciones; ↓ resalta la primera (aria-activedescendant) e Intro la elige
    await owner.fill('mar');
    await expect(listbox.getByRole('option')).toHaveCount(1);
    await owner.press('ArrowDown');
    await owner.press('Enter');
    await expect(owner).toHaveValue('Marta Ruiz');
    await expect(listbox).toBeHidden();
    await expect(programsPage.rowLinks).toHaveText(['PRG-001', 'PRG-007', 'PRG-013', 'PRG-019']);

    await page.getByRole('button', { name: 'Quitar responsable' }).click();
    await expect(owner).toHaveValue('');
    await expect(programsPage.rowLinks).toHaveText(SEED_FIRST_PAGE);
  });
});

test.describe('selección y exportación', () => {
  test('selección múltiple: contador por fila y por página, y «Quitar selección»', async ({ page, programsPage }) => {
    await programsPage.goto();
    await page.getByRole('checkbox', { name: 'Seleccionar PRG-002' }).check();
    await expect(page.getByTestId('programs-bulk-bar')).toBeVisible();
    await expect(page.getByTestId('programs-bulk-count')).toHaveText('1 seleccionados');
    await expect(page.getByTestId('programs-row-PRG-002')).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('checkbox', { name: 'Seleccionar todos los programas de la página' }).check();
    await expect(page.getByTestId('programs-bulk-count')).toHaveText('10 seleccionados');

    // La barra de acciones masivas (archivar, eliminar, exportar) desaparece al quitar la selección
    await page.getByRole('button', { name: 'Quitar selección' }).click();
    await expect(page.getByTestId('programs-bulk-bar')).toBeHidden();
  });

  test('exportar CSV: descarga con los filtros aplicados, cabecera fija y una línea por fila; y la selección', async ({ page, programsPage }) => {
    await programsPage.goto();
    await programsPage.filterByStatus('on_hold');
    await expect(programsPage.rowLinks).toHaveCount(3);

    // `waitForEvent('download')` se registra ANTES del clic: si no, la descarga puede pasar sin que la veamos
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
    expect(download.suggestedFilename()).toBe('sigpro-programas.csv');
    const lines = (await readFile(await download.path(), 'utf8')).split('\n').filter((line) => line.length > 0);
    expect(lines[0]).toBe('code;name;status;owner;start;end;budget;progress');
    // Una línea por fila visible, con el código en la primera columna y el estado en la tercera
    const rows = lines.slice(1).map((line) => line.split(';'));
    expect(rows.map((cells) => cells[0])).toEqual(ON_HOLD);
    expect(rows.every((cells) => cells[2] === 'on_hold')).toBe(true);
    await expect(page.getByTestId('toast-info')).toContainText('CSV generado');

    // «Exportar selección» no pide nada al servidor: genera el CSV con las filas marcadas
    await page.getByRole('checkbox', { name: 'Seleccionar PRG-012' }).check();
    await page.getByRole('checkbox', { name: 'Seleccionar PRG-020' }).check();
    const [selected] = await Promise.all([page.waitForEvent('download'), page.getByTestId('programs-bulk-export').click()]);
    const selectedLines = (await readFile(await selected.path(), 'utf8')).split('\n').filter((line) => line.length > 0);
    expect(selectedLines.map((line) => line.split(';')[0])).toEqual(['code', 'PRG-012', 'PRG-020']);
  });
});

test.describe('localizadores sobre la lista', () => {
  test('filter({ has }), first(), nth(), last() y count() sobre las filas con badge «En pausa»', async ({ page, programsPage }) => {
    await programsPage.goto();
    await programsPage.filterByStatus('on_hold');

    // `filter({ has })` mira los HIJOS de la fila: el badge con su estado, no el texto suelto de la página
    const paused = page.getByRole('row').filter({ has: page.locator('[data-state="on_hold"]') });
    await expect(paused).toHaveCount(3); // toHaveCount espera; `count()` solo lee el número en ese instante
    await expect(paused.first()).toContainText('PRG-004');
    await expect(paused.nth(1)).toContainText('PRG-012');
    await expect(paused.last()).toContainText('PRG-020');
    expect(await paused.count()).toBe(3);

    // `filter({ hasText })`: una sola fila, y dentro de ella el badge con su atributo de estado
    const row = page.getByRole('row').filter({ hasText: 'PRG-012' });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId('programs-state-badge')).toHaveAttribute('data-state', 'on_hold');
  });

  test('encadenar fila → botón «Acciones para…» → menú con sus opciones (admin)', async ({ page, programsPage }) => {
    await programsPage.goto();
    await programsPage.filterByStatus('on_hold');

    // El botón ⋯ se busca DENTRO de la fila: así no depende de en qué posición de la página esté el programa
    const row = page.getByRole('row').filter({ hasText: 'PRG-004' });
    await row.getByRole('button', { name: 'Acciones para PRG-004' }).click();
    const menu = page.getByRole('menu', { name: 'Acciones para PRG-004' });
    await expect(menu.getByRole('menuitem')).toHaveText(['Ver detalle', 'Editar', 'Duplicar', 'Archivar', 'Eliminar']);

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test.describe('menú de fila con el rol consultor', () => {
    test.use({ role: 'consultant' });

    test('el consultor solo puede ver el detalle: el resto de acciones aparecen deshabilitadas con su motivo', async ({ page, programsPage }) => {
      await programsPage.goto();
      await page.getByRole('button', { name: 'Acciones para PRG-001' }).click();
      await expect(page.getByRole('menuitem', { name: 'Ver detalle' })).toBeEnabled();
      for (const name of ['Editar', 'Duplicar', 'Archivar', 'Eliminar']) {
        await expect(page.getByRole('menuitem', { name })).toBeDisabled();
      }
      await expect(page.getByRole('menuitem', { name: 'Eliminar' })).toHaveAttribute('title', 'Solo admin puede eliminar');
      await page.keyboard.press('Escape');
    });
  });
});
