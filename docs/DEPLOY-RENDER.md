# Despliegue de SIGPRO en Render

Guía paso a paso para publicar SIGPRO (API, web, base de datos y reset nocturno) desde el `render.yaml` de la raíz del repositorio. Última revisión: 2026-11-18.

> **Estado (2026-11-18):** QA está desplegado en Render, en Oregon: `sigpro-api` (Web Service Node, plan `starter`), `sigpro-web` (sitio estático), `sigpro-reset` (cron Node) y `sigpro-db` (PostgreSQL 18, `basic-256mb`). Los cuatro son «Blueprint managed» sobre `main`: **un push que toque `render.yaml` se aplica solo a QA.** No hay servicios de Staging creados. Los pasos 1 a 8 son el recorrido de la primera vez; lo que se añadió después para endurecer el despliegue del curso está en [Endurecimiento del despliegue del curso](#endurecimiento-del-despliegue-del-curso).

## Qué se despliega

| Recurso en Render | Tipo | Qué hace | Variables clave |
| --- | --- | --- | --- |
| `sigpro-db` | PostgreSQL (`basic-256mb`) | Base de datos de todos los tenants | — |
| `sigpro-api` | Web Service (Node 22, plan `starter`) | NestJS. Aplica migraciones al arrancar y siembra los tenants la primera vez | `DATABASE_URL`, `JWT_SECRET`, `ADMIN_KEY`, `CORS_ORIGIN`, `APP_ENV`, `SEED_*`, `DOCS_BASIC_AUTH` |
| `sigpro-web` | Static Site | React + Vite compilado. Reescribe `/*` a `/index.html` para el router | `VITE_API_URL`, `VITE_NOINDEX` y `VITE_LAB_PUBLIC` (se fijan **al compilar**) |
| `sigpro-reset` | Cron Job (`0 3 * * *`, hora UTC) | Reinicia el seed de todos los tenants cada noche | `API_URL`, `ADMIN_KEY` |

Los servicios no usan el plan gratuito a propósito: un Web Service gratuito se duerme y el primer request tarda hasta un minuto, inaceptable en clase. La base y el servicio de API son de pago; consulta <https://render.com/pricing> antes de crear el Blueprint.

## 1. Requisitos previos

- Cuenta de Render y una cuenta de GitHub (Render lee el repositorio desde GitHub, GitLab o Bitbucket).
- Node ≥ 22.13 y pnpm 11 en local, solo para la comprobación previa.
- Decidir el nombre del entorno (por ejemplo `isdefe` o `demo`). El plan prevé un entorno por cohorte.

## 2. Subir el repositorio a GitHub

Si `git remote -v` sale vacío, el repositorio solo existe en tu equipo y hay que publicarlo primero. Si ya tiene remoto en GitHub (el de este proyecto es `gsanchezm/sigpro`), salta al paso 3.

1. En GitHub, crea un repositorio vacío (sin README, sin `.gitignore`). Puede ser privado: al conectar Render con GitHub, concédele acceso a ese repositorio. Con la CLI de GitHub: `gh repo create <usuario>/sigpro --private --source=. --remote=origin --push`.
2. Si prefieres hacerlo a mano, conecta y sube:

   ```bash
   git remote add origin https://github.com/<usuario>/sigpro.git
   git push -u origin main
   ```
3. Comprobación previa en local (misma secuencia que el CI):

   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
4. Abre la pestaña **Actions** del repositorio y espera a que `ci.yml` termine en verde. Es su primera ejecución real: si falla ahí, mejor corregirlo antes de desplegar.

## 3. Ajustar `render.yaml` a tu entorno

Render asigna a cada servicio la URL `https://<nombre-del-servicio>.onrender.com`, y **el subdominio es único en todo Render**: si `sigpro-api` ya lo usa otra cuenta, Render añade un sufijo aleatorio y las URLs del fichero dejarían de ser correctas. Para evitarlo, pon un sufijo propio en los nombres **antes** del primer despliegue y mantén las URLs coherentes.

Con el sufijo `isdefe` (cámbialo por el tuyo), haz estos reemplazos en `render.yaml`:

| Buscar | Reemplazar por | Dónde aparece |
| --- | --- | --- |
| `sigpro-db` | `sigpro-isdefe-db` | `databases[].name` y `fromDatabase.name` |
| `sigpro-api` | `sigpro-isdefe-api` | nombre del servicio, `VITE_API_URL`, `API_URL` |
| `sigpro-web` | `sigpro-isdefe-web` | nombre del servicio y `CORS_ORIGIN` |
| `sigpro-reset` | `sigpro-isdefe-reset` | nombre del cron |

Resultado esperado en las tres URLs:

```yaml
# sigpro-isdefe-api
- key: CORS_ORIGIN
  value: https://sigpro-isdefe-web.onrender.com        # sin barra final
# sigpro-isdefe-web
- key: VITE_API_URL
  value: https://sigpro-isdefe-api.onrender.com/api     # termina en /api
# sigpro-isdefe-reset
- key: API_URL
  value: https://sigpro-isdefe-api.onrender.com/api
```

Otros valores que puedes cambiar ahora:

- `SEED_STUDENT_TENANTS` (25 por defecto, máximo 100): número de tenants `alumnoNN` además de `demo`.
- `APP_ENV`: `staging` muestra el panel de usuarios de prueba en la pantalla de acceso (lo que quiere el curso). Con `production` ese panel se oculta.
- Región: `render.yaml` declara `region: oregon` en la base, la API y el cron (el sitio estático no admite `region`). Es lo que ya hay en QA: **la región no se puede cambiar una vez creado el recurso**, así que cambiar el valor del archivo no mueve nada (y un valor distinto del real haría fallar la sincronización). Si para una cohorte nueva necesitas la UE (el plan lo deja como pregunta abierta para Isdefe), pon `region: frankfurt` en la base, la API y el cron **antes de crearla**. La API y la base **deben estar en la misma región** para usar la URL interna.

Haz commit y push de los cambios (`git commit -am "chore(deploy): cohort names in render.yaml" && git push`).

## 4. Preparar los secretos

`render.yaml` marca con `sync: false` las variables que no deben vivir en el repositorio: Render las pide al crear el Blueprint.

| Variable | Servicio | Cómo generarla |
| --- | --- | --- |
| `JWT_SECRET` | API | Aleatoria y larga (mínimo 8 caracteres; si no la defines, la API usaría `dev-only-change-me`) |
| `ADMIN_KEY` | API **y** cron | Aleatoria. **Debe ser el mismo valor en los dos** |
| `DOCS_BASIC_AUTH` | API | Opcional: `usuario:contraseña` para proteger `/api/docs`. Vacío = documentación abierta |

Para generar un secreto en cualquier sistema operativo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Guarda `ADMIN_KEY` en un gestor de contraseñas: la necesitarás para reinicios manuales.

## 5. Crear el Blueprint en Render

1. En el dashboard de Render: **New +** → **Blueprint**.
2. **Connect a repository** y elige el repositorio `sigpro` (instala o autoriza la app de GitHub si es la primera vez).
3. Selecciona la rama `main` e indica un nombre para el Blueprint (por ejemplo `sigpro-isdefe`).
4. Render lee `render.yaml` y lista lo que va a crear: base, API, web y cron. Comprueba que los cuatro aparecen.
5. Rellena las variables pedidas: `JWT_SECRET`, `ADMIN_KEY` y `DOCS_BASIC_AUTH` de la API, y `ADMIN_KEY` del cron (mismo valor).
6. Pulsa **Apply**.

Desde ese momento, los cambios de `render.yaml` en `main` se sincronizan con los servicios del Blueprint.

## 6. Qué ocurre en el primer despliegue

Render crea la base primero y el resto después. Tarda varios minutos (instala dependencias de todo el monorepo).

1. **API, build:** `corepack enable && pnpm install --frozen-lockfile && pnpm --filter api... build`. Compila `@sigpro/shared`, genera el cliente Prisma y compila Nest.
2. **API, arranque:** `pnpm --filter api prisma:deploy && pnpm --filter api start:prod`. Aplica la migración `init` y arranca Nest. Con `SEED_ON_BOOT=true` crea los tenants que falten (`demo` + `alumno01…25`) y no toca los existentes. Render da el servicio por bueno cuando `GET /api/health` responde 200.
3. **Web, build:** `pnpm --filter web... build` y publica `apps/web/dist`. `VITE_API_URL` se incrusta en el JavaScript en este momento.
4. **Cron:** queda programado a las 03:00 UTC. No ejecuta nada hasta entonces.

## 7. Verificación

Sustituye `<api>` y `<web>` por tus URLs. En PowerShell usa `curl.exe` en lugar de `curl`.

```bash
# 1) La API está viva
curl https://<api>.onrender.com/api/health
# → {"status":"ok","uptime":...}

# 2) El seed se aplicó y el entorno es el esperado
curl https://<api>.onrender.com/api/config/tenants     # lista demo, alumno01…  (con TENANT_SUFFIX_SEED o LAB_PUBLIC=false: 403 sin -H "x-admin-key: <ADMIN_KEY>")
curl https://<api>.onrender.com/api/config             # "env":"staging"

# 3) Login real (tenant demo)
curl -X POST https://<api>.onrender.com/api/auth/login \
  -H "Content-Type: application/json" -H "x-tenant: demo" \
  -d '{"email":"gestor@sigpro.test","password":"Gestor1234!"}'
```

En el navegador:

- `https://<web>.onrender.com`: pantalla de acceso con el panel de usuarios de prueba.
- `https://<web>.onrender.com/lab`: credenciales, reset y caos.
- Inicia sesión con `admin@sigpro.test` / `Admin1234!` (MFA `123456`) y abre **Programas**.
- Recarga la página estando en `/programs`: debe seguir funcionando (regla de reescritura).
- `https://<api>.onrender.com/api/docs`: Swagger (pide usuario y contraseña si definiste `DOCS_BASIC_AUTH`).

Prueba el reset global a mano (equivale a lo que hará el cron):

```bash
curl -X POST "https://<api>.onrender.com/api/admin/reset?all=true" -H "x-admin-key: <ADMIN_KEY>"
```

O desde el dashboard: servicio `sigpro-isdefe-reset` → **Trigger Run**, y revisa sus logs (una línea `✔ tenant (N ms)` por tenant).

Entrega a los alumnos: la URL de la web, `?tenant=alumnoNN` para cambiar de tenant (o el selector de `/lab`), y el usuario `alumnoNN@sigpro.lab` / `Alumno1234!`, que es administrador de su tenant. Con los tenants no adivinables (ver más abajo) el id lleva sufijo (`alumno07-k4x9`), el usuario es `<tenant>@sigpro.lab`, no hay selector de tenants en `/lab` y la lista se reparte con `pnpm tenants:list`.

## 8. Operación

| Tarea | Cómo |
| --- | --- |
| Desplegar cambios | `git push` a `main`. Los servicios se reconstruyen solos |
| Esperar al CI antes de desplegar | Servicio → **Settings** → **Build & Deploy** → **Auto-Deploy** → *After CI checks pass* |
| Cambiar una variable de la API | Servicio → **Environment**, guarda y Render redespliega |
| Cambiar `VITE_API_URL` | Servicio web → **Environment**, y luego **Manual Deploy** → *Clear build cache & deploy*: la variable se fija al compilar, no basta con reiniciar |
| Añadir más alumnos | Sube `SEED_STUDENT_TENANTS` (máx. 100) y redespliega la API: crea solo los tenants que faltan |
| Reiniciar los datos de un alumno | Desde `/lab` con el botón **Reiniciar datos** (exige haber iniciado sesión como admin del tenant), o `POST /api/admin/reset` con su sesión |
| Reiniciar todos los tenants | **Trigger Run** del cron, o `node scripts/reset-all.mjs` con `API_URL` y `ADMIN_KEY` |
| Ver logs | Servicio → pestaña **Logs** |

El seed es determinista, así que los datos de un tenant son siempre reproducibles: la base se puede considerar desechable.

## Actualizar a la fase 2

La fase 2 añade tablas y columnas (etiquetas y posición de requisitos, evidencias, versiones de documentos) con valores por defecto, así que la migración `phase2` se aplica sola con el `prisma migrate deploy` del comando de arranque de la API.

- **Re-siembra al arrancar:** los tenants con `seed_version` anterior a 2 se vuelven a sembrar (conservando su configuración de caos). Con 26 tenants son unos 5–10 s; los datos que los alumnos hubieran creado en la fase 1 se pierden, que es lo mismo que haría el reset nocturno.
- **Evidencias en la base:** los archivos (PNG, JPEG o PDF, ≤ 2 MB, hasta 5 por ejecución) se guardan en PostgreSQL; el disco de Render es efímero. El reset nocturno las borra con el resto de datos del tenant.
- **`DOCS_BASIC_AUTH`** protege ahora también `/api/docs-json`. El spec `api-docs.spec.ts` lee las credenciales de `E2E_DOCS_AUTH` (`usuario:contraseña`); para probar Render, ponlo al valor que hayas definido allí. El valor por defecto del spec (`curso:docs-2026`) es solo para la API local de pruebas: no lo uses en producción.
- **Comprobación rápida:** `https://<api>.onrender.com/api/health` y, con sesión de admin, `GET /api/audit` debe devolver 130 eventos en un tenant recién sembrado.

## Actualizar a la fase 3

La fase 3 añade `Milestone.progress`, `NonConformity.created_at` y la tabla `nc_comments`, todo con valores por defecto: la migración `phase3` se aplica sola con el `prisma migrate deploy` del comando de arranque de la API.

- **Re-siembra al arrancar:** los tenants con `seed_version` anterior a 3 se vuelven a sembrar (conservando el caos). Los cambios que los alumnos hubieran hecho en la fase 2 se pierden, igual que con el reset nocturno.
- **Tiempo real (Socket.IO):** la web abre un WebSocket contra el origen de `VITE_API_URL` (sin `/api`), en la ruta `/socket.io`. Render lo admite en los Web Services sin configuración extra; `CORS_ORIGIN` también gobierna el handshake de Socket.IO. Si pones otro proxy delante de la API, debe dejar pasar el *upgrade* a WebSocket.
- **Variables nuevas** (ya en `render.yaml`): `PLANTED_BUGS` (`true` por defecto: los 8 defectos del ejercicio de reporte; `false` deja la aplicación limpia) y `SIMULATOR_MS` (`4000`: intervalo del simulador del panel de misión; `0` lo desactiva). El simulador solo emite a los tenants con algún cliente conectado y nunca escribe en la base.
- **`docs/planted-bugs.md` no está en el repositorio** (es público): consérvalo en privado. `/api/config` solo expone `plantedBugs: true|false`.
- **Comprobación rápida:** `GET /api/config` (cabecera `x-tenant`) devuelve `plantedBugs`; con sesión, `GET /api/mission/summary` devuelve los KPIs (8 NC abiertas en un tenant recién sembrado) y el panel `/mission` muestra «En vivo».

## Actualizar a la fase 4

La fase 4 no cambia el modelo de datos ni añade variables a la API: no hay migración nueva ni re-siembra.

- **La web** genera `sigpro-examples.zip` (el proyecto de `examples/`, con el workflow de alumnos y la guía) durante `pnpm --filter web build`, que ya es el comando de build de `sigpro-web`: **el repositorio completo debe estar disponible en el build** (lo está: `rootDir: .`). El enlace de `/lab` apunta a `/downloads/sigpro-examples.zip`, que Render sirve como archivo estático antes del *rewrite* a `index.html`.
- **Swagger desde `/lab`:** el enlace se deriva de `VITE_API_URL` (`https://sigpro-api.onrender.com/api/docs`), no de la web.
- **La app móvil no se hospeda en Render.** Se usa con Expo Go o con la build para emuladores (`docs/MOBILE-EMULADORES.md`); solo necesita `EXPO_PUBLIC_API_URL`. Su versión web local (`:8081`) necesita ese origen en `CORS_ORIGIN` de la API de desarrollo (ya viene en `.env.example`); en Render basta con el origen de la web.
- **El workflow `students-e2e.yml`** corre contra estas URL por tenant; despierta la API (`/api/health`) antes de la suite y no necesita `ADMIN_KEY` (los alumnos reinician su tenant con su propio usuario `alumnoNN@sigpro.lab`). Ejecútalo una vez desde **Actions** tras desplegar para comprobar el informe unido de los dos shards.

## 9. Rollback

- **Código:** servicio → **Events** (o **Deploys**) → elige un despliegue anterior correcto → **Rollback**. Aplica a la API y a la web.
- **Esquema de base de datos:** `prisma migrate deploy` solo aplica migraciones hacia adelante y un rollback de código **no** las deshace. Si una migración nueva sale mal, corrígela con otra migración posterior.
- **Datos:** restaura el seed con el reset global; no hace falta restaurar copias.

## Endurecimiento del despliegue del curso

Cool Testers e Isdefe piden endurecer los despliegues del curso. **Todo se activa por variables de entorno: sin ellas, la API y la web se comportan exactamente como en el entorno demo público de siempre** (los specs existentes de `e2e/` pasan sin editarse y `e2e/tests/hardening-defaults.spec.ts` lo comprueba de forma explícita).

### Qué se aplica, dónde y cuándo

| Capa | Qué | Cuándo se aplica |
| --- | --- | --- |
| `render.yaml` (archivo) | `region: oregon` y planes explícitos; cabecera `X-Robots-Tag` del sitio estático; `ROBOTS_NOINDEX` y `VITE_NOINDEX` | **Al fusionar en `main`**, solo a QA (Blueprint managed) |
| Variables de la API (de **ejecución**) | Tenants con sufijo, laboratorio cerrado, correos ficticios | Al guardar la variable en el panel: Render redespliega la API |
| Variable de la web (de **compilación**) | `VITE_LAB_PUBLIC` | Hay que reconstruir la web: **Manual Deploy → Clear build cache & deploy** (reiniciar no basta) |

Un sitio estático no puede esconder nada que viaje en su JavaScript ni pedir sesión para servir un archivo. Por eso el cierre del laboratorio tiene **dos** variables con papeles distintos: `LAB_PUBLIC` (API, ejecución) decide qué datos sirve y a quién; `VITE_LAB_PUBLIC` (web, compilación) quita del JavaScript publicado los textos con credenciales de demo y no publica el zip del material. Hay que poner las dos.

### Variables del endurecimiento

| Variable | Servicio | Tipo | Por defecto | Qué hace |
| --- | --- | --- | --- | --- |
| `TENANT_SUFFIX_SEED` | API | ejecución, **secreto** | vacía (sin sufijos) | Semilla (≥ 16 caracteres) para que cada tenant de alumno lleve un sufijo estable: `alumno07-k4x9`. `demo` no lo lleva |
| `TENANT_SUFFIX_LENGTH` | API | ejecución | `4` | Caracteres del sufijo, de 3 a 12 |
| `LAB_PUBLIC` | API | ejecución | `true` | `false`: `/config/test-users` solo con sesión o `X-Admin-Key`; `/config` anuncia `testUsers: false`; `/config/tenants` exige `X-Admin-Key` |
| `RESTRICT_EMAIL_DOMAINS` | API | ejecución | `false` | `true`: `/auth/register`, `/auth/forgot` y `/auth/resend` responden 422 a cualquier correo de otro dominio |
| `ALLOWED_EMAIL_DOMAINS` | API | ejecución | `sigpro.test,example.com` | Dominios admitidos con lo anterior. Coincidencia **exacta**: `mail.example.com` no vale |
| `ROBOTS_NOINDEX` | API | ejecución | `false` | `X-Robots-Tag: noindex, nofollow` en todas las respuestas y `/robots.txt` con `Disallow: /`. `render.yaml` lo pone a `true` |
| `VITE_LAB_PUBLIC` | Web | **compilación** | `true` | `false`: `/lab` exige sesión; sin lista de tenants, sin la contraseña del alumno y sin el zip del material; los textos que citan el código MFA y los correos de prueba desaparecen del JavaScript |
| `VITE_NOINDEX` | Web | **compilación** | `false` | `true`: genera `robots.txt` con `Disallow: /` y `<meta name="robots" content="noindex, nofollow">`. `render.yaml` lo pone a `true` |

La semilla y las claves nunca se imprimen: si `TENANT_SUFFIX_SEED` es demasiado corta la API **no arranca** y el log dice qué variable falla, no su valor (revísalo en **Logs** tras guardar la variable).

### Qué poner a mano en el panel (QA)

Solo cuando decidas activar el endurecimiento; el archivo no lo hace por ti.

| Servicio | Variable | Valor |
| --- | --- | --- |
| `sigpro-api` | `TENANT_SUFFIX_SEED` | Una cadena aleatoria y larga (`node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`). **Guárdala en un gestor de contraseñas: si se pierde o cambia, todos los ids cambian.** |
| `sigpro-api` | `TENANT_SUFFIX_LENGTH` | Opcional (4 por defecto). **Decídela antes de la primera activación**: cambiarla (o cambiar la semilla) después deja tenants huérfanos (ver [Tenants no adivinables](#tenants-no-adivinables)). `6` si te preocupa que se adivinen (ver [Riesgos que quedan](#riesgos-que-quedan)) |
| `sigpro-api` | `LAB_PUBLIC` | `false` |
| `sigpro-api` | `RESTRICT_EMAIL_DOMAINS` | `true` |
| `sigpro-api` | `ALLOWED_EMAIL_DOMAINS` | Solo si quieres otros dominios distintos de `sigpro.test,example.com` |
| `sigpro-web` | `VITE_LAB_PUBLIC` | `false`, y luego **Clear build cache & deploy** |

El cron `sigpro-reset` no necesita ninguna variable nueva. **Staging**: las mismas, con otra `TENANT_SUFFIX_SEED`; además lo que Render pide al crear el Blueprint (ver [Crear Staging](#crear-staging)).

### Orden seguro

1. **Antes de fusionar:** comprueba en el panel que `JWT_SECRET` y `ADMIN_KEY` (en la API **y** en el cron) tienen valores propios. Si faltaran, la API usaría los de desarrollo, que son públicos (están en el repositorio). No hay que poner nada más antes: el código antiguo ignora las variables que no conoce.
2. **Fusionar en `main`.** Render sincroniza el Blueprint (región y planes ya coinciden con los reales, cabeceras, `ROBOTS_NOINDEX` y `VITE_NOINDEX`; **no crea ni borra ningún servicio**) y, como `render.yaml` no fija `autoDeploy` ni `buildFilter`, es probable que API y web se reconstruyan con el código nuevo. Sin variables nuevas todo sigue igual que hoy, salvo que ya no se indexa.
3. **Activar el endurecimiento de la API:** `TENANT_SUFFIX_SEED`, `LAB_PUBLIC=false`, `RESTRICT_EMAIL_DOMAINS=true`. Al guardar, Render redespliega la API y, con `SEED_ON_BOOT=true`, **crea los tenants nuevos al arrancar**.
4. **Activar el de la web:** `VITE_LAB_PUBLIC=false` y *Clear build cache & deploy*.
5. **Repartir los ids** (`pnpm tenants:list`) y **purgar los antiguos** (`pnpm tenants:purge-legacy`), como se explica abajo.
6. **Comprobar** (ver [Comprobaciones](#comprobaciones)).

### Tenants no adivinables

El sufijo es la HMAC-SHA256 de la semilla y del id (`alumno07`) en base 36: **no se guarda en ningún sitio**, así que es el mismo tras un redeploy, un reseed, cada ejecución de `sigpro-reset` e incluso si se recrea la base (con la misma semilla). Los alumnos lo guardan en su `.env` el primer día y vale todo el curso. El usuario de cada alumno sigue derivándose del id: `alumno07-k4x9@sigpro.lab` (misma contraseña pública de siempre).

Qué deja de ser público: `GET /api/config/tenants` responde 403 sin `X-Admin-Key` (una sesión de alumno tampoco basta), el selector de tenants de `/lab` desaparece, el log de arranque de la API solo dice cuántos tenants sembró y el log del cron imprime `alumno07-****`.

**Imprimir la lista para repartirla** (no toca la base de datos; solo necesita la semilla y `SEED_STUDENT_TENANTS`, y usa el mismo algoritmo que la API):

```bash
# En local, con los mismos valores que la API de Render
TENANT_SUFFIX_SEED='<la semilla>' SEED_STUDENT_TENANTS=25 pnpm tenants:list --web-url=https://<web>.onrender.com
# En CSV, para pegarlo en una hoja de cálculo
TENANT_SUFFIX_SEED='<la semilla>' SEED_STUDENT_TENANTS=25 pnpm tenants:list --csv --web-url=https://<web>.onrender.com > tenants.csv
```

También puede ejecutarse en la **Shell** del servicio `sigpro-api` (ahí las variables ya están definidas). Los comandos de este apartado funcionan de dos formas: `pnpm --filter api tenants:list` (usa `tsx`, una dependencia de desarrollo) o, **sin `tsx`**, con Node sobre lo que compila el build: `node apps/api/dist/seed/tenants-cli.js` y `node apps/api/dist/seed/purge-legacy-cli.js [--confirm]`, desde la raíz del repositorio. La segunda forma está comprobada en local; **ninguna de las dos se ha probado dentro de la Shell de Render**.

**Aplicarlo a la base actual de QA sin recrearla.** Al activar la semilla, la API crea los tenants nuevos (`alumno01-xxxx…`) y **no toca los antiguos** (`alumno01…alumno25`): siguen en la base, siguen entrando con la contraseña pública y el reset nocturno ya no los reinicia (recorre solo la lista vigente). Hay que borrarlos de forma explícita; nunca se borran solos. En la Shell de `sigpro-api`:

```bash
pnpm --filter api tenants:purge-legacy             # simulación: lista lo que borraría
pnpm --filter api tenants:purge-legacy --confirm   # los borra, con todos sus datos (irreversible; el seed es determinista)
```

El comando **se niega a borrar nada** si no hay `TENANT_SUFFIX_SEED` o si aún falta algún tenant nuevo en la base (arranca antes la API con la semilla), para no dejar a los alumnos sin entorno.

> **Decide la semilla y la longitud ANTES de repartir los ids, y no las cambies después.** Si cambia `TENANT_SUFFIX_SEED` o `TENANT_SUFFIX_LENGTH`, la API crea otros tenants nuevos y los anteriores (`alumno07-k4x9`) **quedan en la base**: siguen siendo accesibles, el reset nocturno ya no los reinicia y `tenants:purge-legacy` no los toca, porque solo reconoce los `alumnoNN` sin sufijo. No hay un comando para eso (queda pendiente); habría que borrarlos a mano. Cambiar la semilla invalida además los ids que los alumnos ya guardaron en su `.env`.

**Qué pasa con `alumno25`** (el tenant de validación del material): recibe un id nuevo como los demás (`alumno25-xxxx`) y el antiguo desaparece con la purga. Tras el cambio hay que actualizar donde se use: el `.env` del material (`SIGPRO_TENANT`, `SIGPRO_STUDENT`), los scripts de validación y cualquier URL con `?tenant=alumno25`. Si prefieres seguir validando con un id fijo, usa `demo`, que no cambia (es público y de solo lectura por convención).

### Registro solo con correos ficticios

Con `RESTRICT_EMAIL_DOMAINS=true`, `POST /api/auth/register`, `/api/auth/forgot` y `/api/auth/resend` responden **422** con `code: email_domain_not_allowed` y `errors: { email: 'emailDomain' }` a cualquier correo cuyo dominio no sea exactamente uno de los permitidos. La comprobación se hace **antes de leer o escribir nada** y la respuesta no repite la dirección, así que un correo real no llega a la base de datos, a la auditoría ni a los logs. La interfaz lo pinta junto al campo de correo: «En este entorno solo se admiten correos ficticios (por ejemplo, nombre@example.com).» `login` no se restringe.

### `/lab` y credenciales de demo

Con `LAB_PUBLIC=false` (API) y `VITE_LAB_PUBLIC=false` (web):

- `/lab` sin sesión redirige a `/login`; la pantalla de acceso no muestra el panel de usuarios de prueba.
- Con sesión, `/lab` sigue mostrando credenciales (que llegan de la API con el bearer), reinicio y caos; no muestra la lista de tenants, ni la línea con la contraseña del alumno, ni el enlace al zip del material.
- El zip del material (`downloads/sigpro-examples.zip`, que lleva la guía con las credenciales) **no se genera y se borra el anterior**: lo recibe cada alumno del instructor.
- Los textos que citan el código MFA y los correos de prueba (FAQ, ayuda, pista del registro) quedan neutros y **sus originales desaparecen del JavaScript**.

Si solo se pone `LAB_PUBLIC=false` en la API y no se recompila la web, la API deja de servir credenciales y lista de tenants, pero el JavaScript publicado sigue llevando los textos: hacen falta las dos.

### Sin indexar

`render.yaml` aplica `X-Robots-Tag: noindex, nofollow` al sitio estático y la API lo añade a todas sus respuestas (también a Swagger y a los errores) y sirve `/robots.txt` con `Disallow: /`. La web genera además su propio `robots.txt` y la meta `robots` al compilar. Según la documentación de Render, la reescritura `/* → /index.html` no se aplica a una ruta en la que ya existe un archivo, de modo que `/robots.txt` se sirve tal cual; **no se ha comprobado contra un despliegue real**: tras el primer despliegue, abre `https://<web>.onrender.com/robots.txt`.

### Comprobaciones

```bash
# Sin sesión debe dar 403 y con la clave, la lista
curl -i https://<api>.onrender.com/api/config/tenants
curl -i https://<api>.onrender.com/api/config/tenants -H "x-admin-key: <ADMIN_KEY>"
# Anónimo: lista vacía
curl https://<api>.onrender.com/api/config/test-users
# 422 a un correo real
curl -i -X POST https://<api>.onrender.com/api/auth/forgot -H "content-type: application/json" -d '{"email":"nombre@gmail.com"}'
# Cabecera y robots
curl -I https://<api>.onrender.com/api/health | grep -i x-robots-tag
curl https://<web>.onrender.com/robots.txt
```

**Que lo oculto no viaja en la web publicada** se comprueba sobre los archivos, no sobre la página. Compila la web como lo hará Render y pasa el comprobador:

```bash
cd apps/web
VITE_LAB_PUBLIC=false VITE_NOINDEX=true node scripts/zip-examples.mjs      # borra el zip anterior
VITE_LAB_PUBLIC=false VITE_NOINDEX=true pnpm exec vite build --outDir dist-closed
cd ../.. && pnpm check:bundle apps/web/dist-closed --closed --noindex
```

Busca en todos los archivos de `dist/` las contraseñas, los correos de demo y el código MFA **leídos del propio seed de la API** (si cambian, el comprobador los sigue), el correo del alumno y cualquier zip publicado. Sale con código 1 y dice qué archivo contiene qué. No lo ejecutes a través de `turbo`: la caché de Turborepo restauraría un `dist` compilado con otras variables.

### Crear Staging

Staging **no está en `render.yaml`**: añadir allí sus servicios los crearía (de pago) al fusionar. Va en `render.staging.yaml`, un segundo Blueprint:

1. Render → **New +** → **Blueprint** → repositorio `sigpro`, rama `main`.
2. En **Blueprint Path** escribe `render.staging.yaml` (por defecto lee `render.yaml`, que es el de QA: no lo dejes así).
3. Render lista lo que va a crear: `sigpro-staging-db`, `sigpro-staging-api`, `sigpro-staging-web` y `sigpro-staging-reset`. Comprueba que son cuatro y que ninguno es de QA.
4. Rellena lo que pide (`sync: false`): `JWT_SECRET` y `ADMIN_KEY` de la API, `DOCS_BASIC_AUTH` (puede ir vacío) y `ADMIN_KEY` del cron (**igual** que la de la API). No reutilices los valores de QA.
5. **Apply.** Después, las variables de endurecimiento a mano, con otra `TENANT_SUFFIX_SEED`.

**La región se fija en el archivo**, con `region: oregon` en la base, la API y el cron (la misma que QA), y **no se puede cambiar una vez creados**. Staging usa `APP_ENV=staging` y `PLANTED_BUGS=false`. Las URLs `sigpro-staging-*.onrender.com` son únicas en todo Render: si alguna está ocupada, copia la real en `CORS_ORIGIN`, `VITE_API_URL` y `API_URL` y redespliega la web.

> **Decisión pendiente: `APP_ENV`.** QA ya declara `APP_ENV=staging` (`render.yaml`). Con Staging también en `staging`, `GET /api/config` no distingue un entorno de otro. No se ha cambiado QA a `qa` porque el material del curso lee ese valor («Entorno: staging»); ver `docs/DECISIONS.md`.

### Riesgos que quedan

- **Hay un oráculo de existencia de tenant:** el login responde 404 `tenant_not_found` si el tenant no existe y 401 si existe con otro correo (el registro igual). Sin límite de peticiones, un atacante puede probar sufijos. Con 4 caracteres hay 36⁴ ≈ 1,7 millones por cada `alumnoNN`; con 6, unos 2.200 millones. Si te preocupa, decide `TENANT_SUFFIX_LENGTH=6` **antes de la primera activación** (cambiarla después deja tenants huérfanos). No se han cambiado esos mensajes.
- **El repositorio es público:** las credenciales de demo, `Alumno1234!` (la misma contraseña para el administrador de **todos** los tenants) y la guía están en GitHub. Ocultarlas de la web no las vuelve secretas: lo que protege a un tenant de alumno es que su id sea un secreto.
- **`demo` sigue siendo público** (es el entorno demo): sus credenciales funcionan para cualquiera.
- **`JWT_SECRET` y `ADMIN_KEY` por defecto** (`dev-only-change-me`, `dev-admin-key`) son públicos: si el panel no define los suyos, cualquiera puede firmar un JWT o llamar al reset global. Comprueba que están definidos.
- **Logs de acceso de Render:** muestran las URLs que se piden, incluida la web con `?tenant=<id>`. Los ve quien tenga acceso al panel.
- **Los alumnos ven su propio id** en la barra de direcciones y en su `.env`: si se lo pasan, comparten tenant.

## Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
| --- | --- | --- |
| El build falla con `nest: not found`, `tsc: not found` o `vite: not found`, o el arranque con `prisma: not found` | Render instaló solo las dependencias de producción y `@nestjs/cli`, `typescript`, `prisma` y las de Vite son `devDependencies`. **Es el punto sin probar más probable** | En `buildCommand` de la API y de la web, cambia `pnpm install --frozen-lockfile` por `pnpm install --frozen-lockfile --prod=false` y haz push |
| `Configuración de entorno inválida → JWT_SECRET: …` en los logs | `JWT_SECRET` tiene menos de 8 caracteres | Define uno más largo en **Environment** |
| La web carga pero el login dice «No se pudo contactar con el servidor» y la consola muestra un error CORS | `CORS_ORIGIN` no coincide exactamente con la URL de la web (esquema `https`, sin barra final, nombre real con sufijo si Render lo añadió) | Corrige `CORS_ORIGIN` en la API. Admite varios orígenes separados por comas |
| La web llama a `/api/...` de su propio dominio y devuelve 404 | `VITE_API_URL` faltaba o era incorrecta cuando se compiló | Corrígela y haz *Clear build cache & deploy* en la web |
| Al recargar `/programs` aparece 404 | Falta la regla de reescritura | Comprueba que `routes` con `rewrite /* → /index.html` sigue en `render.yaml` |
| `P1001: Can't reach database server` al arrancar | API y base en regiones distintas, o `DATABASE_URL` sustituida a mano | Deja `fromDatabase` en `render.yaml` y pon ambos en la misma región |
| El despliegue de la API se queda en «Deploying» y acaba por fallar el health check | La API no arranca; el primer arranque además siembra 26 tenants | Revisa **Logs**: busca el error de arranque o de migración |
| El cron termina con `Reset global falló: 401` o `403` | `ADMIN_KEY` del cron distinta de la de la API | Pon el mismo valor en ambos servicios |
| El cron termina con `No se pudo contactar con la API` | `API_URL` mal escrita | Debe terminar en `/api` |
| No aparece el panel de usuarios de prueba | `APP_ENV=production` | Usa `staging` para el entorno del curso |
| Tras desplegar sigues viendo la versión anterior de la web | La PWA tiene la versión antigua en caché | Recarga forzada (`Ctrl+Shift+R`) o borra los datos del sitio |
| La URL de la API/web tiene un sufijo que no esperabas | El nombre del servicio estaba ocupado | Copia la URL real del dashboard y actualiza `CORS_ORIGIN`, `VITE_API_URL` y `API_URL`; después redespliega la web |
| `Configuración de entorno inválida → TENANT_SUFFIX_SEED: debe tener al menos 16 caracteres` y la API no arranca | La semilla es demasiado corta | Pon una de 16 o más caracteres (o vacía, para desactivarla) |
| Un alumno recibe 404 `tenant_not_found` tras activar los sufijos | Usa el id antiguo (`alumno07`) | Dale su id nuevo (`pnpm tenants:list`) |
| `GET /api/config/tenants` responde 403 `admin_key_required` | `TENANT_SUFFIX_SEED` o `LAB_PUBLIC=false` activos: la lista exige clave | Añade `-H "x-admin-key: <ADMIN_KEY>"`; es lo esperado |
| `/lab` redirige a `/login` | La web se compiló con `VITE_LAB_PUBLIC=false` | Es lo esperado: entra con una cuenta y abre `/lab` |
| Pusiste `VITE_LAB_PUBLIC=false` y la web no cambia | Es una variable de compilación | **Manual Deploy → Clear build cache & deploy** |
| Registrarse o recuperar la contraseña da «solo se admiten correos ficticios» | `RESTRICT_EMAIL_DOMAINS=true` | Usa un correo `@example.com` o `@sigpro.test` (o añade el dominio a `ALLOWED_EMAIL_DOMAINS`) |
| `tenants:purge-legacy` dice «Faltan N tenant(s) nuevos» | La API aún no ha arrancado con la semilla | Redespliega la API con `TENANT_SUFFIX_SEED` y `SEED_ON_BOOT=true` y repite |

## Referencia de variables de la API

| Variable | Valor en `render.yaml` | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | `fromDatabase` (cadena de conexión de `sigpro-db`) | Obligatoria |
| `PORT` | la inyecta Render | La API escucha en `0.0.0.0:$PORT` (3000 por defecto en local) |
| `JWT_SECRET` | `sync: false` | Firma de los JWT; mínimo 8 caracteres |
| `ADMIN_KEY` | `sync: false` | Valor de la cabecera `x-admin-key` para `/api/admin/*` |
| `CORS_ORIGIN` | URL de la web | Uno o varios orígenes separados por comas |
| `APP_ENV` | `staging` | `production` oculta el panel de usuarios de prueba |
| `SEED_ON_BOOT` | `true` | Crea los tenants que falten al arrancar |
| `SEED_STUDENT_TENANTS` | `25` | Tenants `alumnoNN`, de 0 a 100 |
| `DOCS_BASIC_AUTH` | `sync: false` | `usuario:contraseña` para `/api/docs`; vacío = sin protección |
| `NODE_VERSION` | `22` | `pnpm@11` exige Node ≥ 22.13 (ver `docs/DECISIONS.md`) |
| `ROBOTS_NOINDEX` | `'true'` | Cabecera `X-Robots-Tag: noindex, nofollow` en todas las respuestas y `/robots.txt` con Disallow total (por defecto del código: `false`) |
| `TENANT_SUFFIX_SEED`, `TENANT_SUFFIX_LENGTH`, `LAB_PUBLIC`, `RESTRICT_EMAIL_DOMAINS`, `ALLOWED_EMAIL_DOMAINS` | no se declaran: **a mano en el panel** | Endurecimiento; ver [la tabla](#variables-del-endurecimiento) |

Consulta también el [README](../README.md) para el arranque local y [`docs/STATUS.md`](STATUS.md) para el estado de la construcción.
