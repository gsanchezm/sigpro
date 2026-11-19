---
id: US-DOC-VERSIONES-002
tipo: historia
epica: EP-DOC-VERSIONES
titulo: "[API] Validar el contenido y la nota de una versión nueva"
etiquetas: [api]
relacionadas: [US-DOC-VERSIONES-001, US-DOC-VERSIONES-003, US-DOC-VERSIONES-005, US-DOC-VERSIONES-009]
verificacion: ejecutada
cubre: ["POST /api/documents/:id/versions"]
---

## Historia
Como cliente de la API, quiero que una versión nueva con un contenido o una nota que no cumplen los límites reciba un 422 con el motivo de cada campo,
para corregir el envío sin que el documento cambie.

## Reglas
- Un cuerpo que no cumple las reglas responde 422 con `code: "validation_failed"` y un objeto `errors` con un motivo por campo. La validación ocurre antes de buscar el documento.
- `lines` es obligatorio: una lista de entre 1 y 80 textos, y cada texto tiene hasta 200 caracteres. Los motivos (valor de la clave en `errors`) son `linesRequired` si la lista no tiene ninguna línea, `linesMax` si tiene más de 80 (clave `lines`), y `lineLong` si una línea tiene más de 200 caracteres (clave `lines.N`, con N el índice desde 0 de la primera línea demasiado larga).
- `note` es opcional y tiene hasta 200 caracteres, sin contar los espacios del principio y del final. El motivo es `noteLong` (clave `note`).
- Un campo del tipo equivocado (`lines` que no es una lista, un elemento de `lines` que no es un texto, `note` que no es un texto, o `lines` que falta) también responde 422 con ese campo en `errors`. Ver Decisiones pendientes para el motivo.
- Una petición rechazada no cambia el documento: la última versión sigue siendo la que era.
- En los ejemplos, `(lista sin líneas)` es un `lines` vacío, `(N líneas de texto)` es una lista de N textos distintos, `(N letras a)` es un texto de N letras «a» seguidas y `(tres líneas: la segunda de 201 letras a)` es una lista de tres textos en la que el segundo tiene 201 letras «a».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `gestor@sigpro.test` (contraseña `Gestor1234!`) obtiene su token con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Estado del seed, sin pasos previos, en el tenant `alumno01`: `DOC-001` («Plan de verificación PRG-001», público, versiones 1 a 3) y `DOC-002` («Especificación técnica PRG-001», público, versión 1).

## Criterios de aceptación
```gherkin
Característica: Límites y motivos de una versión nueva por la API

  Esquema del escenario: El contenido admite de 1 a 80 líneas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su token y DOC-001 está en la versión 3
    Cuando envía POST /api/documents/DOC-001/versions con x-tenant alumno01, un cuerpo con <contenido> y la nota Revisión
    Entonces la respuesta es <respuesta>
    Y la última versión de DOC-001 es la <version_final>

    Ejemplos:
      | contenido | respuesta | version_final |
      | lines (lista sin líneas) | 422 validation_failed con el motivo linesRequired en la clave lines | 3 |
      | lines (una línea de texto) | 201 con version 4 | 4 |
      | lines (80 líneas de texto) | 201 con version 4 | 4 |
      | lines (81 líneas de texto) | 422 validation_failed con el motivo linesMax en la clave lines | 3 |

  Esquema del escenario: Cada línea admite hasta 200 caracteres
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su token y DOC-002 está en la versión 1
    Cuando envía POST /api/documents/DOC-002/versions con x-tenant alumno01, un cuerpo con <contenido> y la nota Revisión
    Entonces la respuesta es <respuesta>
    Y la última versión de DOC-002 es la <version_final>

    Ejemplos:
      | contenido | respuesta | version_final |
      | lines (una línea de 199 letras a) | 201 con version 2 | 2 |
      | lines (una línea de 200 letras a) | 201 con version 2 | 2 |
      | lines (una línea de 201 letras a) | 422 validation_failed con el motivo lineLong en la clave lines.0 | 1 |
      | lines (tres líneas: la segunda de 201 letras a) | 422 validation_failed con el motivo lineLong en la clave lines.1 | 1 |

  Esquema del escenario: La nota admite hasta 200 caracteres sin contar los espacios de los extremos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su token y DOC-002 está en la versión 1
    Cuando envía POST /api/documents/DOC-002/versions con x-tenant alumno01, un cuerpo con una línea de texto y la nota <nota>
    Entonces la respuesta es <respuesta>
    Y la última versión de DOC-002 es la <version_final>

    Ejemplos:
      | nota | respuesta | version_final |
      | (199 letras a) | 201 con version 2 | 2 |
      | (200 letras a) | 201 con version 2 | 2 |
      | (201 letras a) | 422 validation_failed con el motivo noteLong en la clave note | 1 |

  Esquema del escenario: Un campo de otro tipo responde 422 con ese campo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su token y DOC-001 está en la versión 3
    Cuando envía POST /api/documents/DOC-001/versions con x-tenant alumno01, un cuerpo en el que <cuerpo>
    Entonces la respuesta es 422 validation_failed con un motivo en la clave <campo>
    Y la última versión de DOC-001 sigue siendo la 3

    Ejemplos:
      | cuerpo | campo |
      | lines es el texto «Una línea» | lines |
      | lines es una lista con «Línea 1» y el número 5 | lines.1 |
      | note es el número 5 | note |
      | falta el campo lines | lines |
```

## Decisiones pendientes
- Qué motivo ve quien envía un campo de otro tipo: hoy `errors` trae el texto que devuelve el validador del esquema, no una clave del catálogo de textos.
- Si la API debe quitar las filas vacías del final del contenido, como hace la web antes de enviar. Hoy la API guarda las líneas tal como llegan.

## Fuera de alcance
- Quién puede publicar y el orden entre 403, 422 y 404: EP-DOC-VERSIONES, otra historia de esta épica.
- La publicación de una versión válida y su efecto en la ficha: EP-DOC-VERSIONES, otra historia de esta épica.
- Los avisos que la web y la app móvil muestran bajo los campos: EP-DOC-VERSIONES, otra historia de esta épica.
