# Historias de usuario de SIGPRO

Los requisitos de SIGPRO escritos como **épicas** e **historias de usuario** en español. Sirven para dos cosas:

1. **Practicar la lectura de requisitos**, a mano (alumnado) y con agentes: dado un issue, derivar los casos de prueba sin abrir el código.
2. **Ser la referencia contra la que se prueba la app**: quien prueba siguiendo el texto de la historia, con sus casos negativos y sus valores límite, comprueba mucho más que quien solo recorre el camino feliz.

Por eso cada historia es un requisito: dice **lo que la funcionalidad debe hacer**, con el valor, el mensaje y el orden exactos, y no se escribe copiando el código. Este documento es la guía para quien escribe y para quien lee. El diseño completo está en `docs/superpowers/specs/2026-11-13-user-stories-design.md`.

Los archivos Markdown de esta carpeta son la **fuente de verdad**. GitHub es solo un reflejo que se publica con `pnpm stories:sync`.

## Qué es una épica y qué es una historia

- **Épica**: un issue padre con la etiqueta `epic`. Agrupa una funcionalidad («Login», «Requisitos», «Auditoría») y recoge su objetivo, su alcance, las plataformas que toca, la lista de sus historias y lo que queda fuera.
- **Historia**: un sub-issue de una épica. Es **un comportamiento verificable en una plataforma**. «Bloqueo tras 5 intentos fallidos en la web» es una historia propia, no una línea dentro de «Login».

Cada historia se basta a sí misma: su título, su relato, sus reglas y sus criterios de aceptación alcanzan para diseñar las pruebas. Si la misma regla vale en varias plataformas, **cada plataforma tiene su historia**, redactada con su superficie (en `api`, estados y cuerpos HTTP; en `web` y `movil`, lo que el usuario ve y hace), y se enlazan con `relacionadas`.

## Carpetas y nombres de archivo

```text
docs/user-stories/
  login/                 carpeta de EP-LOGIN: el id de la épica sin «EP-», en minúsculas
    epic.md
    US-LOGIN-001.md
    US-LOGIN-002.md
  COBERTURA.md           generado, no se edita a mano
  README.md              esta guía
```

- Épica: `EP-<SLUG>` y archivo `<slug>/epic.md`. Historia: `US-<SLUG>-NNN` (tres dígitos, numeración dentro de la épica, **sin reutilizar números**) y archivo `<slug>/US-<SLUG>-NNN.md`.
- **Solo se leen los archivos que se llaman exactamente `epic.md` o empiezan por `US-` y acaban en `.md`.** Cualquier otro nombre (`us-login-001.md`, `Epic.md`, `US_LOGIN_001.md`) **se ignora en silencio**: no se revisa, no entra en la cobertura y nunca se publica. El linter no avisa. Comprueba que el número de «archivos revisados» de su última línea coincide con los que has creado.

## Etiquetas y plataformas

Cada historia lleva **exactamente una** etiqueta de plataforma. `no-implementada` se suma a ella cuando corresponde. La épica lleva solo `epic`.

| Etiqueta | Prefijo del título | Uso |
| --- | --- | --- |
| `epic` | (sin prefijo) | Issue padre |
| `api` | `[API]` | Endpoints, códigos HTTP, validación en servidor, permisos |
| `web` | `[Web]` | Interfaz web (escritorio y diseño responsive) |
| `movil` | `[Móvil]` | App Expo común a iOS y Android |
| `ios` | `[iOS]` | Solo cuando el comportamiento difiere en iOS |
| `android` | `[Android]` | Solo cuando el comportamiento difiere en Android |
| `transversal` | `[Transversal]` | Regla válida en todas las plataformas, sin interfaz ni endpoint propios que describir (idioma, tema, accesibilidad, aislamiento por tenant) |
| `no-implementada` | (el de su plataforma) | La capacidad no existe en la app o solo está simulada; es material de lectura, no se puede probar |

Reglas:

- El título de una historia empieza por el prefijo de su plataforma seguido de un espacio: `[Web] Bloquear la cuenta tras 5 intentos fallidos`.
- **Historias `ios` y `android` solo si el comportamiento observable cambia por el sistema**: el botón atrás de Android, el selector de imágenes y de documentos, la hoja de compartir, los permisos del sistema, el teclado, las áreas seguras. Si el comportamiento es el mismo, basta la historia `movil`.
- Las historias `ios` **no se pueden ejecutar**: iOS nunca se ha abierto en un Simulador (`docs/MOBILE-PARITY.md`). Llevan `verificacion: pendiente-nativo` (o `no-ejecutable` si además son `no-implementada`). Android solo se ha usado en el emulador (API 33).

## Plantilla de una historia

El front matter es para el repositorio; el cuerpo es lo que se publica. Este ejemplo está relleno con datos concretos: cópialo y sustituye. Sus datos salen del código y de los textos de la interfaz.

````markdown
---
id: US-LOGIN-003
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Bloquear la cuenta tras 5 intentos fallidos"
etiquetas: [web]
relacionadas: [US-LOGIN-002]
verificacion: ejecutada
cubre: ["/login"]
---

## Historia
Como usuario con cuenta activa, quiero ver un aviso claro cuando mi cuenta se bloquea,
para saber que debo pedir ayuda y no seguir intentando.

## Reglas
- La cuenta se bloquea en el 5.º intento fallido consecutivo; con 4 sigue activa.
- Un intento fallido que no bloquea muestra «Correo o contraseña incorrectos».
- Una cuenta bloqueada no inicia sesión ni con la contraseña correcta.
- Un acceso correcto antes del 5.º fallo reinicia el contador de intentos.

## Criterios de aceptación
```gherkin
Característica: Bloqueo de cuenta tras intentos fallidos

  Esquema del escenario: El quinto intento fallido bloquea la cuenta
    Dado que el usuario "gestor@sigpro.test" ya acumula <fallos_previos> intentos fallidos
    Cuando intenta entrar en /login con una contraseña <contraseña>
    Entonces ve el aviso "<mensaje>"
    Y la cuenta queda <cuenta>

    Ejemplos:
      | fallos_previos | contraseña | mensaje | cuenta |
      | 3 | incorrecta | Correo o contraseña incorrectos | activa |
      | 4 | incorrecta | Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador. | bloqueada |
      | 4 | correcta | Sesión iniciada. Redirigiendo a Programas… | activa |
      | 5 | correcta | Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador. | bloqueada |
```

## Fuera de alcance
- El desbloqueo de la cuenta por un administrador.
````

El front matter admite exactamente estas claves (cualquier otra es un error):

| Clave | Obligatoria | Valor |
| --- | --- | --- |
| `id` | sí | `US-<SLUG>-NNN` |
| `tipo` | sí | `historia` |
| `epica` | sí | id de la épica, `EP-<SLUG>` |
| `titulo` | sí | con el prefijo de la plataforma; entre comillas si lleva corchetes |
| `etiquetas` | sí | lista con una etiqueta de plataforma y, si procede, `no-implementada` |
| `verificacion` | sí | `ejecutada`, `codigo`, `pendiente-nativo` o `no-ejecutable` (ver más abajo) |
| `relacionadas` | no | ids de **historias** hermanas (otras plataformas, la historia del ideal o su contrato) |
| `cubre` | no | endpoints o rutas que cubre la historia (ver «Cobertura») |
| `permisos` | no | claves de `PERMISSIONS` que cubre la historia |

`relacionadas` se publica sola como sección «Relacionadas» al final del issue: no la escribas a mano en el cuerpo. Tampoco escribas la marca de identidad ni la línea `Id` / `Épica` del principio: las añade la sincronización. `verificacion` no se publica.

### Cobertura: `cubre` y `permisos`

La matriz de cobertura exige que cada endpoint de la API, cada ruta de la web y de la app móvil y cada clave de `PERMISSIONS` aparezca en al menos una historia. Cada historia lo declara en su front matter:

- **`cubre`** lista lo que cubre según su plataforma, y solo cuenta si la plataforma coincide:
  - `api`: endpoints, con el verbo en mayúsculas y la ruta como en el controlador, por ejemplo `"POST /api/auth/login"` o `"GET /api/programs/:code"`.
  - `web`: rutas de la web, por ejemplo `"/login"` o `"/programs/:code"`.
  - `movil`, `ios` y `android`: rutas de la app móvil, con la misma forma.
  - `transversal` no cubre endpoints ni rutas: solo puede cubrir permisos.
- **`permisos`** lista claves de `PERMISSIONS` (`packages/shared/src/permissions.ts`) y vale en cualquier plataforma.

```yaml
# Historia api que cubre un endpoint y los permisos que lo gobiernan
cubre: ["POST /api/programs", "GET /api/programs/:code"]
permisos: [program.create]
```

Una errata en `cubre` o en `permisos` no da error: simplemente no cubre nada. `pnpm stories:coverage` imprime los huecos con la grafía exacta de cada endpoint, ruta y permiso; copia de ahí.

## Plantilla de una épica

El esquema de la épica es estricto: solo estas cuatro claves y la única etiqueta es `epic`.

````markdown
---
id: EP-LOGIN
tipo: epica
titulo: "Acceso con correo y contraseña"
etiquetas: [epic]
---

## Objetivo
Qué consigue el usuario con esta funcionalidad y por qué existe.

## Alcance
- Lo que cubren sus historias.

## Plataformas
API, web y móvil.

## Historias
- US-LOGIN-001: [API] Iniciar sesión con credenciales válidas
- US-LOGIN-002: [Web] Mostrar el error de credenciales incorrectas
- US-LOGIN-003: [Web] Bloquear la cuenta tras 5 intentos fallidos

## Fuera de alcance
- Lo que esta épica no cubre.
````

La lista de historias de la épica se mantiene a mano. El enlace entre la épica y sus historias como sub-issues lo crea la sincronización.

## Reglas de redacción

- **Gherkin en español**: `Característica`, `Esquema del escenario`, `Ejemplos`, `Dado`, `Cuando`, `Entonces`, `Y`. El bloque va en una valla de código con el lenguaje `gherkin`.
- **Al menos un Esquema del escenario por historia**, con su tabla de `Ejemplos`. La tabla incluye **casos negativos** y, si hay un umbral, **valores límite**: n−1, n y n+1 (el ejemplo de arriba prueba 4, 5 y 6 intentos).
- **Datos concretos**: códigos del seed (`PRG-001`, `REQ-001`, `TC-001`, `NC-001`), usuarios demo (`docs/GUIA-ALUMNO.md`), roles, mensajes exactos de la interfaz en español y códigos HTTP.
- **Describe lo que la funcionalidad debe hacer**, no lo que el código casualmente hace. Cada ejemplo concreto se ejecuta contra la app en marcha antes de darlo por bueno.
- **Nada de implementación**: ninguna historia menciona términos de implementación (identificadores de prueba, localizadores) ni de la mecánica del curso, ni nombres de componentes o de funciones. El linter revisa el título y todo el cuerpo, bloques de código incluidos, y **cuando encuentra uno imprime el término exacto** que debes quitar.
- **Sin menciones ni referencias sueltas**: GitHub convierte `@usuario` en una notificación y `#12` en un enlace a otro issue. Escríbelos entre comillas invertidas (`` `@usuario` ``) o reformula. Un correo (`admin@sigpro.test`) no cuenta.
- **El relato** (`## Historia`) empieza por «Como » y dice qué quiere el rol («… quiero …»), con ese orden y sin negritas.

## Cómo se lee un Esquema del escenario

Un **Esquema del escenario** es una plantilla con huecos y una tabla que los rellena. Cada fila de `Ejemplos` es un caso de prueba:

- `Dado` es el contexto, `Cuando` la acción y `Entonces` / `Y` lo que se observa.
- Los huecos son los marcadores `<nombre>` de los pasos. Cada uno se corresponde con una **columna** de la tabla, por su nombre exacto: la primera línea de la tabla es la cabecera, y en cada fila el marcador se sustituye por la celda de esa columna.
- El ejemplo de arriba contiene por tanto cuatro casos: con 3 fallos previos y una contraseña incorrecta se ve «Correo o contraseña incorrectos» y la cuenta sigue activa; con 4 y una incorrecta se ve el aviso de bloqueo y la cuenta queda bloqueada; y así con las otras dos filas.
- Todas las filas tienen tantas celdas como la cabecera. Un `|` literal dentro de una celda se escribe `\|`.
- Una comparación como «valor < 5 y > 3» no es un marcador: un marcador no lleva espacio tras el `<` ni antes del `>`. Un `<valor>` pegado sí lo es, y entonces `valor` debe ser una columna.

## Funcionalidad ausente o simulada: `no-implementada`

Cuando la app no tiene una capacidad o solo la simula (aprobar cuentas pendientes, el correo real de recuperación y de verificación, el acceso con SSO, las lagunas conocidas del móvil), la historia describe **el ideal**, no el contrato actual.

- **Cuándo se usa.** Solo para capacidades **sin ningún camino de código real** o **simuladas a propósito**. Un comportamiento que existe pero es incorrecto, o difiere de lo que debería hacer, **nunca** se marca `no-implementada`: se describe con lo que debe hacer, como cualquier otra historia. En caso de duda: si hay pantalla, ruta o endpoint con comportamiento real, no es `no-implementada`.
- **Cómo se marca.** Etiqueta `no-implementada` en `etiquetas` y `verificacion: no-ejecutable`; una cosa implica la otra y el linter lo exige en los dos sentidos. Sus ejemplos se revisan por lectura contra el plan, `docs/DECISIONS.md` y la plataforma que sí tiene la capacidad; no se ejecutan.
- **Patrón de dos historias para un sucedáneo con contrato observable.** Si lo que hay en su lugar tiene un comportamiento que se puede probar, ese contrato tiene su **propia historia ejecutable**, aparte de la del ideal, y se enlazan con `relacionadas`:
  - `POST /api/auth/forgot` responde 202 sin enviar nada, igual exista o no el correo. La historia «llega un correo con el enlace» es `no-implementada`; la historia «el endpoint responde 202 con la misma respuesta» es una historia `api` ejecutable (con `cubre: ["POST /api/auth/forgot"]`). Lo mismo vale para `/resend`.
  - `GET /api/auth/sso` responde 501 `sso_not_available`. «Entrar con SSO» es `no-implementada`; el 501 tiene su historia `api` ejecutable.

## Valores de `verificacion`

Dice cómo se comprobó la historia contra la app. No se publica en GitHub.

| Valor | Cuándo |
| --- | --- |
| `ejecutada` | Cada ejemplo concreto se ejecutó contra la app: la API con `curl` o `fetch`, la web y Expo web en el navegador, Android en el emulador (API 33). |
| `codigo` | Se comprobó leyendo el código y los textos de la interfaz, sin ejecutarla. |
| `pendiente-nativo` | Depende de un sistema nativo que no se ha podido ejecutar. Es el valor de **toda** historia `ios`. |
| `no-ejecutable` | La historia es `no-implementada`: no hay nada que ejecutar. |

## Comandos

Desde la raíz del repositorio:

| Comando | Qué hace |
| --- | --- |
| `pnpm stories:lint` | Lee `docs/user-stories`, aplica las reglas y sale con código 1 si hay algún hallazgo. Imprime `ruta: [regla] mensaje` y, al final, `stories lint: N archivos revisados, M hallazgos`. Lo ejecuta el CI. |
| `pnpm stories:coverage` | Cruza los endpoints, las rutas web y móviles y los permisos de la app con lo que cubren las historias e imprime los huecos (código 0). Con `-- --write` escribe `COBERTURA.md`; con `-- --check` sale con 1 si hay huecos o si `COBERTURA.md` está desactualizado. Necesita `@sigpro/shared` compilado (`pnpm --filter @sigpro/shared build`). El objetivo es **cero huecos**, sin lista de exclusiones. |
| `pnpm stories:sync` | Compara los archivos con los issues de GitHub e imprime el plan **en seco**: no escribe nada. Con `-- --apply` ejecuta el plan. Necesita la CLI `gh` con sesión iniciada. |

Sobre `stories:sync`:

- **No ejecutes `--apply` sin autorización explícita**: el repositorio (`gsanchezm/sigpro`) es público y publicar es irreversible a efectos prácticos. Antes se revisa el plan en seco.
- Es **idempotente**: reconoce cada issue por una marca oculta con el id en el cuerpo, solo toca los issues creados por la cuenta autenticada, y volver a ejecutarlo no duplica nada. Si se interrumpe, al reanudar solo propone lo que falta.
- Crea las etiquetas que faltan, luego las épicas y las historias, y enlaza cada historia como sub-issue de su épica. Espacia las escrituras y, si GitHub pide esperar por límite de uso, espera y reintenta.
- **No cierra ni borra issues**; no existe ninguna opción para hacerlo.
- Si el linter encuentra hallazgos, la sincronización se aborta antes de hablar con GitHub.

## Lo que el linter no ve

El linter es una red, no una garantía. Tenlo presente al escribir:

1. **Los archivos con otro nombre no se leen** (ver «Carpetas y nombres»). Un `us-login-001.md` o un `Epic.md` pasa el linter con 0 hallazgos y nunca se publica.
2. **No uses tablas de datos dentro de los pasos**; las tablas van solo en `Ejemplos:`. Toda tirada de líneas que empiezan por `|` dentro de un Esquema se lee como una tabla de ejemplos: una tabla de datos bajo un paso puede ocultar un marcador sin columna y confunde a quien lea el criterio.
3. **Cierra siempre las vallas de código.** Una valla sin cierre se lleva el resto del archivo: lo que quede debajo se trata como código (no se vigilan las menciones sueltas y en GitHub se vería como código). La valla del Gherkin lleva el lenguaje `gherkin`; con otro nombre o sin él el linter no encuentra el Esquema.
4. **El linter no sabe si lo que escribes es cierto**: no ejecuta los ejemplos ni comprueba que `cubre` o `permisos` existan. De lo primero responde `verificacion`; de lo segundo, la matriz de cobertura.
5. **Lo que se edita a mano en GitHub se pierde.** La sincronización lleva el issue al estado del archivo: el título, el cuerpo, las etiquetas y la épica padre de un issue ya sincronizado que se cambien en GitHub **se restablecen en la siguiente sincronización**. Los archivos mandan: cambia el Markdown, no el issue.
6. **`COBERTURA.md` se genera, no se edita a mano.** Se regenera con `pnpm stories:coverage -- --write`; `-- --check` falla si no coincide con lo que se generaría ahora.

## Reglas del linter

| Regla | Qué comprueba |
| --- | --- |
| `frontmatter` | El archivo se puede leer: empieza con `---`, el YAML es válido y los campos cumplen el esquema (sin claves desconocidas). |
| `id-unico` | Ningún id se repite entre archivos. |
| `epica-existe` | La épica de la historia existe. |
| `plataforma-unica` | Exactamente una etiqueta de plataforma, más `no-implementada` si procede, y ninguna otra. |
| `prefijo-titulo` | El título empieza por el prefijo de su plataforma y un espacio. |
| `archivo-id` | El archivo se llama como su id, está en la carpeta de su épica y el id tiene la forma `US-<SLUG>-NNN`. |
| `relacionadas-existen` | Cada relacionada es una historia (no una épica) que existe. |
| `historia-como` | `## Historia` empieza por «Como » y contiene «quiero». |
| `esquema-requerido` | Hay un bloque `gherkin` y cada Esquema del escenario tiene una tabla de `Ejemplos` con filas. |
| `placeholder-columna` | Cada marcador `<nombre>` de los pasos es una columna de `Ejemplos`. |
| `fila-celdas` | Cada fila de `Ejemplos` tiene tantas celdas como la cabecera. |
| `gherkin-ingles` | Sin palabras clave de Gherkin en inglés. |
| `no-ejecutable-etiqueta` | `verificacion: no-ejecutable` si y solo si la etiqueta `no-implementada`. |
| `ios-pendiente-nativo` | Una historia `ios` lleva `pendiente-nativo` o `no-ejecutable`. |
| `terminos-prohibidos` | Ni el título ni el cuerpo contienen términos de implementación o de la mecánica del curso; el hallazgo imprime el término exacto. |
| `mencion-suelta` | Ninguna `@usuario` ni `#n` suelta fuera de código. |
