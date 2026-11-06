# SIGPRO

Laboratorio de pruebas para el curso **Playwright + TypeScript**: un gestor ficticio de programas de ingeniería de sistemas (programas, requisitos, verificación, no conformidades, documentos) pensado para ser automatizado. La testabilidad es un requisito funcional: todo elemento interactivo tiene nombre accesible y `data-testid` (de `packages/shared/src/testids.ts`), el seed es determinista y cada alumno trabaja en su propio *tenant*.

- Plan y backlog: [`docs/SIGPRO-plan.md`](docs/SIGPRO-plan.md) · Diseño: [`docs/design-handoff/`](docs/design-handoff/README.md)
- Estado de la construcción: [`docs/STATUS.md`](docs/STATUS.md) · Decisiones: [`docs/DECISIONS.md`](docs/DECISIONS.md) · Cambios: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- Capturas (claro/oscuro, 1440 y 390 px): [`docs/screens/`](docs/screens)

## Estructura

| Ruta | Qué es |
| --- | --- |
| `apps/api` | NestJS + Prisma + PostgreSQL. JWT + roles, MFA simulado, OpenAPI en `/api/docs`, `/api/admin/reset` y `/api/admin/chaos` |
| `apps/web` | React 18 + Vite + Tailwind 4, tokens del design system como CSS variables, claro/oscuro, ES/EN, PWA |
| `packages/shared` | Tipos, esquemas Zod, cliente HTTP, i18n ES/EN y `testids.ts` |
| `e2e` | Playwright: specs de humo, capturas y comparación visual con el handoff |
| `apps/mobile` | Expo (fase 4, aún no creado) |

## Módulos

| Ruta | Módulo | Qué practica |
| --- | --- | --- |
| `/login`, `/register`, `/forgot` | Acceso | `storageState`, MFA, bloqueo, formularios con 422 |
| `/programs`, `/programs/:code`, `/programs/:code/edit` | Programas | Tablas, filtros, paginación, asistente de 3 pasos, edición con «Guardar» / «Guardar y cerrar» |
| `/programs/:code/requirements` | Requisitos | Árbol `role="tree"`, estados por rol con confirmación, edición en línea, etiquetas con chips, editor `contenteditable`, drag & drop para reordenar, clic derecho, atajos, portapapeles, matriz, CSV |
| `/verification`, `/verification/:code` | Verificación | Casos de prueba, ejecución con radio, subida simple / múltiple / zona de arrastre, `getByAltText`, informe PDF |
| `/documents`, `/documents/:id`, `/documents/:id/view` | Documentos | Clasificación por rol (403), `<iframe>` con `frameLocator`, `target="_blank"`, comparación de versiones, descargas |
| `/audit` | Auditoría | Feed con scroll infinito (`role="feed"`, cursor), filtros por fecha, entidad y texto |
| `/lab`, `/legal/terms`, `/legal/privacy`, `/help` | Laboratorio y páginas públicas | Credenciales, reset, caos, contraejemplos de locators, pestañas nuevas |

Pendiente: Panel de misión, No conformidades y Administración (fase 3) y la app móvil (fase 4).

## Arranque local

Requisitos: Node ≥ 22.13 (lo pide `pnpm@11`), pnpm 11 (`corepack enable`) y Docker.

```bash
pnpm install
cp .env.example .env              # en Windows: copy .env.example .env
docker compose up -d db           # PostgreSQL en :5432
pnpm --filter api prisma:deploy   # aplica las migraciones
pnpm dev                          # API :3000 (siembra los tenants al arrancar) + web :5173
```

Abre <http://localhost:5173> (acceso, con panel de usuarios de prueba), <http://localhost:5173/lab> (credenciales, reset, caos) y <http://localhost:3000/api/docs> (Swagger).

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
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Calidad (ESLint sin `switch`/`any`/`data-testid` literal, `tsc`, Vitest) |
| `pnpm build` | Compila `shared`, `api` (Prisma + Nest) y `web` (Vite) |
| `pnpm seed` | Reinicia el seed de todos los tenants desde la CLI |
| `pnpm e2e` | Specs de humo de Playwright (arranca API y web; `CI=true` sirve el build con `vite preview`) |
| `pnpm e2e:screens` | Regenera `docs/screens/` |
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

> En Windows, `prisma generate` no puede reemplazar el motor de consultas mientras otra API lo tenga cargado (`EPERM … query_engine-windows.dll.node`): para `pnpm typecheck` y `pnpm build` detén antes las APIs en marcha.

## Despliegue

`render.yaml` declara la API (Web Service), la web (Static Site), PostgreSQL y el Cron Job de reset nocturno. `JWT_SECRET`, `ADMIN_KEY` y `DOCS_BASIC_AUTH` se piden al crear el Blueprint. Al desplegar la fase 2, la API aplica la migración `phase2` y vuelve a sembrar los tenants con `seed_version` antigua (ver [`docs/DEPLOY-RENDER.md`](docs/DEPLOY-RENDER.md#actualizar-a-la-fase-2)). El workflow [`ci.yml`](.github/workflows/ci.yml) ejecuta lint, typecheck, tests unitarios, build y los specs e2e de humo con un PostgreSQL de servicio.
