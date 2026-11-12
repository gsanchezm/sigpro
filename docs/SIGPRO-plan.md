# SIGPRO — Laboratorio de pruebas para el curso Playwright + TypeScript (Isdefe)

Nov 1, 2026 · @Gilberto

## Concepto: SIGPRO, un gestor de programas de ingeniería de sistemas

SIGPRO es una aplicación ficticia de gestión de programas, requisitos y verificación, pensada para que los alumnos de Isdefe automaticen pruebas sobre un dominio que reconocen desde el primer día. Mezcla lo que hace la empresa (apoyo técnico a programas de adquisición, ingeniería de requisitos, V&V, ciberseguridad, auditoría) con los retos técnicos que un curso de Playwright necesita cubrir.

Objetivos didácticos del laboratorio:

- Dar un sistema realista con roles, estados y permisos, no un formulario de demostración.
- Cubrir en una sola app todos los temas del curso: locators, formularios, tablas, autenticación, API, interceptación de red, archivos, iframes, visual, móvil.
- Permitir que cada alumno trabaje aislado y pueda reiniciar sus datos sin afectar al resto.
- Incluir bugs plantados y un "modo caos" para enseñar estabilidad y reporte de defectos.
- Servir como base reutilizable para cursos posteriores (API testing, Appium, performance).

Todo el contenido (programas, proveedores, documentos) es inventado: nada debe parecer información real de defensa.

## Arquitectura y stack

Un monorepo pnpm con tres apps y un paquete compartido; la API es la única fuente de verdad y la web y el móvil son dos vistas del mismo contrato.

&#91;embedded content: arquitectura SIGPRO · 3 clientes, 1 API, 1 base, 1 paquete compartido\]

La web, el móvil y las suites de los alumnos consumen la misma API; el paquete compartido evita que web y móvil se desincronicen.

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Monorepo | pnpm workspaces + Turborepo | Un solo `pnpm install`; scripts `dev`, `build`, `seed`, `test` por app |
| API | NestJS + Prisma + PostgreSQL | OpenAPI automático con decoradores, guards para roles, WebSocket gateway incluido |
| Web | React 18 + Vite + Tailwind + React Router | Build estático barato de hostear; PWA con `vite-plugin-pwa` |
| Móvil | Expo (React Native) + Expo Router | Navegación con las mismas rutas que la web; `expo start --web` sirve de respaldo |
| Compartido | `packages/shared`: tipos, Zod, cliente `fetch`, constantes de `data-testid` | Un cambio de contrato rompe web, móvil y tests al mismo tiempo, que es lo que quieres |
| Auth | JWT en header + refresh; MFA simulado (código fijo por usuario de seed) | Permite enseñar `storageState`, reuse de sesión y pruebas de permisos |
| Tiempo real | Socket.IO | Panel de "estado de misión" que cambia solo; ejercicio de `waitForEvent` y aserciones asíncronas |

Convenciones: código en inglés con comentarios en español, patrones funcionales sin `switch` (mapas de despacho + guard clauses), `data-testid` obligatorio en todo elemento interactivo.

## Modelo de datos

Nueve entidades, todas con `tenant_id` para aislar a cada alumno, y dos máquinas de estado (requisito y no conformidad) que dan la mayor parte de los casos de prueba.

| Entidad | Campos clave | Relaciones |
| --- | --- | --- |
| Tenant | `id`, `name`, `seed_version` | Dueño de todo lo demás; uno por alumno (`alumno01`…`alumno25`) y uno `demo` |
| User | `email`, `password_hash`, `role`, `mfa_code`, `active` | Pertenece a Tenant; roles: `admin`, `program_manager`, `consultant`, `auditor` |
| Program | `code`, `name`, `budget_eur`, `start_date`, `end_date`, `status` | Tiene Milestones, Requirements, Risks, Documents; `owner_id` → User |
| Milestone | `name`, `due_date`, `done` | Pertenece a Program |
| Requirement | `code` (REQ-001), `title`, `description`, `priority`, `state`, `parent_id` | Árbol dentro de Program; se enlaza a TestCases (N:M) |
| TestCase | `code` (TC-001), `title`, `steps`, `expected` | Pertenece a Program; tiene TestRuns |
| TestRun | `executed_at`, `result` (`pass`/`fail`/`blocked`), `evidence_url`, `executed_by` | Pertenece a TestCase; archivo adjunto |
| NonConformity | `code` (NC-001), `severity`, `description`, `state`, `assignee_id` | Pertenece a Program; opcional `test_run_id` |
| Document | `title`, `classification` (`public`/`restricted`), `file_url`, `version` | Pertenece a Program; visible según rol |
| AuditLog | `actor_id`, `action`, `entity`, `entity_id`, `at`, `diff` | Solo lectura; lo escribe la API en cada mutación |
| Supplier | `name`, `nif`, `contact_email`, `approved` | N:M con Program a través de `Contract` (`amount_eur`, `signed_at`) |

Estados del requisito: `draft` → `approved` → `verified` → `validated`, con retroceso a `draft` desde cualquiera si se edita el texto. Solo `program_manager` aprueba; solo `auditor` valida; `consultant` crea y verifica.

Estados de la no conformidad: `open` → `in_analysis` → `corrective_action` → `closed`, y `rejected` como salida alternativa desde `in_analysis`. Cerrar exige un comentario de cierre de al menos 20 caracteres (validación que da un buen caso negativo).

Permisos por rol (lo que más se presta a pruebas de autorización):

| Acción | admin | program\_manager | consultant | auditor |
| --- | --- | --- | --- | --- |
| Crear programa | sí | sí | no | no |
| Aprobar requisito | sí | sí | no | no |
| Validar requisito | sí | no | no | sí |
| Ver documentos `restricted` | sí | sí | no | sí |
| Ver AuditLog | sí | no | no | sí |
| Gestionar usuarios | sí | no | no | no |

## Backlog por módulos

Ocho módulos; cada uno existe porque cubre un tema concreto del curso, no por completitud funcional. Los tres primeros son el mínimo para arrancar el curso.

| # | Módulo | Funcionalidad | Reto de automatización que cubre |
| --- | --- | --- | --- |
| 1 | Autenticación | Login con email + contraseña, MFA simulado (código de 6 dígitos fijo por usuario), recordar sesión, logout, bloqueo tras 5 intentos | `storageState`, fixtures de usuario por rol, reuse de sesión, mensajes de error, pruebas negativas |
| 2 | Programas | Lista con filtros (estado, año, responsable), paginación de 10, orden por columna, detalle con pestañas, crear/editar con validaciones (fechas coherentes, presupuesto > 0) | Tablas, `getByRole`, paginación, formularios, date pickers, Page Object Model |
| 3 | Requisitos | Árbol colapsable, crear hijo, editar inline, transición de estado con confirmación modal, matriz requisito ↔ caso de prueba, drag & drop para priorizar | Locators jerárquicos, modales, drag & drop, aserciones de estado, pruebas de permisos |
| 4 | Verificación (V&V) | Casos de prueba con pasos, registrar ejecución con resultado y evidencia (upload PNG/PDF), descarga de informe PDF del plan | `setInputFiles`, `waitForEvent('download')`, validación de archivos, iframes (visor PDF embebido) |
| 5 | No conformidades | Tablero kanban por estado, asignación con autocompletar, comentarios, cierre con validación de longitud, severidad con color | Drag & drop entre columnas, comboboxes, toasts, `expect.poll`, aserciones visuales |
| 6 | Documentos | Lista con clasificación, visor en iframe, descarga, versionado, ocultos para `consultant` si son `restricted` | Iframes, permisos, descargas, `page.route()` para simular 403 |
| 7 | Panel de misión | Dashboard con gráficas (hitos cumplidos, NC abiertas por severidad) y feed en tiempo real por WebSocket de un "simulador de misión" que emite eventos cada pocos segundos | Esperas inteligentes, `waitForResponse`, aserciones sobre contenido que cambia, pruebas visuales con máscaras |
| 8 | Administración | Gestión de usuarios y roles, auditoría filtrable, panel de modo caos (latencia, errores 500, textos alternos), botón de reset del tenant | Pruebas de API con `request`, setup/teardown por `project`, flakiness controlado |

Elementos transversales que se reparten entre módulos:

- Idioma ES/EN con selector en la cabecera (locators por rol y no por texto).
- Modo oscuro (pruebas visuales en dos temas).
- Un componente web en Shadow DOM (el selector de severidad) y un iframe (visor de documentos).
- Notificaciones toast que desaparecen a los 3 s.
- Rutas idénticas en web y móvil: `/programs`, `/programs/:id/requirements`, `/nc`, `/mission`, `/admin`.

Lo que el móvil (Expo) replica en la fase 1: módulos 1, 2, 5 y 7. Requisitos y documentos solo en lectura; administración no existe en móvil.

> **Superado (2026-11-12):** por decisión del usuario el móvil es hoy un espejo **funcional** de la web (todos los módulos, incluida Administración, salvo `/lab`, el arrastrar y soltar y los atajos de teclado). Estado por módulo y lagunas en `docs/MOBILE-PARITY.md`; decisión en `docs/DECISIONS.md` («Paridad funcional del móvil»).

## Catálogo de componentes UI

La app debe cubrir todos los tipos de elemento que un alumno se va a encontrar en producción; cada uno vive en una pantalla concreta para que ningún componente exista solo como demo. Es la lista de verificación del frontend: nada se da por terminado hasta que cada fila tiene su sitio.

| Componente | Dónde vive en SIGPRO | Qué practica en Playwright |
| --- | --- | --- |
| Tabla con orden, filtros, paginación y selección múltiple (checkbox) | Programas, Casos de prueba, Auditoría | `getByRole('row')`, `nth()`, `filter({ hasText })`, acciones masivas |
| Tabla con edición inline de celdas | Hitos del programa | `dblclick`, `fill`, `press('Enter')`, verificar persistencia |
| Exportar tabla a CSV | Programas, Requisitos | `waitForEvent('download')`, leer el archivo y validar filas |
| `<select>` nativo | Filtro de estado, prioridad de requisito | `selectOption` por valor y por etiqueta |
| Combobox con autocompletar (custom) | Asignar NC a un usuario, buscar proveedor | Escribir, esperar sugerencias, elegir por teclado y por clic |
| Multi-select con chips | Etiquetas de requisito | Añadir y quitar chips, verificar el conjunto |
| Dropdown de acciones por fila (menú ⋯) | Todas las tablas | Hover/clic en menú, `getByRole('menuitem')` |
| Modal de confirmación custom | Cambiar estado de requisito, eliminar hito | `getByRole('dialog')`, aceptar y cancelar |
| `alert()`, `confirm()` y `prompt()` nativos | Eliminar programa usa `confirm()`; comentario rápido usa `prompt()` | `page.on('dialog')`, `dialog.accept(text)` |
| Toast con autocierre a 3 s | Toda acción de guardado | Aserción antes de que desaparezca, `toBeHidden` |
| Tooltip y popover | Iconos de estado, ayuda de campos | `hover`, `getByRole('tooltip')` |
| Pestañas (tabs) | Detalle de programa | `getByRole('tab')`, `aria-selected` |
| Acordeón y árbol colapsable | Requisitos, FAQ de /lab | Expandir, verificar hijos, `toBeVisible` |
| Wizard de 3 pasos | Crear programa | Navegar pasos, validar bloqueo del botón Siguiente |
| Date picker y rango de fechas | Fechas de programa, filtro de auditoría | Rellenar por teclado y por calendario |
| Checkbox, radio, switch | Preferencias, severidad de NC, activar usuario | `check`, `toBeChecked`, `setChecked` |
| Slider | Porcentaje de avance de hito | `fill` sobre range, teclado flechas, aserción de valor |
| Upload simple, múltiple y zona drag-and-drop | Evidencias de ejecución, documentos | `setInputFiles`, `filechooser`, validar tamaño y tipo |
| Descarga de archivo | Informe PDF, documento | `download.suggestedFilename()`, `saveAs` |
| Drag & drop para reordenar | Prioridad de requisitos | `dragTo`, verificar orden resultante |
| Kanban con drag & drop entre columnas | No conformidades | `dragTo` entre contenedores, aserción de estado |
| Iframe | Visor de documentos | `frameLocator`, contenido dentro del frame |
| Shadow DOM | Selector de severidad (web component) | Locators que atraviesan shadow root |
| Enlace que abre nueva pestaña | Abrir documento en nueva pestaña | `context.waitForEvent('page')` |
| Scroll infinito | Feed de auditoría | `scrollIntoViewIfNeeded`, `expect.poll` sobre el conteo |
| Menú contextual (clic derecho) | Fila de requisito | `click({ button: 'right' })` |
| Atajos de teclado | `N` nuevo requisito, `/` buscar, `Esc` cerrar | `keyboard.press`, verificar efecto |
| Editor de texto enriquecido (`contenteditable`) | Descripción de requisito y NC | Escribir, negrita con atajo, leer HTML resultante |
| Botón copiar al portapapeles | Código de requisito | Permisos de clipboard, leer con `evaluate` |
| Búsqueda global con resultados agrupados | Cabecera | Debounce, `waitForResponse`, resultados por grupo |
| Spinner y skeleton de carga | Listas al filtrar | Esperar a que desaparezca antes de afirmar |
| Barra de progreso y badges | Programa, NC | Aserción de atributos `aria-valuenow` y texto |
| Breadcrumbs y sidebar colapsable (hamburguesa en móvil) | Layout | Navegación, responsive con `viewport` |
| Banner de cookies | Primera visita | Cerrar antes de interactuar, `storageState` sin banner |
| Ruta protegida con basic auth | `/api/docs` en el entorno del curso | `httpCredentials` en el contexto |
| Validación de formulario cliente y servidor | Todos los formularios | Mensajes inline vs. error 422 de API |
| Tabla de comparación de versiones de documento | Documentos | Aserciones de diff resaltado |
| Notificación en tiempo real (campana) | Cabecera, vía WebSocket | Esperar evento, verificar contador |
| Selector de idioma y tema | Cabecera | Cambiar y verificar textos/colores; pruebas visuales |

Regla de implementación: cada componente tiene nombre accesible (`aria-label` o `<label>`), `data-testid` según la convención, y estados visibles de carga, vacío y error. Un componente que solo funciona con ratón no se da por terminado.

## Diseño para testabilidad

Cinco mecanismos hacen que 20 alumnos puedan correr suites en paralelo contra el mismo despliegue sin pisarse ni heredar basura de la sesión anterior.

1. **Aislamiento por tenant.** Cada alumno recibe un usuario `alumnoNN@sigpro.lab` ligado a su tenant. La API filtra toda consulta por el `tenant_id` del JWT; las suites de API lo mandan además en el header `x-tenant` para los endpoints públicos de setup.
2. **Seed determinista.** `pnpm seed` genera siempre los mismos 3 programas, 40 requisitos, 25 casos de prueba, 12 NC y 6 proveedores por tenant, con ids y códigos fijos (`PRG-001`, `REQ-017`). Así los ejercicios pueden decir "abre REQ-017" y funciona para todos.
3. **Reset bajo demanda.** `POST /api/admin/reset` restaura el seed del tenant del JWT en menos de 2 s; `POST /api/admin/reset?all=true` con `X-Admin-Key` lo hace para todos (lo usa el Cron Job nocturno). Ideal para `globalSetup` o `beforeAll`.
4. **Modo caos por flags.** `PATCH /api/admin/chaos` con `{ latencyMs, errorRate, flakyLabels }` activa, solo para ese tenant: latencia aleatoria 0–`latencyMs`, un porcentaje de 500 en escrituras, y textos de botón que alternan ("Guardar" / "Guardar cambios"). El instructor lo enciende a mitad de sesión para enseñar `retries`, `expect` con timeout y locators por rol.
5. **Bugs plantados y documentados.** Lista interna (`docs/planted-bugs.md`, no accesible a alumnos) con 8–10 defectos reproducibles, por ejemplo: el filtro por año ignora el último día del año, la paginación pierde el orden al cambiar de página, el cierre de NC acepta 19 caracteres, el contador de NC del dashboard no se actualiza por WebSocket hasta refrescar. Sirven para el ejercicio de reporte de defectos.

Convenciones de `data-testid`, definidas en `packages/shared/testids.ts` y usadas por web y móvil:

| Patrón | Ejemplo | Nota |
| --- | --- | --- |
| `<pantalla>-<elemento>` | `login-submit`, `programs-filter-status` | Nunca ids generados en runtime |
| `<entidad>-row-<código>` | `requirement-row-REQ-017` | Filas de tablas y nodos de árbol |
| `<entidad>-state-badge` | `nc-state-badge` | Un único badge por detalle |
| `toast-<tipo>` | `toast-success`, `toast-error` | Los toasts duran 3 s |

Aun así, los ejercicios del curso priorizan `getByRole` y `getByLabel`; el `data-testid` es la red de seguridad, no el locator por defecto.

Documentación que acompaña a la app: OpenAPI en `/api/docs` (Swagger UI), colección Postman exportada, y una página `/lab` dentro de la web con credenciales de demo, lista de usuarios por rol y el botón de reset.

## Cobertura de locators de Playwright

Cada estrategia de localización que recomienda Playwright tiene al menos un elemento en SIGPRO pensado para ella; el frontend no se da por terminado hasta que cada fila tiene su elemento con los atributos indicados.

| Locator | Elemento en SIGPRO | Requisito de implementación | Ejemplo en el curso |
| --- | --- | --- | --- |
| `getByRole` (prioritario) | Botón "Nuevo programa", filas de tabla, `dialog`, `tab`, `menuitem`, `combobox`/`option`, `checkbox`, `link` | Roles nativos o ARIA correctos en todo; nombres accesibles únicos por pantalla | `page.getByRole('button', { name: 'Nuevo programa' })` |
| `getByRole` con `name` regex y `exact` | Badges "Activo" vs "Inactivo", botones "Guardar" vs "Guardar y cerrar" | Pares de textos que se solapan a propósito | `getByRole('button', { name: /^Guardar$/ })` |
| `getByLabel` (por `<label for>`) | Todos los inputs de formularios: "Correo electrónico", "Estado", "Presupuesto" | `label` enlazado por `for`/`id`, nunca placeholder como única etiqueta | `page.getByLabel('Correo electrónico')` |
| `getByLabel` (por `aria-label`) | Botones de icono: tema, campana, menú ⋯ de fila ("Acciones para PRG-001"), cerrar modal | `aria-label` descriptivo e incluyendo el código de la entidad | `getByLabel('Acciones para PRG-001')` |
| `getByPlaceholder` | Búsqueda global "Buscar código o nombre…", combobox "Buscar persona…", MFA "000000" | Placeholder distinto del label | `getByPlaceholder('Buscar código o nombre')` |
| `getByText` | Estado vacío "No hay programas que coincidan", texto de toast, celda de nombre | Mensajes fijos y únicos; `exact: true` enseñable con "Activo" / "Activo (3)" | `getByText('No hay programas', { exact: false })` |
| `getByAltText` | Logo `<img alt="SIGPRO">`, avatar de usuario `<img alt="Marta Ruiz">`, miniatura de evidencia `<img alt="Evidencia TC-001">` | Usar `<img>` reales con `alt`, no solo iniciales en `<div>` | `getByAltText('Evidencia TC-001')` |
| `getByTitle` | Barra de progreso `title="11 % completado"`, botón deshabilitado `title="Tu rol no permite crear programas"`, nombre truncado con `title` completo | Atributo `title` en elementos sin texto visible completo | `getByTitle('Tu rol no permite crear programas')` |
| `getByTestId` | Todo elemento interactivo (`packages/shared/testids.ts`) | Patrón `<pantalla>-<elemento>` y `<entidad>-row-<código>` | `getByTestId('programs-row-PRG-004')` |
| `locator` CSS | Celdas por columna `td:nth-child(6)`, badge `.badge[data-state="active"]` | Atributos `data-state`, `data-severity` en badges y filas | `locator('[data-state="on_hold"]')` |
| `locator` XPath | Fila cuyo texto contiene un código (para enseñar por qué evitarlo) | Ninguno extra; sirve de contraejemplo | `locator('//tr[contains(., "PRG-004")]')` |
| Encadenamiento y `filter({ hasText })` | Fila de PRG-004 → su menú ⋯ → "Eliminar" | Estructura de tabla consistente | `getByRole('row').filter({ hasText: 'PRG-004' }).getByRole('button', { name: /acciones/i })` |
| `filter({ has })` / `filter({ hasNot })` | Filas que tienen badge "Cancelado"; tarjetas kanban sin asignado | Badge y avatar como elementos hijos reales | `getByRole('row').filter({ has: page.getByText('Cancelado') })` |
| `first()`, `last()`, `nth()`, `count()` | Paginación, lista de hitos, opciones de combobox | Orden determinista desde el seed | `getByRole('option').nth(2)` |
| `and()` / `or()` | Botón que es `[data-testid=programs-new]` y está habilitado; mensaje de éxito o de error tras guardar | Dos estados finales posibles (toast ok / alerta 422) | `getByTestId('toast-ok').or(getByRole('alert'))` |
| `frameLocator` | Visor de documentos en `<iframe title="Visor de documento">` | Iframe con `title` y contenido propio con sus `data-testid` | `frameLocator('[title="Visor de documento"]').getByText('Página 1')` |
| Shadow DOM (atraviesa por defecto) | Web component `<sigpro-severity-picker>` en NC | Shadow root abierto con opciones con `role=option` | `getByRole('option', { name: 'Crítica' })` dentro del componente |
| `getByRole` en `dialog` nativo vs custom | Eliminar programa usa `alertdialog` custom; reset del tenant usa `confirm()` nativo | Mantener ambos a propósito | `page.on('dialog', d => d.accept())` |
| Locators en nueva pestaña | Enlace "Abrir en nueva pestaña" de documentos (`target=_blank`) | Enlace real, no `window.open` por JS | `context.waitForEvent('page')` |
| Locator de lista con `toHaveText([...])` | Columna Código tras ordenar | Orden determinista | `expect(getByTestId(/^programs-link-/)).toHaveText(['PRG-001', …])` |

Reglas derivadas para el frontend:

- Todo `<img>` lleva `alt`; los avatares de iniciales se implementan como `<img>` generado (SVG data-URI) con `alt` del nombre, no como `<div>`.
- Todo botón de icono lleva `aria-label` con el código de la entidad cuando aplica.
- Todo input tiene `<label for>`; el placeholder es adicional y distinto del label.
- Los badges llevan `data-state` o `data-severity`; las filas, `data-testid` con el código.
- Hay al menos un par de textos que se solapan en cada pantalla ("Guardar" / "Guardar y cerrar") para enseñar `exact`.
- Los elementos pensados como contraejemplo (XPath frágil, texto que cambia con modo caos) se documentan en `/lab`.

## Despliegue en Render

Tres servicios y una base, declarados en un `render.yaml` en la raíz del monorepo para poder levantar un entorno por cohorte (`sigpro-isdefe`, `sigpro-demo`) desde un Blueprint.

| Servicio | Tipo en Render | Plan sugerido | Motivo |
| --- | --- | --- | --- |
| `sigpro-web` | Static Site | Free | Sale del cómputo; solo consume ancho de banda |
| `sigpro-api` | Web Service (Node) | Starter | El plan free se duerme tras inactividad y el primer request tarda hasta un minuto: inaceptable en clase |
| `sigpro-db` | PostgreSQL | Basic (o Neon/Supabase free) | El Postgres gratuito de Render caduca al poco tiempo; para un curso corto puede valer, para un lab permanente no |
| `sigpro-reset` | Cron Job | Free/Starter | Reset de todos los tenants cada noche |

Puntos a vigilar en tu workspace actual:

- Ya vas por encima del 70% de los 5 GB de ancho de banda mensual del plan Hobby con OmniPizza y los demás servicios. Con 20 alumnos corriendo suites con `trace: 'on'` y evidencias adjuntas, se puede agotar. Opciones: limitar evidencias a 2 MB, servir el front con cache agresiva, o pasar a un plan de equipo durante las semanas del curso.
- El móvil (Expo) no se hostea en Render: se distribuye con Expo Go o un build EAS; solo necesita la URL pública de la API.
- Variables sensibles (`JWT_SECRET`, `ADMIN_KEY`) con `sync: false` para que Render las pida al crear el Blueprint y no queden en el repo.

`render.yaml` inicial:

```yaml
databases:
  - name: sigpro-db
    plan: basic-256mb
    databaseName: sigpro
    user: sigpro

services:
  - type: web
    name: sigpro-api
    runtime: node
    plan: starter
    rootDir: .
    buildCommand: pnpm install --frozen-lockfile && pnpm --filter api prisma generate && pnpm --filter api build
    startCommand: pnpm --filter api prisma migrate deploy && pnpm --filter api start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_VERSION
        value: "20"
      - key: DATABASE_URL
        fromDatabase:
          name: sigpro-db
          property: connectionString
      - key: JWT_SECRET
        sync: false
      - key: ADMIN_KEY
        sync: false
      - key: CORS_ORIGIN
        value: https://sigpro-web.onrender.com
      - key: SEED_ON_BOOT
        value: "true"

  - type: web
    name: sigpro-web
    runtime: static
    rootDir: .
    buildCommand: pnpm install --frozen-lockfile && pnpm --filter web build
    staticPublishPath: apps/web/dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_URL
        value: https://sigpro-api.onrender.com/api

  - type: cron
    name: sigpro-reset
    runtime: node
    schedule: "0 3 * * *"
    buildCommand: pnpm install --frozen-lockfile
    startCommand: node scripts/reset-all.mjs
    envVars:
      - key: API_URL
        value: https://sigpro-api.onrender.com/api
      - key: ADMIN_KEY
        sync: false
```

`scripts/reset-all.mjs` solo hace un `fetch` a `POST ${API_URL}/admin/reset?all=true` con el header `X-Admin-Key`. El `SEED_ON_BOOT` crea los tenants y el seed la primera vez que arranca la API; después no toca nada si ya existen.

Para que un alumno reproduzca todo en local: `docker compose up db` + `pnpm dev` levanta API en `:3000`, web en `:5173` y Expo en `:8081`; el `.env.example` apunta a esos puertos.

## Mapa curso ↔ laboratorio

Cada sesión del curso usa un módulo concreto como escenario; así el temario y el backlog se construyen a la par y nada queda sin usar.

| Sesión | Tema del curso | Módulo del lab | Ejercicio tipo |
| --- | --- | --- | --- |
| 1 | Setup, TypeScript básico, estructura de proyecto | /lab | Primer test: abrir SIGPRO y comprobar el título |
| 2 | Locators, `getByRole`, `getByLabel`, `data-testid` | Autenticación | Login válido, inválido, bloqueo tras 5 intentos |
| 3 | Fixtures, `storageState`, Page Object Model | Autenticación + Programas | Un fixture por rol; POM de la lista de programas |
| 4 | Formularios, validaciones, date pickers | Programas | Crear programa con fechas incoherentes y ver el error |
| 5 | Tablas, filtros, paginación, orden | Programas | Verificar que el filtro por año devuelve solo esos (bug plantado) |
| 6 | Modales, drag & drop, estados | Requisitos | Aprobar REQ-017 y comprobar el badge; reordenar prioridades |
| 7 | Archivos: upload, download, iframes | Verificación + Documentos | Adjuntar evidencia PNG; descargar informe y validar el nombre |
| 8 | API testing con `request`, setup por API | Administración + Requisitos | Crear datos por API y verificarlos en UI |
| 9 | Interceptación de red, `page.route`, mocks | Documentos | Simular 403 y 500; verificar mensajes de error |
| 10 | Esperas, flakiness, retries, modo caos | Panel de misión | Suite estable con caos activado |
| 11 | Pruebas visuales y emulación móvil | Panel de misión + No conformidades | Screenshot con máscara; kanban en `devices['iPhone 14']` |
| 12 | CI con GitHub Actions, reportes, trazas | Todo | Pipeline que corre la suite por tenant y publica el reporte HTML |

Si las 24 horas se quedan cortas, las sesiones 11 y 12 son las candidatas a convertirse en tarea guiada.

## Plan de construcción

Cuatro fases; la fase 1 ya permite dar las primeras cinco sesiones, y cada fase posterior añade módulos sin tocar los anteriores.

1. **Base (fase 1).** Monorepo, Prisma schema con las 11 entidades, seed, auth con roles y MFA, módulos Autenticación y Programas en web, `/lab`, OpenAPI, `render.yaml` desplegado. Entregable: URL pública con usuarios de demo.
2. **Núcleo del dominio (fase 2).** Requisitos con árbol y estados, Verificación con uploads y PDF, Documentos con iframe y permisos, AuditLog. Entregable: cubre sesiones 6 a 9.
3. **Dinámica y caos (fase 3).** Panel de misión con WebSocket, No conformidades kanban, modo caos, bugs plantados documentados, i18n y modo oscuro. Entregable: cubre sesiones 10 y 11.
4. **Móvil y CI (fase 4).** App Expo con los módulos 1, 2, 5 y 7, workflow de GitHub Actions de referencia, página `/lab` con enlaces de descarga. Entregable: material de la sesión 12 y base para un curso de Appium.

Decisiones pendientes antes de arrancar:

- [ ] Número de alumnos y fechas del curso (define cuántos tenants y si conviene subir el plan de Render esas semanas).
- [ ] Si Isdefe permite usar Render (hosting en EE. UU.) o exige algo en la UE; de ser así, el mismo `render.yaml` se traduce a Railway o a un VPS con Docker Compose sin cambiar la app.
- [ ] Nombre definitivo y branding neutro (evitar logos o referencias reales de defensa).
- [ ] Si el repo será público (reutilizable para la comunidad, como OmniPizza) o privado para el cliente.
