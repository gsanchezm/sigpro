---
id: US-REQ-EDICION-005
tipo: historia
epica: EP-REQ-EDICION
titulo: "[API] Reordenar un requisito entre sus hermanos"
etiquetas: [api]
relacionadas: [US-REQ-EDICION-003, US-REQ-EDICION-010, US-REQ-EDICION-014, US-REQ-EDICION-007]
verificacion: ejecutada
cubre: ["POST /api/requirements/:code/move"]
permisos: [requirement.edit]
---

## Historia
Como cliente de la API que organiza el orden de un programa, quiero colocar un requisito antes o después de otro requisito de su mismo nivel,
para priorizar un grupo de hermanos sin cambiar a qué padre pertenece ninguno de ellos.

## Reglas
- `POST /api/requirements/:code/move` exige un `accessToken` y el permiso `requirement.edit`, que tienen `admin`, `program_manager` y `consultant`. Sin cabecera `Authorization` la respuesta es 401 `missing_token`; con el rol `auditor`, 403 `forbidden`.
- El cuerpo lleva `targetCode` (el requisito de referencia) y `placement`, que vale `before` (antes) o `after` (después).
- El destino debe ser un hermano: el mismo programa y el mismo padre que el requisito movido. Un destino que sea el propio requisito, que tenga otro padre, que sea de otro programa o que no exista en el tenant responde 422 `validation_failed` con `errors.targetCode` igual a `badTarget`. Así no es posible dejar un requisito dentro de sus propios descendientes.
- Una respuesta correcta es 200 con `program` (código y nombre del programa) e `items`, con todos los requisitos del programa ordenados por código y su `position` ya actualizada. Solo cambian las posiciones de los hermanos.
- El requisito conserva siempre su padre: no hay forma de cambiarlo con esta petición.
- Un código que no existe en el tenant responde 404 `requirement_not_found`.
- Un movimiento correcto deja un evento `requirement.moved` en la auditoría. Una petición rechazada no cambia ninguna posición ni deja evento.
- Convenciones de los ejemplos: `(sin el campo)` es un campo que no se envía.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). El token de `gestor@sigpro.test` (contraseña `Gestor1234!`) se obtiene con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`.
- Estado del seed, sin pasos previos: las raíces de `PRG-001` son `REQ-001` (position 0), `REQ-006` (position 1) y `REQ-011` (position 2). Los hijos de `REQ-001` son `REQ-002` (0), `REQ-003` (1) y `REQ-005` (2); `REQ-004` es hijo de `REQ-003`.

## Criterios de aceptación
```gherkin
Característica: Reordenación de requisitos por la API

  Esquema del escenario: Reordenar deja a los hermanos en el orden pedido
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/requirements/<codigo>/move con x-tenant alumno01 y el cuerpo con targetCode <destino> y placement <colocacion>
    Entonces la respuesta es 200 con el programa PRG-001 y sus requisitos, y <orden>

    Ejemplos:
      | codigo | destino | colocacion | orden |
      | REQ-001 | REQ-011 | after | las raíces quedan REQ-006 (position 0), REQ-011 (position 1) y REQ-001 (position 2) |
      | REQ-011 | REQ-001 | before | las raíces quedan REQ-011 (position 0), REQ-001 (position 1) y REQ-006 (position 2) |
      | REQ-006 | REQ-001 | before | las raíces quedan REQ-006 (position 0), REQ-001 (position 1) y REQ-011 (position 2) |
      | REQ-005 | REQ-003 | before | los hijos de REQ-001 quedan REQ-002 (position 0), REQ-005 (position 1) y REQ-003 (position 2) |
      | REQ-002 | REQ-005 | after | los hijos de REQ-001 quedan REQ-003 (position 0), REQ-005 (position 1) y REQ-002 (position 2) |

  Esquema del escenario: Un destino que no es hermano del requisito se rechaza sin cambiar el orden
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/requirements/<codigo>/move con x-tenant alumno01 y el cuerpo con targetCode <destino> y placement <colocacion>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | codigo | destino | colocacion | respuesta |
      | REQ-001 | REQ-001 | before | 422 validation_failed con errors.targetCode igual a badTarget |
      | REQ-001 | REQ-002 | before | 422 validation_failed con errors.targetCode igual a badTarget, porque REQ-002 es hijo de REQ-001 |
      | REQ-002 | REQ-006 | after | 422 validation_failed con errors.targetCode igual a badTarget, porque REQ-006 es una raíz |
      | REQ-002 | REQ-015 | after | 422 validation_failed con errors.targetCode igual a badTarget, porque REQ-015 es de PRG-002 |
      | REQ-002 | REQ-999 | after | 422 validation_failed con errors.targetCode igual a badTarget |
      | REQ-999 | REQ-001 | before | 404 requirement_not_found |
      | REQ-001 | (sin el campo) | before | 422 validation_failed con errors.targetCode igual a required |
      | REQ-001 | REQ-011 | (sin el campo) | 422 validation_failed con un motivo para placement |
      | REQ-001 | REQ-011 | middle | 422 validation_failed con un motivo para placement |
```

## Decisiones pendientes
- Qué clave de motivo lleva `placement` cuando no vale `before` ni `after`. Hoy es el mensaje por defecto de la validación; las filas solo exigen que haya un motivo para ese campo.

## Fuera de alcance
- Cambiar el padre de un requisito al reordenarlo: la historia no implementada de esta misma épica.
- Reordenar desde la web y desde la app móvil, con el teclado, el menú o el arrastre: las historias web y móvil de reordenación de esta misma épica.
