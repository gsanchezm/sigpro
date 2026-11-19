---
id: US-DOC-LISTA-004
tipo: historia
epica: EP-DOC-LISTA
titulo: "[API] Servir el contenido de una versión en páginas para el visor"
etiquetas: [api]
relacionadas: [US-DOC-LISTA-003, US-DOC-LISTA-005, US-DOC-LISTA-010, US-DOC-LISTA-012]
verificacion: codigo
cubre: ["GET /api/documents/:id/content"]
---

## Historia
Como cliente de la API con una sesión iniciada, quiero pedir el contenido de un documento repartido en páginas, de su última versión o de una versión concreta,
para pintarlo en el visor página a página, con sus apartados y sus huecos tal como están en el documento.

## Reglas
- `GET /api/documents/:id/content` exige sesión como la lista: sin cabecera `Authorization` responde 401 `missing_token`, y con un Bearer que no es un `accessToken` válido responde 401 `invalid_token`.
- Con un `accessToken` válido responde 200 con `id`, `title`, `programCode`, `classification`, `version`, `note` y `createdAt` de la versión que se muestra, y `pages`.
- Sin `version`, la versión que se muestra es la última. Con `version=N`, con N un número entero, es la versión N. Una versión que no existe, como 0 o un número mayor que la última, responde 404 `version_not_found`.
- `pages` es una lista de páginas, y cada página es una lista de líneas en el orden del documento. Cada página tiene hasta 12 líneas y la última tiene las que sobran.
- Las líneas van tal cual: una línea vacía es una cadena vacía, y se conserva porque marca el hueco entre apartados. Un apartado numerado empieza por su número y un punto, como `1. Objeto`.
- Datos del seed que citan los ejemplos: la versión 1 de cada documento tiene 18 líneas, la 2 tiene 19 y la 3 tiene 21. Así, la última versión de `DOC-001` (la 3) tiene dos páginas de 12 y 9 líneas; la versión 1 de `DOC-002` tiene 12 y 6; y la versión 2 de `DOC-003` tiene 12 y 7.
- Un código que no existe en el tenant del token responde 404 con `code` y `message` iguales a `document_not_found`, sin páginas.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); el reinicio se aplica al tenant de ese token. Después `gestor@sigpro.test` (contraseña `Gestor1234!`, rol `program_manager`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y su `accessToken` va en `Authorization: Bearer`.

## Criterios de aceptación
```gherkin
Característica: Contenido de una versión para el visor por la API

  Esquema del escenario: El contenido trae la versión, su nota y su reparto en páginas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents/<id>/content con ese accessToken como Bearer
    Entonces la respuesta es 200 con la versión <version>, la nota <nota> y la clasificación <clasificacion>
    Y tiene <paginas> páginas, con <lineas_1> líneas en la página 1 y <lineas_ultima> en la última
    Y la primera línea del documento es <primera> y la última es <ultima>

    Ejemplos:
      | id | version | nota | clasificacion | paginas | lineas_1 | lineas_ultima | primera | ultima |
      | DOC-001 | 3 | Nuevos criterios de aceptación y anexos | public | 2 | 12 | 9 | Plan de verificación PRG-001 | Anexo A: matriz de trazabilidad. |
      | DOC-002 | 1 | Versión inicial | public | 2 | 12 | 6 | Especificación técnica PRG-001 | Las desviaciones se registran como no conformidades. |
      | DOC-003 | 2 | Ajuste de alcance y responsabilidades | restricted | 2 | 12 | 7 | Plan de verificación PRG-002 | Las desviaciones se registran como no conformidades. |

  Esquema del escenario: Las líneas llegan tal cual, con sus huecos y en su página
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents/DOC-001/content con ese accessToken como Bearer
    Entonces la línea <linea> de la página <pagina> es <texto>

    Ejemplos:
      | pagina | linea | texto |
      | 1 | 3 | (vacío) |
      | 1 | 4 | 1. Objeto |
      | 2 | 1 | El auditor valida los resultados. |
      | 2 | 2 | El director técnico supervisa la ejecución. |
      | 2 | 8 | 5. Anexos |

  Esquema del escenario: El parámetro version elige la versión; sin él se muestra la última
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide <peticion> con ese accessToken como Bearer
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | peticion | respuesta |
      | GET /api/documents/DOC-001/content | 200 con la versión 3 |
      | GET /api/documents/DOC-001/content?version=1 | 200 con la versión 1, la nota Versión inicial y 2 páginas |
      | GET /api/documents/DOC-001/content?version=2 | 200 con la versión 2 y 2 páginas |
      | GET /api/documents/DOC-001/content?version=0 | 404 version_not_found |
      | GET /api/documents/DOC-001/content?version=4 | 404 version_not_found |

  Esquema del escenario: Un código que no existe en el tenant responde 404 y no trae páginas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents/<id>/content con ese accessToken como Bearer
    Entonces la respuesta es 404 document_not_found y no trae páginas

    Ejemplos:
      | id |
      | DOC-000 |
      | DOC-013 |
      | doc-001 |
```

## Decisiones pendientes
- Qué responde el contenido cuando `version` no es un número entero, por ejemplo `version=abc`. Hoy responde con la última versión, sin error, mientras que `version=0` responde 404; no está decidido si un valor no numérico debe responder con un error de validación.

## Fuera de alcance
- Publicar una versión nueva: EP-DOC-VERSIONES.
- El 403 de un documento restringido para un rol que no puede verlo: EP-DOC-RESTRINGIDOS.
- Las pantallas del visor en la web y la ficha en la app móvil: historias de web y de móvil de esta épica.
