# SIGPRO · proyecto Playwright de referencia

Proyecto **Playwright + TypeScript** contra SIGPRO, el laboratorio del curso. Es independiente del monorepo (tiene su propio `package.json`): puedes usarlo aquí, dentro del repositorio de SIGPRO, o copiarlo a tu propio repositorio. Incluye:

- **Fixtures por rol** con `storageState`: cada test arranca ya autenticado como admin, gestor, consultor o auditor.
- **Page Objects** de Programas y de la pantalla de acceso.
- **Un spec por sesión del curso** (sesiones 2 a 11).
- **El workflow de GitHub Actions de la sesión 12** (`.github/workflows/students-e2e.yml`): corre la suite contra Render con tu tenant, en 2 shards, y publica el informe HTML.

## Puesta en marcha

Necesitas Node 20.12 o superior (mejor 22) y npm.

```bash
npm install
npx playwright install chromium     # solo la primera vez
cp .env.example .env                # en Windows: copy .env.example .env
npm run reset                       # restaura el seed de tu tenant y apaga el modo caos
npm test
npm run report                      # abre el informe HTML
```

`npm run test:fresh` hace `reset` + `test` de una vez. `npm run test:ui` abre el modo interactivo de Playwright y `npm run test:headed` muestra el navegador.

## ¿Contra qué se ejecuta? El archivo `.env`

Todo se controla con variables de entorno (puedes ponerlas en `.env` o exportarlas). Sin `.env`, la suite apunta a SIGPRO en tu máquina.

| Variable | Por defecto | Para qué sirve |
| --- | --- | --- |
| `SIGPRO_STUDENT` | `alumno01` | Tu usuario: es el correo `alumnoNN@sigpro.lab` **y** el tenant donde trabajas (cabecera `x-tenant`) |
| `SIGPRO_TENANT` | el de `SIGPRO_STUDENT` | Solo si quieres otro tenant (p. ej. `demo`) |
| `SIGPRO_STUDENT_PASSWORD` | `Alumno1234!` | Contraseña de tu usuario |
| `SIGPRO_WEB_URL` | `http://localhost:5173` | URL de la web |
| `SIGPRO_API_URL` | `http://localhost:3000/api` | URL de la API (acaba en `/api`) |

Contra el entorno del curso en Render:

```bash
SIGPRO_STUDENT=alumno07
SIGPRO_WEB_URL=https://sigpro-web.onrender.com
SIGPRO_API_URL=https://sigpro-api.onrender.com/api
```

> La API de Render se duerme tras un rato sin uso: la primera petición puede tardar hasta un minuto. Si `npm run reset` falla por tiempo de espera, repítelo.

## Cómo está organizado

| Ruta | Qué contiene |
| --- | --- |
| `playwright.config.ts` | 2 proyectos: `setup` (inicia sesión una vez por rol) y `chromium` (los specs, que dependen de `setup`). 2 workers en local y 1 en CI |
| `tests/auth.setup.ts` | Inicia sesión por la pantalla de acceso con cada rol y guarda `.auth/<tenant>-<rol>.json` |
| `fixtures/index.ts` | `test` y `expect` que importan todos los specs: `role`, `pageAs`, `adminPage`…, `apiAs`, `programsPage` |
| `pages/` | Page Objects: `ProgramsPage`, `LoginPage` |
| `support/` | `env.ts` (variables y usuarios), `api.ts` (login por API y cliente mínimo) |
| `scripts/reset-tenant.ts` | `npm run reset`: restaura tu tenant por la API |

### Los fixtures en dos líneas

```ts
import { test, expect } from '../fixtures';

test.use({ role: 'auditor' });                       // todo el archivo (o bloque) como auditor

test('dos usuarios a la vez', async ({ adminPage, consultantPage }) => { /* … */ });
test('preparar datos por API', async ({ apiAs }) => { const api = await apiAs('admin'); /* … */ });
```

`test.use({ role: 'anonymous' })` abre el navegador **sin** sesión (pantallas de acceso).

## Un spec por sesión

| Sesión | Spec | Módulo | Qué practicas |
| --- | --- | --- | --- |
| 2 | `s02-locators-auth.spec.ts` | Autenticación | `getByRole`, `getByLabel`, `exact`, login válido e inválido, MFA, bloqueo tras 5 intentos |
| 3 | `s03-fixtures-pom.spec.ts` | Autenticación + Programas | Fixtures por rol, `storageState`, Page Object de Programas |
| 4 | `s04-forms-validation.spec.ts` | Programas | Asistente de 3 pasos, validaciones de cliente y de servidor (422), campos de fecha |
| 5 | `s05-tables-filters.spec.ts` | Programas | Paginación, orden, filtros, selección múltiple, CSV |
| 6 | `s06-modals-dnd.spec.ts` | Requisitos | Diálogos de confirmación, estados y permisos, drag & drop |
| 7 | `s07-files.spec.ts` | Verificación + Documentos | `setInputFiles`, descargas, `<iframe>`, pestaña nueva |
| 8 | `s08-api-testing.spec.ts` | Administración + Requisitos | `request`, códigos de estado, datos por API verificados en la UI |
| 9 | `s09-network-mocking.spec.ts` | Documentos | `page.route`: 403, 500, respuestas lentas y modificadas |
| 10 | `s10-waits-chaos.spec.ts` | Panel de misión | Esperas, `expect.poll`, WebSocket, modo caos, locators resilientes |
| 11 | `s11-visual-mobile.spec.ts` | Panel de misión + No conformidades | Capturas con máscara, emulación de iPhone 14 |

Lee primero la cabecera de cada spec: explica el ejercicio y qué se practica.

## Reglas para que 2 workers (y 2 shards) no se pisen

Todos los specs trabajan sobre **tu tenant a la vez**. Para que eso funcione sin reinicios entre medias:

1. **Cada spec toca datos distintos.** Los de solo lectura no modifican nada; los que escriben crean sus propias entidades con nombre único (`Date.now()`) y las borran al terminar, o restauran lo que cambian (`finally`).
2. **Cada test se prepara su estado** (por API, si hace falta) y puede repetirse sin reset: así los reintentos de CI son seguros.
3. **El reset va fuera de la suite** (`npm run reset`, o el job `prepare` del workflow). Si cada shard reiniciara el tenant, uno borraría los datos del otro a mitad de ejecución.
4. **El modo caos es de todo el tenant.** La sesión 10 lo enciende (latencia pequeña y textos variables) y lo apaga en un `finally`; el resto de specs usan locators que lo toleran, como `getByRole('button', { name: /^Guardar( cambios)?$/ })`. `npm run reset` también lo apaga si una ejecución se interrumpió.

Qué datos toca cada spec (si añades specs, mantén esta regla):

| Spec | Datos del tenant que toca |
| --- | --- |
| s02 | Solo crea una cuenta desechable (`bloqueo-<ts>@sigpro.lab`) para el bloqueo a 5 intentos |
| s03, s05, s09, s11 | Solo lectura (s05 supone que nadie crea programas «En pausa» ni toca `PRG-004`, `PRG-012` y `PRG-020`) |
| s04 | Programas que crea él mismo (nombre único) y borra al terminar |
| s06 | `REQ-016`, `REQ-017` y `REQ-019` de `PRG-002`; los deja como estaban |
| s07 | Añade ejecuciones y evidencias a un caso de prueba (`TC-008`): afirma «una más que antes», nunca totales |
| s08 | Requisitos nuevos en `PRG-001` (nombre único) que borra al terminar |
| s10 | El modo caos del tenant (lo apaga en `finally`) |

## Pruebas visuales (`@visual`)

Los tests con `toHaveScreenshot` comparan contra una **línea base que depende del sistema operativo**, así que van etiquetados `@visual` y no se incluyen en el zip. La primera vez genera las tuyas:

```bash
npx playwright test --grep @visual --update-snapshots
```

A partir de ahí `npm test` las compara. En el workflow de GitHub el parámetro `visual` elige entre `skip` (por defecto), `compare` y `update`.

## Sesión 12: CI con GitHub Actions

El workflow `.github/workflows/students-e2e.yml` es la plantilla. Hace tres cosas:

1. **`prepare`**: despierta la API de Render, restaura tu tenant y apaga el caos (una sola vez, antes de los shards).
2. **`e2e`**: corre la suite en 2 shards (`--shard=1/2` y `2/2`), cada uno en su job.
3. **`report`**: une los informes de los dos shards en **un único informe HTML** y lo publica como artefacto (`playwright-report-<tenant>`).

Para usarlo en tu repositorio:

1. Copia el contenido de esta carpeta a la raíz del repo (el workflow ya viene con `PROJECT_DIR: .` en el zip del `/lab`; en el monorepo de SIGPRO vale `examples`).
2. En GitHub: **Actions → Students E2E → Run workflow**, indica tu tenant (`alumno07`) y, si hace falta, las URLs.
3. Descarga el artefacto `playwright-report-alumno07`, descomprímelo y ábrelo con `npx playwright show-report <carpeta>`.

Parámetros del workflow: `tenants` (uno o varios, separados por comas: corre la suite una vez por tenant), `web_url`, `api_url` y `visual`. Para que corra en cada `push`, activa el bloque comentado `on: push` y define las variables de repositorio `SIGPRO_STUDENT`, `SIGPRO_WEB_URL` y `SIGPRO_API_URL`.

## Problemas frecuentes

| Síntoma | Causa y remedio |
| --- | --- |
| `Login de alumnoNN@sigpro.lab … 401` | El usuario no existe en ese tenant o `SIGPRO_STUDENT` está mal escrito (`alumno07`, no `alumno7`) |
| `Login … 423` | Cuenta bloqueada por 5 contraseñas incorrectas: `npm run reset` la desbloquea |
| `ECONNREFUSED` o *timeout* en `reset` | SIGPRO no está levantado (local) o la API de Render está despertando (reintenta) |
| Un test falla solo cuando otro alumno trabaja | No debería: cada alumno tiene su tenant. Revisa que `SIGPRO_STUDENT` sea el tuyo |
| «Guardar» no se encuentra a veces | Modo caos con textos variables: usa `/^Guardar( cambios)?$/` |
| Faltan líneas base de capturas | Ejecuta `npx playwright test --grep @visual --update-snapshots` una vez |
