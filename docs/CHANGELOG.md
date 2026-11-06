# Changelog

Una línea por módulo cerrado.

## Fase 1 — Base

- **Acceso** (login, MFA, recuperar, registro, verificación, usuarios de prueba): reproduce el handoff con ≤1,1 % de píxeles distintos en claro/oscuro a 1440 y 390 px; 17 specs de humo en `e2e/tests/access.spec.ts`; capturas en `docs/screens/acceso-*`.
- **Programas** (shell con sidebar/cabecera/tabbar, tabla con orden y paginación de 10, filtros con combobox ARIA, selección múltiple y acciones masivas, CSV, asistente de 3 pasos, diálogo de borrado, cookies, atajos N / Esc, detalle con pestañas): 26 escenarios comparados con el handoff (≤1,8 % de píxeles distintos); 44 specs de humo en `e2e/tests/programs*.spec.ts`; capturas en `docs/screens/programas-*`.
- _(pendiente)_
