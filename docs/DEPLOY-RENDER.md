# Despliegue de SIGPRO en Render

Guía paso a paso para publicar SIGPRO (API, web, base de datos y reset nocturno) desde el `render.yaml` de la raíz del repositorio. Última revisión: 2026-11-06.

> **Estado:** el `render.yaml` está escrito y validado en local (build de producción, `CI=true pnpm e2e` en verde), pero **no se ha desplegado nunca en Render**. Los puntos que más probablemente den guerra en el primer despliegue están en [Problemas frecuentes](#problemas-frecuentes).

## Qué se despliega

| Recurso en Render | Tipo | Qué hace | Variables clave |
| --- | --- | --- | --- |
| `sigpro-db` | PostgreSQL (`basic-256mb`) | Base de datos de todos los tenants | — |
| `sigpro-api` | Web Service (Node 22, plan `starter`) | NestJS. Aplica migraciones al arrancar y siembra los tenants la primera vez | `DATABASE_URL`, `JWT_SECRET`, `ADMIN_KEY`, `CORS_ORIGIN`, `APP_ENV`, `SEED_*`, `DOCS_BASIC_AUTH` |
| `sigpro-web` | Static Site | React + Vite compilado. Reescribe `/*` a `/index.html` para el router | `VITE_API_URL` (se fija **al compilar**) |
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
- Región: el fichero no fija ninguna, así que Render usa la suya por defecto. Si necesitas la UE (el plan lo deja como pregunta abierta para Isdefe), añade `region: frankfurt` a la base y a la API y al cron. La API y la base **deben estar en la misma región** para usar la URL interna.

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
curl https://<api>.onrender.com/api/config/tenants     # lista demo, alumno01…
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

Entrega a los alumnos: la URL de la web, `?tenant=alumnoNN` para cambiar de tenant (o el selector de `/lab`), y el usuario `alumnoNN@sigpro.lab` / `Alumno1234!`, que es administrador de su tenant.

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

## 9. Rollback

- **Código:** servicio → **Events** (o **Deploys**) → elige un despliegue anterior correcto → **Rollback**. Aplica a la API y a la web.
- **Esquema de base de datos:** `prisma migrate deploy` solo aplica migraciones hacia adelante y un rollback de código **no** las deshace. Si una migración nueva sale mal, corrígela con otra migración posterior.
- **Datos:** restaura el seed con el reset global; no hace falta restaurar copias.

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

Consulta también el [README](../README.md) para el arranque local y [`docs/STATUS.md`](STATUS.md) para el estado de la construcción.
