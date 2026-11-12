# Paridad funcional del móvil con la web

**Objetivo (decisión del usuario, 2026-11-12):** `apps/mobile` es un espejo **funcional** de la web, en Android y en iOS: lo que se puede hacer en la web se puede hacer en el móvil, con la misma API, las mismas reglas, los mismos permisos, los mismos textos y los mismos `data-testid`. Sustituye a la decisión anterior de «espejo visual y de solo lectura» (`docs/DECISIONS.md`, «Móvil espejo»): los asserts de los specs móviles que fijaban la solo lectura se reescriben, no se esquivan.

Fuera de alcance, por ser propios del navegador o del curso: `/lab` (la pantalla del instructor), el arrastrar y soltar (se sustituye por «Mover a…»), el atajo de teclado `N`/`/`/`Esc`, el `confirm()`/`prompt()` nativos (se sustituyen por diálogos de la app) y las descargas de archivos del navegador (se sustituyen por la hoja de compartir del sistema).

## Reglas para cualquier pantalla nueva

1. **Misma lógica que la web.** Cliente HTTP `useAuth().api` (de `@sigpro/shared`), esquemas Zod compartidos para validar, `can(role, permission)` para los permisos, funciones puras de `@sigpro/shared` (transiciones, métricas, formatos…), textos de `t(espacio, clave)` del i18n compartido. Un texto que no exista allí va en un `texts.ts` de la feature (`useTexts`, siempre `es` y `en`). Lee primero la página equivalente de la web en `apps/web/src/pages/<módulo>/` y copia su comportamiento, no su DOM.
2. **Mismos ids.** `testID` = el `data-testid` de `packages/shared/src/testids.ts`. Si la web no tiene equivalente, se añade a un grupo `MOVIL_*`; nunca se renombra ni se elimina un id. Nombre accesible (`aria-label`) y etiqueta visible en todo control; botón deshabilitado con `disabledReason` mostrado como texto; carga (`aria-busy`), vacío y error con reintento en toda lista; avisos con `useToast`.
3. **Multiplataforma de verdad.** Sin `window`, `document`, `localStorage`, `confirm`, `prompt`, `alert` ni CSS: el mismo código tiene que correr en iOS, Android y Expo web. Usa los componentes de `src/ui/`: `Screen`, `Card`, `Button`, `Chip`, `Segmented`, `Metric`, `Badge`, `ProgressBar`, `TextField`, `SelectField`, `SwitchField`, `StepSlider`, `Sheet`, `FormDialog`, `ConfirmSheet`, `States`. Archivos e imágenes: `expo-document-picker` / `expo-image-picker` con la versión que pide SDK 58 (`pnpm --filter mobile exec expo install <paquete>`), y un camino que funcione también en web.
4. **Estilo «Ciruela».** Colores de `useTheme().colors` (nunca un hex), tipografía con `Text` (`variant`, `weight`; jamás `fontWeight`), radios de `RADIUS`, separaciones de `SPACING`, objetivos táctiles de 44 px, sombras de `colors.shadow`.
5. **Código.** Inglés en el código y español en los comentarios; sin `switch/case`; inmutable; la lógica pura va en un `view.ts` con su `view.test.ts` (Vitest, sin importar `react-native`); efectos en hooks y pantallas.
6. **Pruebas.** Un spec de Playwright por módulo en `e2e/tests/mobile/<módulo>.spec.ts` (`openAs`, tenant `alumno24`, `serial`, `resetTenant` antes y después, locators por rol/etiqueta primero). Se lanza con `pnpm --filter @sigpro/e2e exec playwright test -c playwright.mobile.config.ts --project=mobile <archivo>`. Los asserts existentes que contradigan la paridad (p. ej. «ningún botón Aprobar») se reescriben y se anota en `docs/DECISIONS.md`.
7. **Cierre de cada módulo.** `pnpm --filter mobile lint && pnpm --filter mobile typecheck && pnpm --filter mobile test` en verde, el spec nuevo y los 25 anteriores en verde, una línea en `docs/CHANGELOG.md`, la fila de la tabla de abajo, y un commit (`feat(mobile): …`). No se hace `git push`.

## Estado por módulo

| Módulo | Web | Móvil |
| --- | --- | --- |
| Navegación (Programas · Verificación · NC · Misión · Más) | barra lateral | [x] pestañas + «Más» (Documentos, Auditoría, Administración, Perfil) |
| Acceso: login, MFA | [x] | [x] |
| Acceso: registro, recuperar contraseña, reenviar verificación | [x] | [ ] |
| Páginas legales y ayuda | [x] | [ ] |
| Programas: lista, filtros, métricas, detalle (lectura) | [x] | [x] |
| Programas: alta (asistente), edición, archivar, duplicar, eliminar | [x] | [ ] |
| Hitos: alta, edición, avance, borrado | [x] | [ ] |
| Proveedores de un programa | [x] | [ ] |
| Requisitos: lectura, métricas, árbol, documento, flujo | [x] | [x] |
| Requisitos: transiciones de estado, alta, edición, borrado, mover | [x] | [ ] |
| Requisitos: matriz de trazabilidad (ver y enlazar/desenlazar) | [x] | [ ] |
| Verificación: casos de prueba, detalle, ejecuciones con evidencias, informe | [x] | [ ] |
| No conformidades: tablero, transiciones, comentarios, cierre | [x] | [x] |
| No conformidades: alta y edición | [x] | [ ] |
| Documentos: lista, ficha, visor | [x] | [x] |
| Documentos: publicar versión, comparar versiones, descargar | [x] | [ ] |
| Auditoría | [x] | [ ] |
| Administración: usuarios, modo caos, reinicio | [x] | [ ] |
| Panel de misión | [x] | [x] |
| Perfil: idioma, tema, sesión | [x] | [x] |
| Perfil: preferencias de avisos | [x] | [ ] |
| Búsqueda global | [x] | [ ] |
