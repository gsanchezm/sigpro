---
id: US-VER-EJECUCION-002
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[API] Registrar una ejecución con su resultado, sus notas y su efecto en el caso"
etiquetas: [api]
relacionadas: [US-VER-EJECUCION-001, US-VER-EJECUCION-003, US-VER-EJECUCION-004, US-VER-EJECUCION-005, US-VER-EJECUCION-008]
verificacion: codigo
cubre: ["POST /api/test-cases/:code/runs"]
---

## Historia
Como cliente de la API con permiso para ejecutar pruebas (la web, la app móvil o una suite de pruebas), quiero registrar el resultado de un caso de prueba con sus notas,
para que la ejecución quede guardada con su número, su autor y su fecha, y pase a ser la última del caso.

## Reglas
- Un cuerpo válido responde 201 con la ejecución creada: `id` (`RUN-` y tres dígitos, con el número siguiente al mayor que ya existe en el tenant), `testCaseCode` (el código del caso), `executedAt` (la fecha y hora de la petición, en ISO 8601), `result`, `notes`, `executedById` (el id de quien la registra), `executedByName` (su nombre), y `evidences` (vacía si no se adjunta ningún archivo).
- `result` es obligatorio y solo admite `pass`, `fail` o `blocked`. Cualquier otro valor (vacío, ausente, `PASS` o `Superado`) responde 422 `validation_failed` con `errors.result: resultRequired`.
- `notes` es opcional. Sus espacios del principio y del final se recortan antes de contar, y admite hasta 1000 caracteres. Sin el campo se guarda vacío. Más de 1000 caracteres después de recortar responde 422 con `errors.notes: notesLong`.
- Un rechazo por el resultado o por las notas no crea ninguna ejecución ni evidencia.
- Una ejecución aceptada es la más reciente del caso, porque su fecha es la de la petición y es posterior a las del seed. Por eso el último resultado del caso pasa a ser el de la ejecución nueva y su número de ejecuciones aumenta en una.
- En el seed, `TC-001` tiene 2 ejecuciones: `RUN-001` (`pass`, la primera) y `RUN-002` (`blocked`, la última).
- Cada ejecución aceptada deja un evento `testrun.executed` en el registro de auditoría, sobre el `RUN-` creado, en la misma operación. Un rechazo no deja ningún evento. Lo consulta un administrador o un auditor con `GET /api/audit`, filtrando por la entidad `testrun` y por el identificador de la ejecución.
- Cada evidencia de `evidences` trae `id`, `filename`, `mimeType`, `size` (bytes) y `url` (ver «Decisiones pendientes»).
- La ejecución se crea en el tenant del token, y la cabecera `x-tenant` no lo cambia.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La cuenta `alumno01@sigpro.lab` inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken` como `Authorization: Bearer`.

## Criterios de aceptación
```gherkin
Característica: Registro de una ejecución por la API

  Esquema del escenario: Una ejecución válida se guarda con su número, su autor y su fecha
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/TC-001/runs con el campo result <resultado> y el campo notes Prueba de humo
    Entonces la respuesta es 201 con id RUN-051, testCaseCode TC-001, result <resultado>, notes Prueba de humo, executedByName Alumno 01 y evidences vacía

    Ejemplos:
      | resultado |
      | pass |
      | blocked |

  Esquema del escenario: Las notas se recortan antes de contar y admiten hasta 1000 caracteres
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/TC-001/runs con el campo result pass y el campo notes <notas>
    Entonces la respuesta es <respuesta>
    Y <efecto>

    Ejemplos:
      | notas | respuesta | efecto |
      | (sin el campo notes) | 201 | la ejecución tiene las notas vacías |
      | (999 letras a) | 201 | la ejecución tiene las notas con 999 letras a |
      | (1000 letras a) | 201 | la ejecución tiene las notas con 1000 letras a |
      | (1000 letras a con espacios delante y detrás) | 201 | la ejecución tiene las notas con 1000 letras a, sin los espacios |
      | (1001 letras a) | 422 validation_failed con el motivo notesLong en notes | no se crea ninguna ejecución |

  Esquema del escenario: Un resultado ausente o no válido responde 422 y no crea ninguna ejecución
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/TC-001/runs con <cuerpo>
    Entonces la respuesta es 422 validation_failed con el motivo resultRequired en result
    Y el caso TC-001 sigue con 2 ejecuciones

    Ejemplos:
      | cuerpo |
      | (sin el campo result) |
      | el campo result (vacío) |
      | el campo result Superado |

  Esquema del escenario: Una ejecución aceptada pasa a ser la última del caso
    Dado que en el tenant alumno01, recién reiniciado, TC-001 tiene 2 ejecuciones, su última es blocked (RUN-002) y alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/TC-001/runs con el campo result <resultado>
    Entonces GET /api/test-cases/TC-001 responde con lastResult <ultimo>, runCount 3 y la ejecución RUN-051 como la primera del historial

    Ejemplos:
      | resultado | ultimo |
      | pass | pass |
      | blocked | blocked |

  Esquema del escenario: Cada ejecución aceptada deja un evento de auditoría y un rechazo no deja ninguno
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/TC-001/runs con <cuerpo>
    Entonces la respuesta es <respuesta>
    Y el registro de auditoría <auditoria>

    Ejemplos:
      | cuerpo | respuesta | auditoria |
      | el campo result pass | 201 | tiene un evento testrun.executed sobre RUN-051 |
      | (sin el campo result) | 422 validation_failed con el motivo resultRequired en result | no recibe ningún evento nuevo |
```

## Fuera de alcance
- El permiso, el orden de los rechazos y los 403 y 404: historia 001 de esta épica.
- Las evidencias adjuntas, sus reglas de tipo, tamaño y cantidad, y sus respuestas 413 y 400: historia 003.
- La descarga de una evidencia por su identificador: historia 004.
- La lista del caso, su historial y su último resultado en las pantallas: EP-VER-CASOS.
- La pantalla del registro de auditoría: la épica de Auditoría.

## Decisiones pendientes
- La forma de `url` de cada evidencia. Hoy es `/evidence/<id>`, sin el prefijo `/api` que tiene la ruta de descarga (`GET /api/evidence/:id`), mientras que la primera evidencia de la ejecución se guarda como `/api/evidence/<id>`. No está decidido cuál debe ser la forma de `url`. Ningún ejemplo de esta historia la afirma.
