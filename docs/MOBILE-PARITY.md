# Paridad funcional del móvil con la web

**Estado (2026-11-12): la paridad funcional está completa**, salvo las lagunas documentadas en `docs/DECISIONS.md`: en Requisitos, «Mover a…» reordena entre hermanos pero no cambia de padre (la API lo rechaza y no se toca); las descripciones se editan como texto plano, sin el editor enriquecido de la web (negrita, cursiva, listas); el arrastrar y soltar se sustituye por «Mover a…»; y `/lab` (la pantalla del instructor) no existe en el móvil, por lo que la ayuda no enlaza a ella. También quedan pendientes, y están anotados, los extras del login de la web (mostrar contraseña, «mantener la sesión», SSO y el aviso de sesión cerrada) y el «Guardar» alterno del modo caos fuera del panel de Administración.

**Verificación (2026-11-12):** todo se ha probado en Expo web (Chromium, 390 px; CI de GitHub en verde con 167 specs móviles). En nativo, solo en un **emulador de Android (API 33)** con el APK de la build funcional: login con MFA, Programas, el asistente de «Nuevo programa» con un selector modal anidado y Verificación. **Sin verificar:** iOS en un Simulador (el `.app` compila en GitHub, run 43256654130, pero nunca se abrió: hace falta un Mac), los selectores de imagen y documento, la hoja de compartir, la descarga de archivos y el resto de módulos en nativo. Guía de las builds en `docs/MOBILE-EMULADORES.md`.

**Objetivo (decisión del usuario, 2026-11-12):** `apps/mobile` es un espejo **funcional** de la web, en Android y en iOS: lo que se puede hacer en la web se puede hacer en el móvil, con la misma API, las mismas reglas, los mismos permisos, los mismos textos y los mismos `data-testid`. Sustituye a la decisión anterior de «espejo visual y de solo lectura» (`docs/DECISIONS.md`, «Móvil espejo»): los asserts de los specs móviles que fijaban la solo lectura se reescriben, no se esquivan.

Fuera de alcance, por ser propios del navegador o del curso: `/lab` (la pantalla del instructor), el arrastrar y soltar (se sustituye por «Mover a…»), el atajo de teclado `N`/`/`/`Esc`, el `confirm()`/`prompt()` nativos (se sustituyen por diálogos de la app) y las descargas de archivos del navegador (se sustituyen por la hoja de compartir del sistema).

## Reglas para cualquier pantalla nueva

1. **Misma lógica que la web.** Cliente HTTP `useAuth().api` (de `@sigpro/shared`), esquemas Zod compartidos para validar, `can(role, permission)` para los permisos, funciones puras de `@sigpro/shared` (transiciones, métricas, formatos…), textos de `t(espacio, clave)` del i18n compartido. Un texto que no exista allí va en un `texts.ts` de la feature (`useTexts`, siempre `es` y `en`). Lee primero la página equivalente de la web en `apps/web/src/pages/<módulo>/` y copia su comportamiento, no su DOM.
2. **Mismos ids.** `testID` = el `data-testid` de `packages/shared/src/testids.ts`. Si la web no tiene equivalente, se añade a un grupo `MOVIL_*`; nunca se renombra ni se elimina un id. Nombre accesible (`aria-label`) y etiqueta visible en todo control; botón deshabilitado con `disabledReason` mostrado como texto; carga (`aria-busy`), vacío y error con reintento en toda lista; avisos con `useToast`.
3. **Multiplataforma de verdad.** Sin `window`, `document`, `localStorage`, `confirm`, `prompt`, `alert` ni CSS: el mismo código tiene que correr en iOS, Android y Expo web. Usa los componentes de `src/ui/`: `Screen`, `Card`, `Button`, `Chip`, `Segmented`, `Metric`, `Badge`, `ProgressBar`, `TextField`, `SelectField`, `SwitchField`, `StepSlider`, `Sheet`, `FormDialog`, `ConfirmSheet`, `States`. Archivos e imágenes: `expo-document-picker` / `expo-image-picker` con la versión que pide SDK 58 (`pnpm --filter mobile exec expo install <paquete>`), y un camino que funcione también en web.
4. **Estilo «Ciruela».** Colores de `useTheme().colors` (nunca un hex), tipografía con `Text` (`variant`, `weight`; jamás `fontWeight`), radios de `RADIUS`, separaciones de `SPACING`, objetivos táctiles de 44 px, sombras de `colors.shadow`.
5. **Código.** Inglés en el código y español en los comentarios; sin `switch/case`; inmutable; la lógica pura va en un `view.ts` con su `view.test.ts` (Vitest, sin importar `react-native`); efectos en hooks y pantallas.
6. **Pruebas.** Un spec de Playwright por módulo en `e2e/tests/mobile/<módulo>.spec.ts` (`openAs`, tenant `alumno24`, `serial`, `resetTenant` antes y después, locators por rol/etiqueta primero). Se lanza con `pnpm --filter @sigpro/e2e exec playwright test -c playwright.mobile.config.ts --project=mobile <archivo>`. Los asserts existentes que contradigan la paridad (p. ej. «ningún botón Aprobar») se reescriben y se anota en `docs/DECISIONS.md`.
7. **Cierre de cada módulo.** `pnpm --filter mobile lint && pnpm --filter mobile typecheck && pnpm --filter mobile test` en verde, el spec nuevo y toda la suite móvil en verde, una línea en `docs/CHANGELOG.md`, la fila de la tabla de abajo, y un commit (`feat(mobile): …`). El `git push` solo lo hace quien lleva la sesión y con la autorización del usuario cada vez; los agentes de módulo no lo hacen.

## Estado por módulo

| Módulo | Web | Móvil |
| --- | --- | --- |
| Navegación (Programas · Verificación · NC · Misión · Más) | barra lateral | [x] pestañas + «Más» (Documentos, Auditoría, Administración, Perfil) |
| Acceso: login, MFA | [x] | [x] |
| Acceso: registro, recuperar contraseña, reenviar verificación | [x] | [x] |
| Páginas legales y ayuda | [x] | [x] |
| Programas: lista, filtros, métricas, detalle | [x] | [x] |
| Programas: alta (asistente), edición, archivar, duplicar, eliminar, selección múltiple y CSV | [x] | [x] |
| Hitos: alta, edición, avance, borrado | [x] | [x] |
| Proveedores de un programa | [x] | [x] |
| Requisitos: lectura, métricas, árbol, documento, flujo | [x] | [x] |
| Requisitos: transiciones de estado, alta, edición, borrado, mover | [x] | [x] |
| Requisitos: matriz de trazabilidad (ver y enlazar/desenlazar) | [x] | [x] |
| Verificación: casos de prueba, detalle, ejecuciones con evidencias, informe | [x] | [x] |
| No conformidades: tablero, transiciones, comentarios, cierre | [x] | [x] |
| No conformidades: alta y edición | [x] | [x] |
| Documentos: lista, ficha, visor | [x] | [x] |
| Documentos: publicar versión, comparar versiones, descargar | [x] | [x] |
| Auditoría: feed con filtros, rango de fechas y carga continua; aviso por rol | [x] | [x] |
| Administración: usuarios (rol y activo), auditoría, modo caos y reinicio del tenant | [x] | [x] |
| Panel de misión | [x] | [x] |
| Perfil: idioma, tema, sesión | [x] | [x] |
| Perfil: preferencias de avisos | [x] | [x] |
| Búsqueda global | [x] | [x] |
