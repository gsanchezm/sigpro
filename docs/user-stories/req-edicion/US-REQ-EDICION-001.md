---
id: US-REQ-EDICION-001
tipo: historia
epica: EP-REQ-EDICION
titulo: "[API] Dar de alta un requisito en borrador"
etiquetas: [api]
relacionadas: [US-REQ-EDICION-002, US-REQ-EDICION-006, US-REQ-EDICION-008, US-REQ-EDICION-012, US-REQ-ARBOL-001]
verificacion: codigo
cubre: ["POST /api/requirements"]
permisos: [requirement.create]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con un rol que puede crear requisitos, quiero dar de alta un requisito en un programa de mi tenant,
para que nazca en borrador, con un código nuevo y al final de sus hermanos, listo para revisarse.

## Reglas
- `POST /api/requirements` exige un `accessToken` en `Authorization: Bearer` y el permiso `requirement.create`, que tienen `admin`, `program_manager` y `consultant`. Sin cabecera `Authorization` la respuesta es 401 `missing_token`; con un token que la API no ha emitido, 401 `invalid_token`; con el rol `auditor`, 403 `forbidden`, aunque el cuerpo no sea válido.
- El cuerpo lleva `programCode` y `title`. Puede llevar además `parentCode` (sin padre si no se envía o es `null`), `description` (vacía si no se envía), `priority` (`medium` si no se envía) y `tags` (ninguna si no se envía). Los motivos de los campos no válidos no se describen aquí.
- La respuesta correcta es 201 con el requisito: `code`, `programCode`, `parentCode`, `title`, `description`, `priority`, `tags`, `state` (`draft`), `position` y las listas vacías `testCaseCodes`, `tests` y `ncs`.
- El código es `REQ-` seguido de tres dígitos: el número siguiente al mayor que ya existe en el tenant, en cualquier programa. Con el seed, el primer alta de cada ejecución recibe `REQ-041`.
- El requisito nace siempre en `draft`, con independencia de su prioridad o sus etiquetas.
- La posición (`position`) es el número de hermanos que ya tiene el padre en ese programa: el alta queda al final. Sin padre, los hermanos son las raíces del programa.
- El padre, si se indica, debe ser un requisito del mismo programa. Si no existe en el tenant o es de otro programa, la respuesta es 422 `validation_failed` con `errors.parentCode` igual a `badParent`.
- El programa debe existir en el tenant del token. Si no existe, la respuesta es 404 `program_not_found` y no se crea nada.
- Un alta correcta deja un evento `requirement.created` en la auditoría, con entidad `requirement` y el código nuevo como identificador.
- El tenant lo fija el token. La cabecera `x-tenant` no cambia el resultado de estas peticiones.
- Convenciones de los ejemplos: `(vacío)` es un valor vacío; `(sin el campo)` es un campo que no se envía; `(ninguno)` como padre es `parentCode` igual a `null`; `(N letras a)` es un texto de N letras «a» seguidas, sin espacios.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Los tokens de `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`) y `auditor@sigpro.test` (`Audit1234!`) se obtienen con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`.
- Con el seed, `PRG-001` tiene tres raíces (`REQ-001`, `REQ-006` y `REQ-011`), y `REQ-001` tiene tres hijos (`REQ-002`, `REQ-003` y `REQ-005`). `PRG-010` existe y no tiene requisitos. El Esquema del programa de otro tenant reinicia además `alumno02` con `POST /api/admin/reset` y el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`), obtiene su token con `POST /api/auth/login` y la cabecera `x-tenant: alumno02`, y borra `PRG-024` solo en `alumno01` con `DELETE /api/programs/PRG-024` y el token de `alumno01@sigpro.lab`.

## Criterios de aceptación
```gherkin
Característica: Alta de requisitos por la API

  Esquema del escenario: Un alta válida nace en borrador al final de sus hermanos
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene un token de acceso
    Cuando envía POST /api/requirements con x-tenant alumno01 y el cuerpo con programCode <programa>, parentCode <padre> y title Requisito de prueba
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | programa | padre | respuesta |
      | gestor@sigpro.test | PRG-001 | (ninguno) | 201 con code REQ-041, state draft, parentCode null y position 3 |
      | consultor@sigpro.test | PRG-001 | REQ-001 | 201 con code REQ-041, state draft, parentCode REQ-001 y position 3 |
      | alumno01@sigpro.lab | PRG-010 | (ninguno) | 201 con code REQ-041, state draft, parentCode null y position 0 |

  Esquema del escenario: Un alta no se crea si el programa no existe o el padre es de otro programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/requirements con x-tenant alumno01 y el cuerpo con programCode <programa>, parentCode <padre> y title Requisito de prueba
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | programa | padre | respuesta |
      | PRG-999 | (ninguno) | 404 program_not_found |
      | PRG-001 | REQ-015 | 422 validation_failed con errors.parentCode igual a badParent, porque REQ-015 es de PRG-002 |
      | PRG-001 | REQ-999 | 422 validation_failed con errors.parentCode igual a badParent |

  Esquema del escenario: Un programa solo existe en el tenant donde no se ha borrado
    Dado que los tenants alumno01 y alumno02 están recién reiniciados, y que con el token de alumno01@sigpro.lab se elimina PRG-024 con DELETE /api/programs/PRG-024 en alumno01
    Cuando envía POST /api/requirements con el token de <cuenta> y el cuerpo con programCode PRG-024 y title Requisito de prueba
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | respuesta |
      | alumno01@sigpro.lab | 404 program_not_found |
      | alumno02@sigpro.lab | 201 con code REQ-041, programCode PRG-024 y position 0 |
```

## Decisiones pendientes
- Si el código de un requisito borrado puede volver a asignarse. Hoy el alta toma el número siguiente al mayor que queda en el tenant: tras borrar el requisito de mayor número (por ejemplo `REQ-040`), el siguiente alta recibe ese mismo código.

## Fuera de alcance
- Los motivos de rechazo de un alta con datos no válidos: la historia de la API de rechazo de altas de esta misma épica.
- El alta desde la web y desde la app móvil: las historias web y móvil de alta de esta misma épica.
- La creación de programas, de la que depende el programa de un requisito: EP-PROG-ALTA.
