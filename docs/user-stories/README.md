# Historias de usuario de SIGPRO

Los requisitos de SIGPRO escritos como **épicas** e **historias de usuario** en español. Sirven para dos cosas:

1. **Practicar la lectura de requisitos**, a mano (alumnado) y con agentes: dado un issue, derivar los casos de prueba sin abrir el código.
2. **Ser la referencia contra la que se prueba la app**: quien prueba siguiendo el texto de la historia, con sus casos negativos y sus valores límite, comprueba mucho más que quien solo recorre el camino feliz.

Por eso cada historia es un requisito: dice **lo que la funcionalidad debe hacer**, con el valor, el mensaje y el orden exactos, y no se escribe copiando el código. Este documento es la guía para quien escribe y para quien lee. El diseño completo está en `docs/superpowers/specs/2026-11-13-user-stories-design.md`.

Los archivos Markdown de esta carpeta son la **fuente del texto de los issues**, y el comportamiento correcto se define en ellos. **No son una descripción de lo que la app hace hoy**: una historia vigente dice lo que la app debe cumplir, y una historia de capacidad futura describe algo que la app todavía no tiene (ver «Cómo leer un issue publicado»). GitHub es solo un reflejo que se publica con `pnpm stories:sync`.

## Qué es una épica y qué es una historia

- **Épica**: un issue padre con la etiqueta `epic`. Agrupa una funcionalidad («Login», «Requisitos», «Auditoría») y recoge su objetivo, su alcance, las plataformas que toca, la lista de sus historias y lo que queda fuera.
- **Historia**: un sub-issue de una épica. Es **un tema de una funcionalidad en una plataforma**, con uno o varios Esquemas del escenario; **cada Esquema es un comportamiento verificable** («el 5.º intento fallido consecutivo bloquea la cuenta»). Cuántas historias tiene una épica lo fija «Granularidad».

Cada historia se basta a sí misma: su título, su relato, sus reglas y sus criterios de aceptación alcanzan para diseñar las pruebas (ver «Criterio de autonomía de una historia»). Si la misma regla vale en varias plataformas, **cada plataforma tiene su historia**, redactada con su superficie (en `api`, estados y cuerpos HTTP; en `web` y `movil`, lo que el usuario ve y hace), y se enlazan con `relacionadas`.

## Granularidad

Decisión del usuario tras el piloto `EP-LOGIN`; vale para todas las épicas.

- **Tope: unas 15 historias por épica.** Entre 12 y 16 está bien; más de 16, no. Una épica pequeña puede tener menos.
- **Lo que no cabe se fusiona**: una historia reúne los comportamientos de un mismo tema y plataforma (por ejemplo, «credenciales incorrectas y bloqueo en el 5.º intento», o «avisos de cuenta pendiente y desactivada»), y cada comportamiento es **un Esquema del escenario** con sus Ejemplos. Un Esquema no mezcla dos comportamientos.
- **Se fusiona primero** lo que comparte pantalla o endpoint y preparación del estado; nunca historias de plataformas distintas.
- **La API sigue siendo la más atómica** (estados y cuerpos HTTP por regla de negocio), dentro del tope.
- **Una capacidad `no-implementada` no se fusiona con una vigente**: la etiqueta y la línea de estado del issue publicado son de la historia entera.
- **`cubre` y `permisos` de una historia fusionada son la unión** de los de sus partes: `pnpm stories:coverage` no debe ganar huecos al fusionar.

## Carpetas y nombres de archivo

```text
docs/user-stories/
  ejemplo/               carpeta de EP-EJEMPLO: el id de la épica sin «EP-», en minúsculas
    epic.md
    US-EJEMPLO-001.md
    US-EJEMPLO-002.md
  COBERTURA.md           generado, no se edita a mano
  README.md              esta guía
```

- Épica: `EP-<SLUG>` y archivo `<slug>/epic.md`. Historia: `US-<SLUG>-NNN` (tres dígitos, numeración dentro de la épica, **sin reutilizar números** una vez publicada) y archivo `<slug>/US-<SLUG>-NNN.md`.
- **Solo se leen los archivos que se llaman exactamente `epic.md` o empiezan por `US-` y acaban en `.md`.** Cualquier otro nombre (`us-ejemplo-001.md`, `Epic.md`, `US_EJEMPLO_001.md`) **se ignora en silencio**: no se revisa, no entra en la cobertura y nunca se publica. El linter no avisa. Comprueba que el número de «archivos revisados» de su última línea coincide con los que has creado.

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
| `no-implementada` | (el de su plataforma) | La capacidad no existe en la app o solo está simulada; es material de lectura, no se prueba contra la app |

Reglas:

- El título de una historia empieza por el prefijo de su plataforma seguido de un espacio: `[Web] Bloquear la cuenta tras 5 intentos fallidos`.
- **Historias `ios` y `android` solo si el comportamiento observable cambia por el sistema**: el botón atrás de Android, el selector de imágenes y de documentos, la hoja de compartir, los permisos del sistema, el teclado, las áreas seguras. Si el comportamiento es el mismo, basta la historia `movil`.
- Las historias `ios` **no se pueden ejecutar**: iOS nunca se ha abierto en un Simulador (`docs/MOBILE-PARITY.md`). Llevan `verificacion: pendiente-nativo` (o `no-ejecutable` si además son `no-implementada`). Android solo se ha usado en el emulador (API 33), y no para todo: una historia `android` que no se ha ejecutado en él también lleva `pendiente-nativo`.

## Cómo leer un issue publicado

El cuerpo publicado de cada **historia** lleva, justo debajo de la línea `**Id:** … · **Épica:** …`, una línea de estado (la épica no la lleva):

| Línea | Qué significa para quien prueba |
| --- | --- |
| `**Estado:** vigente — la app debe cumplirlo; si no lo cumple, es un defecto.` | Se prueba contra la app. **Toda desviación** entre la app y el texto del issue es un hallazgo que se reporta. |
| `**Estado:** capacidad futura — la app todavía no la tiene; no se prueba contra la app.` | Material de lectura (historias con la etiqueta `no-implementada`): describe lo mínimo acordado de algo que no existe y, en «Decisiones pendientes», lo que aún no está decidido. No se reporta como defecto que la app no lo haga. |

- La línea la escribe la sincronización a partir de la etiqueta `no-implementada`; no la escribas a mano.
- El issue **no dice si la app cumple hoy** una historia vigente. Las diferencias conocidas entre una historia vigente y la app son material del instructor y no se publican: encontrarlas es el ejercicio.
- `verificacion` (front matter) no se publica: dice cómo se escribió la historia (ver «Valores de `verificacion`»), no si la app la cumple.

## Plantilla de una historia

El front matter es para el repositorio; el cuerpo es lo que se publica. Este ejemplo está relleno con datos concretos: cópialo y sustituye. Sus datos salen del código y de los textos de la interfaz, sin ejecutarlos contra la app; por eso lleva `verificacion: codigo`.

````markdown
---
id: US-EJEMPLO-003
tipo: historia
epica: EP-EJEMPLO
titulo: "[Web] Bloquear la cuenta tras 5 intentos fallidos"
etiquetas: [web]
relacionadas: [US-EJEMPLO-002]
verificacion: codigo
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
- Preparación de cada fila, en el tenant `alumno01`: se reinicia el tenant con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y después se envían tantos intentos con una contraseña incorrecta como indique `fallos_previos`. Así las filas son independientes y se pueden repetir en cualquier orden.

## Criterios de aceptación
```gherkin
Característica: Bloqueo de cuenta tras intentos fallidos

  Esquema del escenario: El quinto intento fallido bloquea la cuenta
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login?tenant=alumno01 escribe ese correo y la contraseña <contraseña> y pulsa «Entrar»
    Entonces en menos de 5 segundos ve <mensaje>
    Y la cuenta queda <cuenta>

    Ejemplos:
      | fallos_previos | contraseña | mensaje | cuenta |
      | 3 | incorrecta | «Correo o contraseña incorrectos» | activa |
      | 4 | incorrecta | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» | bloqueada |
      | 4 | Gestor1234! | «Sesión iniciada. Redirigiendo a Programas…» | activa |
      | 5 | Gestor1234! | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» | bloqueada |
```

## Fuera de alcance
- El desbloqueo de la cuenta por un administrador.
````

Una historia `no-implementada` lleva además la sección `## Decisiones pendientes` (regla `decisiones-pendientes`): lo que la historia no puede afirmar porque nadie lo ha decidido todavía. Si de verdad no queda nada, la viñeta dice «Ninguna.».

````markdown
---
id: US-EJEMPLO-004
tipo: historia
epica: EP-EJEMPLO
titulo: "[Móvil] Mostrar y ocultar la contraseña"
etiquetas: [movil, no-implementada]
relacionadas: [US-EJEMPLO-003]
verificacion: no-ejecutable
---

## Historia
Como persona que escribe su contraseña en el móvil, quiero poder verla en claro y volver a ocultarla,
para comprobar que la he escrito bien antes de enviarla, como en la web.

## Reglas
- La contraseña empieza oculta y el control alterna entre verla en claro y ocultarla, como en la web.
- Mostrar u ocultar no cambia lo escrito ni envía el formulario.

## Criterios de aceptación
```gherkin
Característica: Mostrar y ocultar la contraseña en la app móvil

  Esquema del escenario: El control alterna la visibilidad de la contraseña
    Dado que una persona sin sesión en /login ha escrito Consul1234! en «Contraseña»
    Cuando pulsa el control de la contraseña <veces> veces
    Entonces la contraseña se ve <visibilidad>
    Y el campo sigue conteniendo Consul1234!

    Ejemplos:
      | veces | visibilidad |
      | 0 | oculta |
      | 1 | en claro |
      | 2 | oculta |
```

## Decisiones pendientes
- Si el control es un botón con texto, como en la web, o un icono, y su nombre accesible.
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

`relacionadas` se publica sola como sección «Relacionadas» al final del issue: no la escribas a mano en el cuerpo. Tampoco escribas la marca de identidad ni las líneas `Id` / `Épica` y `Estado` del principio: las añade la sincronización. `verificacion` no se publica.

### Cobertura: `cubre` y `permisos`

La matriz de cobertura exige que cada endpoint de la API, cada ruta de la web y de la app móvil y cada clave de `PERMISSIONS` aparezca en al menos una historia. Cada historia lo declara en su front matter:

- **`cubre`** lista lo que cubre según su plataforma, y solo cuenta si la plataforma coincide:
  - `api`: endpoints, con el verbo en mayúsculas y la ruta como en el controlador, por ejemplo `"POST /api/auth/login"` o `"GET /api/programs/:code"`.
  - `web`: rutas de la web, por ejemplo `"/login"` o `"/programs/:code"`.
  - `movil`, `ios` y `android`: rutas de la app móvil, con la misma forma.
  - `transversal` no cubre endpoints ni rutas: solo puede cubrir permisos.
- **`permisos`** lista claves de `PERMISSIONS` (`packages/shared/src/permissions.ts`) y vale en cualquier plataforma.
- Un endpoint que una historia solo usa para preparar el estado o para comprobar un efecto (el reinicio del tenant, o la renovación del token tras cerrar sesión) **no** va en su `cubre`: lo cubre la historia de su propia épica.

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
id: EP-EJEMPLO
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
- US-EJEMPLO-001: [API] Iniciar sesión con credenciales válidas
- US-EJEMPLO-002: [Web] Mostrar el error de credenciales incorrectas
- US-EJEMPLO-003: [Web] Bloquear la cuenta tras 5 intentos fallidos

## Fuera de alcance
- Lo que esta épica no cubre.
````

La lista de historias de la épica se mantiene a mano. El enlace entre la épica y sus historias como sub-issues lo crea la sincronización.

## Preparación del estado y aislamiento

Cada fila de una tabla de `Ejemplos` es un caso de prueba que parte de un **estado inicial explícito**, y las filas son **independientes**: se pueden ejecutar en cualquier orden y repetir sin contaminar otras pruebas. Cada historia dice cómo se crea ese estado, en una columna (`fallos_previos`, `estado_inicial`) o en una regla que empieza por «Preparación», con este procedimiento estándar:

1. **Un tenant por Esquema, dicho en el Esquema.** Los ejemplos usan `alumno01`; cada alumno usa el suyo (`alumnoNN`). En la web se entra con `/login?tenant=alumno01`; en la app móvil, con `alumno01` en «Tenant de trabajo»; en la API, con la cabecera `x-tenant: alumno01`. No se usa `demo`: es compartido y su único administrador tiene segundo factor.
2. **Las cuentas del seed** (`docs/GUIA-ALUMNO.md` §3) existen en todos los tenants y, tras un reinicio, están así: todas activas y sin intentos fallidos, salvo `bloqueado@sigpro.test` (bloqueada) y `pendiente@sigpro.test` (pendiente de aprobación). `alumnoNN@sigpro.lab` (`Alumno1234!`, rol `admin`, sin segundo factor) solo existe en su tenant.
3. **Los estados que se fabrican** se crean después de reiniciar el tenant, y la historia lo dice:
   - *N intentos fallidos previos*: se envían N inicios de sesión con una contraseña incorrecta.
   - *Cuenta desactivada*: un administrador del tenant la desactiva (Administración, o `PATCH /api/admin/users/<id>` con `active: false`).
   - *Sesión iniciada*: se inicia sesión en la propia prueba con la cuenta y el tenant de la fila.
4. **Datos que no se pueden repetir**: un correo sin cuenta se escribe `(correo sin cuenta)` y es **un correo nuevo en cada fila y en cada ejecución**: `nadie-` seguido de una marca de tiempo y `@sigpro.test`. Una solicitud de acceso se escribe `(cuenta recién solicitada)`: una solicitud hecha en la prueba con un correo nuevo, `nueva-` seguido de una marca de tiempo y `@organizacion.es`.
5. **Restauración**: `POST /api/admin/reset` con `Authorization: Bearer` y el token de acceso de un administrador del tenant (en `alumnoNN`, el de `alumnoNN@sigpro.lab`). El reinicio se aplica al tenant del token; la cabecera `x-tenant` no lo cambia. Se hace **antes de cada fila**, también de las que solo inician sesión con la contraseña correcta (otra prueba anterior puede haber dejado la cuenta bloqueada), y al terminar. Cada primer paso lo dice: «Dado que el tenant alumno01 está recién reiniciado…».

**Qué restaura el reinicio y qué no:**

- Restaura **todos los datos del tenant** desde el seed: las cuentas con su estado (intentos fallidos a cero, bloqueo, pendiente de aprobación, activa o no y rol) y el resto de datos. Borra las cuentas solicitadas durante las pruebas. Conserva la configuración del modo caos del tenant.
- **No** restaura el número de intentos de un correo que no tiene cuenta: no es un dato del tenant. Por eso esas filas usan siempre un correo nuevo, nunca uno ya usado.
- **No** cierra las sesiones abiertas antes del reinicio: los tokens ya emitidos siguen valiendo hasta caducar (ver «Cerrar sesión» en la épica de Login).

## Criterio de autonomía de una historia

Una historia se puede probar **sin leer otra** si cumple todo esto:

- **Precondiciones con datos observables**: quién (correo), con qué rol, en qué tenant y en qué estado inicial (intentos fallidos, bloqueada, desactivada, sesión iniciada y en qué pantalla). Ver «Preparación del estado y aislamiento».
- **Esperas con un límite explícito**: «en menos de 5 segundos», «a los 2 segundos sigue visible». Nunca una espera sin límite. Los límites de las historias son **tolerancias de la prueba, no garantías del producto**: 1 segundo para las reacciones de la propia pantalla que no esperan al servidor (avisos de validación, mostrar u ocultar, borrar un aviso al editar), 5 segundos para todo lo que pasa por la red o cambia de pantalla, y 2 segundos para que aparezca un aviso emergente. Los valores que sí son del producto se dicen como regla (por ejemplo, «el aviso se cierra solo a los 3 segundos»).
- **Sin expresiones vagas**: ni «con la sesión» (di de quién y en qué tenant), ni «al cabo de un momento», «un momento», «enseguida» o «en breve» (di el límite).
- **Las referencias a otras historias van solo en `relacionadas`**: ninguna regla ni paso remite a otra historia para entenderse o ejecutarse. Si un comportamiento de otra plataforma importa, se repite aquí con su superficie.
- **Lo que no se prueba aquí** va en «Fuera de alcance», nombrando la épica que lo cubre.

## Detalle técnico visible

En las pantallas de Acceso de la web y de la app móvil, el aviso de error y la pantalla de redirección muestran, bajo el mensaje para la persona, una **línea de detalle técnico** con la petición HTTP real: `POST /api/auth/login → 423 Locked`, `POST /api/auth/login → 401 Unauthorized · attempts=2` o `POST /api/auth/login → 200 · role=program_manager`. Es una **función deliberada del laboratorio**, no un diagnóstico: sale del diseño de las pantallas (la alerta lleva un título y la traza HTTP; la pantalla de redirección, el endpoint real y el rol), y deja relacionar lo que se ve con la API.

En las historias:

- **El mensaje y la línea de detalle técnico son criterios distintos**, en pasos distintos.
- **La línea se afirma con el mínimo estable**: contiene el método, la ruta y el código de estado (`POST /api/auth/login → 423`). Lo que sigue al código (`Locked`, `· reason=…`) no forma parte del criterio salvo que la historia lo diga. Dos excepciones, escritas siempre: `attempts=N` en un 401 del inicio de sesión (es el único sitio donde se ve el número de intento) y `role=<rol>` en la pantalla de redirección.
- En los pasos y en las celdas el detalle va **sin «…»**: se comprueba que la línea lo contiene, no que sea igual.

## Reglas de redacción

- **Gherkin en español**: `Característica`, `Esquema del escenario`, `Ejemplos`, `Dado`, `Cuando`, `Entonces`, `Y`. El bloque va en una valla de código con el lenguaje `gherkin`.
- **Al menos un Esquema del escenario por historia**, con su tabla de `Ejemplos`. La tabla incluye **casos negativos** y, si hay un umbral, **valores límite**: n−1, n y n+1 (el ejemplo de arriba prueba el 4.º, el 5.º y el 6.º intento).
- **Datos concretos**: códigos del seed (`PRG-001`, `REQ-001`, `TC-001`, `NC-001`), usuarios demo (`docs/GUIA-ALUMNO.md`), roles, mensajes exactos de la interfaz en español y códigos HTTP.
- **Describe lo que la funcionalidad debe hacer**, no lo que el código casualmente hace. Cada ejemplo concreto se ejecuta contra la app en marcha antes de darlo por bueno; si se escribió sin la app en marcha, la historia lleva `verificacion: codigo` y sus ejemplos se ejecutan antes de publicarla.
- **Nada de implementación**: ninguna historia menciona términos de implementación (identificadores de prueba, localizadores) ni de la mecánica del curso, ni nombres de componentes o de funciones. El linter busca los identificadores de prueba, los localizadores y los términos de la mecánica del curso en el título y en todo el cuerpo, bloques de código incluidos, y **cuando encuentra uno imprime el término exacto** que debes quitar. Los nombres de componentes y de funciones no los detecta (ver «Lo que el linter no ve»).
- **Sin menciones ni referencias sueltas**: GitHub convierte `@usuario` en una notificación y `#12` en un enlace a otro issue. Escríbelos entre comillas invertidas (`` `@usuario` ``) o reformula. Un correo (`admin@sigpro.test`) no cuenta.
- **El relato** (`## Historia`) empieza por «Como » y dice qué quiere el rol («… quiero …»), con ese orden y sin negritas.
- **Mensajes sin texto en el catálogo**: si la interfaz debería mostrar un aviso que el catálogo de textos (`packages/shared/src/i18n`) no tiene, no inventes la frase exacta: describe su contenido (en una pantalla ficticia de reservas, por ejemplo: «menciona “caducada” y no menciona “cancelada”») o, si el usuario fija el texto, escribe ese texto exacto.

### Convenciones de los Esquemas

- **Textos de la interfaz entre «…»**, en los pasos y en las celdas: títulos, etiquetas, botones y avisos (`pulsa «Entrar»`, `| «Correo o contraseña incorrectos» |`). Si un marcador recibe un texto de la interfaz, las comillas van en la celda, no alrededor del marcador. La línea de detalle técnico es la excepción (ver «Detalle técnico visible»).
- **Los datos van tal cual**, sin comillas: correos, contraseñas, tenants, códigos, rutas, códigos HTTP y campos de la API (`gestor@sigpro.test`, `Gestor1234!`, `alumno01`, `/programs`, `423 account_locked`).
- **Lo que no se puede escribir literalmente va entre paréntesis**: `(vacío)` para un campo o un cuerpo vacío, `(tres espacios)`, `(sin el campo)`, `(sin cabecera)`, `(ninguno)`. Gherkin recorta los espacios de las celdas, y una celda vacía no distingue «vacío» de «ausente».
- **Datos que no se pueden repetir** (un correo sin cuenta o una solicitud de acceso) se escriben entre paréntesis y se definen en las Reglas: `(correo sin cuenta)` y `(cuenta recién solicitada)`, como en «Preparación del estado y aislamiento».
- **El primer paso de cada Esquema empieza por «Dado que …»** y dice el tenant y el estado inicial.
- **Una acción que envía un formulario dice qué se escribe en cada campo**: un envío sin correo no llega al servidor.

## Cómo se lee un Esquema del escenario

Un **Esquema del escenario** es una plantilla con huecos y una tabla que los rellena. Cada fila de `Ejemplos` es un caso de prueba:

- `Dado` es el contexto, `Cuando` la acción y `Entonces` / `Y` lo que se observa.
- Los huecos son los marcadores `<nombre>` de los pasos. Cada uno se corresponde con una **columna** de la tabla, por su nombre exacto: la primera línea de la tabla es la cabecera, y en cada fila el marcador se sustituye por la celda de esa columna.
- El ejemplo de arriba contiene por tanto cuatro casos: con 3 fallos previos y una contraseña incorrecta se ve «Correo o contraseña incorrectos» y la cuenta sigue activa; con 4 y una incorrecta se ve el aviso de bloqueo y la cuenta queda bloqueada; y así con las otras dos filas. Cada uno empieza reiniciando el tenant, como dice su regla «Preparación».
- Todas las filas tienen tantas celdas como la cabecera. Un `|` literal dentro de una celda se escribe `\|`.
- Una comparación como «valor < 5 y > 3» no es un marcador: un marcador no lleva espacio tras el `<` ni antes del `>`. Un `<valor>` pegado sí lo es, y entonces `valor` debe ser una columna.

## Funcionalidad ausente o simulada: `no-implementada`

Cuando la app no tiene una capacidad o solo la simula (aprobar cuentas pendientes, el correo real de recuperación y de verificación, el acceso con SSO, las lagunas conocidas del móvil), la historia describe **lo mínimo acordado de esa capacidad**, no el contrato actual ni un diseño inventado.

- **Cuándo se usa.** Solo para capacidades **sin ningún camino de código real** o **simuladas a propósito**. Un comportamiento que existe pero es incorrecto, o difiere de lo que debería hacer, **nunca** se marca `no-implementada`: se describe con lo que debe hacer, como cualquier otra historia. En caso de duda: si hay pantalla, ruta o endpoint con comportamiento real, no es `no-implementada`.
- **Cómo se marca.** Etiqueta `no-implementada` en `etiquetas` y `verificacion: no-ejecutable`; una cosa implica la otra y el linter lo exige en los dos sentidos. Sus ejemplos se revisan por lectura contra el plan y la plataforma que sí tiene la capacidad; no se ejecutan.
- **Qué afirma.** Solo lo que ya existe en otra plataforma (la paridad con la web es el requisito, y la historia web va en `relacionadas`) o lo que se ha decidido. **Una historia no puede afirmar lo que está sin decidir**: proveedor, método, textos o estados que nadie ha fijado van a `## Decisiones pendientes`, con una viñeta cada uno (regla `decisiones-pendientes`; «- Ninguna.» si no queda nada).
- **Patrón de dos historias para un sucedáneo con contrato observable.** Si lo que hay en su lugar tiene un comportamiento que se puede probar, ese contrato tiene su **propia historia vigente**, aparte de la capacidad futura, y se enlazan con `relacionadas`:
  - `POST /api/auth/forgot` responde 202 sin enviar nada, igual exista o no el correo. La historia «llega un correo con el enlace» es `no-implementada`; la historia «el endpoint responde 202 con la misma respuesta» es una historia `api` vigente (con `cubre: ["POST /api/auth/forgot"]`). Lo mismo vale para `/resend`.
  - `GET /api/auth/sso` responde 501 `sso_not_available`. «Entrar con SSO» es `no-implementada`; el 501 tiene su historia `api` vigente.

## Valores de `verificacion`

Dice cómo se escribió y se comprobó la historia. No se publica en GitHub y no dice si la app cumple la historia.

| Valor | Cuándo |
| --- | --- |
| `ejecutada` | Cada ejemplo concreto se ejecutó contra la app: la API con `curl` o `fetch`, la web y Expo web en el navegador, Android en el emulador (API 33). |
| `codigo` | Se derivó del código, de los textos de la interfaz y de los specs e2e, sin ejecutar ningún ejemplo contra la app. |
| `pendiente-nativo` | Depende de un sistema nativo en el que no se ha ejecutado. Es el valor de **toda** historia `ios` y de una historia `android` no ejecutada en el emulador. |
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
7. **No reconoce nombres de componentes ni de funciones.** Solo busca una lista fija de términos (identificadores de prueba, localizadores y la mecánica del curso). Un nombre de componente o de función del código pasa el linter sin hallazgos: revísalo tú al escribir, igual que cualquier otro detalle de implementación (claves de almacenamiento del navegador, atributos ARIA, nombres de archivo).
8. **No comprueba la autonomía ni la preparación del estado.** Una expresión vaga («al cabo de un momento») o una fila que depende de la anterior pasan el linter: busca esas expresiones con `grep` antes de dar la épica por terminada.

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
| `decisiones-pendientes` | Una historia `no-implementada` tiene la sección `## Decisiones pendientes` con al menos una viñeta («- Ninguna.» si no queda nada). |
