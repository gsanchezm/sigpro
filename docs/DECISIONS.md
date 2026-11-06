# SIGPRO — Decisiones

Una línea de decisión + una de justificación. Si el plan y el handoff se contradicen, gana el handoff en lo visual y el plan en lo funcional.

## Fuentes y contradicciones

- **Ruta del handoff:** `docs/design-handoff/` (nombre de CLAUDE.md), antes `design_handoff_sigpro/`. *CLAUDE.md y el prompt de la fase lo citan con ese nombre.*
- **Autocierre de toast:** 3 s, no 4.5 s. *Es comportamiento (funcional): gana el plan y CLAUDE.md; el handoff solo prototipaba 4.5 s.*
- **Ids de toast:** `toast-{ok|danger|info|warn}` (testids.ts), no `toast-success`/`toast-error` del plan. *testids.ts es la fuente de verdad y no se renombra.*
- **Seed de programas:** 24 por tenant (los del prototipo, fórmula determinista), no 3. *Programas exige paginación de 10 y "Página x de y"; con 3 filas no se podría probar.*
- **Responsables = usuarios:** los 6 `OWNERS` de Programas son los 6 `USERS` de Acceso (Marta Ruiz … Pablo Serrano). *El handoff los reutiliza; modelamos `owner_id → User`.*
- **Número de entidades:** 11 de la tabla del plan + `Contract` (N:M Program↔Supplier) + `RequirementTestCase` (N:M). *El texto del plan dice "nueve" pero la tabla lista once y nombra `Contract`.*
- **`Risk`:** fuera de fase 1. *Se menciona en el plan pero no está en la tabla de entidades ni en ningún módulo.*
- **Progreso del programa:** derivado de hitos (`done/total`), no columna. *Coherencia del modelo; el seed elige el nº de hitos para aproximar el % del prototipo.*
- **Avatares y logo:** `<img alt>` con SVG data-URI (iniciales), no `<div>`. *Regla de testabilidad (`getByAltText`); mismo aspecto visual.*
- **Traza del overlay de redirección:** muestra el endpoint real (`POST /api/auth/login → 200 · role=…`), no `/api/auth/session`. *El mock no tenía API; ahora hay una real.*

## Stack y versiones

- **Versiones fijadas** (aunque haya majors más nuevos): Nest 11, Prisma 6, Vite 7, React 18.3, React Router 6, Tailwind 4, Vitest 3, Zod 3, TypeScript 5.9, ESLint 9. *Son las que conozco bien y coinciden con el plan (React 18); Prisma 7 cambia la configuración del datasource.*
- **Nombres de paquete:** `api`, `web`, `@sigpro/shared`, `@sigpro/e2e`. *El `render.yaml` del plan usa `pnpm --filter api` y `--filter web`.*
- **`packages/shared` se compila con tsup (CJS + ESM + d.ts).** *La API (CJS) y la web (ESM) lo consumen igual; Turborepo ordena con `dependsOn: ["^build"]`.*
- **Node 22 en CI y Render** (`.nvmrc` = 22, `engines >=22.13`), en lugar del 20 de CLAUDE.md. *`pnpm@11` exige Node ≥ 22.13 y Node 20 salió de soporte en abril de 2026; el código no usa nada propio de 22 (Vite 7 pide ≥ 20.19, Nest ≥ 20). Si hubiera que volver a 20 bastaría con fijar pnpm 10.* El entorno local usa Node 24.
- **Contraseñas con `bcryptjs`.** *JS puro: sin compilación nativa en Windows ni en Render; el hash de cada contraseña de demo se calcula una vez por proceso y se reutiliza (reset < 2 s).*
- **Tests:** Vitest para lo puro (Zod, permisos, seed, caos, i18n) en todos los paquetes; la API y la UI se verifican con Playwright (`e2e/`). *El curso es de Playwright: las suites de la API también usan `request`.*
- **ESLint:** prohíbe `switch`, `any` y `data-testid="…"` literal en JSX. *Convierte en regla automática lo que CLAUDE.md pide en code review.*

## Autenticación y multi-tenant

- **Tenant en el login:** header `x-tenant` (por defecto `demo`); la web lo toma de `VITE_TENANT` o `?tenant=`. *Los emails de demo (`admin@sigpro.test`) existen en cada tenant, así que email+contraseña no identifica el tenant.*
- **Tenants:** `demo` + `alumno01…alumnoNN` con `SEED_STUDENT_TENANTS` (25 por defecto). Cada alumno tiene además `alumnoNN@sigpro.lab` (admin).
- **MFA en dos pasos:** `POST /auth/login` devuelve `mfaRequired` + token temporal; `POST /auth/mfa` lo canjea. *Permite enseñar el flujo y `storageState` tras el segundo paso.*
- **Sesión:** access JWT corto + refresh token; el refresh se guarda en `localStorage` solo si "Mantener la sesión" está marcado, si no en `sessionStorage`. *Enseña reuse de sesión con `storageState`.*
- **Bloqueo:** 5.º intento fallido → 423. `bloqueado@sigpro.test` nace bloqueado; `pendiente@sigpro.test` devuelve 403.
- **`flakyLabels` del caos** solo se almacena y se expone en fase 1; la web lo consume en la fase 3.

## Modelo de datos y API

- **Claves primarias compuestas `(tenant_id, …)` y claves foráneas que incluyen el tenant.** *La propia base impide cruzar datos entre alumnos; borrar el tenant limpia todo por cascada, de ahí el reset en ~120 ms.*
- **Códigos como clave natural:** `Program.code`, `Requirement.code`, `TestCase.code`, `NonConformity.code` forman parte de la PK; las demás tablas usan un `id` determinista (`u1`, `RUN-001`, `DOC-001`, `s1`).
- **Refresh token sin estado** (JWT con `type=refresh`, 7 días con "recordar", 12 h sin él); `logout` es 204 y el cliente descarta los tokens. *Evita una tabla de sesiones que la fase 1 no necesita.*
- **Validación 422 en toda la API** (no 400) con `errors: { campo: claveI18n }`. *El plan pide "mensajes inline vs. error 422 de API".*
- **Caos:** solo latencia (0–`latencyMs`) y 500 en escrituras (POST/PATCH/PUT/DELETE); `/api/admin`, `/api/auth`, `/api/health`, `/api/docs`, `/api/config` están exentos. *El instructor siempre puede apagarlo y el login sigue estable.*
- **Reset conserva la configuración de caos** del tenant. *Un alumno que reinicia datos no debe apagar el caos que activó el instructor.*
- **Archivar = estado `closed`; duplicar = copia en `draft` sin hitos.** *Comportamiento del prototipo.*
- **Registro:** crea un usuario `pendingApproval` en el tenant de la cabecera (`demo` por defecto). El reset nocturno lo elimina.
- **`/api/docs-json`** expone el OpenAPI; `/api/docs` admite basic auth con `DOCS_BASIC_AUTH`.

## Web (apps/web)

- **Rutas de Acceso:** `/login`, `/register`, `/forgot` son URL propias; MFA y verificación son subvistas de estado (dependen del flujo). *Los alumnos pueden navegar directo a registro; el resto no tiene sentido sin el paso previo.*
- **Sesión:** access token en memoria; refresh en `localStorage` solo con "Mantener la sesión", si no en `sessionStorage`; al arrancar se recupera con `/auth/refresh`. *Permite enseñar `storageState`.*
- **Spinner mínimo de 400 ms** en login/MFA/registro/recuperar. *Con la API local la respuesta es casi instantánea y el estado `aria-busy`/spinner del handoff no llegaría a verse.*
- **Overlay de redirección de 1,4 s** (como el handoff) antes de entrar en Programas; la sesión se confirma al terminar. *Los specs que necesiten rapidez inician sesión por API y reutilizan `storageState`.*
- **Tailwind 4 + componentes CSS:** tokens como CSS variables bajo `[data-theme]` en `<html>`, mapeados con `@theme inline`; los primitivos (`.btn`, `.input`, `.badge`, `.card`…) viven en `@layer components`. No se usan `text-xs/sm/…` (fijan `line-height`); se usan tamaños arbitrarios `text-[12px]`. *Con el line-height heredado (1,45) el diseño coincide al píxel; con los presets, no.*
- **Logo y avatares:** `<img alt>` con SVG data-URI; la "S" del logotipo es un trazo propio (el SVG-imagen no carga fuentes web) escalado al 69 % para igualar la proporción del prototipo; los avatares usan colores por tema. *El `<img>` de avatar no puede leer variables CSS.*
- **Panel de marca:** muestra entorno y versión reales de `GET /api/config` (`dev · v0.1.0`) en lugar del `staging · eu-west-1` del mock.
- **Comparación con el handoff:** `e2e/tests/compare.spec.ts` sirve `docs/design-handoff` por HTTP y mide el % de píxeles distintos (`pnpm --filter @sigpro/e2e compare`); imágenes en `e2e/.compare/` (ignorado por git).

## Programas

- **Asistente = modal centrado de 560 px (hoja inferior en móvil), no drawer lateral de 480 px.** *El README del handoff dice "drawer", pero el `.dc.html` (la referencia visual) implementa un modal; en lo visual gana el prototipo.*
- **Sidebar 224/56 px y breakpoints 640/1100:** valores del prototipo, no los 220/52 y 1024 del README. En tablet empieza colapsada y se puede expandir.
- **Badge de fila = 20 px, 11/600, con borde del tono** (prototipo de Programas); el de 11,5/500 sin borde del README solo se usa en el panel de verificación.
- **CSV:** separador `;`, cabecera `code;name;status;owner;start;end;budget;progress`, nombre y responsable entrecomillados, archivo `sigpro-programas.csv`, `<a download data-testid="programs-csv-download">` temporal. *Formato del prototipo; lo genera `@sigpro/shared` para API y web.* "Exportar CSV" respeta los filtros (pide `/api/programs/export`); "Exportar selección" lo genera en el cliente.
- **Etiqueta del menú de fila:** `Acciones para PRG-001` (plan) en lugar de `Acciones PRG-001` (prototipo). *El plan manda en lo funcional/locators.*
- **Menú ⋯ con `position: fixed`** dentro de la propia celda. *Se mantiene la jerarquía fila → menú para el encadenamiento de locators y no lo recorta el scroll de la tabla.*
- **Estado de la lista en la URL** (`/programs?status=on_hold&sort=name&dir=desc&page=2`). *Se puede compartir, recargar y usar en `page.goto`.*
- **Búsqueda global = búsqueda de Programas** (debounce 250 ms, `?q=`) en la fase 1.
- **Skeleton:** inmediato en la primera carga; en las siguientes solo si tarda > 250 ms (mientras tanto, `aria-busy` y datos anteriores). *Evita parpadeos al teclear en filtros pero sigue siendo observable con latencia/caos.*
- **Ids de toast `toast-{ok|danger|info|warn}`** también en Programas (el prototipo usaba `success`/`error`). Estilo con franja izquierda de color (prototipo de Programas) en todos los toasts.
- **Vacío:** "Sin programas / Ningún programa coincide con los filtros aplicados." (handoff) en lugar de "No hay programas que coincidan" (plan). *Texto visible del handoff.*
- **Borrado permanente, sin "Deshacer":** el diálogo dice "de forma permanente" y la API no tiene borrado lógico. *El `toast-action` del prototipo queda sin usar; id reservado en `testids.ts`.*
- **Editar** muestra el toast informativo del prototipo (`→ /programs/PRG-001/edit`); la edición real (PATCH) llega con el módulo completo en la fase 2.
- **`GET /api/users/owners` incluye `programCount`** para el contador de las opciones del combobox.
- **Secciones futuras del menú** (Panel, Requisitos, Verificación, NC, Documentos, Auditoría, Administración) existen como página "Próximamente" para que los enlaces del sidebar no rompan.
- **Detalle de programa** mínimo (cabecera, progreso, pestañas Resumen/Hitos/Requisitos con roles `tab`/`tabpanel`); hitos y requisitos llegan en la fase 2.
