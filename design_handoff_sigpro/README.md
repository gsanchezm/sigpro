# Handoff: SIGPRO — Acceso + Programas

## Overview
SIGPRO es un sistema de gestión de programas de ingeniería (programas, requisitos, verificación, NC). Este paquete cubre tres pantallas prototipadas: el **sistema de diseño**, **Acceso** (login, registro, MFA, recuperación, verificación) y **Programas** (listado + asistente de alta). Objetivo: interfaz técnica, densa, sin decoración, totalmente operable por teclado y automatizable con Playwright mediante `data-testid`.

## About the Design Files
Los `.dc.html` de esta carpeta son **referencias de diseño construidas en HTML** (prototipos interactivos con datos mock). No son código de producción para copiar tal cual. La tarea es **recrear estas pantallas en el entorno del proyecto real** (React/Vue/Angular/etc.) con sus patrones y librerías. Si el proyecto aún no tiene stack, elegir el más adecuado (sugerencia: React + TypeScript + CSS variables/Tailwind) e implementar allí.

Para ver los prototipos: abrir los `.dc.html` en un navegador (requiere `support.js` en la misma carpeta y conexión para Google Fonts). Cada pantalla tiene una barra superior oscura "SIGPRO · PROTOTIPO" con controles solo de prototipo (rol, estado de datos, viewport, anotaciones). **No implementar esa barra.** Al activar "Anotaciones data-testid" se dibujan todos los testids sobre la UI.

## Fidelity
**High-fidelity.** Colores, tipografía, espaciados, estados y textos son finales. Recrear con precisión de píxel usando los componentes existentes del codebase, respetando los valores de tokens de abajo.

## Design Tokens

### Tipografía
- UI: `'IBM Plex Sans', system-ui, sans-serif` — pesos 400/500/600
- Mono (códigos, fechas, importes, atajos, trazas HTTP): `'IBM Plex Mono', monospace` — 400/500
- Base: 13px / line-height 1.45. Tamaños usados: 9 (anotaciones), 10–10.5 (badges, kbd), 11–11.5 (ayudas, meta), 12–12.5 (labels, celdas, botones secundarios), 13 (inputs, cuerpo), 15 (títulos modales), 20 (h1 de pantalla), 22 (claim panel marca, código MFA), 26 (h1 design system)
- h1 pantalla: 20px / 600 / letter-spacing -.01em

### Colores — tema claro
```
--bg #f3f5f8        --surface #ffffff    --surface-2 #eef1f5
--border #d5dbe3    --border-strong #b7c0cc
--text #0f1620      --text-2 #4b5665     --text-3 #7a8594
--accent #2f6fed    --accent-hover #2459c7  --accent-soft #e3ecfd  --on-accent #ffffff
--danger #c62f2f    --danger-soft #fbe3e3
--warn #8a5200      --warn-soft #fdeccc
--ok #1a7f4b        --ok-soft #d9f3e4
--info #2459c7      --info-soft #e3ecfd
--neutral #4b5665   --neutral-soft #e6eaf0
--purple #6b3fc9    --purple-soft #ece4fb
--shadow 0 1px 2px rgba(15,22,32,.06)   --shadow-pop 0 8px 24px rgba(15,22,32,.14)
--scrim rgba(15,22,32,.45)
```
### Colores — tema oscuro
```
--bg #0d1117        --surface #151b24    --surface-2 #1c242f
--border #2a3441    --border-strong #3b4756
--text #e8edf3      --text-2 #a3afbe     --text-3 #6f7c8c
--accent #5b8def    --accent-hover #7ea3f3  --accent-soft #1b2a47  --on-accent #ffffff
--danger #f0716b    --danger-soft #3a1f21
--warn #e6a23c      --warn-soft #3a2d14
--ok #49c27f        --ok-soft #14311f
--info #7ea3f3      --info-soft #1b2a47
--neutral #a3afbe   --neutral-soft #27303c
--purple #b394f5    --purple-soft #2a2140
--shadow 0 1px 2px rgba(0,0,0,.4)   --shadow-pop 0 8px 24px rgba(0,0,0,.5)
--scrim rgba(0,0,0,.6)
```
Tema se aplica con `[data-theme="light|dark"]` en el contenedor raíz. Panel de marca de Acceso es siempre oscuro (`#0d1117`, borde `#1c2531`, acento `#5b8def`).

### Espaciado / radios / sombras
- Escala: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32
- Radios: 2 (anotaciones), 3 (kbd, skeleton), 4 (botones, inputs, badges, avatares), 5 (logo), 6 (cards, popovers, modales), 999 (pills)
- Bordes 1px `--border`; inputs 1px `--border-strong`
- Focus visible universal: `outline: 2px solid var(--accent); outline-offset: 2px` (−1/−2px en elementos dentro de bordes)

### Componentes base
- **Botón primario**: h 34 (38 en formularios de acceso a ancho completo), padding 0 14, bg `--accent`, borde 1px `--accent`, texto `--on-accent` 13/500, radio 4; hover `--accent-hover`; disabled opacidad reducida + cursor not-allowed
- **Botón secundario**: igual, bg `--surface`, borde `--border-strong`, texto `--text`; hover bg `--surface-2`
- **Botón ghost**: borde transparente, texto `--text-2`; hover `--surface-2`
- **Botón peligro**: bg `--danger`, texto blanco; variante outline en bulk bar
- **Botón icono**: 32×32, borde `--border`, bg `--surface`, color `--text-2`
- **Input / select**: h 36 (30 en filtros de tabla, 32 en header), padding 0 10, bg `--bg` (acceso) o `--surface` (filtros), borde `--border-strong`, radio 4; focus borde `--accent` + outline; `aria-invalid="true"` muestra mensaje 11.5px `--danger` debajo
- **Label**: 12px / 500 / `--text-2`, gap 4 al control
- **Badge de estado**: inline-flex, gap 6, padding 2 8, radio 4, 11.5/500, punto 6px `currentColor`; tonos: draft→neutral, active→info, on_hold→warn, closed→ok, cancelled→danger
- **Pill mono** (roles, contadores): Plex Mono 10px, padding 1 6, radio 999, `--X-soft`/`--X`
- **Avatar iniciales**: 20/26/28px cuadrado radio 4 (circular en combobox), bg `--neutral-soft`, texto `--text-2` 9–11px/600
- **Popover/menu**: bg `--surface`, borde `--border`, radio 6, `--shadow-pop`, padding 6, items padding 7 10 radio 4, hover `--surface-2`; separador 1px `--border` margen 4 0
- **Alerta inline** (`role=alert`): padding 10–12 / 12–14, radio 6, bg `--X-soft`, borde 1px `--X`; título 600 + traza HTTP en Plex Mono 11.5 `--text-2`
- **Toast**: esquina inferior derecha, ancho min(360px, 100%−32), bg `--surface`, borde, `--shadow-pop`, punto de color 8px, animación `toastIn` 180ms (opacity 0→1, translateY 6→0), autocierre 4.5s, botón × `toast-close`; `data-testid="toast-{ok|danger|info|warn}"`
- **Skeleton**: gradiente `--surface-2 → --border → --surface-2`, `shimmer` 1.4s infinito
- **Spinner**: 12px, borde 2px rgba(255,255,255,.4) con top blanco (20px/`--border-strong`+`--accent` en overlay), `spin` .8s linear
- **kbd**: Plex Mono 10px, h 16, padding 0 5, radio 3, borde `--border`

## Screens / Views

### 1. Acceso (`SIGPRO Acceso.dc.html`)
Layout a dos columnas en ≥640px: panel de marca izquierdo fijo `min(40%, 460px)` (oscuro, aria-hidden, padding 32, logo arriba, claim centrado 22px/500 máx 22ch, `dl` mono con entorno/versión/clasificación, aviso legal 11.5px abajo) y columna derecha con header 52px (bg `--surface`, borde inferior, a la derecha select idioma ES/EN `auth-lang` y botón tema `auth-theme`), `main` centrado vertical/horizontalmente (padding 32 16, gap 20) y footer (© 2026 SIGPRO · Privacidad · Condiciones · Ayuda, 11.5px `--text-3`). En <640px el panel de marca desaparece y el logo pasa al header.

Todas las tarjetas: bg `--surface`, borde `--border`, radio 6, `--shadow`, padding 24, gap 14, ancho `min(400px,100%)` (registro: 520px).

**1a. Login** (`login-form`, `noValidate`)
- h1 "Iniciar sesión" + subtítulo "Accede con tu cuenta corporativa de SIGPRO."
- Alerta error servidor `login-error` (ver códigos abajo); aviso verde `login-info` tras logout ("Sesión cerrada correctamente.")
- Correo `login-email` (type email, autocomplete username, autofocus) — error `login-email-error`
- Contraseña `login-password` con botón interno `login-toggle-password` (texto "Mostrar/Ocultar", aria-pressed) y enlace "¿Olvidaste la contraseña?" `login-forgot` alineado a la derecha del label
- Checkbox `login-remember` "Mantener la sesión en este equipo" (16px, accent-color, por defecto activo)
- Botón primario ancho `login-submit` "Entrar" (spinner cuando `aria-busy`)
- Separador "o" con líneas; botón secundario ancho `login-sso` "Acceder con certificado digital / SSO" (icono cuadrado "ID") → toast info "SSO no disponible…" `GET /api/auth/sso → 501`
- Pie "¿Sin cuenta? **Solicitar acceso**" `login-go-register`

**1b. MFA** (`mfa-form`) — solo usuarios con `mfa:true`
- h1 "Verificación en dos pasos", texto "Introduce el código de 6 dígitos… para {email}."
- Input `mfa-code` h 44, Plex Mono 22px, letter-spacing .4em, centrado, inputmode numeric, maxlength 6, solo dígitos; ayuda "Prototipo: el código válido es 123456."
- `mfa-submit` "Verificar" deshabilitado hasta 6 dígitos; `mfa-back` ghost "Volver al inicio de sesión"; error `mfa-error` (`401`)

**1c. Recuperar** (`forgot-form`): h1 "Recuperar contraseña", texto enlace 30 min, `forgot-email`, `forgot-submit` "Enviar enlace", confirmación verde `forgot-sent` (siempre, sin revelar existencia), `forgot-back`.

**1d. Registro / Solicitar acceso** (`register-form`, 520px)
- h1 "Solicitar acceso", subtítulo "Un administrador revisará la solicitud antes de activar la cuenta."
- Grid 2 col `repeat(auto-fit, minmax(200px,1fr))` gap 12: Nombre `register-first-name` / Apellidos `register-last-name`
- Correo corporativo `register-email` (placeholder `nombre@organizacion.es`, ayuda "Debe pertenecer a un dominio autorizado.")
- Grid: Organización/Unidad `register-org` / Rol solicitado `register-role` select (consultant, program_manager, auditor; ayuda "El rol admin solo se asigna manualmente.")
- Grid: Contraseña `register-password` (+ `register-toggle-password`) / Confirmar `register-password-confirm`
- Medidor `register-password-meter` (`data-strength=none|weak|fair|good|strong`): 4 segmentos h 4 radio 2, color por puntuación (danger/warn/info/ok); lista de reglas 11.5px con ✓ en `--ok` o · en `--text-3`: ≥10 caracteres · mayúscula y minúscula · un número · un símbolo
- Checkbox `register-terms` "He leído y acepto las *condiciones de uso* y la *política de privacidad*." (`register-terms-link`)
- Pie con borde superior: `register-back` ghost "Volver al inicio de sesión" | `register-submit` primario "Enviar solicitud"
- Nota 11.5px: validación servidor 409 si correo ya existe

**1e. Verificación** (`verify-panel`, role=status): icono ✓ 36px circular `--ok-soft/--ok`, h1 "Solicitud enviada", texto "Hemos enviado un correo de verificación a {email}.", `dl` en `--surface-2` con Estado (badge warn `verify-status-badge` "Pendiente de aprobación"), Rol solicitado (mono), ID `REQ-2026-0417`; `verify-resend` secundario → toast ok `202`; `verify-back`.

**1f. Panel usuarios de prueba** (`test-users`, visible en login y registro, borde dashed `--border-strong`, padding 12 14; solo entornos dev/staging): título 12px uppercase letter-spacing .06em + "clic para rellenar" mono. Grid `auto-fill minmax(230px,1fr)` gap 6 de botones (padding 8 10, avatar 28px, nombre 12.5/500, `email · password` mono 10.5 `--text-3`, pill rol/estado a la derecha). Clic rellena email+contraseña y enfoca el correo. `data-testid="test-user-{role}[-locked|-pending]"`.

**Overlay redirección** `auth-redirecting`: cubre la pantalla (bg `--bg`, z 70), spinner 20px, "Sesión iniciada. Redirigiendo a Programas…", traza mono `POST /api/auth/session → 201 · role={role}`; 1.4s y navega a Programas.

### 2. Programas (`SIGPRO Programas.dc.html`)
Shell de aplicación: sidebar 220px (colapsable a 52px con solo glifos, `layout-sidebar`, `layout-sidebar-collapse`; en móvil es drawer con scrim `layout-drawer-scrim`), header sticky 52px con toggle `layout-sidebar-toggle`, migas `layout-breadcrumbs` (Inicio / Programas), búsqueda global `layout-search` (ancho min(320px,30vw), atajo `/`), idioma `layout-lang`, tema `layout-theme`, notificaciones `layout-notifications` (+popover `layout-notifications-popover`, `layout-notifications-markread`), menú usuario `layout-user-menu` (avatar + nombre + rol mono; popover con Perfil `layout-user-profile`, Atajos `layout-user-shortcuts` ?, separador, Cerrar sesión `layout-user-logout` en `--danger`).

Contenido (padding 20 24, gap 16):
- Cabecera: h1 "Programas" + subtítulo "{n} programas · {m} activo"; derecha botones `programs-export-csv` (secundario, icono descarga) y `programs-new` "+ Nuevo programa" con kbd N (primario; deshabilitado si rol sin permiso)
- Filtros (`programs-filters`, role=search, flex-wrap gap 8, inputs h 30): Estado select `programs-filter-status`, Inicio desde `programs-filter-date-from`, Fin hasta `programs-filter-date-to` (type date, mono), Responsable combobox `programs-filter-owner` (ARIA combobox + listbox `programs-filter-owner-list`, opciones con avatar circular, contador, teclado ↑↓ Enter Esc, botón limpiar `programs-filter-owner-clear`), enlace "Limpiar filtros" `programs-filters-clear` si hay filtros
- Barra masiva `programs-bulk-bar` (bg `--accent-soft`, borde `--accent`, radio 6): contador `programs-bulk-count`, `programs-bulk-export`, `programs-bulk-archive`, `programs-bulk-delete`, `programs-bulk-clear` ×
- Error `programs-error` (role=alert, danger-soft): "No se pudieron cargar los programas" + `GET /api/programs → 503 Service Unavailable · trace 7f3a-c21d` + `programs-error-retry`
- Tabla `programs-table` (card `--surface` radio 6, min-width 860, filas h 40, borde inferior `--border`, hover `--surface-2`, thead `--surface-2` con labels 11px uppercase): checkbox `programs-select-all`, Código (mono, enlace `--accent` a detalle), Nombre (ellipsis, title), Estado (badge `programs-state-badge data-state`), Responsable (avatar+nombre), Fechas (`inicio → fin` mono), Presupuesto (mono, derecha, formato es-ES €), Progreso (barra 6px + % mono 11.5, tooltip "i" `programs-progress-info`/`programs-progress-tooltip`), menú fila `programs-row-menu` (Ver detalle, Editar, Duplicar, Archivar, sep., Eliminar). Columnas ordenables con `aria-sort` y botón `programs-sort-{col}`
- Skeleton 6 filas `skeleton-row` cuando carga; vacío `programs-empty` (48px padding, centrado)
- Paginación 10 por página (`programs-pagination`, anterior/siguiente, "Página x de y")
- Móvil (<640): lista de cards en vez de tabla, búsqueda `programs-search` a ancho completo, h1 en header
- Asistente nuevo programa: panel lateral derecho (drawer 480px, scrim) de 3 pasos con indicador: 1 Datos (nombre, descripción, responsable combobox, estado inicial), 2 Planificación (fechas, presupuesto, prioridad radio baja/media/alta, checkbox clasificado), 3 Resumen (`dl` + switch notificar equipo `programs-wizard-notify`). Botones `programs-wizard-back`, `programs-wizard-cancel`, `programs-wizard-next` / `programs-wizard-submit`. Validación cliente inline; servidor devuelve 422 si el nombre contiene "duplicado" (alerta + `aria-invalid`)
- Diálogo eliminar `programs-delete-dialog` (role=alertdialog, 420px, `modal-cancel`/`modal-confirm` en danger, foco inicial en confirmar)
- Banner cookies `cookie-banner` (fondo `--text`, texto `--bg`) con `cookie-banner-accept` / `cookie-banner-reject`
- Atajos globales: `N` nuevo, `/` buscar, `Esc` cierra todo

### 3. Sistema de diseño (`SIGPRO Design System.dc.html`)
Documento de referencia con tokens, tipografía, vocabulario de badges, componentes y convenciones `data-testid`. Úsalo como fuente de verdad visual junto con esta tabla de tokens.

## Interactions & Behavior

### Autenticación (mock → sustituir por API real)
| Correo | Contraseña | Resultado |
|---|---|---|
| admin@sigpro.test | Admin1234! | admin, exige MFA (123456) |
| gestor@sigpro.test | Gestor1234! | program_manager |
| consultor@sigpro.test | Consul1234! | consultant |
| auditor@sigpro.test | Audit1234! | auditor |
| bloqueado@sigpro.test | Block1234! | 423 Locked |
| pendiente@sigpro.test | Pend1234! | 403 pending_approval |
| cualquier otro / mal pass | — | 401 Unauthorized · attempts=n |

Flujo: validar cliente (obligatorio, formato email) → `busy` 700ms → respuesta. Éxito: guardar sesión `{user, role, remember}` (prototipo: `localStorage['sigpro.session']`), overlay redirección 1.4s → Programas. Programas lee la sesión al montar para fijar rol y nombre; "Cerrar sesión" borra la sesión y vuelve a Acceso con aviso.

Registro: validación cliente (todos obligatorios; email válido; contraseña cumple 4 reglas; confirmación coincide; términos aceptados), foco al primer campo con error; 800ms; 409 si el email existe; éxito → vista Verificación + toast ok `201`.

Teclado: `Esc` vuelve a login desde cualquier subvista (salvo ocupado). Cambio de vista mueve el foco al primer campo (email o código MFA).

### Permisos por rol (Programas)
- admin: todo
- program_manager: crear, editar, archivar; no eliminar
- consultant: solo lectura + exportar
- auditor: solo lectura
Botones no permitidos se renderizan `disabled` con `title` explicativo (no se ocultan).

### Responsive
Breakpoints: ≥1024 completo; 640–1023 sidebar colapsado por defecto; <640 móvil (drawer, cards, sin migas ni panel de marca). El prototipo mide el ancho del contenedor; en producción usar media queries.

## State Management
**Acceso**: `view` (login|register|mfa|forgot|verify), `login{email,password,remember}`, `reg{first,last,email,org,role,password,confirm,terms}`, `errors`, `serverError{title,code}`, `busy`, `showPass`, `mfaCode`, `mfaUser`, `forgotSent`, `redirecting`, `toasts`, `theme`, `lang`.
**Programas**: `role`, `theme`, `lang`, `dataState`, `programs[]`, filtros (`search, filterStatus, dateFrom, dateTo, ownerSel`), `sortKey/sortDir`, `page`, `selected[]`, `rowMenu`, popovers abiertos, `wizardOpen/wizStep/form/errors/serverError/submitting`, `deleteTarget`, `toasts`, `showCookies`.
Datos: `GET /api/programs` (lista), `POST /api/programs` (alta, 422 duplicado), `DELETE /api/programs/:code`, `POST /api/auth/login|mfa|register|forgot`, `GET /api/auth/sso`.

## i18n
Todas las cadenas existen en ES y EN en los objetos `T` de cada archivo. ES es el idioma por defecto. Extraerlas a los recursos i18n del proyecto.

## Accesibilidad / Testing
- Cada control interactivo tiene nombre accesible y `data-testid` con patrón `pantalla-elemento` (`login-submit`, `programs-filter-status`, `toast-close`…). Mantener los ids exactamente: Playwright depende de ellos.
- Formularios `noValidate` con validación propia y `aria-invalid` + mensaje asociado por `aria-describedby`.
- Alertas `role=alert`, confirmaciones `role=status`, región toasts `aria-live=polite`, tablas con `aria-sort`, `aria-busy` durante cargas, combobox ARIA 1.2 completo, `aria-selected` en filas.
- Contraste ≥4.5:1 en texto; focus visible en todo.

## Assets
Sin imágenes. Iconos: SVG inline de trazo 1.5px (menú, lupa, campana, sol/luna, descarga, tres puntos). Fuentes vía Google Fonts (IBM Plex Sans 400/500/600, IBM Plex Mono 400/500) — en producción autoalojar.

## Files
- `SIGPRO Design System.dc.html` — tokens y componentes
- `SIGPRO Acceso.dc.html` — login, MFA, recuperar, registro, verificación, usuarios de prueba
- `SIGPRO Programas.dc.html` — shell, listado, filtros, asistente, diálogos
- `support.js` — runtime del prototipo (solo para abrir los HTML; no portar)
