# SIGPRO — Estado de la construcción

Última actualización: 2026-11-05 · Fase actual: **1 (Base)**

Leyenda: `[x]` hecho · `[~]` en curso · `[ ]` pendiente

## Fase 1 — Base

Cada tarea termina con `pnpm lint && pnpm typecheck && pnpm test` en verde y un commit (Conventional Commits).

- [x] **T0** Mover docs (`docs/SIGPRO-plan.md`, `docs/design-handoff/`) y documentar la ruta
- [x] **T1** Raíz del monorepo: pnpm + Turborepo, tsconfig base, ESLint flat (sin `switch`, sin `any`, sin `data-testid` literal), `.env.example`, `docker-compose.yml`, STATUS/DECISIONS/CHANGELOG
- [x] **T2** `packages/shared`: dominio (roles, permisos, estados), esquemas Zod, reglas de contraseña, i18n ES/EN, `testids.ts` ampliado, cliente HTTP
- [x] **T3** `apps/api`: NestJS + Prisma (11 entidades + `Contract`), migración inicial, Postgres local
- [x] **T4** Seed determinista multi-tenant (`demo` + `alumnoNN`) y reset del tenant < 2 s
- [x] **T5** Auth: login, MFA simulado, bloqueo a 5 intentos, registro, recuperar, SSO 501, refresh, roles (guards), filtrado por tenant
- [x] **T6** API de Programas: lista (filtros, orden, paginación), alta con 422, borrado, archivar, duplicar, CSV, AuditLog
- [x] **T7** Admin: `POST /api/admin/reset`, `PATCH /api/admin/chaos` + interceptor, `/api/health`, OpenAPI en `/api/docs` (basic auth opcional)
- [x] **T8** `apps/web` base: Vite + Tailwind 4 con tokens como CSS variables, claro/oscuro, ES/EN, router, sesión, toasts (3 s), fuentes autoalojadas, PWA mínima
- [x] **T9** Módulo **Acceso** (login, MFA, recuperar, registro, verificación, usuarios de prueba) + spec e2e + capturas
- [x] **T10** Módulo **Programas** (shell, tabla, filtros, combobox ARIA, bulk, paginación, estados carga/vacío/error, menú fila, asistente, diálogo eliminar, cookies, atajos) + spec e2e + capturas
- [x] **T11** Checklist "Cobertura de locators" de Acceso y Programas recorrida fila a fila
- [ ] **T12** Página `/lab` (credenciales, usuarios por rol, reset con `confirm()` nativo, caos, contraejemplos, FAQ)
- [ ] **T13** `render.yaml`, `scripts/reset-all.mjs`, workflow de GitHub Actions (lint, typecheck, unit, e2e de humo)
- [ ] **T14** Cierre de fase: README, STATUS final, comandos de arranque local

## Pendiente / deuda conocida

_(se rellena según avanza)_

## Cómo levantar todo en local

_(se completa en T14)_
