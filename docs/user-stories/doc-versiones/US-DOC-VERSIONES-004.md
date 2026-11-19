---
id: US-DOC-VERSIONES-004
tipo: historia
epica: EP-DOC-VERSIONES
titulo: "[API] Comparar dos versiones: diff alineado y estadísticas"
etiquetas: [api]
relacionadas: [US-DOC-VERSIONES-003, US-DOC-VERSIONES-007, US-DOC-VERSIONES-010]
verificacion: codigo
cubre: ["GET /api/documents/:id/compare"]
permisos: [document.viewRestricted]
---

## Historia
Como cliente de la API, quiero comparar dos versiones de un documento y recibir el diff alineado por líneas con sus estadísticas,
para mostrar qué cambió entre ellas sin descargar las dos versiones y compararlas a mano.

## Reglas
- `GET /api/documents/:id/compare?from=N&to=M` compara la versión `from` (la antigua) con la versión `to` (la nueva). Son números enteros de versión del documento. Ambos son obligatorios.
- Con parámetros válidos la respuesta es 200 con `id` del documento, `from`, `to`, `rows` y `stats`.
- `rows` tiene una fila por cada línea alineada, en orden de lectura. Cada fila tiene `kind` (`same`, `changed`, `added` o `removed`), `left` (la línea de la versión `from`, con `line` y `text`, o `null`) y `right` (la línea de la versión `to`, con `line` y `text`, o `null`). `line` cuenta desde 1.
- `same`: la misma línea en las dos versiones, con `left` y `right`. `changed`: una línea de la versión `from` se sustituye por otra en el mismo lugar, con `left` y `right`. `added`: solo `right`. `removed`: solo `left`.
- `stats` cuenta las filas de cada `kind`: `added`, `removed`, `changed` y `same`.
- Un parámetro que falta, que no es un entero, o un `from` igual a `to` responde 422 con `code: "validation_failed"`. Si `from` es igual a `to`, el motivo de `to` es `compareSame`. La validación ocurre antes de buscar el documento.
- Si el documento no existe, responde 404 con `code: "document_not_found"`. Si una de las dos versiones no existe (también la versión 0 o una posterior a la última), responde 404 con `code: "version_not_found"`.
- Un documento `restricted` responde 403 con `code: "forbidden"` a un token que no tiene el permiso `document.viewRestricted` (roles `admin`, `program_manager` y `auditor`). Un documento público se compara con cualquier rol.
- Las versiones se buscan en el tenant del token. Una versión que existe en otro tenant no existe para este.
- En los ejemplos, `(ninguna)` es una línea que no existe en ese lado de la fila.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la cuenta de la fila obtiene su token con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, con su contraseña del seed (`gestor@sigpro.test` con `Gestor1234!`, `consultor@sigpro.test` con `Consul1234!`, `auditor@sigpro.test` con `Audit1234!`). Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Estado del seed, sin pasos previos, en el tenant `alumno01`: `DOC-001` («Plan de verificación PRG-001», público, versiones 1 a 3), `DOC-003` («Plan de verificación PRG-002», restringido, versiones 1 y 2) y `DOC-004` («Especificación técnica PRG-002», público, versiones 1 a 3). El texto de las versiones 1 a 3 es el mismo en todos los documentos del seed, salvo el título y el código del programa de la primera línea.

## Criterios de aceptación
```gherkin
Característica: Comparación de versiones por la API

  Esquema del escenario: Comparar dos versiones devuelve sus estadísticas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su token
    Cuando envía GET /api/documents/<documento>/compare?from=<from>&to=<to> con x-tenant alumno01
    Entonces la respuesta es 200 con from <from>, to <to> y stats <stats>

    Ejemplos:
      | documento | from | to | stats |
      | DOC-001 | 1 | 2 | added 1, removed 0, changed 1, same 17 |
      | DOC-001 | 2 | 3 | added 3, removed 1, changed 1, same 17 |
      | DOC-001 | 3 | 2 | added 1, removed 3, changed 1, same 17 |

  Esquema del escenario: Una línea cambiada, añadida o eliminada aparece en su fila
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su token
    Cuando envía GET /api/documents/DOC-001/compare?from=<from>&to=<to> con x-tenant alumno01
    Entonces la fila <posicion> es de tipo <tipo> y tiene a la izquierda <izquierda> y a la derecha <derecha>

    Ejemplos:
      | from | to | posicion | tipo | izquierda | derecha |
      | 1 | 2 | 9 | changed | línea 9 «Se excluyen los equipos de apoyo en tierra.» | línea 9 «Se excluyen los equipos de apoyo en tierra y los simuladores.» |
      | 1 | 2 | 15 | added | (ninguna) | línea 15 «El director técnico supervisa la ejecución.» |
      | 2 | 3 | 9 | removed | línea 9 «Se excluyen los equipos de apoyo en tierra y los simuladores.» | (ninguna) |

  Esquema del escenario: Parámetros que faltan, no son enteros o son iguales responden 422
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su token
    Cuando envía GET /api/documents/<documento>/compare con x-tenant alumno01 y la consulta <consulta>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | documento | consulta | respuesta |
      | DOC-001 | from=2&to=2 | 422 validation_failed con el motivo compareSame en la clave to |
      | DOC-001 | from=2 y sin to | 422 validation_failed |
      | DOC-001 | from=abc&to=2 | 422 validation_failed |
      | DOC-001 | from=1.5&to=2 | 422 validation_failed |
      | DOC-999 | from=2&to=2 | 422 validation_failed |

  Esquema del escenario: Un documento o una versión que no existen responden 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su token
    Cuando envía GET /api/documents/<documento>/compare?from=<from>&to=<to> con x-tenant alumno01
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | documento | from | to | respuesta |
      | DOC-001 | 1 | 4 | 404 version_not_found |
      | DOC-001 | 0 | 2 | 404 version_not_found |
      | DOC-999 | 1 | 2 | 404 document_not_found |

  Esquema del escenario: Un documento restringido solo se compara con un rol que puede verlo
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene su token
    Cuando envía GET /api/documents/DOC-003/compare?from=1&to=2 con x-tenant alumno01
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | respuesta |
      | consultor@sigpro.test | 403 forbidden |
      | auditor@sigpro.test | 200 con stats added 1, removed 0, changed 1, same 17 |

  Esquema del escenario: Las versiones se buscan en el tenant del token
    Dado que los tenants alumno01 y alumno02 están recién reiniciados y alumno01 ha publicado la versión 4 de DOC-001 con una línea de texto
    Cuando <cuenta> pide GET /api/documents/DOC-001/compare?from=3&to=4
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | respuesta |
      | alumno01@sigpro.lab | 200 con from 3 y to 4 |
      | alumno02@sigpro.lab | 404 version_not_found |
```

## Decisiones pendientes
- El motivo de un parámetro que falta o no es un entero: hoy es el mismo que para dos versiones iguales (`compareSame` en `to`), y ese texto no describe el problema real.

## Fuera de alcance
- La comparación en la web y en la app móvil: EP-DOC-VERSIONES, otra historia de esta épica.
- La visibilidad de los documentos restringidos en la lista y en la ficha: EP-DOC-RESTRINGIDOS.
- La lectura del contenido de una versión, el visor y la descarga del PDF: EP-DOC-LISTA.
