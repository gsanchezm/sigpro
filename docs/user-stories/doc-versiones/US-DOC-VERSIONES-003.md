---
id: US-DOC-VERSIONES-003
tipo: historia
epica: EP-DOC-VERSIONES
titulo: "[API] Permiso para publicar, orden de las comprobaciones y aislamiento por tenant"
etiquetas: [api]
relacionadas: [US-DOC-VERSIONES-001, US-DOC-VERSIONES-002, US-DOC-VERSIONES-005, US-DOC-VERSIONES-009]
verificacion: ejecutada
cubre: ["POST /api/documents/:id/versions"]
permisos: [document.publish]
---

## Historia
Como administrador de un tenant, quiero que solo los roles que pueden publicar creen versiones, y que cada tenant vea solo sus propias versiones,
para que una versión publicada en mi organización no cambie los documentos de otra y que quien no puede publicar reciba siempre el mismo rechazo.

## Reglas
- Solo los roles `admin` y `program_manager` publican versiones (permiso `document.publish`). Un token de `consultant` o de `auditor` responde 403 con `code: "forbidden"`, con cualquier cuerpo y en cualquier documento, también en uno que no existe.
- Un token que falta o no es válido no llega a esta petición: responde 401 (ver Fuera de alcance).
- El orden de las comprobaciones es el rol primero (403), después el cuerpo (422) y por último la existencia del documento (404 con `code: "document_not_found"`). Por eso, un documento que no existe con un cuerpo no válido responde 422, y el mismo documento con un cuerpo válido responde 404.
- Cada tenant tiene sus propias versiones. `DOC-001` existe en todos los tenants con el mismo contenido del seed, y publicar en uno no cambia el de los demás.
- En los ejemplos, `(lista sin líneas)` es un `lines` vacío y `(una línea de texto)` es una lista con un único texto.
- Preparación de cada fila: se reinician los tenants `alumno01` y `alumno02` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` y el de `alumno02@sigpro.lab` (contraseña `Alumno1234!` en los dos). Después, la cuenta de cada fila obtiene su token con `POST /api/auth/login` y su cabecera `x-tenant` del tenant al que pertenece (`alumno01` o `alumno02`), con su contraseña del seed (`alumno01@sigpro.lab`, `alumno02@sigpro.lab` y `Alumno1234!`; `gestor@sigpro.test` con `Gestor1234!`; `consultor@sigpro.test` con `Consul1234!`; `auditor@sigpro.test` con `Audit1234!`).
- Estado del seed, sin pasos previos, en los tenants `alumno01` y `alumno02`: `DOC-001` («Plan de verificación PRG-001», público, versiones 1 a 3), `DOC-003` («Plan de verificación PRG-002», restringido, versiones 1 y 2) y `DOC-004` («Especificación técnica PRG-002», público, versiones 1 a 3).

## Criterios de aceptación
```gherkin
Característica: Quién puede publicar una versión por la API

  Esquema del escenario: Solo admin y gestor de programa publican una versión
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene su token
    Cuando envía POST /api/documents/<documento>/versions con x-tenant alumno01 y un cuerpo con una línea de texto y la nota Revisión
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | documento | respuesta |
      | alumno01@sigpro.lab | DOC-001 | 201 con version 4 |
      | gestor@sigpro.test | DOC-003 | 201 con version 3 |
      | consultor@sigpro.test | DOC-001 | 403 forbidden |
      | auditor@sigpro.test | DOC-003 | 403 forbidden |

  Esquema del escenario: El rol se comprueba antes que el cuerpo, y el cuerpo antes que el documento
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene su token
    Cuando envía POST /api/documents/<documento>/versions con x-tenant alumno01 y un cuerpo con <cuerpo>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | documento | cuerpo | respuesta |
      | consultor@sigpro.test | DOC-001 | lines (lista sin líneas) | 403 forbidden |
      | consultor@sigpro.test | DOC-999 | lines (una línea de texto) | 403 forbidden |
      | alumno01@sigpro.lab | DOC-001 | lines (lista sin líneas) | 422 validation_failed |
      | alumno01@sigpro.lab | DOC-999 | lines (lista sin líneas) | 422 validation_failed |
      | alumno01@sigpro.lab | DOC-999 | lines (una línea de texto) | 404 document_not_found |

  Esquema del escenario: Publicar en un tenant no cambia el documento del otro
    Dado que los tenants alumno01 y alumno02 están recién reiniciados
    Cuando <cuenta_publica> publica una versión con una línea de texto en <documento>
    Y <cuenta_consulta> pide GET /api/documents/<documento> con su tenant
    Entonces el documento que ve <cuenta_consulta> está en la versión <version>

    Ejemplos:
      | cuenta_publica | documento | cuenta_consulta | version |
      | alumno01@sigpro.lab | DOC-001 | alumno02@sigpro.lab | 3 |
      | alumno02@sigpro.lab | DOC-004 | alumno01@sigpro.lab | 3 |
```

## Fuera de alcance
- La respuesta 401 cuando falta el token o no es válido, y la renovación del token: EP-SESION.
- Los límites del contenido y de la nota, y sus motivos de 422: EP-DOC-VERSIONES, otra historia de esta épica.
- La publicación de una versión válida y su efecto en la ficha: EP-DOC-VERSIONES, otra historia de esta épica.
- La lectura de la ficha y la lista de documentos por rol: EP-DOC-LISTA.
- La visibilidad de los documentos restringidos en la lista y en la ficha: EP-DOC-RESTRINGIDOS.
