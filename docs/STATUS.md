# SIGPRO — Estado de la construcción

Última actualización: 2026-11-11 · **Fases 1, 2 y 3 cerradas** · **Fase 4 (material del curso y móvil) en curso**

Leyenda: `[x]` hecho · `[~]` en curso · `[ ]` pendiente

## Fase 4 — Material para alumnos y móvil

Orden fijo (el móvil va el último). Cada tarea termina con `pnpm lint && pnpm typecheck && pnpm test` en verde, su spec, capturas cuando aplica, una línea en `docs/CHANGELOG.md` y un commit. Una sola pila (API :3000, web :5173).

- [x] **T30** `examples/`: proyecto Playwright + TypeScript independiente del monorepo (su `package.json`), fixtures por rol con `storageState`, Page Object de Programas, un spec por sesión 2–11 y `.github/workflows/students-e2e.yml` (tenant parametrizado, sharding en 2, informe HTML como artefacto). **90 tests (86 + 4 de `setup`), 90/90 en dos pasadas seguidas en un solo tenant con 2 workers y sin reset entre ellas** (~55 s). `npm test` ejecuta 83 (+ 4 de `setup`); los 3 `@visual` van en su propio proyecto (`npm run test:visual`, con líneas base propias de cada alumno)
- [x] **T31** `/lab` completa: lista de 22 endpoints con enlaces a Swagger y al OpenAPI, contraejemplo de texto variable con el caos, FAQ de 8 preguntas y descarga del zip de `examples/` generado en el build. `lab.spec.ts` 15/15, capturas regeneradas, + 7 tests unitarios de endpoints y 11 del zip (web: 114). Arreglada de paso la anchura de `/nc` en móvil
- [x] **T32** `docs/GUIA-ALUMNO.md`: levantar SIGPRO en local con Docker, apuntar la suite a Render, usuarios, permisos y códigos fijos del seed (tablas obtenidas de la API real); viaja dentro del zip
- [ ] **T33** `apps/mobile` (Expo + Expo Router): Login con MFA, Programas (cards con filtros), kanban de NC y Panel de misión; Requisitos y Documentos en lectura; sin Administración; `testID` = `data-testid`; capturas a 390 px
- [ ] **T34** Cierre de fase: README con el estado final, STATUS final

## Resumen de la fase 4 (hasta T32)

- **`examples/`** (proyecto independiente, `npm`): 10 specs (86 tests: s02 11 · s03 9 · s04 7 · s05 9 · s06 8 · s07 7 · s08 8 · s09 9 · s10 9 · s11 9), 4 tests de `setup` que guardan `.auth/<tenant>-<rol>.json`, fixtures `role` / `pageAs` / `adminPage`… / `apiAs` / `programsPage`, 9 Page Objects y ayudas, `npm run reset` (restaura el tenant y apaga el caos). **Verificado: 90/90 dos veces seguidas contra un único tenant (`alumno21`) con 2 workers, sin reset entre pasadas.** Reglas de convivencia (datos distintos por spec, tests repetibles, caos acotado) en `examples/README.md` y `docs/DECISIONS.md`.
- **Workflow `students-e2e.yml`:** `plan → prepare → e2e (tenant × shard 1/2) → report`; informe HTML único como artefacto. Validado con `actionlint`; **no se ha podido ejecutar en GitHub desde aquí** y contra Render solo pasaría las sesiones 2–9 hasta desplegar la fase 3.
- **`/lab`:** endpoints, contraejemplos, FAQ, usuario personal y descarga de `sigpro-examples.zip` (40 archivos, 77 KB, generado en `build` y `dev`).
- **Hallazgo corregido:** a 390 px `/nc` medía 1303 px de ancho (los `span` `sr-only` de las tarjetas escapaban del tablero); con `isMobile` el navegador incluso renderizaba el escritorio. `NcBoard` es ahora `relative` y el spec de la sesión 11 usa la emulación completa del iPhone 14.
- **Calidad:** `pnpm lint && pnpm typecheck && pnpm test` en verde (shared 119, web 114, api 139); `lab.spec.ts` 15/15 y `nc.spec.ts` 17/17.

## Fase 3 — Dinámica y caos

Cada tarea termina con `pnpm lint && pnpm typecheck && pnpm test` en verde, su spec e2e de humo, capturas claro/oscuro a 1440 y 390 px en `docs/screens/`, una línea en `docs/CHANGELOG.md` y un commit. Una sola pila (API :3000, web :5173).

- [x] **T22** Contratos y datos: migración `phase3` (`Milestone.progress`, `NcComment`, `NonConformity.createdAt`), seed v3, permisos, esquemas Zod, DTOs, cliente, `testids.ts`, i18n (5 espacios), dependencias Socket.IO
- [x] **T23** **No conformidades**: API (lista, detalle, alta, edición, transición con cierre ≥ 20 caracteres, comentarios), tablero kanban con drag & drop, `<sigpro-severity-picker>` (Shadow DOM abierto), modal con combobox de asignación, comentario rápido con `prompt()` nativo
- [x] **T24** **Panel de misión**: Socket.IO (rooms por tenant, JWT en el handshake), simulador de eventos, 4 KPIs, gráficas (hitos cumplidos, NC por severidad), feed en vivo, campana con contador, tooltips
- [x] **T25** **Administración**: usuarios (switch de activo + select de rol), auditoría con rango de fechas, modo caos (slider de latencia, % de 500, textos alternos) y reset con `confirm()` nativo; la web consume `flakyLabels`
- [x] **T26** **Hitos** del detalle de programa (tabla con edición inline y slider con `aria-valuenow`) y ruta de **Perfil**
- [x] **T27** **Bugs plantados**: 8 defectos (4 del plan + 4 propios) tras `PLANTED_BUGS`, documentados en `docs/planted-bugs.md` (fuera de git y de los builds), con un spec que los reproduce
- [x] **T28** Cierre de fase: README, CHANGELOG, STATUS final, filas de locators (Shadow DOM, `prompt()`), catálogo de componentes UI completo y pasada completa (lint, typecheck, unit, e2e, comparación con el handoff, build)
- [x] **T29** Huecos del catálogo de componentes que venían de antes (no los pedía la fase 3 pero el plan exige cerrarlos): `alert()` nativo, combobox «buscar proveedor» y búsqueda global con resultados agrupados; y el 500 al borrar PRG-001/PRG-002 (seed)

## Resumen de la fase 3

- **Datos y API:** migración `phase3`, seed v3 (re-siembra al arrancar), NC (lista con filtros, detalle, alta, edición, transición con 403 → 409 → 422, comentarios `comment`/`quick`/`closure`), hitos con avance, usuarios de administración (409 `self_change` / `last_admin`), resumen del panel, proveedores y búsqueda global agrupada. **Socket.IO** con JWT en el handshake, un room por tenant y un simulador determinista (`SIMULATOR_MS`). **8 defectos plantados** tras `PLANTED_BUGS`.
- **Web:** No conformidades (kanban con DnD HTML5 y alternativa de teclado, `<sigpro-severity-picker>`, modal con combobox, comentarios, cierre ≥ 20 caracteres, `prompt()` nativo), Panel de misión (4 KPIs, gráficas con vista de tabla, feed en vivo con pausa, tooltips, campana con contador, insignia de NC en el menú), Administración (usuarios, auditoría por rango de fechas, modo caos, reset con `confirm()`, `alert()`), pestaña Hitos (edición inline y slider), Perfil, proveedores y búsqueda global agrupada. Los **textos alternos** del modo caos (`useSaveLabel`) ya los consume la web.
- **Calidad:** `pnpm lint && pnpm typecheck && pnpm test` en verde: **354 tests unitarios** (119 shared, 139 api, 96 web; eran 221). **286 specs e2e de humo** en `chromium` (161 de las fases 1–2 + 125 nuevos, todos en verde en la suite completa), 50/50 escenarios de comparación con el handoff y `pnpm build` (shared, api, web) correcto. **59 de esos specs (Misión, defectos plantados, búsqueda, NC y Administración) también pasan contra el build de producción servido con `vite preview`**, como en CI: el proxy reenvía el *upgrade* de WebSocket de `/socket.io`. 376 capturas claro/oscuro a 1440 y 390 px en `docs/screens/` (126 nuevas).
- **Specs nuevos (125):** `nc` 17 · `nc-api` 10 · `mission` 12 · `admin` 10 · `admin-api` 7 · `milestones` 10 · `profile` 7 · `planted-bugs` 9 · `search` 11 · `search-api` 10 · `suppliers` 13 · `suppliers-api` 8 · `programs-delete-all` 1. Capturas en `screens-{nc,mission,admin,catalog}.spec.ts`.
- **Tenants de los specs nuevos:** NC `alumno01`–`03` y `13` · Misión `09`–`12` · Administración, Hitos y Perfil `04`–`08` y `14` · Búsqueda, proveedores y capturas del catálogo `15`–`19` · borrado de programas `20`. Detalle en `docs/DECISIONS.md`.
- **Hallazgos corregidos por el camino:** el 500 al borrar PRG-001/PRG-002 (el seed enlazaba NC con ejecuciones de otro programa); el anillo de eventos sobrevivía al reset del tenant; tooltips solapados y desbordados en móvil; el contexto de tiempo real repintaba el menú con cada evento; `prisma generate` fallaba con la API en marcha en Windows (`apps/api/scripts/generate-prisma.mjs`).

## Cobertura de locators — fase 3 (cerrada)

Recorrida contra la tabla del plan. Specs en `e2e/tests/`: `nc` = nc.spec.ts, `nc-api` = nc-api.spec.ts, `mis` = mission.spec.ts, `adm` = admin.spec.ts, `ms` = milestones.spec.ts, `prof` = profile.spec.ts, `bug` = planted-bugs.spec.ts, `busq` = search.spec.ts, `prov` = suppliers.spec.ts.

| Locator del plan | Elemento nuevo en la fase 3 | Spec | Estado |
| --- | --- | --- | --- |
| Shadow DOM (atraviesa por defecto) | `<sigpro-severity-picker>` con `attachShadow({ mode: 'open' })`, `role="listbox"` y opciones `role="option"`: `getByRole('option', { name: 'Crítica' })` y `getByTestId('severity-picker-option-critical')` en el detalle y en el alta de NC | nc | ✓ |
| `dialog` nativo vs custom | **`prompt()`** nativo del comentario rápido (`dialog.type() === 'prompt'`, `accept(texto)`, `dismiss()`), **`alert()`** (Administración → Datos), `confirm()` (reset en Administración y `/lab`) frente a los propios: `dialog` de cierre y `alertdialog` de «eliminar hito» | nc, adm, ms | ✓ |
| `filter({ has })` / `filter({ hasNot })` | Tarjetas del kanban sin asignado (`hasNot: getByRole('img')`: NC-005 y NC-010) y filas de usuarios por badge (`has`: bloqueado, pendiente) | nc, adm | ✓ |
| `getByRole` | NC: `region` por columna con `list`/`listitem`, `dialog`, `combobox`/`option`, `alert` · Misión: `status`, `article`, `figure`, `list`, `tooltip`, `table` · Administración: `tablist`/`tab`, `switch`, `table`/`columnheader`, `combobox` · Hitos: `slider`, `alertdialog` · Perfil: `group` (fieldset) y `radio`, `checkbox`, `switch` · Búsqueda: `group` y `option` | todos | ✓ |
| `getByRole` + `name` regex / `exact` | «Guardar» ↔ «Guardar cambios» (textos alternos del caos: `/^Guardar( cambios)?$/`) y el par «Guardar» / «Guardar y cerrar» en el detalle de NC | nc, adm | ✓ |
| `getByLabel` (`<label for>`) | «Comentario de cierre», «Programa», «Descripción», «Añadir comentario», «Desde» / «Hasta» (auditoría en Administración), «Latencia máxima», «Idioma de la interfaz», «Buscar proveedor» | nc, adm, prof, prov | ✓ |
| `getByLabel` (`aria-label`) | «Acciones para NC-001», «Comentario rápido NC-001», «Avance de {hito}», «Rol de {nombre}», «Activo: {nombre}», «Qué mide NC abiertas», «Búsqueda global» | nc, ms, adm, mis | ✓ |
| `getByPlaceholder` | «Código o descripción…» (NC), «Buscar persona…» (asignación), «Buscar proveedor…», «Nombre o correo…» (usuarios) | nc, adm, prov | ✓ |
| `getByAltText` | Avatar del asignado en la tarjeta y de los autores de los comentarios (`alt="Marta Ruiz"`) y de las filas de usuarios | nc, adm | ✓ |
| `getByTitle` | Botones deshabilitados con su motivo: «Tu rol no permite mover no conformidades», «Tu rol no permite crear hitos», «Solo admin puede emitir eventos de prueba» | nc, ms, mis | ✓ |
| CSS (`data-state`, `data-severity`, atributos) | `[data-severity]` en tarjetas, badges y barras de la gráfica, `[data-drop]` en la columna destino, `[data-state]` de hitos, usuarios y conexión | nc, mis, adm | ✓ |
| Encadenamiento | Tablero → columna `nc-column-in_analysis` → tarjeta → «Acciones para NC-001» → menú «Mover a…» | nc | ✓ |
| `first()` / `last()` / `nth()` / `count()` | Columnas y tarjetas por estado (4/2/2/2/2), opciones del combobox y de la búsqueda agrupada, eventos del feed | nc, busq, mis | ✓ |
| Drag & drop entre columnas | `dragTo` de tarjetas con aserción de estado y del contador de la columna; arrastre inválido (409 + toast); arrastre a «Cerrada» abre el formulario de cierre | nc | ✓ |
| Combobox (escribir, esperar, elegir por teclado y clic) | Asignación de NC (`OwnerCombobox`), búsqueda de proveedor (con `waitForResponse`) y búsqueda global | nc, prov, busq | ✓ |
| Slider (`fill`, flechas, aserción de valor) | Avance del hito (`aria-valuenow`, `aria-valuetext`) y latencia / % de errores del modo caos | ms, adm | ✓ |
| Edición inline de celdas | `dblclick` → `fill` → `press('Enter')` (nombre y fecha del hito), `Escape` cancela, persistencia al recargar | ms | ✓ |
| Tooltip (`hover`, `getByRole('tooltip')`) | Icono de información de cada KPI, barras de las gráficas e icono de la conexión (hover, foco y Esc) | mis | ✓ |
| Tiempo real y esperas inteligentes | `page.waitForEvent('websocket')` y `framereceived`, `expect.poll` sobre el feed y la insignia del menú, contador de la campana | mis | ✓ |
| Interceptación de red (`page.route`) | 503 con traza y reintento en el tablero, el panel y los usuarios; caos al 100 % de 500 en escrituras con toast | nc, mis, adm | ✓ |
| Tabla, switch, select, radio y checkbox | Usuarios (select de rol con `selectOption`, switch con `click` y `aria-checked`), radios y casilla del Perfil con `check()` | adm, prof | ✓ |
| Defectos plantados (reporte) | 8 defectos reproducibles, cada uno con su aserción (defectuosa con `PLANTED_BUGS=true`, correcta con `false`) | bug | ✓ |

## Catálogo de componentes UI (plan): completo

Cada fila del «Catálogo de componentes UI» del plan tiene su sitio. **✓ nuevo** = llegó en la fase 3 (incluye los tres huecos que venían de antes).

| Componente | Dónde vive en SIGPRO | Spec | Estado |
| --- | --- | --- | --- |
| Tabla con orden, filtros, paginación y selección múltiple | Programas, Casos de prueba, Auditoría (feed) | programs, verification, audit | ✓ |
| Tabla con edición inline de celdas | Hitos del programa | ms | ✓ nuevo |
| Exportar tabla a CSV | Programas, Requisitos | programs, requirements | ✓ |
| `<select>` nativo | Filtros de estado, prioridad, severidad y rol de usuario | programs, nc, adm | ✓ |
| Combobox con autocompletar | Asignar NC, buscar proveedor, búsqueda global | nc, prov, busq | ✓ nuevo |
| Multi-select con chips | Etiquetas de requisito | requirements | ✓ |
| Dropdown de acciones por fila (⋯) | Programas, Requisitos, Casos de prueba, Documentos, Hitos y tarjetas de NC | programs, requirements, verification, documents, ms, nc | ✓ |
| Modal de confirmación custom | Cambiar estado de requisito, eliminar hito, cierre de NC | requirements, ms, nc | ✓ |
| `alert()`, `confirm()` y `prompt()` nativos | `confirm()` reset (Administración y `/lab`), `prompt()` comentario rápido de NC, `alert()` Administración → Datos | adm, nc, lab | ✓ nuevo |
| Toast con autocierre a 3 s | Toda acción de guardado | todos | ✓ |
| Tooltip y popover | Tooltip: KPIs, barras y conexión · Popover: campana, menú de usuario, búsqueda global | mis, busq | ✓ nuevo |
| Pestañas (tabs) | Detalle de programa, Administración, Requisitos | programs, adm | ✓ |
| Acordeón y árbol colapsable | Requisitos, FAQ de `/lab` | requirements, lab | ✓ |
| Wizard de 3 pasos | Crear programa | programs-crud | ✓ |
| Date picker y rango de fechas | Fechas de programa, rango de auditoría, fecha de hito | programs, adm, ms | ✓ |
| Checkbox, radio, switch | Usuarios (switch), Perfil (radios, checkbox, switch), ejecución de pruebas (radio) | adm, prof, verification | ✓ nuevo |
| Slider | Avance de hito, latencia y % de errores del caos | ms, adm | ✓ nuevo |
| Upload simple, múltiple y zona drag-and-drop | Evidencias de ejecución | verification | ✓ |
| Descarga de archivo | Informe PDF, documento, CSV, evidencias | verification, documents | ✓ |
| Drag & drop para reordenar | Prioridad de requisitos | requirements | ✓ |
| Kanban con drag & drop entre columnas | No conformidades | nc | ✓ nuevo |
| Iframe | Visor de documentos | documents | ✓ |
| Shadow DOM | Selector de severidad `<sigpro-severity-picker>` | nc | ✓ nuevo |
| Enlace que abre nueva pestaña | Documento en nueva pestaña, términos y privacidad | documents, legal | ✓ |
| Scroll infinito | Feed de auditoría | audit | ✓ |
| Menú contextual (clic derecho) | Fila de requisito | requirements | ✓ |
| Atajos de teclado | `N` nuevo requisito, `/` buscar, `Esc` cerrar | requirements | ✓ |
| Editor de texto enriquecido (`contenteditable`) | Descripción de requisito y de NC | requirements, nc | ✓ |
| Botón copiar al portapapeles | Código de requisito | requirements | ✓ |
| Búsqueda global con resultados agrupados | Cabecera (programas, requisitos, casos, NC, documentos; en `/programs` sigue filtrando la tabla) | busq | ✓ nuevo |
| Spinner y skeleton de carga | Listas al filtrar, tablero, panel, usuarios | todos | ✓ |
| Barra de progreso y badges | Programa, NC (severidad y estado), hitos | programs, nc, ms | ✓ |
| Breadcrumbs y sidebar colapsable | Layout (hamburguesa en móvil) | programs | ✓ |
| Banner de cookies | Primera visita | programs | ✓ |
| Ruta protegida con basic auth | `/api/docs` y `/api/docs-json` | api-docs | ✓ |
| Validación de formulario cliente y servidor | Todos los formularios (422 de la API) | todos | ✓ |
| Tabla de comparación de versiones | Documentos | documents | ✓ |
| Notificación en tiempo real (campana) | Cabecera, vía Socket.IO | mis | ✓ nuevo |
| Selector de idioma y tema | Cabecera y Perfil | programs, prof | ✓ nuevo |

## Fase 2 — Núcleo del dominio

Cada tarea termina con `pnpm lint && pnpm typecheck && pnpm test` en verde y un commit. Cada módulo cierra además con su spec e2e de humo, capturas claro/oscuro a 1440 y 390 px en `docs/screens/` y la pasada por la tabla «Cobertura de locators».

- [x] **T15** Modelo de datos y contratos: migración (`tags`, `position`, `Evidence`, `DocumentVersion`), seed v2 con re-seed por versión, permisos, esquemas Zod, DTOs, cliente (multipart + blob), `testids.ts`, i18n (4 espacios nuevos), helpers puros (HTML enriquecido, diff de líneas, árbol, PDF)
- [x] **T16** Pendientes de la fase 1: editar programa (PATCH + formulario), páginas legales y ayuda, spec de basic auth de `/api/docs`
- [x] **T17** Módulo **Requisitos**: árbol, estados y permisos, edición inline, etiquetas, editor `contenteditable`, reordenar, menú contextual, atajos, copiar código, matriz, CSV
- [x] **T18** Módulo **Verificación**: casos de prueba, ejecución (radio), evidencias (simple, múltiple, arrastrar), informe PDF
- [x] **T19** Módulo **Documentos**: clasificación por rol, visor en `<iframe>`, nueva pestaña, comparación de versiones
- [x] **T20** Módulo **Auditoría** (AuditLog): feed con scroll infinito y filtros
- [x] **T21** Cierre de fase 2: README, CHANGELOG, STATUS final, pasada completa (lint, typecheck, unit, e2e, capturas)

## Resumen de la fase 2

- **Datos y API:** migración `phase2` (etiquetas y posición de requisitos, `Evidence`, `DocumentVersion`), seed v2 (árbol de requisitos de 3 niveles, matriz por programa, 13 capturas PNG reales, 1–3 versiones por documento, 130 eventos de auditoría) con **re-siembra al arrancar** de los tenants antiguos; `PATCH /programs/:code`; Requisitos (estados con permisos, mover, enlaces, cascada), Verificación (lista, ejecución multipart con validación por firma real, evidencias, informe PDF), Documentos (403 en restringidos, contenido paginado, diff por líneas, publicar versión, PDF) y Auditoría (cursor). Cada mutación escribe su evento.
- **Web:** Requisitos, Verificación, Documentos y Auditoría; edición de programa; páginas públicas `/legal/terms`, `/legal/privacy` y `/help`; visor HTML en `<iframe>`; componentes nuevos reutilizables (`ActionMenu`, `ConfirmDialog`, `RichTextEditor`, `TagPicker`, `ToneBadge`).
- **Calidad:** `pnpm lint` en verde en los 5 paquetes; `tsc --noEmit` limpio en los 4; **221 tests unitarios** (92 shared, 89 api, 40 web) y **161 specs e2e de humo** en `chromium` (70 de la fase 1 + 91 de la fase 2: Requisitos 13 + 9 de API, Verificación 12 + 8, Documentos 9 + 7, Auditoría 7 + 7, edición de programa 8, legales 5 y basic auth 6). También pasan 46 de ellos contra el build de producción servido con `vite preview`, y `pnpm --filter web build` compila. 250 capturas claro/oscuro a 1440 y 390 px en `docs/screens/` (162 nuevas).
- **Testabilidad:** auditoría automática sobre el AST de `apps/web/src`: 0 elementos interactivos sin `data-testid` y 0 `<img>` sin `alt`.
- **Tenants de los specs:** `alumno08` (edición de programa), `09`–`11` (Requisitos), `12`–`17` (Verificación), `18`–`21` (Documentos), `22`–`23` y `25` (Auditoría) y `13`–`14` (capturas de edición/legal y de Requisitos). Detalle en `docs/DECISIONS.md`.

## Cobertura de locators — fase 2 (cerrada)

Recorrida contra la tabla del plan. Estado: **✓** cubierta · **fase 3** fuera de alcance. Specs en `e2e/tests/`: `req` = requirements.spec.ts, `req-api` = requirements-api.spec.ts, `ver` = verification.spec.ts, `ver-api` = verification-api.spec.ts, `doc` = documents.spec.ts, `doc-api` = documents-api.spec.ts, `aud` = audit.spec.ts, `aud-api` = audit-api.spec.ts, `edit` = programs-edit.spec.ts, `legal` = legal.spec.ts, `docs-auth` = api-docs.spec.ts.

| Locator del plan | Elemento nuevo en la fase 2 | Spec | Estado |
| --- | --- | --- | --- |
| `getByRole` | Requisitos: `tree`/`treeitem`, `tab`, `menu`/`menuitem`, `dialog`/`alertdialog`, `combobox`/`option` (etiquetas), `checkbox` (matriz), `textbox` (editor), `toolbar`, `complementary`, `searchbox` · Verificación: `table`/`row`/`columnheader` (`aria-sort`), `radio` dentro de `group`, `checkbox` con estado indeterminado, `menuitem` · Auditoría: `feed` y `article` (`aria-posinset` / `aria-setsize`) | req, ver, aud | ✓ |
| `getByRole` + `name` regex / `exact` | «Guardar» / «Guardar y cerrar» (detalle de requisito y edición de programa); «Aprobar» / «Marcar como verificado» / «Validar»; «Publicar nueva versión» / «Publicar versión» | req, edit, doc | ✓ |
| `getByLabel` (`<label for>`) | Título, Prioridad, Etiquetas, Programa, Requisito padre, edición de programa completa · Notas, «Adjuntar un archivo», «Adjuntar varios archivos», «Último resultado» · «Versión», «Desde», «Hasta», «Clasificación», «Contenido (una línea por fila)» | req, edit, ver, doc | ✓ |
| `getByLabel` (`aria-label`) | «Contraer REQ-015», «Copiar código REQ-017», «Acciones para REQ-017», «Quitar etiqueta X», «REQ-017 ↔ TC-012», «Arrastrar REQ-019 para reordenar» · «Seleccionar TC-001», «Acciones para TC-003», «Quitar foto.jpg», «Zona para soltar evidencias», «Descargar X» | req, ver | ✓ |
| `getByPlaceholder` | «Filtrar por código o título…», «Añadir etiqueta…» · «Buscar código o título…», «Observaciones de la ejecución…» · «Acción o código…» | req, ver, aud | ✓ |
| `getByText` | «Sin coincidencias», «Sin cobertura», toasts, «Aprobado» con `exact` | req | ✓ |
| `getByAltText` | Miniatura `alt="Evidencia TC-001"` (blob descargado con el token), `alt="Documento PDF informe.pdf"` y vista previa `alt="Vista previa de captura-1.png"` · avatar del actor en cada evento de auditoría (`alt="Marta Ruiz"`) | ver, aud | ✓ |
| `getByTitle` | Botones deshabilitados con su motivo («Tu rol no permite crear requisitos», «No hay cambios que guardar», «Tu rol no permite registrar ejecuciones») | req, edit, ver | ✓ |
| `getByTestId` | Todo elemento interactivo (auditado con un script sobre el AST: 0 sin `data-testid`, 0 `<img>` sin `alt`) | todos | ✓ |
| CSS (`data-state`, atributos) | `.badge[data-state="verified"]`, `[data-covered="false"]`, `[data-drop]` · `tr[data-state="restricted"]`, `tr[data-diff="added"]` y `toHaveCSS` del resaltado | req, doc | ✓ |
| XPath (contraejemplo) | Ya cubierto en Programas y /lab | programs, lab | ✓ (fase 1) |
| Encadenamiento y `filter({ hasText })` | `tree` → `treeitem` de REQ-017 → «Acciones para…» → `menu` | req | ✓ |
| `filter({ has })` / `filter({ hasNot })` | Filas con badge «Aprobado» / sin badge «Borrador» · filas del diff con `<ins>` y `<del>` | req, doc | ✓ |
| `first()` / `last()` / `nth()` / `count()` | Opciones del menú contextual, chips, filas del árbol, ejecuciones del historial | req, ver | ✓ |
| `and()` / `or()` | Botón por rol y por testid; toast de éxito o alerta tras guardar | req | ✓ |
| `frameLocator` | Visor de documentos `<iframe title="Visor de documento">` (ruta HTML del mismo origen con sus propios `data-testid`; también `contentFrame()`) | doc | ✓ |
| Shadow DOM | `<sigpro-severity-picker>` | nc | **✓ fase 3** (tabla «Cobertura de locators — fase 3») |
| `dialog` nativo vs custom | `dialog` (cambio de estado, nueva versión) y `alertdialog` (eliminar) propios | req, doc | ✓ (el `prompt()` nativo del comentario rápido de NC llegó en la fase 3: spec `nc`; también `alert()` en Administración) |
| Nueva pestaña (`context.waitForEvent('page')`) | Enlaces de términos y privacidad del registro · «Abrir en nueva pestaña» de documentos (enlace `target="_blank"` real) y la opción del menú ⋯ | legal, doc | ✓ |
| Lista con `toHaveText([...])` | Opciones del menú contextual; códigos del árbol tras reordenar; pasos de un caso de prueba | req, ver | ✓ |
| Scroll infinito | Feed de auditoría: `role="feed"` de altura fija, centinela con `IntersectionObserver` y cursor; `scrollIntoViewIfNeeded` + `expect.poll` sobre el conteo (20 → 130) | aud | ✓ |
| Clic derecho | Fila de requisito → menú contextual | req | ✓ |
| Drag & drop de reorden | `dragTo` entre hermanos (y caída inválida) | req | ✓ |
| `contenteditable` | Editor de la descripción (negrita con atajo, HTML saneado al recargar) | req | ✓ |
| Portapapeles | «Copiar código» (permisos `clipboard-read` / `clipboard-write`) | req | ✓ |
| Subida de archivos | `setInputFiles` simple y múltiple, zona de arrastre (`dispatchEvent('drop')` con `DataTransfer`) y selector nativo (`filechooser`); validación de tipo, tamaño y máximo de 5 | ver | ✓ |
| Descarga de archivos (`waitForEvent('download')`) | CSV de requisitos, informe PDF del plan (todos, programa o selección), evidencias, PDF de una versión de documento | req, ver, doc | ✓ |
| Interceptación de red (`page.route`) | 403 y 500 simulados en la ficha de un documento; 503 y respuestas lentas en todas las listas | doc, req, ver | ✓ |
| Basic auth (`httpCredentials`) | `/api/docs` y `/api/docs-json` | docs-auth | ✓ |

## Fase 1 — Base

Cada tarea termina con `pnpm lint && pnpm typecheck && pnpm test` en verde y un commit (Conventional Commits).

- [x] **T0** Mover docs (`docs/SIGPRO-plan.md`, `docs/design-handoff/`) y documentar la ruta
- [x] **T1** Raíz del monorepo: pnpm + Turborepo, tsconfig base, ESLint flat (sin `switch`, sin `any`, sin `data-testid` literal), `.env.example`, `docker-compose.yml`, STATUS/DECISIONS/CHANGELOG
- [x] **T2** `packages/shared`: dominio (roles, permisos, estados), esquemas Zod, reglas de contraseña, i18n ES/EN, `testids.ts` ampliado, cliente HTTP
- [x] **T3** `apps/api`: NestJS + Prisma (11 entidades + `Contract` + `RequirementTestCase`), migración inicial, Postgres local
- [x] **T4** Seed determinista multi-tenant (`demo` + `alumnoNN`) y reset del tenant < 2 s (≈ 120 ms)
- [x] **T5** Auth: login, MFA simulado, bloqueo a 5 intentos, registro, recuperar, SSO 501, refresh, roles (guards), filtrado por tenant
- [x] **T6** API de Programas: lista (filtros, orden, paginación), alta con 422, borrado, archivar, duplicar, CSV, AuditLog
- [x] **T7** Admin: `POST /api/admin/reset`, `PATCH /api/admin/chaos` + interceptor, `/api/health`, OpenAPI en `/api/docs` (basic auth opcional)
- [x] **T8** `apps/web` base: Vite + Tailwind 4 con tokens como CSS variables, claro/oscuro, ES/EN, router, sesión, toasts (3 s), fuentes autoalojadas, PWA mínima
- [x] **T9** Módulo **Acceso** (login, MFA, recuperar, registro, verificación, usuarios de prueba) + spec e2e + capturas
- [x] **T10** Módulo **Programas** (shell, tabla, filtros, combobox ARIA, bulk, paginación, estados carga/vacío/error, menú fila, asistente, diálogo eliminar, cookies, atajos) + spec e2e + capturas
- [x] **T11** Checklist "Cobertura de locators" de Acceso y Programas recorrida fila a fila
- [x] **T12** Página `/lab` (credenciales, usuarios por rol, reset con `confirm()` nativo, caos, contraejemplos, FAQ)
- [x] **T13** `render.yaml`, `scripts/reset-all.mjs`, workflow de GitHub Actions (lint, typecheck, unit, build, e2e de humo)
- [x] **T14** Cierre de fase: README, STATUS final, comandos de arranque local

## Resumen de la fase 1

- **API** (NestJS + Prisma): 13 modelos con claves compuestas `(tenant_id, …)`; seed determinista (`demo` + `alumno01…25`: 24 programas, 40 requisitos, 25 casos de prueba, 12 NC y 6 proveedores por tenant); JWT + refresh, MFA en dos pasos, bloqueo a 5 intentos, registro/recuperar/SSO 501, permisos por rol; programas con filtros, orden, paginación de 10, alta con 422, duplicar, archivar, borrar y CSV; `/api/admin/reset` y `/api/admin/chaos`; AuditLog en cada mutación; OpenAPI en `/api/docs`.
- **Web** (React 18 + Vite + Tailwind 4): Acceso y Programas reproducen el handoff (≤ 2,2 % de píxeles distintos en 50 escenarios claro/oscuro a 1440 y 390 px), `/lab`, ES/EN, PWA, estados de carga/vacío/error.
- **Calidad:** `pnpm lint && pnpm typecheck && pnpm test` en verde (118 tests unitarios: 47 shared, 39 api, 32 web) y 70 specs e2e de humo (19 Acceso, 35 + 7 Programas, 9 /lab), también con `CI=true pnpm e2e` contra el build de producción. 88 capturas en `docs/screens/`.
- **Despliegue:** `render.yaml`, cron `scripts/reset-all.mjs` y workflow de GitHub Actions, escritos y validados en local.

## Cobertura de locators (T11): fila del plan → elemento → spec

Recorrida fila a fila para Acceso y Programas. Specs en `e2e/tests/`: `access` = access.spec.ts, `programs` = programs.spec.ts, `crud` = programs-crud.spec.ts, `lab` = lab.spec.ts.

| Locator del plan | Elemento en SIGPRO | Spec |
| --- | --- | --- |
| `getByRole` | Botón «Nuevo programa», filas, `dialog` (asistente), `alertdialog` (borrado), `tab` (detalle), `menuitem`, `combobox`/`option`, `checkbox`, `link` | programs, crud |
| `getByRole` + `name` regex / `exact` | «Contraseña» / «Mostrar contraseña» / «Confirmar contraseña»; «Siguiente» / «Página siguiente»; «Activo» / «12 activo»; «Guardar» / «Guardar y cerrar» y «Activo» / «Activo (3)» en /lab | access, programs, crud, lab |
| `getByLabel` (`<label for>`) | Todos los inputs de Acceso, filtros y asistente | access, programs, crud |
| `getByLabel` (`aria-label`) | Tema, campana, «Acciones para PRG-001», cerrar, mostrar contraseña | access, programs |
| `getByPlaceholder` | «Buscar código o nombre…», «Buscar persona…», MFA «000000», «nombre@organizacion.es» | access, programs, crud |
| `getByText` | Vacío «Sin programas», textos de toast, celdas, `exact` con «Activo» | programs, lab |
| `getByAltText` | Logo `alt="SIGPRO"`, avatares `alt="Marta Ruiz"` (miniatura de evidencia: fase 2) | access, programs |
| `getByTitle` | Progreso «11 % completado», botones deshabilitados con motivo, nombre truncado | programs, crud, lab |
| `getByTestId` | Todo elemento interactivo (auditado: 0 sin id en `apps/web/src`) | todos |
| CSS (`data-state`, `td:nth-child`) | `.badge[data-state="on_hold"]`, celdas por columna | programs |
| XPath (contraejemplo) | `//tr[contains(., "PRG-004")]`, tabla de /lab | programs, lab |
| Encadenamiento y `filter({ hasText / has / hasNot })` | Fila PRG-004 → «Acciones…» → menú; filas con badge «En pausa» | programs |
| `first` / `last` / `nth` / `count` | Paginación, opciones del combobox, filas | programs |
| `and()` / `or()` | Botón exportar + testid; `toast-info` o alerta tras exportar; toast ok o error 422 | programs, crud |
| Lista con `toHaveText([...])` | Columna Código tras ordenar (`programs-link-*`) | programs |
| `dialog` nativo vs custom | Borrado = `alertdialog` propio; reset del tenant = `confirm()` nativo (`page.on('dialog')`) | crud, lab |
| `frameLocator`, nueva pestaña | Visor de documentos y enlace `target=_blank` | **fase 2 ✓** (ver la tabla «fase 2» más arriba) |
| Shadow DOM, kanban sin asignado | `<sigpro-severity-picker>` y tarjetas de NC | **✓ fase 3** (spec `nc`) |

## Pendiente / deuda conocida

- **Render (comprobado el 2026-11-11):** la web (<https://sigpro-web.onrender.com/>) y la API (<https://sigpro-api.onrender.com/>) responden, pero **siguen en la fase 2**: `origin/main` está en `f5d4b7e` («close phase 2») y los 17 commits de la fase 3 no se han subido (`git status`: *ahead 17*); `GET /api/config` no trae `plantedBugs` y `/api/nc`, `/api/mission/summary`, `/api/search` y `/socket.io` dan 404. **Hasta hacer `git push` y desplegar, el workflow `students-e2e.yml` solo puede pasar las sesiones 2–9 contra Render** (las 10 y 11 usan el panel de misión, las NC y los defectos plantados de la fase 3). Al desplegar, la API aplica la migración `phase3`, re-siembra los tenants con `seed_version` < 3 y abre Socket.IO; hay variables nuevas (`PLANTED_BUGS`, `SIMULATOR_MS`, ya en `render.yaml`). Pasos y comprobación rápida en `docs/DEPLOY-RENDER.md` («Actualizar a la fase 3»).
- **CI en GitHub:** la primera ejecución de `ci.yml` (2026-11-06, repositorio `gsanchezm/sigpro`) terminó en verde: lint, typecheck, unit y e2e de humo.
- **Node 22** (resuelto): CI, Render y `CLAUDE.md` usan Node 22 y pnpm 11 (`pnpm@11` exige ≥ 22.13; ver `docs/DECISIONS.md`).
- **Deshacer eliminación** (`toast-action`): no se implementa (borrado permanente).
- **Windows + Prisma** (resuelto en la fase 3): `apps/api/scripts/generate-prisma.mjs` aparta el motor de consultas en uso y reintenta, así `pnpm typecheck` y `pnpm build` funcionan con la API en marcha. Si algún día falla, el síntoma es `EPERM … query_engine-windows.dll.node`.
- **Evidencias en PostgreSQL:** hasta 5 archivos de 2 MB por ejecución; el reset nocturno las elimina con el resto del tenant (ver `docs/DEPLOY-RENDER.md`).
- **Bugs plantados:** `docs/planted-bugs.md` existe **solo en local** (está en `.gitignore` porque el repositorio es público); guárdalo en un lugar privado o haz `git add -f` si el repositorio pasa a ser privado. El código con `PLANTED_BUGS` sigue siendo legible en GitHub.
- **Procesos locales ajenos a la pila:** siguen vivos una API de basic auth en `:3100` (la deja Playwright para `api-docs.spec.ts`; Playwright la vuelve a arrancar sola si falta) y un Vite en `:5174` de una sesión anterior. El segundo no hace falta; deténlo cuando quieras. La pila de trabajo es API `:3000` + web `:5173`.
- **Evolución del modelo:** la FK `NonConformity → TestRun` es `NO ACTION`; el seed v3 enlaza solo ejecuciones del propio programa. Si se permitiera enlazar ejecuciones de otro programa, el borrado de ese programa volvería a dar 500.
- **Git:** el repositorio es público (`https://github.com/gsanchezm/sigpro`). El zip `SIGPRO Design System Entregables.zip` se eliminó de la rama, pero sigue en el primer commit del historial.

## Cómo levantar todo en local

Requisitos: Node ≥ 22.13, pnpm 11 (`corepack enable`) y Docker. Detalle en [`README.md`](../README.md#arranque-local).

```bash
pnpm install
cp .env.example .env                  # en Windows: copy .env.example .env
docker compose up -d db               # PostgreSQL en :5432
pnpm --filter api prisma:deploy       # migraciones
pnpm dev                              # API :3000 (siembra los tenants al arrancar) + web :5173
```

| Qué | Comando |
| --- | --- |
| Calidad | `pnpm lint && pnpm typecheck && pnpm test` |
| Specs e2e de humo | `pnpm --filter @sigpro/e2e install:browsers` (1.ª vez) y `pnpm e2e` |
| Varias ejecuciones de Playwright a la vez | `E2E_SKIP_GLOBAL_RESET=1 pnpm --filter @sigpro/e2e exec playwright test --project=chromium tests/<spec> --output=<dir propio>` (con tenants distintos) |
| Capturas (`docs/screens/`) | `pnpm e2e:screens` (todas) · `pnpm --filter @sigpro/e2e exec playwright test --project=screens tests/screens-nc.spec.ts` (un módulo) |
| Defectos plantados / simulador | `PLANTED_BUGS=false` deja la app limpia · `SIMULATOR_MS=0` apaga el simulador de misión (variables de la API) |
| Comparar con el handoff | `pnpm --filter @sigpro/e2e compare` (`COMPARE_ONLY=programas` filtra) |
| Reiniciar todos los tenants | `pnpm seed` (CLI) · `node scripts/reset-all.mjs` (API, con `ADMIN_KEY`) |
| Ver los prototipos | `pnpm handoff` |

URLs: web <http://localhost:5173> · `/lab` <http://localhost:5173/lab> · API <http://localhost:3000/api> · Swagger <http://localhost:3000/api/docs>.
