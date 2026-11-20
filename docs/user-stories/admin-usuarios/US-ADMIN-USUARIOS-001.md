---
id: US-ADMIN-USUARIOS-001
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[API] Listar los usuarios del tenant con su rol y su estado"
etiquetas: [api]
relacionadas: [US-ADMIN-USUARIOS-002, US-ADMIN-USUARIOS-003, US-ADMIN-USUARIOS-006, US-LOGIN-003, US-REGISTRO-001]
verificacion: ejecutada
cubre: ["GET /api/admin/users"]
permisos: [users.manage]
---

## Historia
Como administrador de un tenant, quiero ver de una vez a todas las cuentas de mi tenant con su rol y con su estado (activa, bloqueada, pendiente de aprobación o desactivada),
para decidir a quién cambiar el rol o el acceso sin buscarlo cuenta a cuenta.

## Reglas
- `GET /api/admin/users` devuelve la lista de todas las cuentas del tenant del token: también la del propio administrador, las bloqueadas, las pendientes de aprobación y las desactivadas. Con éxito responde 200.
- Cada elemento trae `id`, `name`, `email`, `role`, `active`, `locked`, `pending` y `org`. No trae la contraseña ni ningún dato del segundo factor.
- `active` es falso si la cuenta está desactivada. `locked` es verdadero si la cuenta está bloqueada, y `pending` es verdadero si la cuenta está pendiente de aprobación. Un bloqueo no cambia `active`: una cuenta bloqueada sigue con `active` verdadero.
- El orden es el de alta: la cuenta más antigua primero. Las cuentas que comparten fecha de alta salen por su `id`, de menor a mayor. Las cuentas del seed comparten fecha, anterior a cualquier solicitud de acceso, así que en cada tenant `alumnoNN` salen en el orden `u1`, `u2`, `u3`, `u4`, `u5`, `u6`, `u7`. Las cuentas creadas después (por una solicitud de acceso) salen al final.
- Los ids del seed en cada tenant `alumnoNN` son: `u1` para `admin@sigpro.test`, `u2` para `gestor@sigpro.test`, `u3` para `consultor@sigpro.test`, `u4` para `auditor@sigpro.test`, `u5` para `bloqueado@sigpro.test`, `u6` para `pendiente@sigpro.test` y `u7` para `alumnoNN@sigpro.lab`.
- El tenant lo fija el token de quien pide la lista. La cabecera `x-tenant` no cambia la lista.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y ese mismo administrador obtiene su accessToken con `POST /api/auth/login`. Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa.
- En los ejemplos, `(cuenta recién solicitada en alumno01)` y `(cuenta recién solicitada en alumno02)` son cuentas creadas en la propia fila con `POST /api/auth/register`, la cabecera `x-tenant` de su tenant y el cuerpo `first` Ana, `last` Prueba, `email` un correo nuevo (`nueva-` seguido de una marca de tiempo y `@organizacion.es`), `org` Unidad de pruebas, `role` consultant, `password` y `confirm` Abcdefghij1! y `terms` true. En `alumno02` se reinicia antes el tenant con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`).

## Criterios de aceptación
```gherkin
Característica: Listado de usuarios del tenant en la API

  Esquema del escenario: Cada cuenta del seed aparece con su rol y sus indicadores
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en alumno01
    Cuando envía GET /api/admin/users con x-tenant alumno01 y su accessToken
    Entonces la respuesta es 200
    Y la cuenta <correo> aparece con el rol <rol>, active <activa>, locked <bloqueada> y pending <pendiente>

    Ejemplos:
      | correo | rol | activa | bloqueada | pendiente |
      | admin@sigpro.test | admin | true | false | false |
      | gestor@sigpro.test | program_manager | true | false | false |
      | consultor@sigpro.test | consultant | true | false | false |
      | auditor@sigpro.test | auditor | true | false | false |
      | bloqueado@sigpro.test | consultant | true | true | false |
      | pendiente@sigpro.test | consultant | true | false | true |
      | alumno01@sigpro.lab | admin | true | false | false |

  Esquema del escenario: La lista sigue el orden de alta y, con la misma fecha, el de id
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en alumno01 y existe (cuenta recién solicitada en alumno01)
    Cuando envía GET /api/admin/users con x-tenant alumno01 y su accessToken
    Entonces el usuario que ocupa el puesto <puesto> de la lista es <correo>

    Ejemplos:
      | puesto | correo |
      | 1 | admin@sigpro.test |
      | 6 | pendiente@sigpro.test |
      | 7 | alumno01@sigpro.lab |
      | 8 | (cuenta recién solicitada en alumno01) |

  Esquema del escenario: El tenant lo fija el token y no la cabecera x-tenant
    Dado que en los tenants alumno01 y alumno02, recién reiniciados, alumno01@sigpro.lab ha iniciado sesión en alumno01 y existe (cuenta recién solicitada en alumno02)
    Cuando envía GET /api/admin/users con su accessToken y la cabecera <cabecera>
    Entonces la respuesta es 200 con 7 usuarios
    Y la lista no incluye la cuenta solicitada en alumno02

    Ejemplos:
      | cabecera |
      | alumno02 |
      | (sin cabecera) |
```

## Fuera de alcance
- La tabla, la búsqueda y los avisos de la pantalla de Administración, en la web y en la app móvil: esta misma épica (historias 007 y 010).
- La cuenta que crea una solicitud de acceso y su correo de verificación: épica de Solicitud de acceso (EP-REGISTRO).
- El registro de auditoría como pantalla: épica de Auditoría (EP-AUDITORIA).
