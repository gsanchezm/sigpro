# SIGPRO — laboratorio de pruebas para el curso Playwright + TypeScript

Aplicación ficticia de gestión de programas de ingeniería de sistemas (programas, requisitos, verificación, no conformidades, documentos). Su razón de ser es servir de blanco de automatización en un curso, así que la **testabilidad es un requisito funcional**, no un extra.

## Fuentes de verdad (léelas antes de tocar código)

1. `docs/SIGPRO-plan.md` — concepto, arquitectura, modelo de datos, backlog por módulos, catálogo de componentes UI, cobertura de locators, testabilidad, Render, plan por fases.
2. `docs/design-handoff/README.md` — design system (tokens, tipografía, componentes) y especificación pixel-perfect de Acceso y Programas. Los `.dc.html` son prototipos de referencia: se sirven por HTTP (`npx serve docs/design-handoff`), no se copian.
3. `packages/shared/src/testids.ts` — ids de prueba ya acordados. Se amplía, nunca se renombra.

Si el plan y el handoff se contradicen, gana el handoff en lo visual y el plan en lo funcional. Anota la decisión en `docs/DECISIONS.md`.

## Stack

- Monorepo `pnpm` 11 + Turborepo. Node 22 (≥ 22.13, exigido por pnpm 11). Scripts por app: `dev`, `build`, `lint`, `typecheck`, `test`, `seed`.
- `apps/api`: NestJS + Prisma + PostgreSQL. OpenAPI en `/api/docs`. JWT + roles. Socket.IO. Endpoints `/api/admin/reset`, `/api/admin/chaos`.
- `apps/web`: React 18 + Vite + TypeScript + Tailwind + React Router. PWA. Tokens del design system como CSS variables (`[data-theme="light|dark"]`).
- `apps/mobile`: Expo + Expo Router (fase 4; no empezar antes).
- `packages/shared`: tipos, esquemas Zod, cliente HTTP, `testids.ts`, i18n ES/EN.
- Local: `docker compose up -d db` → API `:3000`, web `:5173`, Expo `:8081`.

## Convenciones de código

- Código en inglés, comentarios en español.
- Estilo funcional: mapas de despacho (`ReadonlyMap`, objetos `as const`) y guard clauses; **nada de `switch/case`** ni cadenas largas de `if/else`.
- Inmutabilidad por defecto; funciones puras en dominio; efectos en los bordes (controladores, hooks).
- Tipos estrictos (`strict: true`, sin `any`). Validación de entrada con Zod compartida entre API y web.
- Commits en inglés, estilo Conventional Commits (`feat(web): programs table with sorting`).

## Reglas de testabilidad (bloqueantes en code review)

- Todo elemento interactivo: nombre accesible (`<label for>` o `aria-label`) **y** `data-testid` tomado de `testids.ts`. Patrón `<pantalla>-<elemento>`; filas y nodos `<entidad>-row-<código>`.
- Todo `<img>` con `alt` (avatares incluidos, como SVG data-URI). Botones deshabilitados con `title` explicativo. Barras de progreso con `title` y `aria-valuenow`.
- Badges con `data-state` / `data-severity`. Placeholders distintos del label.
- Estados de carga (`aria-busy`), vacío y error en toda lista. Toasts con `data-testid="toast-{ok|danger|info|warn}"` y autocierre a 3 s.
- Seed determinista: códigos fijos `PRG-001…`, `REQ-001…`, `TC-001…`, `NC-001…`. Usuarios demo del handoff (`admin@sigpro.test` / `Admin1234!`, MFA `123456`, etc.) dentro de cada tenant.
- Multi-tenant: toda tabla lleva `tenant_id`; la API filtra por el tenant del JWT.
- La tabla "Cobertura de locators de Playwright" del plan es una checklist: cada fila debe tener su elemento implementado.

## Definición de hecho por módulo

1. `pnpm lint && pnpm typecheck && pnpm test` en verde.
2. Un spec de humo en `e2e/` (Playwright) que recorre el módulo usando `getByRole`/`getByLabel` primero y `getByTestId` como respaldo.
3. Captura de pantalla en claro y oscuro a 1440 y 390 px guardada en `docs/screens/`.
4. `docs/CHANGELOG.md` actualizado con una línea.
5. Commit.

## Cómo trabajar

- No preguntes: decide, anótalo en `docs/DECISIONS.md` y sigue. Solo detente ante algo irreversible (borrar datos, cambiar un `data-testid` existente, cambiar el stack).
- Avanza por fases en el orden del plan; no empieces una fase sin cerrar la anterior.
- Si algo no compila o un test falla, arréglalo antes de seguir; nunca comentes un test para que pase.
- Mantén `docs/STATUS.md` con qué está hecho, qué sigue y qué quedó pendiente, para que cualquier sesión nueva pueda continuar.
