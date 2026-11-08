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

## Fase 2 — Núcleo del dominio

### Datos y seed

- **`Requirement.tags String[]` y `Requirement.position Int`** (con valor por defecto). *Etiquetas del multi-select y orden manual entre hermanos; los defaults permiten migrar tablas con datos (Render).*
- **`Evidence` guarda los bytes en Postgres (`Bytes`)**, máx. 2 MB por archivo y 5 por ejecución, solo PNG/JPEG/PDF. *El disco de Render es efímero; el plan pide limitar evidencias a 2 MB. Cascada desde el tenant: el reset sigue siendo una sola sentencia.* `TestRun.evidenceUrl` se conserva como «primera evidencia» (`/api/evidence/<id>`).
- **`DocumentVersion` (texto por líneas)**: cada versión del documento guarda sus líneas; `Document.version` es la última. *Es lo que permite comparar versiones con un diff real y generar el visor HTML y el PDF.*
- **Seed v2** (`SEED_VERSION = 2`): vínculos requisito↔caso dentro del mismo programa (la matriz es por programa), árbol de requisitos de hasta 3 niveles, etiquetas y posiciones deterministas, 130 eventos de auditoría (para que el scroll infinito tenga qué cargar), 1–3 versiones por documento y miniaturas PNG reales como evidencia. REQ-017 sigue en borrador y enlazado (ahora con TC-012); el último requisito de cada programa queda sin cobertura a propósito.
- **Re-siembra por versión al arrancar**: la API vuelve a sembrar los tenants cuyo `seed_version` sea menor que `SEED_VERSION` (conserva el caos). *Los tenants desplegados en Render tienen datos de la fase 1; sin esto la fase 2 saldría vacía hasta el reset nocturno.*

### Permisos

- Crear/editar/reordenar/vincular requisitos: `admin`, `program_manager`, `consultant`. Eliminar: `admin`, `program_manager`. Aprobar: `admin`, `program_manager`. **Verificar: `admin`, `consultant`.** Validar: `admin`, `auditor`. *El plan: «consultant crea y verifica»; admin puede todo (como en la tabla del plan).* Volver a borrador sin editar el texto: quien puede aprobar.
- Registrar ejecuciones: `admin`, `consultant`. Publicar nueva versión de un documento: `admin`, `program_manager`. Ver auditoría: `admin`, `auditor`.
- **Documentos `restricted`**: la API los omite en la lista y responde 403 en el detalle, el visor y la descarga para `consultant`. *El plan los oculta; el 403 directo permite practicar `page.route()` y pruebas de permisos por API.*

### API

- **Edición del texto devuelve el requisito a `draft`** (título o descripción distintos); etiquetas y prioridad no. *Regla del plan.*
- **Reordenar = mover entre hermanos** (`POST /requirements/:code/move` con `targetCode` + `placement`); mover a otro padre queda fuera. *Es lo que pide «drag & drop para priorizar»; las posiciones de los hermanos se renumeran.*
- **HTML enriquecido saneado en el servidor** (lista blanca: `b`, `strong`, `i`, `em`, `u`, `p`, `br`, `ul`, `ol`, `li`, sin atributos). *Misma función pura en `@sigpro/shared` para API y web.*
- **Ejecución con evidencias = una sola petición multipart** (`POST /test-cases/:code/runs`); el cliente compartido admite `FormData`. *Atómica: no quedan ejecuciones sin sus archivos si falla una subida (y el caos devuelve 500 antes de escribir).*
- **PDF generado a mano** (`apps/api/src/common/pdf.ts`, Helvetica, WinAnsi): sin dependencias nuevas y con test unitario de la estructura (xref, `%%EOF`). Lo usan el informe de verificación y la descarga de documentos.
- **Auditoría con paginación por cursor** (`at desc, id desc`), 20 por página, con `total`. *Con offset, los eventos nuevos mientras se hace scroll duplicarían filas.*
- **`/api/docs-json` también queda tras el basic auth** cuando `DOCS_BASIC_AUTH` está definido. *Antes el JSON de OpenAPI quedaba abierto aunque Swagger UI pidiera credenciales.*

### Web

- **Rutas:** `/programs/:code/requirements` (árbol + matriz), `/programs/:code/edit`, `/verification` y `/verification/:code`, `/documents` y `/documents/:id`, **`/documents/:id/view`** (visor HTML sin shell), `/audit`, públicas `/legal/terms`, `/legal/privacy`, `/help`. *El visor es una ruta SPA del mismo origen: `frameLocator` no ve dentro del visor nativo de PDF y así comparte sesión y tema.*
- **Evidencias y descargas:** el cliente descarga con `Authorization`, crea un `blob:` y lo usa en `<img alt="Evidencia TC-001">` o en un `<a download>` temporal. *`<img src>` y los enlaces no pueden llevar el Bearer.*
- **Reordenar con HTML5 drag & drop y alternativa de teclado** (Subir/Bajar en el menú contextual). *`dragTo` funciona con DnD nativo; un componente solo-ratón no se da por terminado.*
- **Editor enriquecido sin librería:** `contenteditable` no controlado + `document.execCommand` (negrita `Ctrl+B`, cursiva, lista). *Evita dependencias; el HTML resultante se sanea al guardar.*
- **Copiar código:** `navigator.clipboard.writeText` + toast «Código copiado». *El toast hace el comportamiento observable aunque el test no lea el portapapeles.*
- **Scroll infinito:** contenedor de altura fija con `role="feed"` y `IntersectionObserver` sobre un centinela (más «Cargar más» como respaldo accesible). *Con la página entera como raíz, el centinela estaría ya visible en 900 px de alto y cargaría todo de golpe.*
- **Tenants de los specs nuevos:** `alumno08…alumno16` (uno por archivo/spec de capturas).
- **`WEB_PORT`** (Vite) permite levantar una segunda pila web (p. ej. `WEB_PORT=5174 API_PROXY_TARGET=http://localhost:3001`) sin pisar la que ya esté en marcha; Playwright la usa con `E2E_WEB_URL` / `E2E_API_URL`. *En Windows, `prisma generate` no puede reemplazar el motor mientras otra API lo tiene cargado.*

### Requisitos (T17)

- **Edición en línea: Enter guarda, Esc y salir del campo cancelan** (no se guarda nada por accidente). Doble clic en el título (o F2, o «Renombrar» del menú). Un título inválido deja el campo abierto con `aria-invalid` y el motivo en `title`.
- **Detalle = panel lateral de 380 px en escritorio (≥ 1100 px); cajón superpuesto con scrim en tablet y hoja a pantalla completa en móvil.** *Con la barra lateral de 224 px, a menos de 1100 px el árbol quedaría ilegible junto al panel.*
- **Árbol `role="tree"` con filas `treeitem` planas** (`aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` solo en las que tienen hijos) y foco itinerante: ↑↓, Inicio/Fin, → / ← (desplegar, plegar o ir al padre), Enter, F2, Alt+↑↓ (mover), Mayús+F10 o tecla de menú (menú contextual). El nombre accesible de la fila es «REQ-017 título».
- **Filtro del árbol:** conserva a los ancestros de cada coincidencia y despliega todo mientras hay texto (`withAncestors`, pura y con tests).
- **Reordenar = arrastrar la fila entera** (HTML5 DnD); el icono ⋮⋮ es solo una pista (`role="img"`). En la zona central de la fila, soltar ocupa su sitio (hacia abajo va detrás; hacia arriba, delante); el cuarto superior o inferior fuerza antes o después. Soltar sobre otro padre no se acepta. Vista optimista; si la API falla se recarga el orden real.
- **Atajos:** `N` nuevo requisito, `/` buscar, `Esc` sale del campo en el que se escribe y, al pulsarlo de nuevo, cierra el detalle. Los diálogos y menús tienen su propio `Esc`.
- **Selector de etiquetas:** elegir una etiqueta cierra la lista (el foco sigue en el campo; escribir o ↓ la reabren). *Con la lista abierta tapaba los controles de debajo; lo descubrió el propio spec.*
- **Matriz:** una casilla por cruce con vista optimista; el recuento «X de N con cobertura» se actualiza al instante y el último requisito de cada programa del seed queda sin cobertura a propósito (`data-covered="false"` y etiqueta «Sin cobertura»).
- **Transición inválida = 409 (`invalid_transition`)**, rol sin permiso = 403, cuerpo inválido = 422. *Son tres casos de prueba distintos para el alumno.*
- **Capturas:** el menú contextual solo se captura en escritorio (se cierra al redimensionar y la captura ajusta el viewport a la altura del contenido).
- **Tenants de los specs:** `alumno09` (Requisitos UI), `alumno10` (Requisitos API, con `alumno11` como segundo tenant para el aislamiento), `alumno13` (capturas de edición de programa y páginas legales) y `alumno14` (capturas de Requisitos).

### Verificación (T18)

- **Las tres entradas de evidencia (un archivo, varios y zona de arrastre) alimentan la misma lista** (máx. 5). Se validan al añadirlas (tipo PNG/JPEG/PDF y ≤ 2 MB): los rechazados no entran y se avisa en un `role="alert"`. Mismo archivo = mismo nombre y tamaño. *Cada alumno practica `setInputFiles`, `filechooser` y el `drop` con `DataTransfer` sobre la misma pantalla.*
- **El servidor valida lo mismo (422 `errors.files`) y además comprueba la firma real del archivo** (los primeros bytes): un `.png` que no es un PNG se rechaza aunque el `Content-Type` diga `image/png`. multer deja pasar hasta 5 MB y 10 archivos; más de eso es un 413 antes de llegar al servicio.
- **El `alt` de las miniaturas es `Evidencia TC-001` para todas las de un caso** (no lleva el id de la evidencia): obliga a usar `.first()`, `.nth()` o `filter` con `getByAltText`. Los PDF llevan `Documento PDF <nombre>` y las vistas previas del formulario `Vista previa de <nombre>`.
- **Listado calculado en memoria** (`test-case-query.ts`, puro y con tests): el último resultado y el nº de ejecuciones son derivados y hay 25 casos por tenant.
- **Informe PDF:** `informe-verificacion.pdf` (todos), `informe-verificacion-prg-003.pdf` (programa) o `informe-verificacion-seleccion.pdf` (casos elegidos); 404 si no hay casos. Texto plano sin compresión, así los specs pueden leer su contenido.
- **Enlace cruzado:** el requisito de un caso abre `/programs/:code/requirements?select=REQ-001` con su detalle desplegado.
- **Ojo con los prefijos de `data-testid`:** `testcase-row-menu-TC-001` también empieza por `testcase-row-`; los specs usan `/^testcase-row-TC-\d+$/`. (El mismo caso existe en Programas.)
- **Tenants de los specs:** `alumno12` (UI), `alumno15` (API) con `alumno16` de solo lectura para el aislamiento, `alumno17` (capturas). Reservados: `alumno18`–`alumno21` (Documentos: UI, API, aislamiento y capturas) y `alumno22`–`alumno23` (Auditoría: UI/API y capturas).

### Documentos (T19)

- **El visor es una ruta del mismo origen** (`/documents/:id/view?version=2`, dentro de `RequireAuth` pero sin `AppShell`) que se carga en el `<iframe title="Visor de documento">` y también en la pestaña nueva. Con `localStorage` comparte la sesión; con `sessionStorage` (sesión sin «Mantener la sesión») la pestaña nueva **no** la hereda y pide iniciar sesión: es comportamiento real del navegador y un buen caso para `storageState`.
- **Los `restricted` desaparecen de la lista** para el consultor (con un aviso con el recuento: `hiddenCount`) **y dan 403** en la ficha, el contenido, la comparación y la descarga. *El 403 directo permite practicar `page.route()` y pruebas de permisos por API.*
- **Comparación calculada en el servidor** con `diffLines` + `alignDiff` (compartidas y con tests): filas `same`, `changed`, `added` y `removed`. En la tabla, `data-diff` en la fila y `<del>` / `<ins>` en cada columna. La comparación por defecto es «anterior → última».
- **Publicar versión** (solo admin y gestor): el diálogo parte del contenido de la última, una línea por fila (1–80 líneas de ≤ 200 caracteres y una nota de ≤ 200); la versión nueva pasa a ser la última y queda auditada. Los errores de contenido llegan como `lines` o `lines.N`.
- **Descarga de PDF por versión** (`DOC-004-v3.pdf`) generada con el mismo constructor de PDF que el informe de verificación.
- **Accesibilidad de los `<select>` con etiqueta:** se usa `<label htmlFor>` y no una etiqueta envolvente. *Con la envolvente, el nombre accesible incluía el texto de todas las opciones («Versión Versión 1 Versión 2…») y `getByLabel` encontraba varios selectores.* Corregido también en Verificación.
- **Foco al abrir «Nueva versión»:** el campo está deshabilitado mientras carga el contenido, así que recibe el foco en cuanto se habilita (lo descubrió el propio spec).
- **El filtro de la lista de documentos no usa la URL** (son 12 documentos, sin paginación). Programas y Verificación sí.
- **Tenants de los specs:** `alumno18` (UI), `alumno19` (API) con `alumno20` de solo lectura para el aislamiento y `alumno21` (capturas).

### Auditoría (T20)

- **Feed = `role="feed"` con `<article>` por evento** (`aria-posinset` / `aria-setsize` con el total del filtro), dentro de un contenedor de altura fija (`max-h` 68 vh, tope de 640 px) y con foco de teclado (región con scroll). *La API de scroll infinito del patrón ARIA «feed».*
- **Centinela con `IntersectionObserver` cuya raíz es el contenedor**, no la ventana, y un margen de 120 px: con la ventana como raíz el centinela ya estaría visible a 900 px de alto y cargaría todo de golpe. Si el filtro deja pocos eventos y el centinela queda a la vista, carga la siguiente página (y termina).
- **Si falla la página siguiente no se reintenta sola:** se conserva lo cargado y aparece el aviso con «Cargar más» (`audit-load-more`). Las respuestas de filtros antiguos se descartan y los eventos repetidos no se duplican.
- **Cursor opaco** (base64url de `{ at, id }`); un cursor inválido es 422 (`errors.cursor = "badCursor"`). `limit`: 20 por defecto, entre 1 y 100. Las fechas del filtro son días completos en UTC (`from` y `to` incluidos) y las no válidas se ignoran.
- **`q` busca en la acción y en el código de la entidad** (sin distinguir mayúsculas). Las entidades filtrables son `program`, `requirement`, `testrun`, `document` y `tenant`.
- **Cada mutación audita en la misma transacción** (`program.updated`, `requirement.created|updated|state_changed|moved|linked|unlinked|deleted`, `testrun.executed`, `document.version_published`); las operaciones rechazadas (403, 409, 422) no dejan evento. El spec de API lo comprueba evento a evento.
- **Hora en la zona del navegador** (`toLocaleString`); el atributo `datetime` de cada `<time>` lleva el instante UTC exacto.
- **Tenants de los specs (reasignados):** `alumno22` (UI), `alumno23` (API) y `alumno25` (capturas). *Los `alumno22`–`alumno23` quedaron reservados para Auditoría y el 24 lo usé a mano; el 25 es el último que crea el seed por defecto.*

## Fase 3 — Dinámica y caos

### Datos, contratos y estructura (T22)

- **`Milestone.progress` (0–100) además de `done`**, con la regla «100 % = cumplido». El avance del programa sigue saliendo de `done / total` (el «11 % completado» de PRG-001 no cambia). El seed pone los cumplidos al 100 %, el primero pendiente «en curso» (10–60 %) y el resto a 0.
- **`NcComment` (tipos `comment`, `quick`, `closure`) y `NonConformity.createdAt`.** El comentario de cierre se guarda como comentario de tipo `closure`. Seed v3 (`SEED_VERSION = 3`, re-siembra al arrancar): 12 NC con 0–3 comentarios y las cerradas con su cierre válido.
- **Máquina de estados de las NC** (`packages/shared/src/nc.ts`, un solo mapa): `open → in_analysis → corrective_action → closed`; `rejected` solo desde `in_analysis` y se puede reabrir; `corrective_action` vuelve a `in_analysis`; `closed` es terminal. *El plan solo fija el camino feliz y el rechazo; reabrir y retroceder evita callejones sin salida en el tablero.*
- **Permisos de NC:** todos los roles abren y comentan; mover y editar, admin, gestor y consultor; **cerrar, admin y gestor**; el auditor lee, abre y comenta. Orden de las comprobaciones en la API: 403 (rol) → 409 `invalid_transition` → 422 (cierre) — tres casos de prueba distintos, como en Requisitos.
- **Hitos:** crear, editar y eliminar, admin y gestor. **Usuarios (Administración):** `users.manage` (admin); nadie se desactiva ni se cambia el rol a sí mismo (409 `self_change`) y siempre queda un admin activo (409 `last_admin`). El rol de un usuario cambia en su sesión al refrescar el token.
- **Auditoría ampliada** con `nc`, `milestone` y `user` (acciones `nc.created|updated|state_changed|commented`, `milestone.created|updated|deleted`, `user.updated`); la API de Auditoría no cambia.
- **`apps/api/scripts/generate-prisma.mjs`** envuelve `prisma generate`: en Windows, si otra API tiene cargado `query_engine-windows.dll.node`, aparta (renombra) el motor en uso y reintenta. *Un .dll cargado se puede renombrar aunque no sobrescribir; así `typecheck` y `build` funcionan con la pila en marcha (cierra la deuda «Windows + Prisma»).* En Linux/macOS nunca entra.
- **`E2E_SKIP_GLOBAL_RESET=1`** salta el reset global de `globalSetup`: varias ejecuciones de Playwright contra la misma pila no se borran los datos entre sí (cada spec reinicia su tenant). *La suite completa sigue haciendo el reset global.*
- **Capturas por módulo:** el proyecto `screens` ejecuta `tests/screens*.spec.ts` (un archivo por módulo en lugar de uno gigante).

### Tiempo real y panel de misión (T24)

- **Socket.IO** (`@nestjs/websockets` y `@nestjs/platform-socket.io` 11.2.8, `socket.io` 4.8.4): un gateway en `/socket.io` (el prefijo `/api` no aplica a los sockets). **El JWT se valida en el handshake** (`auth.token`, middleware): un token falso recibe `connect_error` y nunca llega a conectar; la web lo relee en cada reconexión y, si caducó, renueva con una petición autenticada. **Cada tenant tiene su room** (`tenant:<id>`): los eventos de un alumno no llegan a otro.
- **Origen del socket** = origen de `VITE_API_URL` sin `/api` (la web es estática en Render); con la API relativa de desarrollo, el de la propia página, con `/socket.io` proxied por Vite (`ws: true`).
- **Dos tipos de evento:** *del simulador* (telemetría sintética: no escribe en la base, así los datos de los specs no cambian solos) y *reales* (`nc_*`, `milestone`: los emite la API tras una mutación y llevan `ncOpen` y `ncBySeverity`). El simulador es **determinista** (ciclo de 8 tipos, nada de `Math.random`), emite cada `SIMULATOR_MS` (4 s por defecto, 0 lo apaga) **solo a tenants con algún cliente conectado**, y `POST /api/mission/tick` (admin) emite el siguiente al instante para que los specs no esperen al temporizador.
- **Eventos en memoria** (anillo de 50 por tenant, `seq` creciente; arranca con 6 eventos de historia). **Restaurar un tenant los borra:** si no, el feed mostraría sucesos de datos que ya no existen (lo descubrió el spec).
- **Campana:** solo los avisos (`warn`, `danger`) generan notificación; cuenta los recibidos en la sesión (los de antes no); la insignia se muestra con el número y el nombre accesible incluye «N sin leer». La preferencia «Notificaciones en tiempo real» del Perfil la desactiva. La insignia de NC del menú (`nav-badge-nc`) es en vivo (antes era un `3` fijo).
- **Gráficas a mano en HTML/CSS** (sin librería, como el PDF y el editor): barras finas (≤ 24 px), extremo de datos de 4 px y base recta, 2 px entre segmentos, texto con tokens de texto, leyenda para 2+ series, **vista de tabla** alternativa y tooltip por barra (hover y foco). Cada barra lleva su valor en el nombre accesible: el tooltip mejora pero no bloquea.
- **`Tooltip`** (`role="tooltip"`, hover y foco, Esc, solo uno abierto, se ajusta a la ventana: en móvil se salía por el borde) y `aria-describedby` solo mientras está visible. KPI con icono de información y tooltip en cada uno.
- **KPI de «Verificación superada»** = % de casos con ejecuciones cuyo último resultado es «Superado». **Hitos por programa:** los 8 primeros programas activos con hitos.
- **`ConfigProvider`** relee `/api/config` al iniciar sesión y tras aplicar el caos: los **textos alternos** (`useSaveLabel`) alternan «Guardar» y «Guardar cambios» cada 2,5 s (los specs resilientes usan `/^Guardar( cambios)?$/`); «Guardar y cerrar» no cambia.

### Defectos plantados (T27)

- **8 defectos tras `PLANTED_BUGS`** (por defecto `true`; `false` deja la app limpia): los 4 del plan (B1 filtro «Hasta», B2 orden en páginas siguientes, B3 cierre con 19 caracteres, B4 KPI de NC sin WebSocket) y 4 propios (B5 `open → rejected`, B6 «Marcar leídas», B7 salto a 100 % sin cumplir el hito, B8 contador de comentarios de la tarjeta). La API expone solo `plantedBugs: boolean` en `/api/config`. Catálogo y pistas en `docs/planted-bugs.md`.
- **`docs/planted-bugs.md` está en `.gitignore`.** *El repositorio es público y el plan pide que el documento no sea accesible al alumnado; versionarlo publicaría las soluciones. Tampoco lo enlaza `/lab` ni entra en ningún build; un test de la web lo comprueba. Con un repositorio privado basta `git add -f`.* El código con `PLANTED_BUGS` sigue siendo legible en GitHub (inevitable con un repositorio abierto).
- **Los specs de humo no pasan por los caminos defectuosos** (cierre de 19 caracteres, `open → rejected`, salto de < 50 % a 100 %, KPI de NC en vivo, «Marcar leídas», contador > 2 comentarios, filtro «Hasta» exacto, orden en la página 2). `planted-bugs.spec.ts` afirma el comportamiento defectuoso con `PLANTED_BUGS=true` y el correcto con `false`; las reglas puras llevan tests unitarios con la bandera en ambos valores.
- **Tenants de los specs de la fase 3 (míos):** `alumno09` (Panel de misión), `alumno10` (aislamiento de eventos), `alumno11` (capturas del panel) y `alumno12` (defectos plantados). NC usa `alumno01`–`alumno03` y `alumno13`; Administración, Hitos y Perfil, `alumno04`–`alumno08` y `alumno14`.

### Administración (T25)

- **Solo `users.manage` (admin) entra en `/admin`:** el resto ve `admin-forbidden` (con `alert`) y el enlace del menú ya está oculto para ellos. *Mismo patrón que Auditoría.*
- **La pestaña activa vive en la URL** (`/admin?tab=audit|chaos|data`; «Usuarios» es la de por defecto y no lleva parámetro). Patrón `tablist` con flechas, Inicio y Fin. *Se puede enlazar, recargar y usar en `page.goto`.*
- **Usuarios con vista optimista y reversión:** el select de rol y el switch de activo actualizan la fila al instante; si la API rechaza (409/500) se restaura el valor y sale un toast `danger`. Sobre tu propia fila los controles quedan deshabilitados con `title` («No puedes modificar tu propia cuenta»), aunque la API también responde `409 self_change`. *`409 last_admin` solo se alcanza por API con un JWT aún vigente de un admin ya desactivado: desde la UI el que actúa es siempre un admin activo.*
- **Estado visible del usuario por prioridad:** pendiente → bloqueado → desactivado → normal (`data-state` en el badge). *Permite `filter({ has })` sobre filas bloqueadas o pendientes.*
- **Auditoría reutilizada, no duplicada:** `AuditFeed` (filtros entidad, rango Desde–Hasta y texto + scroll infinito) se extrajo de `AuditPage`, que queda como envoltorio (título + permiso `audit.view`). Dentro de Administración se titula con un `h2`. Mismos `data-testid` en las dos pantallas.
- **Modo caos:** latencia 0–5000 ms en pasos de 100 y errores 500 de 0 a 100 % en pasos de 5 (se guarda como 0–1), más el interruptor de textos alternos. Es un borrador: **«Aplicar» hace el `PATCH /api/admin/chaos`** (persistido por tenant) y vuelve a leer `/api/config` para que la web empiece a alternar; «Apagar caos» lo deja todo a cero. El estado persistido se ve en `admin-chaos-status` (`data-active`).
- **Textos alternos = `useSaveLabel()`:** con `flakyLabels` activo el texto del botón «Guardar» alterna entre «Guardar» y «Guardar cambios» cada 2,5 s (`FLAKY_LABEL_MS`). Se aplica al «Guardar» de editar programa, al del detalle de requisito, al de Perfil y a un botón de ejemplo del propio panel; **«Guardar y cerrar» no cambia nunca** (sigue siendo el par para `exact`). Los specs resilientes usan `getByRole('button', { name: /^Guardar( cambios)?$/ })`.
- **Restaurar datos con `window.confirm()` nativo** (como `/lab`), nunca con un modal propio: `page.once('dialog')` registrado *antes* del clic, porque el clic no termina hasta resolver el diálogo.
- **Specs en paralelo contra una sola pila:** con `E2E_SKIP_GLOBAL_RESET=1` no se reinicia todo el seed al arrancar y cada ejecución simultánea usa `--output=<dir propio>` (si no, Playwright limpia `e2e/test-results` y borra las trazas de la otra). *Hacen falta al correr dos agentes o dos terminales a la vez.*
- **Tenants de los specs:** `alumno04` (Administración UI), `alumno05` (API de usuarios y caos) con `alumno06` de solo lectura para el aislamiento, y `alumno14` (capturas).

### Hitos del programa (T26)

- **Pestaña «Hitos» del detalle de programa = tabla `<table>`** (Hito · Fecha límite · Avance · Estado · Acciones) ordenada por fecha límite y, a igualdad, por id (se reordena sola al cambiar una fecha). Contador «n de N hitos cumplidos» con `aria-live`; el detalle vuelve a pedir el programa tras cada cambio, así cambian el avance y los hitos cumplidos de la cabecera (`aria-valuenow` de la barra).
- **Edición inline sin librería:** el texto de la celda es un `<button>` (nombre accesible = su texto); **doble clic, F2 o Intro** abren un `<input>` (texto o `type="date"`); **Intro guarda, Esc y salir del campo cancelan** (misma decisión que Requisitos). Un valor inválido (esquema Zod compartido) deja el campo abierto con `aria-invalid` y el motivo en `title`. «Renombrar» del menú ⋯ abre la misma edición.
- **Slider de avance:** `<input type="range">` 0–100 en pasos de 5 con `aria-label` «Avance de {hito}», `aria-valuenow` y `aria-valuetext` explícitos. **Se confirma con el evento nativo `change`** (no con `input`): `fill()` de Playwright, las flechas y soltar el arrastre guardan una vez. La UI aplica el valor al instante y **solo la última petición de cada hito manda** (`progressSeq`): si no, la respuesta de la primera pulsación de flecha pisaba el valor de las siguientes y se perdían pasos.
- **El badge de estado sale del `done` del servidor, no del slider:** con el 100 % de avance el hito queda «Cumplido» porque la API lo marca; así el defecto plantado de los hitos (un salto desde < 50 % a 100 % deja `done=false`) se ve como «En curso» al 100 %.
- **Alta con diálogo** (nombre y fecha, validación con `createMilestoneSchema`, 422 por campo) y **eliminación con `alertdialog`** («eliminar hito» del plan). Con otro rol que admin o gestor todo es de solo lectura (slider deshabilitado, botones con `title` de motivo).
- **Tenants de los specs:** `alumno07` (UI y API de hitos; también `PRG-004` para la API y `PRG-003` para el estado vacío).

### Perfil (T26)

- **`/profile` = cuenta + permisos del rol + preferencias.** La lista de permisos sale de `can()` (la misma tabla que usa la API) y cada fila lleva `data-allowed`, ✓ / — visuales y «Permitido» / «No permitido» para lectores de pantalla.
- **Las preferencias son un borrador y «Guardar» las aplica todas a la vez** (idioma, tema, avisos en tiempo real, resumen semanal): el botón está deshabilitado con `title` mientras no haya cambios y vuelve a deshabilitarse si se deshacen. Tema = grupo de **radios** dentro de un `fieldset`; avisos = **switch** (`STORAGE_KEYS.live`); resumen semanal = **casilla** (`STORAGE_KEYS.digest`, simulado: solo se guarda).
- **El switch de avisos solo decide si la campana cuenta los avisos nuevos** (la conexión de Socket.IO y el feed del panel de misión siguen vivos).
- **Nombre accesible único por pantalla:** el selector de la cabecera ya se llamaba «Idioma», así que el del perfil es «Idioma de la interfaz». *Lo descubrió el propio spec (`getByLabel` resolvía dos elementos).*
- **Los specs de Perfil no usan `openAs`:** su script de inicio reescribe tema e idioma en cada carga y ocultaría la persistencia; inician sesión por API y dejan que la app decida tema e idioma.
- **Tenant del spec:** `alumno08` (capturas en `alumno14`).

### No conformidades (T23)

- **Máquina de estados** (compartida por API y web): `open → in_analysis → corrective_action → closed`; `rejected` sale de `in_analysis`; `in_analysis → open` (volver atrás), `corrective_action → in_analysis` y `rejected → open` (reabrir). `closed` es terminal. *Los retrocesos permiten rectificar un arrastre sin romper la regla de cierre.* El orden de comprobación de la API es 403 (rol) → 409 (paso inexistente) → 422 (comentario de cierre), tres casos de prueba distintos.
- **Permisos:** abrir (`nc.create`) y comentar (`nc.comment`) todos los roles; editar y mover (`nc.edit`, `nc.transition`) admin, gestor y consultor; **cerrar** (`nc.close`) solo admin y gestor. *El auditor puede leer, abrir y comentar, pero no mover: las tarjetas no son arrastrables (`draggable="false"`, `title` con el motivo) y «Mover a…» sale deshabilitado.*
- **`/nc/:code` abre el detalle en un modal sobre el tablero** (enlace directo, recarga y `page.goto`); cerrarlo vuelve a `/nc`. Los filtros del tablero **no** viven en la URL (12 tarjetas, sin paginación): los pide el servidor (`GET /nc?q&program&severity&assignee=none`).
- **Arrastrar a «Cerrada» abre el diálogo del comentario de cierre en vez de mover**, pero solo desde «Acción correctiva»; desde cualquier otra columna se envía el movimiento y el servidor responde 409 (así «arrastre inválido» es un caso de prueba real y no hay que escribir un comentario para nada). Cualquier otro destino es **optimista** y se revierte con toast `danger` si el servidor lo rechaza. Mientras se arrastra, cada columna lleva `data-valid` (`valid`/`invalid`/`same`) según la máquina de estados y `data-drop` bajo el puntero; **decide siempre el servidor**.
- **Cierre = `closureErrorKey` + 422 del servidor:** el formulario valida al enviar (`role="alert"`, `aria-invalid`) con `ncClosureMinLength(plantedBugs)`, muestra el contador `n / 20` y, si la API rechaza, traduce `errors.comment` (`closureShort` / `closureRequired`). El comentario queda como comentario de tipo `closure`. El mismo formulario sirve para el diálogo del tablero y para el detalle.
- **Cada columna se limita al alto visible (`max-h-[calc(100vh-260px)]`) y su lista hace scroll interno.** *`locator.dragTo(columna)` desplaza la página para ver la columna destino entera cuando es más alta que la ventana, y ese desplazamiento posterior al `mousedown` cambia la tarjeta que se arrastra (se movió NC-006 en lugar de NC-001). Con columnas que caben, `dragTo(column)` funciona sin `targetPosition`.* Las descripciones de las tarjetas van a 2 líneas.
- **Comentario rápido = `window.prompt()` nativo** (cancelar no hace nada; vacío → toast `warn`; texto → comentario de tipo `quick`), a propósito para practicar `page.on('dialog')` con `dialog.type() === 'prompt'`, `accept(texto)` y `dismiss()`. La alternativa de teclado al arrastre es el menú ⋯ → «Mover a «…»», con solo los estados que permite la máquina.
- **`<sigpro-severity-picker>`** (`apps/web/src/ui/severity-picker.ts`): custom element con `attachShadow({ mode: 'open' })`, un `role="listbox"` con tres `role="option"` (`aria-selected`, tabindex itinerante; ←↑→↓/Inicio/Fin mueven el foco y Intro/Espacio eligen), estilos dentro del shadow con las variables del design system, atributos `value`, `disabled`, `label` y `labels` (JSON con los textos ya traducidos) y evento `change` (`bubbles` + `composed`). El wrapper React asigna los atributos por la referencia y engancha `change` con `addEventListener`. Las reglas de teclado y de atributos viven en un módulo puro con tests unitarios. **El nombre accesible está solo en el listbox del shadow** (un `aria-label` también en el host haría ambiguo `getByLabel`); el host lleva el `data-testid` (`nc-severity-picker` / `nc-new-severity`) y `title` cuando está deshabilitado.
- **La declaración JSX del elemento** está en `ui/sigpro-elements.d.ts` (no en `severity-picker.d.ts`: TypeScript ignora un `.d.ts` con el mismo nombre que un `.ts`).
- **Tarjeta:** franja izquierda y badge del color de la severidad (`info`/`warn`/`danger`, con `data-severity` en ambos), asignado con `<img alt>` o el texto «Sin asignar» (sin `<img>`: `filter({ hasNot: getByRole('img') })`), insignia de comentarios sin `role="img"` (si no, `hasNot` no distinguiría tarjetas), botón «Comentario rápido NC-001» y menú ⋯ «Acciones para NC-001». El clic en la tarjeta abre el detalle como comodidad para el ratón; el botón del código es la vía de teclado.
- **Detalle:** «Guardar» (usa `useSaveLabel()`, alterna con el modo caos) y «Guardar y cerrar» son un par que se solapa a propósito para `exact`; `PATCH` solo con lo que cambió (`diffNcDraft`, que compara la descripción ya saneada); asignación con `OwnerCombobox` (solo lectura con `title` si el rol no puede editar); los comentarios nuevos se añaden a la lista sin recargar y el tablero se refresca debajo.
- **Defectos plantados que toca la web de NC:** B3 (cierre con 19 caracteres: el contador sigue diciendo `n / 20` pero el botón acepta 19) y B8 (la insignia de comentarios de la tarjeta muestra uno menos cuando hay más de 2). Los specs de humo no pasan por ellos (5 y 38 caracteres, `open → closed`, recuentos ≤ 2).
- **Specs:** `nc.spec.ts` (17, UI), `nc-api.spec.ts` (10, API) y `screens-nc.spec.ts` (capturas `nc-*`). Tenants: `alumno01` (UI), `alumno02` (API) con `alumno03` de solo lectura para el aislamiento y `alumno13` (capturas).

### Catálogo de componentes: huecos cerrados

- **`alert()` nativo:** Administración → Datos → «Información del tenant» (`window.alert` con el tenant y el recuento de usuarios total y activos). Junto con el `confirm()` del reset (Administración y `/lab`) y el `prompt()` del comentario rápido de NC, ya están los tres diálogos nativos. *El plan lista `alert()` en la fila de diálogos nativos pero no le daba pantalla.*
- **Proveedores (combobox «buscar proveedor»):** `GET /api/suppliers?q=&program=` (cualquier rol; nombre o NIF sin distinguir mayúsculas; `program` = con contrato en ese programa; ordenados por nombre) y sección «Proveedores» en **Detalle de programa → Resumen**: los contratados en el programa y un combobox ARIA 1.2 que busca entre **todos** los del tenant. *Los proveedores y sus contratos existían en el modelo y el seed pero ninguna pantalla los usaba.* Se filtra en memoria con una función pura (son 6 por tenant). El combobox pide al servidor con debounce de 250 ms, **enseña como mucho 5 opciones** («n más: afina la búsqueda» en la región `aria-live`) y la lista solo existe con opciones: vacío, carga y error se dicen en el `role="status"`, no dentro del `listbox`. Al elegir muestra la ficha (NIF, correo, estado y todos sus contratos, con enlace al programa). Es un componente propio (`SupplierSearch`) que reutiliza `moveActive` de `ui/combobox.ts`; `OwnerCombobox` no cambia.
- **Búsqueda global con resultados agrupados:** `GET /api/search?q=` (mínimo 2 caracteres: 422 `errors.q = minChars`; grupos en orden fijo programas, requisitos, casos de prueba, NC y documentos; solo los que tienen resultados; 5 ítems por grupo con el `total` real). Busca sobre **texto plano** (`richTextToPlain`): una descripción HTML no coincide con sus propias etiquetas (`strong`, `li`…), y la NC usa un resumen de su descripción como título. Los documentos `restricted` no aparecen sin `document.viewRestricted` (ni en el recuento). *Se trae el mínimo de campos del tenant y se busca en memoria: son decenas de filas por tabla.*
- **Compatibilidad con la fase 1 (decisión):** en `/programs` la búsqueda de la cabecera **sigue filtrando la tabla** (`?q=`, `searchbox`, sin popover: es lo que prueban `programs.spec.ts` y el atajo `/`); en el resto de rutas pasa a ser un `combobox` con el popover de resultados agrupados. Antes, escribir fuera de Programas navegaba a `/programs?q=`. Al salir de `/programs` el campo se vacía. *Un campo cambia de rol (searchbox ↔ combobox) porque solo es combobox cuando tiene popup.* El popover se cierra al navegar (también al cambiar solo el `?select=`), al salir del campo y con Esc, no se pinta cerrado (no intercepta clics) y **Esc con el popover visible solo lo cierra**: sin `preventDefault`, Chrome vacía además los `<input type="search">`; con el popover cerrado, un segundo Esc ya limpia el campo.
- **Móvil:** la cabecera ocultaba la búsqueda a menos de 640 px. Ahora hay un icono «Búsqueda global» (`layout-search-toggle`) que la abre a todo el ancho (el popover es `fixed` bajo la cabecera y cabe en 390 px). En `/programs` no hay icono: la página trae su propio buscador.
- **Hallazgo (no corregido, fuera de alcance):** `DELETE /api/programs/PRG-001` y `PRG-002` responden **500** (`non_conformities_tenant_id_test_run_id_fkey`): el seed hace que NC de un programa apunten a ejecuciones de casos de **otro** programa y la FK `NO ACTION` impide borrar el programa de esas ejecuciones. Los demás programas con contratos (PRG-003 a PRG-012) se borran bien; `suppliers-api.spec.ts` usa PRG-003. Solución futura: `onDelete: SetNull` en `NonConformity.testRun` o que el seed enlace cada NC con una ejecución de su propio programa.
- **Tenants de los specs:** `alumno15` (búsqueda, UI y API) con `alumno18` de solo lectura (aislamiento de búsqueda y de proveedores), `alumno16` (proveedores UI), `alumno17` (proveedores API) y `alumno19` (capturas del catálogo).
