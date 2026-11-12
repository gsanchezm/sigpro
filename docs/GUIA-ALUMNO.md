# SIGPRO · Guía del alumno

SIGPRO es una aplicación **ficticia** de gestión de programas de ingeniería de sistemas (programas, requisitos, verificación, no conformidades y documentos). Existe para que practiques Playwright + TypeScript sobre un dominio realista. Todos los datos son inventados.

Esta guía responde a tres preguntas:

1. [Cómo levantar SIGPRO en tu máquina con Docker](#1-levantar-sigpro-en-local-con-docker)
2. [Cómo apuntar tu suite al entorno del curso en Render](#2-apuntar-tu-suite-a-render)
3. [Qué usuarios y qué códigos fijos hay](#3-usuarios-y-roles) (para que «abre PRG-004» funcione igual para todos)

Si solo vas a trabajar contra Render, salta al [apartado 2](#2-apuntar-tu-suite-a-render): no necesitas Docker.

---

## 1. Levantar SIGPRO en local con Docker

### Requisitos

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Node.js | 22.13 o superior | Ejecutar la API y la web |
| pnpm | 11 (`corepack enable`) | Gestor de paquetes del monorepo |
| Docker | Docker Desktop o Engine | Solo para la base de datos PostgreSQL |
| Git | cualquiera | Clonar el repositorio |

### Pasos

```bash
git clone https://github.com/gsanchezm/sigpro.git
cd sigpro
pnpm install

cp .env.example .env              # en Windows (cmd o PowerShell): copy .env.example .env
docker compose up -d db           # PostgreSQL en el puerto 5432
pnpm --filter api prisma:deploy   # crea las tablas
pnpm dev                          # API en :3000 y web en :5173
```

Al arrancar, la API **crea los tenants y el seed** automáticamente (`SEED_ON_BOOT=true` en el `.env`). La primera vez tarda unos segundos.

### Comprobar que funciona

| Qué | Dónde |
| --- | --- |
| Web (pantalla de acceso con usuarios de prueba) | <http://localhost:5173> |
| Laboratorio: credenciales, reinicio de datos, caos, endpoints, descarga del proyecto de ejemplo | <http://localhost:5173/lab> |
| API | <http://localhost:3000/api> (`GET /api/health` → `{"status":"ok"}`) |
| Documentación de la API (Swagger UI) | <http://localhost:3000/api/docs> |

Entra con `admin@sigpro.test` / `Admin1234!` y, cuando lo pida, el código `123456`.

### Parar y volver a empezar

```bash
# Ctrl+C en la terminal de `pnpm dev`
docker compose stop db            # para la base, conserva los datos
docker compose down -v            # borra también los datos (empezar de cero)
```

Para restaurar solo los datos sin tocar Docker: `pnpm seed` (todos los tenants) o el botón **Reiniciar datos** de `/lab` (solo el tuyo).

### Si algo falla

| Síntoma | Remedio |
| --- | --- |
| `Cannot connect to the Docker daemon` | Abre Docker Desktop y espera a que arranque |
| `port 5432 is already allocated` | Tienes otro PostgreSQL: páralo o cambia el puerto en `docker-compose.yml` y en `DATABASE_URL` del `.env` |
| `EADDRINUSE :3000` o `:5173` | Hay otra instancia en marcha; ciérrala. SIGPRO usa siempre esos dos puertos |
| `ERR_PNPM_UNSUPPORTED_ENGINE` | Node demasiado antiguo: instala Node 22.13+ |
| `EPERM … query_engine-windows.dll.node` (Windows) | Ya se resuelve solo (`apps/api/scripts/generate-prisma.mjs`); si persiste, cierra la API y repite el comando |
| La web carga pero el acceso da error de red | La API no está en marcha: mira la terminal de `pnpm dev` |

---

## 2. Apuntar tu suite a Render

El instructor mantiene un entorno compartido (cada alumno trabaja en su propio *tenant*, así que nadie se pisa los datos):

| Qué | URL |
| --- | --- |
| Web | <https://sigpro-web.onrender.com> |
| API | <https://sigpro-api.onrender.com/api> |
| Swagger | <https://sigpro-api.onrender.com/api/docs> (puede pedir usuario y contraseña: te los da el instructor) |

**Tu tenant y tu usuario** son el mismo identificador: `alumnoNN` (por ejemplo `alumno07`). Tu usuario personal es `alumno07@sigpro.lab` con contraseña `Alumno1234!`; es administrador de tu tenant y no tiene segundo paso (MFA).

### Con el proyecto de ejemplo (`examples/`)

Descárgalo desde `/lab` (**Material del curso → Descargar sigpro-examples.zip**) o usa la carpeta `examples/` del repositorio. Después:

```bash
cd examples
npm install
npx playwright install chromium
cp .env.example .env              # en Windows: copy .env.example .env
```

Edita `.env`:

```bash
SIGPRO_STUDENT=alumno07
SIGPRO_WEB_URL=https://sigpro-web.onrender.com
SIGPRO_API_URL=https://sigpro-api.onrender.com/api
```

Y ejecuta:

```bash
npm run reset      # restaura el seed de TU tenant (usa tu usuario alumnoNN@sigpro.lab)
npm test           # corre las sesiones 2 a 11 y la 13
npm run report     # abre el informe HTML
```

Para ejecutar contra tu máquina en lugar de Render, deja las dos URL por defecto (`localhost`) o bórralas del `.env`.

| Variable | Por defecto | Significado |
| --- | --- | --- |
| `SIGPRO_STUDENT` | `alumno01` | Tu usuario y, salvo que lo cambies, tu tenant |
| `SIGPRO_TENANT` | el de `SIGPRO_STUDENT` | Otro tenant de trabajo (p. ej. `demo`) |
| `SIGPRO_STUDENT_PASSWORD` | `Alumno1234!` | Contraseña de tu usuario |
| `SIGPRO_WEB_URL` | `http://localhost:5173` | Dónde corre la web |
| `SIGPRO_API_URL` | `http://localhost:3000/api` | Dónde corre la API |

### Con tu propio proyecto

Tres cosas bastan para que cualquier suite funcione contra SIGPRO:

1. **La URL base** de la web (`baseURL` en `playwright.config.ts`).
2. **El tenant** de cada sesión:
   - En la **web**: `https://sigpro-web.onrender.com/login?tenant=alumno07`. La app guarda el tenant en `localStorage` (`sigpro.tenant`), así que también viaja en `storageState`.
   - En la **API**: cabecera `x-tenant: alumno07` en cada petición.
3. **Marcar «Mantener la sesión en este equipo»** al iniciar sesión por la UI. Sin esa casilla, el token vive en `sessionStorage` y `storageState` no lo captura.

Ejemplo de login por API (con el segundo paso del admin):

```ts
const headers = { 'x-tenant': 'alumno07' };
const login = await request.post('https://sigpro-api.onrender.com/api/auth/login', {
  headers,
  data: { email: 'admin@sigpro.test', password: 'Admin1234!', remember: true },
});
const { mfaToken } = await login.json();              // el admin devuelve mfaRequired + mfaToken
const mfa = await request.post('https://sigpro-api.onrender.com/api/auth/mfa', { headers, data: { mfaToken, code: '123456' } });
const { accessToken } = await mfa.json();             // → Authorization: Bearer <accessToken>
```

### Sesión 12: la suite en GitHub Actions

El workflow `students-e2e.yml` (dentro del zip y en `.github/workflows/` del repositorio) corre la suite contra Render con tu tenant, la reparte en 2 shards y publica el informe HTML como artefacto. Se lanza desde **Actions → Students E2E → Run workflow** indicando tu tenant. El detalle está en el `README.md` de `examples/`.

### Aviso sobre Render

La API del curso se duerme si nadie la usa: **la primera petición puede tardar hasta un minuto**. Es normal; reintenta. Si ves errores de red nada más empezar la clase, abre `/api/health` en el navegador para despertarla.

---

## 3. Usuarios y roles

### Usuarios de demo

Existen **en todos los tenants** (`demo` y `alumno01` … `alumno25`). También los muestra `/lab`.

| Correo | Contraseña | Rol | Nota |
| --- | --- | --- | --- |
| `admin@sigpro.test` | `Admin1234!` | `admin` | Segundo paso (MFA): código `123456` |
| `gestor@sigpro.test` | `Gestor1234!` | `program_manager` | |
| `consultor@sigpro.test` | `Consul1234!` | `consultant` | |
| `auditor@sigpro.test` | `Audit1234!` | `auditor` | |
| `bloqueado@sigpro.test` | `Block1234!` | `consultant` | Cuenta bloqueada: el login responde **423** |
| `pendiente@sigpro.test` | `Pend1234!` | `consultant` | Pendiente de aprobación: el login responde **403** |
| `alumnoNN@sigpro.lab` | `Alumno1234!` | `admin` | Solo en el tenant `alumnoNN`; sin MFA |

Cinco contraseñas incorrectas seguidas bloquean una cuenta (423). **Reiniciar los datos del tenant la desbloquea.**

### Qué puede hacer cada rol

| Acción | admin | program_manager | consultant | auditor |
| --- | :---: | :---: | :---: | :---: |
| Crear, editar y borrar programas | sí | sí | no | no |
| Crear y editar requisitos | sí | sí | sí | no |
| Aprobar requisito | sí | sí | no | no |
| Verificar requisito | sí | no | sí | no |
| Validar requisito | sí | no | no | sí |
| Registrar ejecuciones de pruebas | sí | no | sí | no |
| Ver documentos `restricted` | sí | sí | no (403) | sí |
| Publicar versión de documento | sí | sí | no | no |
| Cerrar una no conformidad | sí | sí | no | no |
| Mover una no conformidad | sí | sí | sí | no |
| Ver la auditoría | sí | no | no | sí |
| Gestionar usuarios y el modo caos | sí | no | no | no |

Un botón que tu rol no puede pulsar aparece **deshabilitado con un atributo `title`** que explica el motivo (`getByTitle`).

---

## 4. Códigos fijos del seed

El seed es **determinista**: cada tenant se crea siempre igual, con los mismos códigos. Por eso un ejercicio puede decir «abre REQ-017» y funciona para todos.

| Entidad | Códigos | Cantidad |
| --- | --- | --- |
| Programas | `PRG-001` … `PRG-024` | 24 |
| Requisitos | `REQ-001` … `REQ-040` (en `PRG-001`, `PRG-002` y `PRG-003`) | 40 |
| Casos de prueba | `TC-001` … `TC-025` | 25 |
| No conformidades | `NC-001` … `NC-012` | 12 |
| Documentos | `DOC-001` … `DOC-012` | 12 |
| Proveedores | 6 (por ejemplo «Aeronáutica Levante S.L.») | 6 |

### Programas

| Estado | Códigos |
| --- | --- |
| Activo (12) | PRG-001, 002, 005, 007, 009, 010, 013, 015, 017, 018, 021, 023 |
| Borrador (3) | PRG-003, 011, 019 |
| En pausa (3) | PRG-004, 012, 020 |
| Cerrado (3) | PRG-006, 014, 022 |
| Cancelado (3) | PRG-008, 016, 024 |

La lista muestra 10 por página (3 páginas) y cada uno de los seis responsables tiene 4 programas. `PRG-001` va al 11 % de avance.

### Requisitos, casos de prueba y no conformidades

| Programa | Requisitos | Casos de prueba | No conformidades |
| --- | --- | --- | --- |
| `PRG-001` | `REQ-001` … `REQ-014` | `TC-001` … `TC-009` | `NC-001` … `NC-004` |
| `PRG-002` | `REQ-015` … `REQ-028` | `TC-010` … `TC-018` | `NC-005` … `NC-008` |
| `PRG-003` | `REQ-029` … `REQ-040` | `TC-019` … `TC-025` | `NC-009` … `NC-012` |

- Los requisitos forman un **árbol** de hasta 3 niveles. `REQ-017` (hijo de `REQ-015`, en `PRG-002`) está en **borrador**: es el que se aprueba en la sesión 6.
- El último requisito de cada programa queda **sin cobertura** a propósito (sin caso de prueba enlazado).
- Estados de los 14 requisitos de `PRG-002`: 5 en borrador, 2 aprobados, 3 verificados y 4 validados.
- No conformidades por estado: abiertas `NC-001`, `006`, `007`, `012` · en análisis `NC-002`, `008` · acción correctiva `NC-003`, `009` · cerradas `NC-004`, `010` · rechazadas `NC-005`, `011`. `NC-005` y `NC-010` no tienen asignado (para `filter({ hasNot })`).

### Documentos

| Código | Programa | Clasificación |
| --- | --- | --- |
| `DOC-001`, `002` | PRG-001 | pública |
| `DOC-003` | PRG-002 | **restringida** |
| `DOC-004` | PRG-002 | pública |
| `DOC-005` | PRG-003 | pública |
| `DOC-006` | PRG-003 | **restringida** |
| `DOC-007`, `008` | PRG-004 | pública |
| `DOC-009` | PRG-005 | **restringida** |
| `DOC-010` | PRG-005 | pública |
| `DOC-011` | PRG-006 | pública |
| `DOC-012` | PRG-006 | **restringida** |

El consultor **no ve** los restringidos en la lista y recibe un 403 si abre uno por URL. Cada documento tiene entre 1 y 3 versiones.

### Cuentas de los tenants

| Tenant | Para qué |
| --- | --- |
| `demo` | Curiosear y ejemplos del instructor |
| `alumno01` … `alumno25` | Uno por alumno; cada uno se reinicia por separado |

---

## 5. Herramientas del laboratorio

- **`/lab`**: usuarios, tenant activo, botón **Reiniciar datos** (usa un `confirm()` nativo), modo caos, lista de endpoints, contraejemplos de locators (XPath frágil, textos que cambian con el caos), la tabla de **locators responsive** (las 10 familias de componentes que cambian con el ancho) y FAQ.
- **Reinicio por API**: `POST /api/admin/reset` con el token de un admin y `x-tenant`; restaura el seed de tu tenant en menos de 2 s.
- **Modo caos**: `PATCH /api/admin/chaos` con `{ "latencyMs": 400, "errorRate": 0, "flakyLabels": true }`. Añade latencia aleatoria, errores 500 en las escrituras (`errorRate`, de 0 a 1) y textos de botón que alternan («Guardar» ↔ «Guardar cambios»). Solo afecta a tu tenant y **sobrevive al reinicio de datos**; apágalo con ceros y `false`.
- **Swagger**: todos los endpoints, con sus códigos de respuesta (401, 403, 404, 409, 422).
- **Idioma y tema**: selector ES/EN y claro/oscuro en la cabecera; la preferencia se guarda en `localStorage`.

Buena suerte, y recuerda el orden de preferencia de locators: `getByRole` → `getByLabel` → `getByPlaceholder` / `getByAltText` / `getByTitle` → `getByTestId` como red de seguridad.

---

## 6. App móvil (Expo)

SIGPRO tiene una versión móvil con **las mismas rutas, la misma API y los mismos `data-testid`** (en React Native se llaman `testID`, y en la versión web de Expo se pintan como `data-testid`). Es un espejo funcional de la web: acceso (MFA, registro, recuperar contraseña), **Programas**, **Requisitos**, **Verificación**, **No conformidades** (tablero kanban), **Panel de misión** (tiempo real) y, desde la pestaña **Más**, **Documentos**, **Auditoría**, **Administración**, **Perfil**, la ayuda y la búsqueda global, cada uno con los permisos de su rol. No incluye `/lab`, el arrastrar y soltar (se usa «Mover a…») ni los atajos de teclado.

### Arrancarla

```bash
pnpm dev                          # levanta API :3000, web :5173 y la app móvil en web :8081
# o solo la móvil:
pnpm --filter mobile web          # equivale a `expo start --web --port 8081`
```

Abre <http://localhost:8081/login?tenant=alumno07>. Es la misma app que verías en un teléfono, servida como web: es lo que se automatiza con Playwright (viewport de 390 × 844, por ejemplo).

| Dónde quieres verla | Cómo |
| --- | --- |
| Navegador (para automatizar) | `pnpm --filter mobile web` → <http://localhost:8081> |
| Teléfono con Expo Go | `EXPO_PUBLIC_API_URL=http://<IP-de-tu-PC>:3000/api pnpm --filter mobile start` y escanea el QR |
| Emulador de Android | `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api pnpm --filter mobile start` |
| Contra Render | `EXPO_PUBLIC_API_URL=https://sigpro-api.onrender.com/api EXPO_PUBLIC_TENANT=alumno07 pnpm --filter mobile web` |

La app móvil no se aloja en Render (no es un sitio web): se usa con Expo Go o con la build para emuladores de iOS y Android (`docs/MOBILE-EMULADORES.md`). En su versión web, la API debe permitir el origen `http://localhost:8081` (`CORS_ORIGIN`; ya viene así en `.env.example`).

### Automatizarla con Playwright

- **La sesión es compatible con la web:** las mismas claves de `localStorage` (`sigpro.session`, `sigpro.tenant`, `sigpro.theme`, `sigpro.lang`), así que un `storageState` o un `addInitScript` como los de la sesión 3 funcionan igual en `:8081`.
- **Locators:** `getByRole('tab', { name: 'No conformidades' })` para la barra inferior, `getByRole('radio', { name: 'En pausa' })` para los filtros de selección única, `getByRole('button', …)`, `getByLabel` y `getByTestId` (los ids son los de la web: `programs-row-PRG-001`, `nc-column-open`…). Los badges llevan `data-state` / `data-severity`.
- **No hay drag & drop en el móvil:** mover una no conformidad se hace desde su detalle con **«Mover a…»**. Cerrarla exige un comentario de al menos 20 caracteres, igual que en la web.
- **Los botones deshabilitados** explican el motivo en un texto visible junto al botón y en el atributo `data-reason`, no en `title` (React Native no tiene `title`): `await expect(boton).toHaveAttribute('data-reason', '…')`.

---

## 7. Locators que cambian en modo responsive (sesión 13)

La web de SIGPRO tiene **un solo corte de diseño**: por debajo de **1024 px** (móvil y tablet) se monta la variante *responsive* de cada familia de componentes; desde 1024 px, la de escritorio. `<html data-layout="desktop|mobile">` dice cuál está activa. Son **dos componentes distintos** y React monta uno u otro, **nunca los dos a la vez**: la variante contraria no está oculta con CSS, **no existe en el DOM**.

### Reglas de los ids

- Los `data-testid` de escritorio **no cambian**. La variante responsive es siempre **`<id de escritorio>-mobile`**, también en los dinámicos: `programs-row-PRG-001` → `programs-row-PRG-001-mobile`.
- **No cambian de id en ningún ancho:** la pantalla de Acceso completa, los campos de formulario (`programs-filter-status`, `requirement-title`…), los diálogos, los toasts y los botones internos del asistente de alta.
- **El nombre accesible es el mismo** en las dos variantes siempre que el rol lo permita. Cambia el **rol**: fila ↔ tarjeta (`row` ↔ `listitem`), `menuitem` ↔ botón, `tab` ↔ `<select>`.
- Los ids que **solo existen en una variante** (sin pareja) conservan su nombre: `layout-search-toggle` (el icono de búsqueda), `layout-drawer-scrim`, `programs-search` y los del panel de filtros y la hoja de acciones (`programs-filters-apply-mobile`…).

### Las 10 familias

| # | Familia | Escritorio (≥ 1024 px) | Responsive (< 1024 px) | Nombre accesible |
| --- | --- | --- | --- | --- |
| 1 | Navegación principal | `layout-sidebar` (barra lateral) | `layout-sidebar-mobile` (drawer que abre `layout-sidebar-toggle-mobile`) | «Navegación principal» |
| 2 | Búsqueda global | `layout-search` (campo en la cabecera, popover) | `layout-search-toggle` (icono) → `layout-search-mobile` (campo de la pantalla completa) | «Búsqueda global» |
| 3 | Menú de usuario | `layout-user-menu` (popover con `menuitem`) | `layout-user-menu-mobile` (sección al pie del drawer: enlace «Perfil», botones) | «Menú de usuario», «Perfil», «Atajos», «Cerrar sesión» |
| 4 | Lista de Programas | `programs-table` / `programs-row-PRG-001` (`row`) | `programs-table-mobile` / `programs-row-PRG-001-mobile` (`listitem`) | el enlace «PRG-001» |
| 5 | Crear programa | `programs-new` (botón de la cabecera) | `programs-new-mobile` (botón flotante) | «+ Nuevo programa» |
| 6 | Filtros de Programas | `programs-filters` (barra en línea, `search`) | `programs-filters-mobile` (botón) + `programs-filters-panel-mobile` (panel inferior) | «Filtros» |
| 7 | Acciones por fila | `programs-row-menu` (`menu` con `menuitem`) | `programs-row-menu-mobile` (hoja inferior, `dialog` con botones) | «Acciones para PRG-001» |
| 8 | Pestañas del detalle | `program-detail-tabs` (`tablist`) | `program-detail-tabs-mobile` (`<select>`) | «Detalle del programa» |
| 9 | Detalle de requisito | `requirement-detail` (panel junto al árbol) | `requirement-detail-mobile` (pantalla completa) | «Detalle del requisito» (el cierre es «Cerrar» en escritorio y **«Volver»** en responsive) |
| 10 | Kanban de NC | `nc-board` (columnas con drag & drop) | `nc-board-mobile` (pestañas por estado + «Mover a…» en cada tarjeta) | «Tablero de no conformidades» |

La misma tabla está en `/lab` («Locators responsive»).

### Dos formas de automatizar el mismo flujo

El spec `s13-locators-responsive.spec.ts` resuelve un flujo (filtrar por «En pausa», abrir las acciones de `PRG-004`, «Ver detalle», pestaña «Hitos») **de dos formas, y cada una a 1440 y a 390 px**:

- **A · `getByRole` + nombre accesible.** Casi no distingue anchos: `getByLabel('Estado')`, `getByRole('button', { name: 'Acciones para PRG-004' })`… Solo cambian de *acción* abrir el panel «Filtros» y elegir la pestaña (en responsive es un `<select>`), y de *rol* el menú (`menuitem` ↔ enlace), que se resuelve con `.or()`.
- **B · `getByTestId`.** Cada id con pareja necesita `tid(id, isResponsive)`.

```ts
import { test, expect } from '../fixtures';
import { tid } from '../support/responsive';

test('fila o tarjeta', async ({ page, isResponsive }) => {
  await page.goto('/programs');
  await expect(page.getByTestId(tid('programs-row-PRG-004', isResponsive))).toBeVisible();
  // …y la variante contraria no existe
  await expect(page.getByTestId(tid('programs-row-PRG-004', !isResponsive))).toHaveCount(0);
});
```

- **`isResponsive`** (fixture): `true` si el viewport del test es < 1024 px. Se calcula **al empezar el test**; si cambias el tamaño dentro del test, usa `isResponsiveNow(page)`.
- **`tid(id, responsive)`** (helper): `programs-new` → `programs-new-mobile`.
- **Decide por el ancho, no por `data-layout`.** Si lees el atributo para decidir qué locator usar y la app calculara mal el diseño, tu test le daría la razón a la app en lugar de detectar el fallo. Usa el atributo solo para *comprobar* el diseño.

### Emular dispositivos en tu propio proyecto

```ts
projects: [
  { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  // Las descripciones de iPad e iPhone traen WebKit por defecto: con Chromium emulas viewport, agente y táctil
  { name: 'tablet', use: { ...devices['iPad (gen 7)'], defaultBrowserType: 'chromium' } },   // 810 px → responsive
  { name: 'mobile', use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium' } },       // 390 px → responsive
],
```

Ojo: un iPad **apaisado** (`iPad (gen 7) landscape`, 1080 px) ya es escritorio.
