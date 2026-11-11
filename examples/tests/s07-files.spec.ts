import { expect, test } from '../fixtures';
import { DocumentsPage } from '../pages/DocumentsPage';
import { VerificationPage } from '../pages/VerificationPage';
import { bigPng, jpeg, pdf, png, readDownload, text } from '../support/files';

// SESIÓN 7 · Archivos: upload, download, iframes
// Ejercicio tipo: adjuntar evidencia PNG; descargar informe y validar el nombre.
//
// Qué se practica:
//  1) `setInputFiles` con un archivo y con varios, usando buffers en memoria (`{ name, mimeType, buffer }`).
//  2) Validación de tipo y tamaño en el cliente: un .txt y un PNG de más de 2 MB.
//  3) La zona de arrastre: el selector nativo (`filechooser`) y un `drop` simulado con `DataTransfer`.
//  4) Enviar una ejecución con evidencia y descargar el archivo que acabas de subir.
//  5) Informes PDF: el nombre que sugiere el servidor (`suggestedFilename()`) y el contenido del fichero.
//  6) El visor de documentos en `<iframe>` (`frameLocator`) y el enlace «Abrir en nueva pestaña» (`context.waitForEvent('page')`).
//
// Datos compartidos: otros specs usan el mismo tenant a la vez. Este spec solo AÑADE una ejecución al caso TC-008 (PRG-001),
// identificada por un marcador único, y no afirma números absolutos (ni de ejecuciones ni de filas): compara con lo que ve.

// El consultor registra ejecuciones y descarga informes. Todo el archivo corre como consultor.
test.use({ role: 'consultant' });

test.describe('evidencias en el formulario de ejecución', () => {
  test('setInputFiles: un archivo y después varios; la miniatura se localiza por su texto alternativo', async ({ page }) => {
    const verification = new VerificationPage(page);
    await verification.gotoCase('TC-008');
    await expect(verification.noFiles).toBeVisible();

    // Un archivo: `setInputFiles` recibe un buffer en memoria; no hace falta ningún fichero en disco
    await verification.attachOne.setInputFiles(png('captura-1.png'));
    await expect(verification.fileItems).toHaveCount(1);
    // La miniatura es un <img> con alt «Vista previa de <nombre>»: el alt es el locator, no el src
    await expect(page.getByAltText('Vista previa de captura-1.png')).toBeVisible();

    // Varios archivos: la entrada múltiple acepta una lista y los añade a los que ya había
    await verification.attachMany.setInputFiles([jpeg('foto.jpg'), pdf('informe.pdf')]);
    await expect(verification.fileItems).toHaveCount(3);
    await expect(verification.fileItems.nth(2)).toContainText('informe.pdf');
  });

  test('validación en el cliente: un .txt y un PNG de más de 2 MB se rechazan con aviso y no entran en la lista', async ({ page }) => {
    const verification = new VerificationPage(page);
    await verification.gotoCase('TC-008');

    await verification.attachOne.setInputFiles(text('notas.txt'));
    await expect(verification.fileErrors).toContainText('notas.txt: solo se admiten PNG, JPEG o PDF');

    // Aunque la firma sea de PNG, el tamaño lo rechaza: el aviso va en un role="alert"
    await verification.attachOne.setInputFiles(bigPng('enorme.png'));
    await expect(verification.fileErrors).toContainText('enorme.png: supera los 2 MB');

    // Lo rechazado no ocupa sitio en la lista
    await expect(verification.fileItems).toHaveCount(0);
    await expect(verification.noFiles).toBeVisible();
  });

  test('zona de arrastre: el selector nativo (filechooser), un drop con DataTransfer y el máximo de 5', async ({ page }) => {
    const verification = new VerificationPage(page);
    await verification.gotoCase('TC-008');

    // 1) Clic en la zona: se abre el selector nativo. `filechooser` lo intercepta antes de que aparezca
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), verification.dropzone.click()]);
    await chooser.setFiles([png('selector-1.png'), png('selector-2.png')]);
    await expect(verification.fileItems).toHaveCount(2);

    // 2) Arrastrar: Playwright no puede arrastrar desde el sistema de archivos; se simula con un DataTransfer en la página
    const transfer = await page.evaluateHandle(() => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'arrastrado-1.png', { type: 'image/png' }));
      data.items.add(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])], 'arrastrado-2.png', { type: 'image/png' }));
      return data;
    });
    await verification.dropzone.dispatchEvent('dragover', { dataTransfer: transfer });
    await expect(verification.dropzone).toHaveAttribute('data-over', 'true'); // la zona se resalta mientras algo está encima
    await verification.dropzone.dispatchEvent('drop', { dataTransfer: transfer });
    await expect(verification.dropzone).toHaveAttribute('data-over', 'false');
    await expect(verification.fileItems).toHaveCount(4);

    // 3) El máximo es 5 archivos por ejecución: uno más entra y el siguiente se rechaza con aviso
    const [more] = await Promise.all([page.waitForEvent('filechooser'), verification.dropzone.click()]);
    await more.setFiles([png('selector-3.png'), png('selector-4.png')]);
    await expect(verification.fileItems).toHaveCount(5);
    await expect(verification.fileErrors).toContainText('Máximo 5 archivos por ejecución');
  });

  test('enviar con evidencia: el historial trae la miniatura y el archivo subido se descarga igual que se envió', async ({ page }) => {
    const verification = new VerificationPage(page);
    await verification.gotoCase('TC-008');

    // Marcador único: identifica NUESTRA ejecución en el historial aunque otro test registre la suya a la vez
    const marker = `s07-${Date.now()}`;
    const capture = png(`captura-${marker}.png`);

    await verification.result('Bloqueado').check();
    await verification.notes.fill(`Entorno no disponible · ${marker}`);
    await verification.attachMany.setInputFiles([capture, pdf(`informe-${marker}.pdf`)]);
    await expect(verification.fileItems).toHaveCount(2);
    await verification.submitRun.click();

    // Éxito: toast verde con el resultado y el formulario vuelve a estar vacío
    await expect(page.getByTestId('toast-ok')).toContainText('Ejecución registrada');
    await expect(verification.noFiles).toBeVisible();

    // La fila nueva se localiza por su nota. La captura y el PDF tienen cada uno su propio alt en la miniatura
    const run = verification.runWithNote(marker);
    await expect(run).toHaveCount(1);
    await expect(run.getByAltText('Evidencia TC-008')).toHaveAttribute('data-state', 'ready');
    await expect(run.getByAltText(`Documento PDF informe-${marker}.pdf`)).toBeVisible();

    // Descarga desde la fila de ESTA ejecución: el nombre es único, así que el botón también lo es
    const [download] = await Promise.all([page.waitForEvent('download'), run.getByRole('button', { name: `Descargar ${capture.name}` }).click()]);
    expect(download.suggestedFilename()).toBe(capture.name);
    expect((await readDownload(download)).equals(capture.buffer)).toBe(true); // mismos bytes que se subieron

    // La lista refleja el último resultado del caso (el del registro que acabamos de hacer)
    await verification.goto('?q=TC-008');
    await expect(verification.row('TC-008').getByTestId('testcase-result-badge')).toHaveAttribute('data-state', 'blocked');
  });
});

test.describe('informes PDF de verificación', () => {
  test('el nombre sugerido depende del filtro: todos los programas o un programa concreto', async ({ page }) => {
    const verification = new VerificationPage(page);
    await verification.goto();

    // Sin filtro: el informe cubre todos los programas
    const [all] = await Promise.all([page.waitForEvent('download'), verification.reportButton.click()]);
    expect(all.suggestedFilename()).toBe('informe-verificacion.pdf');
    const allText = (await readDownload(all)).toString('latin1'); // el PDF de este generador es texto plano sin comprimir
    expect(allText.startsWith('%PDF-')).toBe(true);
    expect(allText).toContain('Todos los programas');

    // Con un programa elegido, el nombre lleva su código en minúsculas
    await verification.programFilter.selectOption('PRG-001');
    await expect(verification.rows.first()).toBeVisible();
    const [program] = await Promise.all([page.waitForEvent('download'), verification.reportButton.click()]);
    expect(program.suggestedFilename()).toBe('informe-verificacion-prg-001.pdf');
    expect((await readDownload(program)).toString('latin1')).toContain('Programa PRG-001');
  });
});

test.describe('visor de documentos en iframe', () => {
  test('frameLocator: el visor es una página dentro del iframe, y cambiar de versión recarga el iframe', async ({ page }) => {
    const documents = new DocumentsPage(page);
    await documents.openDetail('DOC-001');

    // El iframe apunta a la ruta del visor con la versión elegida (la última por defecto)
    const latest = await documents.versionSelect.inputValue();
    await expect(documents.viewerIframe).toHaveAttribute('src', `/documents/DOC-001/view?version=${latest}`);

    // Dentro del iframe hay una página normal: se localiza con frameLocator igual que la principal
    await expect(documents.viewerFrame.getByTestId('viewer-version')).toHaveText(`Versión ${latest}`);
    await expect(documents.viewerFrame.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(documents.viewerFrame.getByTestId('viewer-page-1')).toBeVisible();

    // Otra versión: el iframe pide otra URL y su contenido cambia
    await documents.versionSelect.selectOption('1');
    await expect(documents.viewerIframe).toHaveAttribute('src', '/documents/DOC-001/view?version=1');
    await expect(documents.viewerFrame.getByTestId('viewer-version')).toHaveText('Versión 1');
  });

  test('«Abrir en nueva pestaña»: el enlace abre el visor en otra página con la misma sesión', async ({ page, context }) => {
    const documents = new DocumentsPage(page);
    await documents.openDetail('DOC-001');
    const latest = await documents.versionSelect.inputValue();

    // Enlace real con target="_blank": Playwright ve la pestaña nueva como un evento del CONTEXTO, no de la página
    await expect(documents.openInNewTab).toHaveAttribute('target', '_blank');
    await expect(documents.openInNewTab).toHaveAttribute('href', `/documents/DOC-001/view?version=${latest}`);
    const [popup] = await Promise.all([context.waitForEvent('page'), documents.openInNewTab.click()]);
    await popup.waitForLoadState();

    // La sesión viaja con el contexto (localStorage): la pestaña nueva no pide iniciar sesión
    await expect(popup).toHaveURL(new RegExp(`/documents/DOC-001/view\\?version=${latest}$`));
    await expect(popup.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(popup.getByTestId('viewer-version')).toHaveText(`Versión ${latest}`);
    await popup.close();
  });
});
