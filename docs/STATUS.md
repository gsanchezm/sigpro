# SIGPRO — Estado de la construcción

Última actualización: 2026-11-06 · **Fase 1 (Base) cerrada** · **Fase 2 (Núcleo del dominio) cerrada** · La fase 3 no se ha empezado

Leyenda: `[x]` hecho · `[~]` en curso · `[ ]` pendiente

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
| Shadow DOM | `<sigpro-severity-picker>` | — | fase 3 |
| `dialog` nativo vs custom | `dialog` (cambio de estado, nueva versión) y `alertdialog` (eliminar) propios | req, doc | ✓ (el `prompt()` nativo llega con NC, fase 3) |
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
| Shadow DOM, kanban sin asignado | `<sigpro-severity-picker>` y tarjetas de NC | **fase 3** |

## Pendiente / deuda conocida

- **Render:** desplegado (web <https://sigpro-web.onrender.com/>, API <https://sigpro-api.onrender.com/>); CI en verde. Al desplegar la fase 2, la API re-siembra al arrancar los tenants con `seed_version` antigua (ver `docs/DECISIONS.md`).
- **CI en GitHub:** la primera ejecución de `ci.yml` (2026-11-06, repositorio `gsanchezm/sigpro`) terminó en verde: lint, typecheck, unit y e2e de humo.
- **Node 22** (resuelto): CI, Render y `CLAUDE.md` usan Node 22 y pnpm 11 (`pnpm@11` exige ≥ 22.13; ver `docs/DECISIONS.md`).
- **Deshacer eliminación** (`toast-action`): no se implementa (borrado permanente).
- **Detalle de programa:** Resumen y Requisitos (enlace al módulo) están hechos; la pestaña **Hitos** sigue siendo un marcador. La tabla de hitos con edición inline y el slider de avance del catálogo del plan no entraban en la fase 2.
- **Windows + Prisma:** `pnpm typecheck` y `pnpm build` ejecutan `prisma generate`, que falla con `EPERM … query_engine-windows.dll.node` si otra API tiene el motor cargado. Detén antes las APIs locales (el resto de comprobaciones no se ve afectado).
- **Evidencias en PostgreSQL:** hasta 5 archivos de 2 MB por ejecución; el reset nocturno las elimina con el resto del tenant (ver `docs/DEPLOY-RENDER.md`).
- **Perfil**: el enlace del menú de usuario sigue sin destino (las páginas legales y la ayuda ya existen: `/legal/terms`, `/legal/privacy`, `/help`).
- **Textos variables del caos** (`flakyLabels`): se guardan y exponen, pero la web aún no alterna etiquetas (fase 3).
- **Bugs plantados** (`docs/planted-bugs.md`): fase 3.
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
| Capturas (`docs/screens/`) | `pnpm e2e:screens` |
| Comparar con el handoff | `pnpm --filter @sigpro/e2e compare` (`COMPARE_ONLY=programas` filtra) |
| Reiniciar todos los tenants | `pnpm seed` (CLI) · `node scripts/reset-all.mjs` (API, con `ADMIN_KEY`) |
| Ver los prototipos | `pnpm handoff` |

URLs: web <http://localhost:5173> · `/lab` <http://localhost:5173/lab> · API <http://localhost:3000/api> · Swagger <http://localhost:3000/api/docs>.
