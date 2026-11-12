# SIGPRO — Estado de la construcción

Última actualización: 2026-11-12 (`origin/main` = `6b1101d`: auditoría, rediseño «Ciruela» fases 1–5 y móvil espejo funcional con builds para emuladores, todo subido; CI en verde en `12ce4f4`: 331 e2e web + 167 móvil. **Encima, en local y sin subir: «Locators responsive»**, ver la sección siguiente) · **Las 4 fases están construidas y desplegadas en Render** (Render redespliega con cada push a `main`; no se ha comprobado el despliegue de este último push) · el workflow de alumnos se ejecutó contra Render en verde

Leyenda: `[x]` hecho · `[~]` en curso · `[ ]` pendiente

## Locators responsive (2026-11-12)

Un solo corte de diseño a 1024 px y dos componentes por familia, con ids `<id de escritorio>-mobile`. Decisiones y correspondencia de ids en `docs/DECISIONS.md` («Locators responsive»); la tabla de las 10 familias está en `/lab` y en `docs/GUIA-ALUMNO.md` (sección 7). **Todo lo de esta sección está verificado en local y sin subir** (ver «Verificado» y «Cabos sueltos»).

- [x] **T35 · Base.** `useLayout()` (`matchMedia`) y `<html data-layout="desktop|mobile">` (también en `/login`: lo escribe `index.html` antes de pintar), `responsiveId()` / `layoutTestId()` y `RESPONSIVE_TESTIDS` / `RESPONSIVE_DYNAMIC_TESTIDS` en `testids.ts`, `RESPONSIVE_FAMILIES`, claves i18n. `useBreakpoint` retirado (13 usos migrados), los bloques CSS de 639 px pasan a `[data-layout='mobile']` y `sm:` / `md:` valen lo mismo que `lg:`. Unitarios nuevos: shared +8 (133), web +4 (118)
- [x] **T36 · Shell, familias 1–3.** Navegación (`DesktopSidebar` / `MobileDrawer`), búsqueda global (`GlobalSearch` / `GlobalSearchScreen`, con la consulta y los resultados comunes en `search-view.tsx`) y menú de usuario (popover / sección al pie del drawer). Se retira la tabbar móvil de la web
- [x] **T37 · Programas, familias 4–7.** Tabla / tarjetas (`listitem`), botón de cabecera / flotante, filtros en línea / botón «Filtros» con panel inferior, menú ⋯ / hoja de acciones (`ActionSheet`)
- [x] **T38 · Detalle y NC, familias 8–10.** Pestañas / `<select>`, detalle de requisito en panel / pantalla completa con «Volver», kanban de columnas / pestañas por estado con «Mover a…»
- [x] **T39 · Playwright.** Tres proyectos (`desktop` 1440 px, `tablet` iPad gen 7 810 px y `mobile` iPhone 14 390 px; los dos últimos con Chromium), un spec por familia en `e2e/tests/responsive/` más `layout.spec.ts` (corte 1023/1024, `data-layout` en `/login` y remontaje al cambiar el viewport a mitad de test). Actualizados los specs que corrían a 390 px o cruzaban el corte (`programs`, `search`, `nc`, `programs-panel`, `lab` y cuatro de capturas) y `screens-responsive.spec.ts` nuevo. El proyecto `chromium` se llama ahora `desktop`; el CI tiene un paso nuevo para `tablet` y `mobile`
- [x] **T40 · `examples/`.** La sesión 11 (iPhone 14) se actualiza al cajón y a las pestañas de NC (`NcBoardPage` con `responsive`). Fixture `isResponsive`, helper `tid()` / `isResponsiveNow()` y la **sesión 13** (`s13-locators-responsive.spec.ts`): el mismo flujo con `getByRole` (con `.or()`) y con `getByTestId` + `tid()`, a 1440 y 390 px
- [x] **T41 · `/lab` y guía.** Sección «Locators responsive» (reglas, diseño activo y la tabla de familias), `docs/GUIA-ALUMNO.md` sección 7, `docs/design-system.md` («Diseño responsive»), README y `examples/README.md`
- [~] **T42 · Cierre.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde y todo lo de abajo pasado en local. **Abierta: falta el push y que el CI de GitHub pase** (los commits están en local; el push dispara además el despliegue en Render, que el usuario autoriza aparte).

**Verificado en local (2026-11-12), con `CI=true` contra el build de producción (`vite preview`) cuando es e2e:** `pnpm lint` y `pnpm typecheck` (6 paquetes), unitarios shared 133 · api 145 · web 118 · móvil 337 y `pnpm build`; e2e web **`desktop` 376 en verde + 1 intermitente que pasó en el reintento (`verification.spec.ts:40`, lista ordenada: lee el orden antes de que la tabla se repinte; es de antes, no de esta funcionalidad) y 10 omitidos, de 387**; **`tablet` + `mobile` 104 en verde y 4 omitidos de 108**; capturas (`--project=screens`, todas) **89 en verde y 2 omitidas, 0 fallos**; e2e de la app móvil (`pnpm e2e:mobile`) **167/167**; `examples/` completo **95/95** contra un tenant local (`alumno21`) y las capturas `@visual` de iPhone 14 regeneradas; `tsc` de `e2e/` y `examples/` limpios.

**No verificado:** CI de GitHub (no hay push) y el despliegue en Render con esta versión; Safari/WebKit real (los dispositivos se emulan con Chromium); un iPad real o un móvil físico; la sesión 13 contra Render (el workflow de alumnos no la ha ejecutado); las capturas a 1440 px de los módulos no se regeneraron (el escritorio no cambió y los e2e de escritorio pasan).

**Cabos sueltos:** «workers: 2 en local» se aplica a `pnpm e2e:responsive` (`--workers=2`) y a `examples/`; el resto de `e2e/` (`pnpm e2e`, `pnpm e2e:screens`) va en serie porque sus specs y capturas comparten tenants (ver DECISIONS). La tabbar móvil de la web ya no existe (las constantes de `testids.ts` siguen, `apps/mobile` las usa). Menú ⋯ de NC, Requisitos, Verificación, Documentos e Hitos: siguen siendo popover a cualquier ancho (la familia 7 es solo Programas).

## Rediseño visual «1a Ciruela» (2026-11-11)

Detalle y decisiones en `docs/DECISIONS.md` («Rediseño visual «1a Ciruela»») y referencia en `docs/design-system.md`. Un commit por fase.

- [x] **Fase 1 — tokens, fuentes y forma.** e2e nc, access y programs: 71/71
- [x] **Fase 2 — componentes base.** e2e web 299/299
- [x] **Fase 3 — Acceso y Programas** (métricas, filtros como chips, panel lateral de 380 px). Verificado por piezas: `programs-panel.spec.ts` 12/12, `programs-metrics-api.spec.ts`, unit/lint/typecheck. La suite completa no pudo ejecutarse en local (el equipo se quedó sin memoria); el CI de GitHub dio 311/312: la tarjeta «Programas» repetía el texto «12 activo» y `programs.spec` localiza el resumen de la tabla por él (strict mode, 2 elementos). Corregido con «activos: 12» (sin tocar el selector del spec); `programs.spec` + `programs-panel.spec` 47/47 en local
- [x] **Fase 4 — Requisitos** (métricas, árbol-tabla con Pruebas n/m y NC, chip de estado, vista Documento, panel con flujo de aprobación y trazabilidad, matriz con resultados). `requirements*.spec` + `requirements-redesign.spec` en verde en local; la suite completa la valida el CI
- [x] **Fase 5 — documentación y cierre.** CI de GitHub en verde en `10fc024` (run 43207601267): 331 e2e web + 21 móvil, 125/95/114 unitarios en shared/móvil/web. Hecho: capturas web regeneradas (374 más 4 nuevas de `requisitos-documento`) y **desversionadas** (`docs/screens/` pasa a `.gitignore`; el historial anterior conserva las viejas), `compare` eliminado, README/design-system/STATUS/DECISIONS/`CLAUDE.md` al día. La fase 4 ya la había validado el CI: 331 e2e web + 21 móvil
- [x] **Móvil «espejo» FUNCIONAL de la web (decisión del usuario, 2026-11-12).** Primero visual (M1–M3: tokens, Geist, componentes, métricas) y después funcional, módulo a módulo (guía y tabla de estado en `docs/MOBILE-PARITY.md`): navegación Programas · Verificación · NC · Misión · Más; Requisitos (transiciones, alta, edición, borrado, mover, matriz de trazabilidad); Programas (asistente de alta, edición, duplicar, archivar, borrar, selección múltiple, CSV, hitos, proveedores); Verificación (casos, ejecuciones con evidencias, informe); NC (alta y edición); Documentos (publicar versión, comparar, descargar); Auditoría y Administración; registro y recuperar contraseña, páginas legales, preferencias del perfil y búsqueda global. Lagunas documentadas: «Mover a…» solo reordena entre hermanos (la API rechaza cambiar de padre), descripciones en texto plano, y fuera de alcance `/lab`, arrastrar y soltar y los atajos de teclado. **Verificado en Expo web (Chromium a 390 px):** `pnpm lint/typecheck/test/build` de la raíz en verde (shared 125, api 145, web 114, móvil 337) y la suite móvil `e2e` + capturas en verde en local. **No verificado en nativo** salvo lo que indique la línea siguiente.
- [~] **Builds para emuladores (iOS y Android).** `.github/workflows/mobile-builds.yml` (manual) genera un `.app` zipeado para el Simulador de iOS y un `.apk` para el emulador de Android; guía en `docs/MOBILE-EMULADORES.md`. **Ejecutado en GitHub con la app funcional completa (run 43256654130, commit `424ca3d`):** ambos jobs en verde; el `.app` lleva `x86_64 arm64`, `dev.sigpro.lab`, `NSAllowsLocalNetworking`, las fuentes Geist y la URL de la API en `main.jsbundle`; el APK lleva `x86_64` y `arm64-v8a` y la URL en el bundle (los módulos nativos nuevos —selector de imágenes y de documentos, sistema de archivos, compartir— compilan en los dos). CI de la misma versión en verde (run 43256636909): 331 e2e web + 167 móvil. **Probado en un emulador de Android (API 33, local) con ese APK:** instala y arranca; Geist, sombras y paleta bien; login con MFA contra una API por HTTP, Programas con métricas y acciones nuevas, asistente de «Nuevo programa» con un selector modal anidado y la pestaña Verificación con sus filtros y el informe. **No verificado:** iOS en un Simulador (exige macOS); en nativo, la subida de evidencias y de documentos (selectores), la hoja de compartir y la descarga de archivos; el resto de módulos solo se ejercitó en Expo web.

## Auditoría de código (2026-11-11)

Revisión externa contrastada con el código; el detalle y lo descartado está en `docs/DECISIONS.md` («Auditoría de código»).

- [x] **MFA:** el segundo paso comprueba la cuenta (bloqueada 423, pendiente/desactivada 403) con `accountBlock()`, compartido con login y refresh. Test unitario + spec de API (`admin-api.spec.ts`)
- [x] **Códigos correlativos concurrentes:** 8 altas simultáneas daban 500 en 5 sitios (programas alta y duplicar, requisitos, NC, ejecuciones); ahora `lockTenantCodes()` (candado de Postgres por tenant) las serializa. `codes-concurrency-api.spec.ts`: 5 specs, 20/20 con `--repeat-each=4` y 0 errores `P2002` en el log de la API
- [x] **JWT sin estado: se mantiene** (decisión de la fase 1, `last_admin` depende de ello); un spec fija la ventana de 15 min
- [ ] **Pendiente, sin urgencia:** separar `AccessPage.tsx` (641 líneas) y extraer el hook de lista común de Programas/Verificación cuando se vuelvan a tocar
- **Verificado:** `pnpm lint && pnpm typecheck && pnpm test` en verde (shared 119, web 114, api 142, móvil 95) y **e2e web 299/299** contra la API reconstruida. **No se ha probado en Render ni en GitHub**: los cambios no están subidos

## Fase 4 — Material para alumnos y móvil

Orden fijo (el móvil va el último). Cada tarea termina con `pnpm lint && pnpm typecheck && pnpm test` en verde, su spec, capturas cuando aplica, una línea en `docs/CHANGELOG.md` y un commit. Una sola pila (API :3000, web :5173).

- [x] **T30** `examples/`: proyecto Playwright + TypeScript independiente del monorepo (su `package.json`), fixtures por rol con `storageState`, Page Object de Programas, un spec por sesión 2–11 y `.github/workflows/students-e2e.yml` (tenant parametrizado, sharding en 2, informe HTML como artefacto). **90 tests (86 + 4 de `setup`), 90/90 en dos pasadas seguidas en un solo tenant con 2 workers y sin reset entre ellas** (~55 s). `npm test` ejecuta 83 (+ 4 de `setup`); los 3 `@visual` van en su propio proyecto (`npm run test:visual`, con líneas base propias de cada alumno)
- [x] **T31** `/lab` completa: lista de 22 endpoints con enlaces a Swagger y al OpenAPI, contraejemplo de texto variable con el caos, FAQ de 8 preguntas y descarga del zip de `examples/` generado en el build. `lab.spec.ts` 15/15, capturas regeneradas, + 7 tests unitarios de endpoints y 11 del zip (web: 114). Arreglada de paso la anchura de `/nc` en móvil
- [x] **T32** `docs/GUIA-ALUMNO.md`: levantar SIGPRO en local con Docker, apuntar la suite a Render, usuarios, permisos y códigos fijos del seed (tablas obtenidas de la API real); viaja dentro del zip
- [x] **T33** `apps/mobile` (Expo SDK 58 + Expo Router): Login con MFA, Programas (cards con filtros), kanban de NC y Panel de misión; Requisitos y Documentos en lectura; sin Administración (**ampliado después a espejo funcional completo: ver la línea «Móvil “espejo” FUNCIONAL» de arriba**); `testID` = `data-testid`; capturas a 390 px. **95 tests unitarios, 21 specs de humo (`pnpm e2e:mobile`, con la exportación estática y con `expo start --web`) y 32 capturas** al cerrar la fase (hoy 337 unitarios, 167 specs y 34 capturas); las capturas no se versionan
- [x] **T34** Cierre de fase: README con el estado final, STATUS final, guía del alumno con la sección móvil

## Resumen de la fase 4

- **`examples/`** (proyecto independiente, `npm`): 10 specs (86 tests: s02 11 · s03 9 · s04 7 · s05 9 · s06 8 · s07 7 · s08 8 · s09 9 · s10 9 · s11 9), 4 tests de `setup` que guardan `.auth/<tenant>-<rol>.json`, fixtures `role` / `pageAs` / `adminPage`… / `apiAs` / `programsPage`, 9 Page Objects y ayudas, `npm run reset` (restaura el tenant y apaga el caos). **Verificado: 90/90 dos veces seguidas contra un único tenant (`alumno21`) con 2 workers, sin reset entre pasadas.** `npm test` ejecuta el proyecto `chromium` (los 3 `@visual` van aparte: `npm run test:visual`). Reglas de convivencia en `examples/README.md` y `docs/DECISIONS.md`.
- **Workflow `students-e2e.yml`:** `plan → prepare → e2e (tenant × shard 1/2) → report`; informe HTML único como artefacto. Validado con `actionlint` y **ejecutado en GitHub contra Render con `alumno25`** (run 43092572209): los 5 jobs en verde, 48 + 43 tests (83 de las sesiones 2–11 + el `setup` de cada shard) y artefacto `playwright-report-alumno25` de ~284 KB.
- **`/lab`:** endpoints (contrastados con el OpenAPI real), contraejemplos (XPath, par que se solapa, texto que cambia con el caos), FAQ de 8 preguntas, usuario personal y descarga de `sigpro-examples.zip` (40 archivos, ~78 KB, generado en `build` y `dev`).
- **`docs/GUIA-ALUMNO.md`:** Docker en local, apuntar la suite a Render, usuarios, permisos, códigos fijos del seed (de la API real) y la app móvil.
- **App móvil (`apps/mobile`):** Expo SDK 58 + Expo Router con React 19 **solo en ese paquete** (la web sigue en React 18); mismas rutas, mismo cliente HTTP y mismos ids que la web, AsyncStorage con las mismas claves (las ayudas e2e de la web sirven en `:8081`). Pantallas: acceso con MFA, Programas, No conformidades (kanban con «Mover a…»), Panel de misión (Socket.IO), Requisitos y Documentos en lectura, Perfil. **`pnpm dev` levanta también Expo web en `:8081`; `pnpm build` exporta la web móvil.**
- **Hallazgos corregidos por el camino:** `/nc` medía 1303 px a 390 px (los `span` `sr-only` escapaban del tablero); en un clon limpio `npm test` de `examples/` fallaba por faltar las líneas base `@visual`; al añadir React 19 al workspace los tipos de `react-router-dom` resolvían `@types/react@19` (la web lo fija ahora en su `tsconfig`); la barra de pestañas móvil recortaba sus etiquetas (la caja de 9 px de la etiqueta, vista en la captura); React Native Web no pinta `aria-description` (el motivo de un botón deshabilitado va en `data-reason` y en un texto visible); un Vite arrancado antes de `pnpm install` responde `504 Outdated Optimize Dep` y hay que reiniciarlo.
- **Calidad:** `pnpm lint && pnpm typecheck && pnpm test` en verde (shared 119, web 114, api 139, móvil 95; tras la auditoría, api 142) y `pnpm build` (shared, api, web, mobile). **e2e web: 292 specs** al cerrar la fase (286 + 6 nuevos de `/lab`; 299 tras la auditoría); **e2e móvil: 21 specs** y 32 capturas. **En GitHub**, el primer CI de las fases 3–4 dio 285/286 en la web (la carrera de `search.spec.ts`, corregida; ver `DECISIONS.md`) y los dos pasos e2e, web y móvil, quedaron en verde tras la corrección.

## Cobertura de locators — móvil (React Native Web a 390 px)

Los mismos ids que la web (`testID` → `data-testid`) y roles ARIA con `role=` / `aria-*`. Specs en `e2e/tests/mobile/`: `mobile.spec.ts` (humo por rol) y uno por módulo (`requirements-edit`, `programs-edit`, `verification`, `nc-edit`, `documents-edit`, `audit-admin`, `access-extras`, `search-profile`), más `capture.spec.ts` (capturas).

| Locator | Elemento móvil | Estado |
| --- | --- | --- |
| `getByRole` | `tab` (barra inferior), `radio` (filtros y versiones), `dialog` (hoja de detalle), `alert`, `status`, `progressbar` (`aria-valuenow`), `list` / `listitem`, `region` (columnas del kanban), `group`, `img` (avatares), `button` | ✓ |
| `getByRole` + `exact` | «EN» frente a «En pausa»; `Mover a «En análisis»` | ✓ |
| `getByLabel` | Correo, contraseña, código MFA, tenant, buscadores, «Comentario de cierre», «Añadir comentario» (`aria-label` en `TextInput`) | ✓ |
| `getByPlaceholder` | «Buscar código o nombre…», «000000» | ✓ |
| `getByAltText` | **No aplica**: los avatares son `role="img"` con nombre (`getByRole('img', { name })`) | n/a |
| `getByTitle` | **No aplica**: React Native no tiene `title`; el motivo va en `data-reason` y en texto visible | n/a |
| `getByTestId` | Todo elemento interactivo (ESLint prohíbe el `testID` literal) | ✓ |
| CSS (`data-state`, `data-severity`) | `dataSet` en badges de estado, severidad y conexión | ✓ |
| `filter({ hasNot })` | Tarjetas de NC sin avatar (NC-005 y NC-010) | ✓ |
| Tiempo real | `expect.poll` sobre el feed, `waitForResponse` en `Promise.all`, KPI que cambia por un evento real | ✓ |
| Interceptación de red | 503 con traza y reintento (Programas) | ✓ |
| Sesión | `storageState` / `addInitScript` con las claves de la web; persistencia al recargar y cierre de sesión | ✓ |
| Drag & drop | **No hay** en el móvil: «Mover a…» desde el detalle | n/a |


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
- **Web** (React 18 + Vite + Tailwind 4): Acceso y Programas reproducían el handoff (≤ 2,2 % de píxeles distintos en 50 escenarios; medición histórica: el handoff y su comparación se retiraron con el rediseño «1a Ciruela»), `/lab`, ES/EN, PWA, estados de carga/vacío/error.
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

- **Render (2026-11-11):** `origin/main` recibió las fases 3 y 4 (`f5d4b7e..30891a2` y la corrección `5e7b12a`) y Render desplegó solo: la API aplicó la migración `phase3` y re-sembró los tenants, `/api/config` expone `plantedBugs`, `/socket.io` responde y la web sirve `/downloads/sigpro-examples.zip` (~80 KB). Antes de subir, el entorno público seguía en la fase 2 (el encargo de la fase decía lo contrario; ver `DECISIONS.md`). Pasos y comprobación rápida en `docs/DEPLOY-RENDER.md` («Actualizar a la fase 3» y «a la fase 4»).
- **CI en GitHub:** la primera ejecución de `ci.yml` (2026-11-06, repositorio `gsanchezm/sigpro`) terminó en verde: lint, typecheck, unit y e2e de humo.
- **Node 22** (resuelto): CI, Render y `CLAUDE.md` usan Node 22 y pnpm 11 (`pnpm@11` exige ≥ 22.13; ver `docs/DECISIONS.md`).
- **Deshacer eliminación** (`toast-action`): no se implementa (borrado permanente).
- **Windows + Prisma** (resuelto en la fase 3): `apps/api/scripts/generate-prisma.mjs` aparta el motor de consultas en uso y reintenta, así `pnpm typecheck` y `pnpm build` funcionan con la API en marcha. Si algún día falla, el síntoma es `EPERM … query_engine-windows.dll.node`.
- **Evidencias en PostgreSQL:** hasta 5 archivos de 2 MB por ejecución; el reset nocturno las elimina con el resto del tenant (ver `docs/DEPLOY-RENDER.md`).
- **Bugs plantados:** `docs/planted-bugs.md` existe **solo en local** (está en `.gitignore` porque el repositorio es público); guárdalo en un lugar privado o haz `git add -f` si el repositorio pasa a ser privado. El código con `PLANTED_BUGS` sigue siendo legible en GitHub.
- **Procesos locales:** la pila de trabajo es API `:3000` + web `:5173` (+ Expo web en `:8081` si se lanza `pnpm dev`). Sigue viva una API de basic auth en `:3100` (la deja Playwright para `api-docs.spec.ts`; la vuelve a arrancar sola). El Vite de `:5174` de una sesión anterior se detuvo.
- **`pnpm dev` y Expo:** sin terminal interactiva (turbo, CI) `scripts/expo.mjs` pone `CI=1` y Metro no recarga solo; en una terminal normal sí. Si dejas el Vite de `:5173` arrancado durante un `pnpm install` responde `504 Outdated Optimize Dep`: reinícialo.
- **App móvil:** probada en Expo web (React Native Web) y, en nativo, **solo en un emulador de Android (API 33) con el APK de la build funcional**: login con MFA, Programas, asistente con selector modal anidado y Verificación. **Sin verificar:** iOS en un Simulador (exige un Mac; el `.app` compila en GitHub pero nunca se abrió), los selectores de imagen y documento, la hoja de compartir, la descarga de archivos y el resto de módulos en nativo. `EXPO_PUBLIC_API_URL` se incrusta al compilar (iOS `http://localhost:3000/api`, Android `http://10.0.2.2:3000/api`; para Render, las entradas `ios_api_url` / `android_api_url` del workflow). Las builds nativas se hacen en el runner de GitHub: el Gradle local de Windows falla en CMake/ninja (`build.ninja still dirty`). `pnpm-workspace.yaml` tiene 28 entradas nuevas en `minimumReleaseAgeExclude` (versiones recientes de Expo). `@sigpro/shared` debe estar compilado antes de `expo start` (`pnpm dev` y `pnpm build` ya lo hacen).
- **Workflow de alumnos (`students-e2e.yml`):** ejecutado en GitHub contra Render (ver arriba). Las pruebas visuales `@visual` no se ejecutan en él por defecto (`visual: skip`); los modos `compare` y `update` no se han probado en GitHub. Corre sobre `alumno25`: cada ejecución **reinicia ese tenant** en Render.
- **Evolución del modelo:** la FK `NonConformity → TestRun` es `NO ACTION`; el seed v3 enlaza solo ejecuciones del propio programa. Si se permitiera enlazar ejecuciones de otro programa, el borrado de ese programa volvería a dar 500.
- **Git:** el repositorio es público (`https://github.com/gsanchezm/sigpro`). El zip `SIGPRO Design System Entregables.zip` se eliminó de la rama, pero sigue en el primer commit del historial. Las 408 capturas que se versionaron antes del rediseño también siguen en el historial (decisión del usuario: no versionar capturas desde ahora); purgarlas exigiría `git filter-repo` y un push forzado, y no se ha hecho.
- **Cabos sueltos (2026-11-12):** el run de CI 43097697564 (commit `e902850`, solo docs) es un registro zombi: figura `queued` sin jobs desde el 11-nov y GitHub no deja cancelarlo (`gh run cancel` dice «completed» y `force-cancel` responde 409 «not been queued yet»). No bloquea nada: los runs posteriores corrieron y pasaron, y este commit lo cubren. Solo se quitaría con `gh run delete 43097697564` (decisión del usuario). La carpeta temporal `C:\s` (una copia del repo con `node_modules` de un intento de compilar Gradle desde una ruta corta; ya no es un worktree y nada la usa) debe borrarla el usuario con `cmd /c rmdir /s /q C:\s`: la herramienta de la sesión no puede. El `Switch` del tema oscuro móvil se ve verde azulado (`activeThumbColor` de react-native-web): cosmético. Las carpetas `.tmp-*` (salida de Playwright y capturas de revisión) se borraron; `e2e/tests/zz-visual-check.spec.ts` sigue sin seguimiento a propósito (herramienta temporal de capturas rápidas, se omite sola sin `VISUAL_OUT`). «Mover a…» solo reordena entre hermanos y las descripciones móviles son texto plano (ver `docs/MOBILE-PARITY.md`).

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
| Varias ejecuciones de Playwright a la vez | `E2E_SKIP_GLOBAL_RESET=1 pnpm --filter @sigpro/e2e exec playwright test --project=desktop tests/<spec> --output=<dir propio>` (con tenants distintos) |
| Capturas (`docs/screens/`) | `pnpm e2e:screens` (todas) · `pnpm --filter @sigpro/e2e exec playwright test --project=screens tests/screens-nc.spec.ts` (un módulo) |
| Defectos plantados / simulador | `PLANTED_BUGS=false` deja la app limpia · `SIMULATOR_MS=0` apaga el simulador de misión (variables de la API) |
| Reiniciar todos los tenants | `pnpm seed` (CLI) · `node scripts/reset-all.mjs` (API, con `ADMIN_KEY`) |
| App móvil | `pnpm --filter mobile web` (Expo web :8081) · `pnpm e2e:mobile` (specs; `MOBILE_SERVER=expo` usa `expo start --web`) · `pnpm e2e:mobile:screens` (capturas a 390 px) |
| Proyecto de los alumnos | `cd examples && npm install && npm run reset && npm test` (ver `examples/README.md`) |
| Ver los prototipos anteriores (histórico) | `pnpm handoff` |

URLs: web <http://localhost:5173> · `/lab` <http://localhost:5173/lab> · API <http://localhost:3000/api> · Swagger <http://localhost:3000/api/docs> · app móvil (Expo web) <http://localhost:8081>.
