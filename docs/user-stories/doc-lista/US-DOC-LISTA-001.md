---
id: US-DOC-LISTA-001
tipo: historia
epica: EP-DOC-LISTA
titulo: "[API] Listar los documentos del tenant con sus campos y su orden"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-DOC-LISTA-002, US-DOC-LISTA-003]
verificacion: ejecutada
cubre: ["GET /api/documents"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con una sesión iniciada en un tenant, quiero pedir la lista de documentos de ese tenant,
para mostrar a quien consulta cada documento con su programa, su clasificación y su versión vigente, sin ver los de otra organización.

## Reglas
- `GET /api/documents` exige sesión: el `accessToken` va en la cabecera `Authorization` como Bearer. Sin cabecera responde 401 `missing_token`; con un Bearer que no es un `accessToken` válido (un texto que no es un token, o un `refreshToken`) responde 401 `invalid_token`. Ninguna de estas respuestas trae documentos.
- Con un `accessToken` válido responde 200 con un objeto de dos campos: `items`, la lista, y `hiddenCount`, un número entero que cuenta los documentos restringidos que el rol de quien pide no puede ver. Para `gestor@sigpro.test` (rol `program_manager`) vale 0. Cuándo vale más de 0 lo decide EP-DOC-RESTRINGIDOS.
- La lista no está paginada: trae de una vez todos los documentos del tenant que el rol puede ver.
- Cada elemento de `items` trae `id`, `programCode`, `programName`, `title`, `classification` (`public` o `restricted`), `version` (el número de la última versión) y `updatedAt` (fecha y hora en formato ISO 8601 de la creación de esa última versión).
- `programName` es el nombre del programa de `programCode` en el mismo tenant.
- Los elementos van en orden ascendente por `id`: `DOC-001` antes que `DOC-002`, y `DOC-010` después de `DOC-009`.
- La lista contiene solo documentos del tenant del token. La cabecera `x-tenant` no cambia el tenant de la petición, que es el del token.
- Datos del seed que citan los ejemplos: en cada tenant `alumnoNN` hay doce documentos, `DOC-001` a `DOC-012`, dos por cada programa de `PRG-001` a `PRG-006`. La fecha de `updatedAt` depende de la última versión: 2026-01-22T09:00:00.000Z si es la 1, 2026-01-29T09:00:00.000Z si es la 2 y 2026-02-05T09:00:00.000Z si es la 3.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); el reinicio se aplica al tenant de ese token. Después `gestor@sigpro.test` (contraseña `Gestor1234!`, rol `program_manager`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y su `accessToken` va en `Authorization: Bearer`.
- Preparación de las filas de aislamiento: además se reinicia `alumno02` con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`). Después `alumno02@sigpro.lab` inicia sesión con `x-tenant: alumno02` y publica con `POST /api/documents/DOC-001/versions` una versión nueva con `lines` de una sola línea, «Versión de prueba de aislamiento», y `note` «Prueba de aislamiento». Así `DOC-001` de `alumno02` queda en la versión 4. Esa publicación solo prepara el estado: publicar versiones es de EP-DOC-VERSIONES. `gestor@sigpro.test` inicia sesión también en `alumno02` con `x-tenant: alumno02`.

## Criterios de aceptación
```gherkin
Característica: Lista de documentos por la API

  Esquema del escenario: Cada documento trae sus campos y su versión vigente
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents con ese accessToken como Bearer
    Entonces la respuesta es 200 con 12 documentos y hiddenCount 0
    Y el primero es DOC-001 y el último es DOC-012
    Y el documento <codigo> tiene el título <titulo>, el programa <programa> con el nombre <nombre_programa>, la clasificación <clasificacion>, la versión <version> y updatedAt <actualizado>

    Ejemplos:
      | codigo | titulo | programa | nombre_programa | clasificacion | version | actualizado |
      | DOC-001 | Plan de verificación PRG-001 | PRG-001 | Sistema de mando táctico Ártemis | public | 3 | 2026-02-05T09:00:00.000Z |
      | DOC-002 | Especificación técnica PRG-001 | PRG-001 | Sistema de mando táctico Ártemis | public | 1 | 2026-01-22T09:00:00.000Z |
      | DOC-003 | Plan de verificación PRG-002 | PRG-002 | Radar de vigilancia costera RVC-2 | restricted | 2 | 2026-01-29T09:00:00.000Z |
      | DOC-012 | Especificación técnica PRG-006 | PRG-006 | Simulador de adiestramiento naval | restricted | 2 | 2026-01-29T09:00:00.000Z |

  Esquema del escenario: La lista solo la entrega una petición con un accessToken válido
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y un refreshToken
    Cuando pide GET /api/documents con <credencial>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera Authorization) | 401 missing_token |
      | Bearer con un texto que no es un token | 401 invalid_token |
      | Bearer con el refreshToken | 401 invalid_token |
      | Bearer con el accessToken | 200 con 12 documentos |

  Esquema del escenario: Cada tenant ve solo sus documentos y la versión de su propio DOC-001
    Dado que los tenants alumno01 y alumno02 están recién reiniciados y alumno02 ha publicado la versión 4 de DOC-001
    Cuando pide GET /api/documents con <credencial> y la cabecera x-tenant <cabecera>
    Entonces DOC-001 aparece con la versión <version>

    Ejemplos:
      | credencial | cabecera | version |
      | el accessToken de gestor@sigpro.test en alumno01 | (sin cabecera) | 3 |
      | el accessToken de gestor@sigpro.test en alumno01 | alumno02 | 3 |
      | el accessToken de gestor@sigpro.test en alumno02 | alumno01 | 4 |
      | el accessToken de gestor@sigpro.test en alumno02 | alumno02 | 4 |
```

## Decisiones pendientes
- Si la lista debe paginarse cuando un tenant tenga muchos documentos. Hoy no está paginada y devuelve todos de una vez; ningún ejemplo afirma lo que pasaría con más de doce.

## Fuera de alcance
- Los filtros por programa, clasificación y texto: historia siguiente de la API de esta épica.
- El permiso `document.viewRestricted`, qué roles ven los documentos restringidos, el valor de `hiddenCount` para cada rol y el aviso de ocultos: EP-DOC-RESTRINGIDOS.
- Publicar versiones, que aquí solo sirve para preparar la fila de aislamiento: EP-DOC-VERSIONES.
