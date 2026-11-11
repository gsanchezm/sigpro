# SIGPRO

Laboratorio de pruebas para el curso **Playwright + TypeScript**: un gestor ficticio de programas de ingeniería de sistemas (programas, requisitos, verificación, no conformidades, documentos) pensado para ser automatizado. La testabilidad es un requisito funcional: todo elemento interactivo tiene nombre accesible y `data-testid` (de `packages/shared/src/testids.ts`; `testID` en la app móvil), el seed es determinista y cada alumno trabaja en su propio *tenant*.

- Plan y backlog: [`docs/SIGPRO-plan.md`](docs/SIGPRO-plan.md) · Diseño: [`docs/design-handoff/`](docs/design-handoff/README.md)
- Estado de la construcción: [`docs/STATUS.md`](docs/STATUS.md) · Decisiones: [`docs/DECISIONS.md`](docs/DECISIONS.md) · Cambios: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- **Para alumnos:** [`docs/GUIA-ALUMNO.md`](docs/GUIA-ALUMNO.md) · proyecto Playwright de referencia en [`examples/`](examples/README.md)
- Capturas (claro/oscuro; web a 1440 y 390 px, móvil a 390 px): [`docs/screens/`](docs/screens)

## Estado del proyecto

Las **cuatro fases del plan están construidas y verificadas en local**:

| Fase | Contenido | Verificación |
| --- | --- | --- |
| 1 · Base | Monorepo, API, seed multi-tenant, Acceso y Programas, `/lab`, `render.yaml` | `pnpm lint && pnpm typecheck && pnpm test` y e2e de humo |
| 2 · Núcleo | Requisitos, Verificación, Documentos, Auditoría | idem |
| 3 · Dinámica y caos | No conformidades (kanban), Panel de misión (Socket.IO), Administración, modo caos, 8 defectos plantados | idem |
| 4 · Material y móvil | `examples/` + workflow de alumnos, `/lab` completa, guía del alumno, app Expo | idem + e2e móvil |

Cifras de la última pasada: **tests unitarios** shared 119 · web 114 · api 139 · móvil 95; **e2e de la web** 292 specs; **e2e del móvil** 21 specs y 32 capturas; **`examples/`** 90 tests (86 + 4 de `setup`) en dos pasadas seguidas, con 2 workers y un solo tenant.

> **Despliegue pendiente.** Render (<https://sigpro-web.onrender.com> y <https://sigpro-api.onrender.com>) sigue en la **fase 2**: los commits de las fases 3 y 4 no se han subido a `origin/main`. Hasta hacer `git push` y desplegar (pasos en [`docs/DEPLOY-RENDER.md`](docs/DEPLOY-RENDER.md#actualizar-a-la-fase-3)), el workflow de alumnos solo puede pasar las sesiones 2–9 contra Render. La app móvil no se aloja en Render.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `apps/api` | NestJS + Prisma + PostgreSQL. JWT + roles, MFA simulado, OpenAPI en `/api/docs`, Socket.IO, `/api/admin/reset` y `/api/admin/chaos` |
| `apps/web` | React 18 + Vite + Tailwind 4, tokens del design system como CSS variables, claro/oscuro, ES/EN, PWA |
| `apps/mobile` | Expo SDK 58 + Expo Router (React 19): mismas rutas, mismo cliente y mismos ids que la web |
| `packages/shared` | Tipos, esquemas Zod, cliente HTTP, i18n ES/EN y `testids.ts` |
| `e2e` | Playwright: specs de humo de la web y del móvil, capturas y comparación visual con el handoff |
| `examples` | Proyecto Playwright + TypeScript de referencia para los alumnos (independiente del monorepo: `npm`, su propio `package.json`) |

## Módulos

| Ruta | Módulo | Qué practica |
| --- | --- | --- |
| `/login`, `/register`, `/forgot` | Acceso | `storageState`, MFA, bloqueo, formularios con 422 |
| `/programs`, `/programs/:code`, `/programs/:code/edit` | Programas | Tablas, filtros, paginación, asistente de 3 pasos, edición con «Guardar» / «Guardar y cerrar» |
| `/programs/:code/requirements` | Requisitos | Árbol `role="tree"`, estados por rol con confirmación, edición en línea, etiquetas con chips, editor `contenteditable`, drag & drop para reordenar, clic derecho, atajos, portapapeles, matriz, CSV |
| `/verification`, `/verification/:code` | Verificación | Casos de prueba, ejecución con radio, subida simple / múltiple / zona de arrastre, `getByAltText`, informe PDF |
| `/documents`, `/documents/:id`, `/documents/:id/view` | Documentos | Clasificación por rol (403), `<iframe>` con `frameLocator`, `target="_blank"`, comparación de versiones, descargas |
| `/audit` | Auditoría | Feed con scroll infinito (`role="feed"`, cursor), filtros por fecha, entidad y texto |
| `/nc`, `/nc/:code` | No conformidades | Kanban con drag & drop entre columnas, `<sigpro-severity-picker>` (Shadow DOM abierto), combobox de asignación, comentarios, cierre con mínimo 20 caracteres, `prompt()` nativo |
| `/mission` | Panel de misión | 4 KPIs, gráficas, feed en tiempo real por Socket.IO (`waitForEvent`, `expect.poll`), campana con contador, tooltips |
| `/admin` | Administración | Usuarios (switch y select de rol), auditoría por rango de fechas, modo caos (sliders y textos alternos), reset con `confirm()` nativo |
| `/programs/:code` (pestaña Hitos), `/profile` | Hitos y Perfil | Edición inline de celdas, slider con `aria-valuenow`; radios, checkbox y switch |
| `/lab`, `/legal/terms`, `/legal/privacy`, `/help` | Laboratorio y páginas públicas | Credenciales, reset, caos, **lista de endpoints**, contraejemplos de locators (XPath frágil, textos que cambian con el caos), **descarga de `sigpro-examples.zip`**, FAQ |

**App móvil** (`apps/mobile`, mismas rutas): acceso con MFA, Programas (tarjetas con filtros), No conformidades (tablero kanban; sin drag & drop: «Mover a…»), Panel de misión (tiempo real) y, en solo lectura, Requisitos y Documentos. No tiene Administración. Detalle y caveats de locators en [`docs/GUIA-ALUMNO.md`](docs/GUIA-ALUMNO.md#6-app-móvil-expo).

El producto trae además **8 defectos plantados** para el ejercicio de reporte de defectos (`PLANTED_BUGS`, activos por defecto; `false` deja la aplicación limpia) y un **simulador de misión** (`SIMULATOR_MS`). El catálogo de defectos es solo para el instructor y no se versiona (`docs/planted-bugs.md` está en `.gitignore`); la app móvil implementa siempre el comportamiento correcto.

## Arranque local

Requisitos: Node ≥ 22.13 (lo pide `pnpm@11`), pnpm 11 (`corepack enable`) y Docker.

```bash
pnpm install
cp .env.example .env              # en Windows: copy .env.example .env
docker compose up -d db           # PostgreSQL en :5432
pnpm --filter api prisma:deploy   # aplica las migraciones
pnpm dev                          # API :3000 (siembra los tenants al arrancar) + web :5173 + app móvil (Expo web) :8081
```

Abre <http://localhost:5173> (acceso, con panel de usuarios de prueba), <http://localhost:5173/lab> (credenciales, reset, caos, endpoints y descarga del proyecto de ejemplo), <http://localhost:3000/api/docs> (Swagger) y <http://localhost:8081> (app móvil en el navegador; `?tenant=alumno01` elige el tenant). Solo la app móvil: `pnpm --filter mobile web`; en un teléfono con Expo Go, `EXPO_PUBLIC_API_URL=http://<IP-de-tu-PC>:3000/api pnpm --filter mobile start`.

Usuarios demo (existen en cada tenant; `?tenant=alumno01` o el selector de `/lab` cambian de tenant):

| Correo | Contraseña | Rol / nota |
| --- | --- | --- |
| `admin@sigpro.test` | `Admin1234!` | admin · MFA `123456` |
| `gestor@sigpro.test` | `Gestor1234!` | program_manager |
| `consultor@sigpro.test` | `Consul1234!` | consultant |
| `auditor@sigpro.test` | `Audit1234!` | auditor |
| `bloqueado@sigpro.test` | `Block1234!` | cuenta bloqueada (423) |
| `pendiente@sigpro.test` | `Pend1234!` | pendiente de aprobación (403) |
| `alumnoNN@sigpro.lab` | `Alumno1234!` | admin de su tenant `alumnoNN` |

## Scripts

| Comando | Qué hace |
| --- | --- |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Calidad (ESLint sin `switch`/`any`/`data-testid` ni `testID` literales, `tsc`, Vitest) |
| `pnpm build` | Compila `shared`, `api` (Prisma + Nest), `web` (Vite; también genera el zip de `examples/`) y `mobile` (`expo export` web) |
| `pnpm seed` | Reinicia el seed de todos los tenants desde la CLI |
| `pnpm e2e` | Specs de humo de la web (arranca API y web; `CI=true` sirve el build con `vite preview`) |
| `pnpm e2e:mobile` | Specs de humo de la app móvil a 390 px (exportación estática en :8081; `MOBILE_SERVER=expo` usa `expo start --web`) |
| `pnpm e2e:screens` · `pnpm e2e:mobile:screens` | Regeneran las capturas de `docs/screens/` (web / móvil) |
| `pnpm --filter @sigpro/e2e compare` | Compara las pantallas con los prototipos del handoff (`e2e/.compare/`) |
| `pnpm handoff` | Sirve `docs/design-handoff/` por HTTP (`npx serve`) para ver los prototipos |
| `node scripts/reset-all.mjs` | Reinicia todos los tenants (lo usa el Cron Job de Render) |

La primera vez: `pnpm --filter @sigpro/e2e install:browsers`.

**Segunda pila para los specs.** Si ya tienes la API en :3000 y la web en :5173 (o prefieres no pisarlas), arranca otra y apunta Playwright a ella:

```bash
PORT=3001 CORS_ORIGIN=http://localhost:5174 pnpm --filter api dev        # API en :3001
WEB_PORT=5174 API_PROXY_TARGET=http://localhost:3001 pnpm --filter web dev # web en :5174
E2E_API_URL=http://localhost:3001/api E2E_WEB_URL=http://localhost:5174 pnpm e2e
```

El spec de basic auth (`api-docs.spec.ts`) usa una segunda API con `DOCS_BASIC_AUTH=curso:docs-2026` que Playwright arranca solo en el puerto 3100 (`E2E_DOCS_URL` y `E2E_DOCS_AUTH` lo cambian).

> En Windows, `prisma generate` no puede sobrescribir el motor de consultas mientras otra API lo tenga cargado (`EPERM … query_engine-windows.dll.node`). `apps/api/scripts/generate-prisma.mjs` (lo usan `build` y `typecheck`) aparta el motor en uso y reintenta, así que ya no hace falta detener la API.
>
> Si dejas el servidor de Vite (:5173) arrancado mientras haces `pnpm install` o cambias dependencias, responderá `504 Outdated Optimize Dep`: reinícialo.

**Varias ejecuciones de Playwright a la vez** contra la misma pila: con `E2E_SKIP_GLOBAL_RESET=1` se salta el reset global de `globalSetup` (cada spec ya reinicia su propio tenant en `beforeAll`) y no se pisan los datos entre sí. La suite de la web va con `workers: 1` porque sus archivos comparten tenants; `examples/` sí usa 2 workers en local (cada spec toca datos distintos).

## Material para alumnos

- [`docs/GUIA-ALUMNO.md`](docs/GUIA-ALUMNO.md): levantar SIGPRO con Docker, apuntar la suite a Render, usuarios, permisos y códigos fijos del seed, app móvil.
- [`examples/`](examples/README.md): proyecto Playwright + TypeScript con fixtures por rol (`storageState`), Page Objects y **un spec por sesión (2 a 11)**; `npm run reset` restaura el tenant y apaga el caos. También se descarga como zip desde `/lab`.
- [`.github/workflows/students-e2e.yml`](.github/workflows/students-e2e.yml): la plantilla de la sesión 12. Corre la suite contra Render por tenant (`x-tenant` + usuario `alumnoNN`), en 2 shards, y publica el informe HTML como artefacto.

## Despliegue

`render.yaml` declara la API (Web Service), la web (Static Site), PostgreSQL y el Cron Job de reset nocturno. `JWT_SECRET`, `ADMIN_KEY` y `DOCS_BASIC_AUTH` se piden al crear el Blueprint. Al desplegar una fase nueva, la API aplica sus migraciones y vuelve a sembrar los tenants con `seed_version` antigua (ver [`docs/DEPLOY-RENDER.md`](docs/DEPLOY-RENDER.md#actualizar-a-la-fase-3)); la fase 3 añade Socket.IO, `PLANTED_BUGS` y `SIMULATOR_MS`. El workflow [`ci.yml`](.github/workflows/ci.yml) ejecuta lint, typecheck, tests unitarios, build, el tipado de `examples/` y los specs e2e de humo (web y móvil) con un PostgreSQL de servicio.
