---
id: US-DOC-LISTA-005
tipo: historia
epica: EP-DOC-LISTA
titulo: "[API] Descargar una versión de un documento como PDF con su nombre"
etiquetas: [api]
relacionadas: [US-DOC-LISTA-004, US-DOC-LISTA-006, US-DOC-LISTA-009, US-DOC-LISTA-014]
verificacion: ejecutada
cubre: ["GET /api/documents/:id/download"]
---

## Historia
Como cliente de la API con una sesión iniciada, quiero descargar un documento como PDF, de su última versión o de una versión concreta,
para guardarlo con un nombre que diga qué documento y qué versión es, y abrirlo con cualquier lector de PDF.

## Reglas
- `GET /api/documents/:id/download` exige sesión como la lista: sin cabecera `Authorization` responde 401 `missing_token`, y con un Bearer que no es un `accessToken` válido responde 401 `invalid_token`.
- Con un `accessToken` válido responde 200 con el PDF como cuerpo, la cabecera `Content-Type: application/pdf` y la cabecera `Content-Disposition: attachment; filename="<nombre>"; filename*=UTF-8''<nombre>`, donde `<nombre>` es `<id>-v<versión>.pdf`; por ejemplo, `DOC-004-v3.pdf`.
- Sin `version`, el PDF es de la última versión. Con `version=N`, con N un número entero, es de la versión N. Una versión que no existe, como 0 o un número mayor que la última, responde 404 `version_not_found`.
- Un código que no existe en el tenant del token responde 404 con `code` y `message` iguales a `document_not_found`, sin PDF.
- El archivo es un PDF válido: empieza por `%PDF-` y termina con `%%EOF`. Su primera línea de texto es el título del documento, en negrita; la segunda es `<id> · Programa <programa> · Versión <versión> · PÚBLICO`, o `RESTRINGIDO` si el documento es restringido; y después van las líneas de la versión, tal cual.
- Datos del seed que citan los ejemplos: `DOC-001` está en la versión 3, `DOC-002` en la 1 y `DOC-003` en la 2. `DOC-003` es restringido y `DOC-001` público.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); el reinicio se aplica al tenant de ese token. Después `gestor@sigpro.test` (contraseña `Gestor1234!`, rol `program_manager`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y su `accessToken` va en `Authorization: Bearer`.
- Preparación de las filas de aislamiento: además se reinicia `alumno02` con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`). Después `alumno02@sigpro.lab` inicia sesión con `x-tenant: alumno02` y publica con `POST /api/documents/DOC-001/versions` una versión nueva con `lines` de una sola línea, «Versión de prueba de aislamiento», y `note` «Prueba de aislamiento». Así `DOC-001` de `alumno02` queda en la versión 4. Esa publicación solo prepara el estado: publicar versiones es de EP-DOC-VERSIONES. `gestor@sigpro.test` inicia sesión también en `alumno02` con `x-tenant: alumno02`.

## Criterios de aceptación
```gherkin
Característica: Descarga de documentos en PDF por la API

  Esquema del escenario: La descarga entrega el PDF de la versión pedida con su nombre
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide <peticion> con ese accessToken como Bearer
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | peticion | respuesta |
      | GET /api/documents/DOC-001/download | 200 con application/pdf y el nombre DOC-001-v3.pdf |
      | GET /api/documents/DOC-002/download | 200 con application/pdf y el nombre DOC-002-v1.pdf |
      | GET /api/documents/DOC-003/download | 200 con application/pdf y el nombre DOC-003-v2.pdf |
      | GET /api/documents/DOC-001/download?version=1 | 200 con application/pdf y el nombre DOC-001-v1.pdf |
      | GET /api/documents/DOC-001/download?version=0 | 404 version_not_found |
      | GET /api/documents/DOC-001/download?version=4 | 404 version_not_found |
      | GET /api/documents/DOC-013/download | 404 document_not_found |

  Esquema del escenario: El PDF empieza por su título y por la línea de identificación del documento
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents/<id>/download con ese accessToken como Bearer
    Entonces el archivo es un PDF que empieza por %PDF- y su primer texto es <titulo>
    Y su segundo texto es <identificacion>

    Ejemplos:
      | id | titulo | identificacion |
      | DOC-001 | Plan de verificación PRG-001 | DOC-001 · Programa PRG-001 · Versión 3 · PÚBLICO |
      | DOC-003 | Plan de verificación PRG-002 | DOC-003 · Programa PRG-002 · Versión 2 · RESTRINGIDO |

  Esquema del escenario: Cada tenant descarga su propia versión, aunque la cabecera x-tenant diga otra cosa
    Dado que los tenants alumno01 y alumno02 están recién reiniciados y alumno02 ha publicado la versión 4 de DOC-001
    Cuando pide GET /api/documents/DOC-001/download con <credencial> y la cabecera x-tenant <cabecera>
    Entonces la respuesta es 200 con el nombre <nombre>

    Ejemplos:
      | credencial | cabecera | nombre |
      | el accessToken de gestor@sigpro.test en alumno01 | (sin cabecera) | DOC-001-v3.pdf |
      | el accessToken de gestor@sigpro.test en alumno01 | alumno02 | DOC-001-v3.pdf |
      | el accessToken de gestor@sigpro.test en alumno02 | alumno02 | DOC-001-v4.pdf |
```

## Decisiones pendientes
- Lo mismo que en el contenido: qué responde la descarga cuando `version` no es un número entero (`version=abc`). Hoy descarga la última versión sin error; no está decidido si debe responder con un error de validación.

## Fuera de alcance
- Cómo se entrega el PDF en la app de iOS y en la de Android (hoja de compartir del sistema): historias de iOS y de Android de esta épica.
- Los botones de descarga de la web y de la app móvil: historias de web y de móvil de esta épica.
- El 403 de un documento restringido para un rol que no puede verlo: EP-DOC-RESTRINGIDOS.
- Publicar una versión nueva, que aquí solo prepara la fila de aislamiento: EP-DOC-VERSIONES.
