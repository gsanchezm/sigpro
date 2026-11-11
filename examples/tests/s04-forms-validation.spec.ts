import { test, expect } from '../fixtures';
import { ProgramWizard } from '../pages/ProgramWizard';
import { countProgramsTagged, createProgram, deleteProgramsTagged, programBody, uniqueTag } from '../support/programs';

// SESIÓN 4 · Formularios, validaciones y date pickers
// Ejercicio tipo: crear un programa con fechas incoherentes y ver el error.
//
// Qué se practica:
//  - validación de cliente por paso: el asistente NO avanza mientras el paso no sea válido;
//  - `fill` sobre un `<input type="date">` con formato ISO (AAAA-MM-DD), independientemente del idioma del navegador;
//  - radios, casillas y conmutadores: `check()`, `uncheck()`, `toBeChecked()` y `aria-checked`;
//  - el error 422 del SERVIDOR (un nombre que contiene «duplicado») y cómo la UI lo devuelve al campo correspondiente;
//  - el formulario de edición: «Guardar» (activo solo con cambios) frente a «Guardar y cerrar» (`exact`).
//
// Datos: cada test crea sus propios programas con un nombre único que contiene una etiqueta (`s04-…`) y los borra por API
// al terminar, pase o falle. Así no toca los programas del seed ni los de otros specs que corren a la vez.
// Solo usa los estados `draft` y `active`: `on_hold` es el filtro que comprueba la sesión 5.

test.describe.configure({ mode: 'serial' });

let tag = '';

test.beforeEach(() => {
  tag = uniqueTag('s04');
});

test.afterEach(async ({ apiAs }) => {
  await deleteProgramsTagged(await apiAs('admin'), tag);
});

test.describe('asistente «Nuevo programa»', () => {
  test('paso 1: sin nombre válido ni responsable, el asistente no avanza', async ({ page, programsPage, apiAs }) => {
    await programsPage.goto();
    const wizard = new ProgramWizard(page);
    await wizard.open();
    await expect(wizard.dialog).toContainText('Paso 1 de 3');
    await expect(wizard.step(1)).toHaveAttribute('aria-current', 'step');

    // En el primer paso «Atrás» está deshabilitado y su `title` explica por qué
    await expect(wizard.back).toBeDisabled();
    await expect(wizard.back).toHaveAttribute('title', 'Estás en el primer paso');

    // Nombre de 2 caracteres y ningún responsable: el error sale en cada campo, sin llegar al servidor
    await wizard.name.fill('ab');
    await wizard.next.click();
    await expect(wizard.nameError).toHaveText('El nombre debe tener al menos 3 caracteres');
    await expect(wizard.ownerError).toHaveText('Selecciona un responsable de la lista');
    await expect(wizard.name).toHaveAttribute('aria-invalid', 'true');
    await expect(wizard.step(1)).toHaveAttribute('aria-current', 'step');

    await wizard.close();
    expect(await countProgramsTagged(await apiAs('admin'), tag)).toBe(0);
  });

  test('paso 2: fechas incoherentes y presupuesto cero se avisan campo a campo y no se avanza', async ({ page, programsPage, apiAs }) => {
    await programsPage.goto();
    const wizard = new ProgramWizard(page);
    await wizard.open();
    await wizard.fillStepOne(`Programa ${tag}`, 'Andrés Molina', 'active');
    await expect(wizard.dialog).toContainText('Paso 2 de 3');

    // Sin fechas ni presupuesto: tres mensajes a la vez
    await wizard.next.click();
    await expect(wizard.startError).toHaveText('La fecha de inicio es obligatoria');
    await expect(wizard.endError).toHaveText('La fecha de fin debe ser posterior al inicio');
    await expect(wizard.budgetError).toHaveText('El presupuesto debe ser mayor que 0');

    // Fin igual que inicio: incoherente. Presupuesto 0: no válido. Formato ISO en los dos date pickers.
    await wizard.startDate.fill('2026-03-01');
    await wizard.endDate.fill('2026-03-01');
    await wizard.budget.fill('0');
    await wizard.next.click();
    await expect(wizard.endError).toBeVisible();
    await expect(wizard.budgetError).toBeVisible();
    await expect(wizard.step(2)).toHaveAttribute('aria-current', 'step');

    // Corregido el último campo, el paso 3 ya es alcanzable
    await wizard.endDate.fill('2027-09-30');
    await wizard.budget.fill('1500000');
    await wizard.next.click();
    await expect(wizard.dialog).toContainText('Paso 3 de 3');
    await expect(wizard.endError).toBeHidden();

    // Cancelar a mitad de camino no deja ningún programa
    await wizard.close();
    expect(await countProgramsTagged(await apiAs('admin'), tag)).toBe(0);
  });

  test('paso 2: radios y casilla se marcan con check(); el switch del resumen cambia su aria-checked', async ({ page, programsPage, apiAs }) => {
    await programsPage.goto();
    const wizard = new ProgramWizard(page);
    await wizard.open();
    await wizard.fillStepOne(`Programa ${tag}`, 'Andrés Molina', 'draft');

    // Radios: solo uno marcado a la vez. `check()` deja el radio marcado; el otro se desmarca solo.
    const high = page.getByRole('radio', { name: 'Alta' });
    const low = page.getByRole('radio', { name: 'Baja' });
    await high.check();
    await expect(high).toBeChecked();
    await low.check();
    await expect(low).toBeChecked();
    await expect(high).not.toBeChecked();
    await high.check();

    // Casilla: `check()` es idempotente (llamarlo dos veces no la desmarca); `uncheck()` la quita
    const classified = page.getByRole('checkbox', { name: 'Programa clasificado' });
    await classified.check();
    await classified.check();
    await expect(classified).toBeChecked();
    await classified.uncheck();
    await expect(classified).not.toBeChecked();
    await classified.check();

    await wizard.startDate.fill('2026-03-01');
    await wizard.endDate.fill('2027-09-30');
    await wizard.budget.fill('250000');
    await wizard.next.click();

    // En el resumen, el switch «notificar» va activo por defecto: su estado está en aria-checked, no en una clase
    const notify = page.getByRole('switch', { name: 'Notificar al equipo por correo' });
    await expect(notify).toHaveAttribute('aria-checked', 'true');
    await notify.click();
    await expect(notify).toHaveAttribute('aria-checked', 'false');

    await wizard.close();
    expect(await countProgramsTagged(await apiAs('admin'), tag)).toBe(0);
  });

  test('alta correcta: fechas en ISO, resumen con formato español y el programa aparece en la lista', async ({ page, programsPage }) => {
    await programsPage.goto();
    const wizard = new ProgramWizard(page);
    await wizard.open();
    await wizard.fillStepOne(`Programa de pruebas ${tag}`, 'Andrés Molina', 'active');

    await wizard.startDate.fill('2026-03-01');
    await wizard.endDate.fill('2027-09-30');
    await wizard.budget.fill('1500000');
    await page.getByRole('radio', { name: 'Alta' }).check();
    await page.getByRole('checkbox', { name: 'Programa clasificado' }).check();
    await wizard.next.click();

    // El resumen muestra lo que se va a enviar: la fecha ISO se pinta como dd/mm/aaaa y el presupuesto con separadores
    await expect(wizard.summary).toContainText(`Programa de pruebas ${tag}`);
    await expect(wizard.summary).toContainText('Andrés Molina');
    await expect(wizard.summary).toContainText('01/03/2026 → 30/09/2027');
    await expect(wizard.summary).toContainText('1.500.000');

    await wizard.submit.click();
    await expect(page.getByTestId('toast-ok')).toContainText('Programa creado');
    await expect(wizard.dialog).toBeHidden();

    // Se localiza por el nombre (no por el código, que asigna el servidor)
    await programsPage.searchFor(tag);
    await expect(programsPage.rowLinks).toHaveCount(1);
    const row = page.getByRole('row').filter({ hasText: tag });
    await expect(row.getByTestId('programs-state-badge')).toHaveAttribute('data-state', 'active');
  });

  test('422: un nombre que contiene «duplicado» vuelve al paso 1 con el error del servidor', async ({ page, programsPage, apiAs }) => {
    await programsPage.goto();
    const wizard = new ProgramWizard(page);
    await wizard.open();
    // La validación de cliente no conoce la regla de «duplicado»: la decide el servidor, con un 422
    await wizard.fillStepOne(`Programa duplicado ${tag}`, 'Andrés Molina', 'draft');
    await wizard.startDate.fill('2026-01-10');
    await wizard.endDate.fill('2026-12-31');
    await wizard.budget.fill('250000');
    await wizard.next.click();
    await wizard.submit.click();

    await expect(wizard.serverError).toContainText('422');
    await expect(wizard.serverError).toContainText('Ya existe un programa con ese nombre');
    // El error vuelve al campo que lo causa: el asistente regresa al paso 1 y marca el nombre
    await expect(wizard.nameError).toHaveText('Ya existe un programa con ese nombre');
    await expect(wizard.step(1)).toHaveAttribute('aria-current', 'step');

    await wizard.close();
    expect(await countProgramsTagged(await apiAs('admin'), tag)).toBe(0); // el 422 no dejó nada a medias
  });
});

test.describe('formulario de edición /programs/:code/edit', () => {
  test('«Guardar» solo se activa con cambios y muestra el error de fechas en su campo', async ({ page, apiAs }) => {
    // Arrange por API: un programa propio, en borrador, con fechas válidas
    const program = await createProgram(await apiAs('admin'), programBody(`Edición ${tag}`));
    await page.goto(`/programs/${program.code}/edit`);
    await expect(page.getByRole('heading', { level: 1, name: 'Editar programa' })).toBeVisible();
    await expect(page.getByLabel('Código')).toHaveValue(program.code);

    // Sin cambios, «Guardar» está deshabilitado y su `title` lo dice. El texto puede alternar en modo caos: por eso la expresión.
    const save = page.getByRole('button', { name: /^Guardar( cambios)?$/ });
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute('title', 'No hay cambios que guardar');

    await page.getByLabel('Descripción').fill(`Descripción revisada ${tag}`);
    await expect(save).toBeEnabled();

    // Fin anterior al inicio: el error aparece en el campo de fin
    await page.getByLabel('Fecha de fin').fill('2026-01-01');
    await save.click();
    await expect(page.getByTestId('program-edit-end-error')).toHaveText('La fecha de fin debe ser posterior al inicio');

    // Corregida la fecha, guardar muestra el toast con el código del programa
    await page.getByLabel('Fecha de fin').fill('2027-12-31');
    await save.click();
    const toast = page.getByTestId('toast-ok');
    await expect(toast).toContainText('Programa actualizado');
    await expect(toast).toContainText(`${program.code} se guardó correctamente`);
    await expect(save).toBeDisabled(); // tras guardar ya no hay cambios pendientes
  });

  test('«Guardar y cerrar» guarda los cambios y vuelve al detalle del programa', async ({ page, apiAs }) => {
    const program = await createProgram(await apiAs('admin'), programBody(`Cierre ${tag}`));
    await page.goto(`/programs/${program.code}/edit`);

    await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(`Cierre ${tag} (revisado)`);
    await page.getByRole('radio', { name: 'Alta' }).check();

    // «Guardar» y «Guardar y cerrar» se solapan a propósito: exact distingue el segundo
    await page.getByRole('button', { name: 'Guardar y cerrar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/programs/${program.code}$`));
    await expect(page.getByRole('heading', { level: 1, name: `Cierre ${tag} (revisado)` })).toBeVisible();
    await expect(page.getByTestId('program-detail-state-badge')).toHaveAttribute('data-state', 'draft');
  });
});
