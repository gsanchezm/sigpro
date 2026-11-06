# SIGPRO — Estado de la construcción

Última actualización: 2026-11-06 · **Fase 1 (Base) cerrada** · **Fase 2 (Núcleo del dominio) en curso**

Leyenda: `[x]` hecho · `[~]` en curso · `[ ]` pendiente

## Fase 2 — Núcleo del dominio

Cada tarea termina con `pnpm lint && pnpm typecheck && pnpm test` en verde y un commit. Cada módulo cierra además con su spec e2e de humo, capturas claro/oscuro a 1440 y 390 px en `docs/screens/` y la pasada por la tabla «Cobertura de locators».

- [ ] **T15** Modelo de datos y contratos: migración (`tags`, `position`, `Evidence`, `DocumentVersion`), seed v2 con re-seed por versión, permisos, esquemas Zod, DTOs, cliente (multipart + blob), `testids.ts`, i18n (4 espacios nuevos), helpers puros (HTML enriquecido, diff de líneas, árbol, PDF)
- [ ] **T16** Pendientes de la fase 1: editar programa (PATCH + formulario), páginas legales y ayuda, spec de basic auth de `/api/docs`
- [ ] **T17** Módulo **Requisitos**: árbol, estados y permisos, edición inline, etiquetas, editor `contenteditable`, reordenar, menú contextual, atajos, copiar código, matriz, CSV
- [ ] **T18** Módulo **Verificación**: casos de prueba, ejecución (radio), evidencias (simple, múltiple, arrastrar), informe PDF
- [ ] **T19** Módulo **Documentos**: clasificación por rol, visor en `<iframe>`, nueva pestaña, comparación de versiones
- [ ] **T20** Módulo **Auditoría** (AuditLog): feed con scroll infinito y filtros
- [ ] **T21** Cierre de fase 2: README, CHANGELOG, STATUS final, pasada completa (lint, typecheck, unit, e2e, capturas)


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
| `frameLocator`, Shadow DOM, nueva pestaña, kanban sin asignado | Visor de documentos, `<sigpro-severity-picker>`, enlace `target=_blank`, NC | **fase 2/3** |

## Pendiente / deuda conocida

- **Render:** desplegado (web <https://sigpro-web.onrender.com/>, API <https://sigpro-api.onrender.com/>); CI en verde. Al desplegar la fase 2, la API re-siembra al arrancar los tenants con `seed_version` antigua (ver `docs/DECISIONS.md`).
- **CI en GitHub:** la primera ejecución de `ci.yml` (2026-11-06, repositorio `gsanchezm/sigpro`) terminó en verde: lint, typecheck, unit y e2e de humo.
- **Node 22 en CI/Render** en vez de Node 20: `pnpm@11` exige ≥ 22.13 (ver `docs/DECISIONS.md`).
- **Editar programa** (PATCH + formulario): hoy muestra el toast del prototipo; llega con el módulo completo en la fase 2.
- **Deshacer eliminación** (`toast-action`): no se implementa (borrado permanente).
- **Detalle de programa:** solo la pestaña Resumen; Hitos y Requisitos son marcadores.
- **Páginas legales** (`#/legal/…`, `#/ayuda`) y **Perfil**: enlaces del handoff sin destino.
- **Textos variables del caos** (`flakyLabels`): se guardan y exponen, pero la web aún no alterna etiquetas (fase 3).
- **Bugs plantados** (`docs/planted-bugs.md`): fase 3.
- **Basic auth de `/api/docs`** (`DOCS_BASIC_AUTH`): implementado, sin spec e2e (no se activa en local).
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
