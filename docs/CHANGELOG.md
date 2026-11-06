# Changelog

Una línea por módulo cerrado.

## Fase 1 — Base

- **Acceso** (login, MFA, recuperar, registro, verificación, usuarios de prueba): reproduce el handoff con ≤ 1,1 % de píxeles distintos en claro/oscuro a 1440 y 390 px; 19 specs de humo en `e2e/tests/access.spec.ts`; capturas en `docs/screens/acceso-*`.
- **Programas** (shell con sidebar/cabecera/tabbar, tabla con orden y paginación de 10, filtros con combobox ARIA, selección múltiple y acciones masivas, CSV, asistente de 3 pasos, diálogo de borrado, cookies, atajos N / `/` / Esc, detalle con pestañas): 38 escenarios comparados con el handoff (≤ 2,2 % de píxeles distintos); 42 specs de humo en `e2e/tests/programs*.spec.ts`; capturas en `docs/screens/programas-*`.
- **/lab** (credenciales de demo, selector de tenant, reset con `confirm()` nativo, modo caos, contraejemplos de locators, FAQ en acordeón): 9 specs en `e2e/tests/lab.spec.ts`; capturas en `docs/screens/lab-*`.
- **Infraestructura:** `docker-compose.yml` (PostgreSQL), `render.yaml` (API, web, BD y cron de reset), `scripts/reset-all.mjs` y workflow `ci.yml` (lint, typecheck, unit, build y e2e de humo con PostgreSQL de servicio).

## Fase 2 — Núcleo del dominio

- **Pendientes de la fase 1:** editar programa (`PATCH /api/programs/:code` parcial + `/programs/:code/edit`, con «Guardar» / «Guardar y cerrar»), páginas públicas `/legal/terms`, `/legal/privacy` y `/help`, y spec de basic auth de `/api/docs` y `/api/docs-json` (segunda API con `DOCS_BASIC_AUTH`); 19 specs nuevos (`programs-edit`, `legal`, `api-docs`) y capturas `programas-editar-*`, `legal-condiciones`, `ayuda`.
