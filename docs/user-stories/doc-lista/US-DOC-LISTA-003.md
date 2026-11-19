---
id: US-DOC-LISTA-003
tipo: historia
epica: EP-DOC-LISTA
titulo: "[API] Consultar el detalle de un documento con su historial de versiones"
etiquetas: [api]
relacionadas: [US-DOC-LISTA-001, US-DOC-LISTA-004, US-DOC-LISTA-009, US-DOC-LISTA-012]
verificacion: codigo
cubre: ["GET /api/documents/:id"]
---

## Historia
Como cliente de la API con una sesión iniciada, quiero pedir un documento por su código y ver sus datos y todas sus versiones,
para mostrar a quien consulta qué versión es la vigente, quién la publicó y qué cambió en cada una.

## Reglas
- `GET /api/documents/:id` exige sesión como la lista: sin cabecera `Authorization` responde 401 `missing_token`, y con un Bearer que no es un `accessToken` válido responde 401 `invalid_token`.
- Con un `accessToken` válido responde 200 con el documento directamente en el cuerpo, sin envolverlo: `id`, `programCode`, `programName`, `title`, `classification`, `version` y `updatedAt`, con el mismo significado que en la lista, y además `versions`.
- `version` es el número de la última versión, y `updatedAt` la fecha de creación de esa última versión.
- `versions` lista todas las versiones del documento, de la más antigua a la más nueva. Cada una trae `version` (número), `note` (texto de la nota de cambios; vacío si no hay nota), `authorName` (nombre de la cuenta que la publicó, o `null` si no hay autor registrado) y `createdAt` (fecha y hora ISO 8601 de la creación).
- El código se compara exacto: `doc-001` no es `DOC-001`. Un código que no existe en el tenant del token responde 404 con `code` y `message` iguales a `document_not_found`, sin ningún dato del documento.
- Datos del seed que citan los ejemplos: en cada tenant, todas las versiones del seed las publicó «Javier Ortega» (la cuenta `gestor@sigpro.test`). Las notas son «Versión inicial» (versión 1), «Ajuste de alcance y responsabilidades» (versión 2) y «Nuevos criterios de aceptación y anexos» (versión 3). Las fechas de creación son 2026-01-22T09:00:00.000Z, 2026-01-29T09:00:00.000Z y 2026-02-05T09:00:00.000Z, en ese orden.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); el reinicio se aplica al tenant de ese token. Después `gestor@sigpro.test` (contraseña `Gestor1234!`, rol `program_manager`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y su `accessToken` va en `Authorization: Bearer`.

## Criterios de aceptación
```gherkin
Característica: Detalle de un documento por la API

  Esquema del escenario: El detalle trae los datos del documento y sus versiones
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents/<id> con ese accessToken como Bearer
    Entonces la respuesta es 200 con el documento <id> del programa <programa>, la clasificación <clasificacion>, la versión <version> y updatedAt <actualizado>
    Y trae las versiones <versiones>

    Ejemplos:
      | id | programa | clasificacion | version | actualizado | versiones |
      | DOC-001 | PRG-001 | public | 3 | 2026-02-05T09:00:00.000Z | 1, 2 y 3 |
      | DOC-002 | PRG-001 | public | 1 | 2026-01-22T09:00:00.000Z | 1 |
      | DOC-003 | PRG-002 | restricted | 2 | 2026-01-29T09:00:00.000Z | 1 y 2 |

  Esquema del escenario: Cada versión del historial trae su nota, su autor y su fecha de creación
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents/DOC-001 con ese accessToken como Bearer
    Entonces la versión <version> del historial tiene la nota <nota>, el autor <autor> y createdAt <creado>

    Ejemplos:
      | version | nota | autor | creado |
      | 1 | Versión inicial | Javier Ortega | 2026-01-22T09:00:00.000Z |
      | 2 | Ajuste de alcance y responsabilidades | Javier Ortega | 2026-01-29T09:00:00.000Z |
      | 3 | Nuevos criterios de aceptación y anexos | Javier Ortega | 2026-02-05T09:00:00.000Z |

  Esquema del escenario: Solo se encuentra un documento por su código exacto del tenant
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents/<id> con ese accessToken como Bearer
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | id | respuesta |
      | DOC-000 | 404 document_not_found, sin datos del documento |
      | DOC-001 | 200 con el título Plan de verificación PRG-001 |
      | DOC-012 | 200 con el título Especificación técnica PRG-006 |
      | DOC-013 | 404 document_not_found, sin datos del documento |
      | doc-001 | 404 document_not_found, sin datos del documento |
```

## Fuera de alcance
- Publicar una versión nueva y comparar versiones: EP-DOC-VERSIONES.
- El 403 de un documento restringido para un rol que no puede verlo: EP-DOC-RESTRINGIDOS.
- El contenido de cada versión para el visor y la descarga en PDF: historias de contenido y de descarga de esta API.
