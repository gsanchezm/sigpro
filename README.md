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

## Despliegue

`render.yaml` declara la API (Web Service), la web (Static Site), PostgreSQL y el Cron Job de reset nocturno. `JWT_SECRET`, `ADMIN_KEY` y `DOCS_BASIC_AUTH` se piden al crear el Blueprint. El workflow [`ci.yml`](.github/workflows/ci.yml) ejecuta lint, typecheck, tests unitarios, build y los specs e2e de humo con un PostgreSQL de servicio.
