---
id: US-ADMIN-USUARIOS-004
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[API] Validar el cuerpo y el id de un cambio de usuario"
etiquetas: [api]
relacionadas: [US-ADMIN-USUARIOS-002, US-ADMIN-USUARIOS-003, US-ADMIN-USUARIOS-005]
verificacion: codigo
cubre: ["PATCH /api/admin/users/:id"]
---

## Historia
Como administrador de un tenant, quiero que una petición de cambio mal formada, o dirigida a una cuenta que no existe en mi tenant, se rechace con un motivo claro y sin cambiar nada,
para no creer que he cambiado una cuenta que no he tocado.

## Reglas
- El cuerpo admite `active` (booleano) y `role` (uno de los cuatro roles). Los dos campos son opcionales, pero debe venir al menos uno.
- Un cuerpo no válido responde 422 `validation_failed` con `errors`, un objeto con un motivo por campo:
  - `role` que no es uno de los cuatro roles, o que está vacío: motivo `roleInvalid` en `role`.
  - `active` que no es booleano: un motivo en `active`. Su texto lo da la validación y esta historia no lo fija.
  - Ni `active` ni `role` (cuerpo vacío, o solo con campos que no se admiten y se ignoran): 422 con el motivo `nothingToUpdate`, que no va ligado a ningún campo.
- Antes de buscar la cuenta se valida el cuerpo. Un cuerpo no válido responde 422 aunque el id no exista, nunca 404.
- Un id que no existe en el tenant del token responde 404 `user_not_found`. Un id que solo existe en otro tenant responde igual, porque el tenant lo fija el token.
- Ninguna petición rechazada (422 o 404) cambia una cuenta ni deja registro de auditoría.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y ese administrador obtiene su accessToken con `POST /api/auth/login`. Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa.
- En los ejemplos, `(id de la cuenta recién solicitada en alumno02)` es el id que `GET /api/admin/users` muestra en el tenant `alumno02` para una cuenta creada en la fila con `POST /api/auth/register`, la cabecera `x-tenant: alumno02` y el cuerpo `first` Ana, `last` Prueba, `email` un correo nuevo (`nueva-` seguido de una marca de tiempo y `@organizacion.es`), `org` Unidad de pruebas, `role` consultant, `password` y `confirm` Abcdefghij1! y `terms` true. Para leerlo, se reinicia `alumno02` con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`) y ese administrador lista sus usuarios.

## Criterios de aceptación
```gherkin
Característica: Validación del cambio de un usuario

  Esquema del escenario: Un cuerpo no válido responde 422 con su motivo y no cambia nada
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador y ha anotado el total que devuelve GET /api/audit
    Cuando envía PATCH /api/admin/users/u4 con x-tenant alumno01, su accessToken y el cuerpo <cuerpo>
    Entonces la respuesta es 422 validation_failed con el motivo <motivo>
    Y auditor@sigpro.test sigue con el rol auditor y activa
    Y el total que devuelve GET /api/audit sigue igual

    Ejemplos:
      | cuerpo | motivo |
      | {"role": "dios"} | roleInvalid en role |
      | {"role": ""} | roleInvalid en role |
      | {"active": "si"} | un motivo en active |
      | {} | nothingToUpdate sin campo |
      | {"name": "Otra persona"} | nothingToUpdate sin campo |

  Esquema del escenario: Un id que no existe en el tenant responde 404 y no cambia nada
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador y en el tenant alumno02, recién reiniciado, existe (cuenta recién solicitada en alumno02)
    Cuando envía PATCH /api/admin/users/<id> con x-tenant alumno01, su accessToken y el cuerpo {"active": false}
    Entonces la respuesta es 404 user_not_found
    Y la lista de usuarios de alumno01 sigue con sus siete cuentas, sin cambios

    Ejemplos:
      | id |
      | u99 |
      | (id de la cuenta recién solicitada en alumno02) |

  Esquema del escenario: La validación del cuerpo va antes que la búsqueda de la cuenta
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador
    Cuando envía PATCH /api/admin/users/<id> con x-tenant alumno01, su accessToken y el cuerpo <cuerpo>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | id | cuerpo | respuesta |
      | u99 | {} | 422 validation_failed con el motivo nothingToUpdate sin campo |
      | u99 | {"active": false} | 404 user_not_found |
      | u99 | {"role": "dios"} | 422 validation_failed con el motivo roleInvalid en role |
      | u7 | {"role": "dios"} | 422 validation_failed con el motivo roleInvalid en role |
```

## Fuera de alcance
- El permiso de rol y el 403 que gana a la validación: esta misma épica (historia 002).
- La protección de la propia cuenta y del último admin activo, que se comprueba después de encontrar la cuenta: esta misma épica (historia 005).
- Los avisos de la web y de la app móvil ante un rechazo: esta misma épica (historias 008 y 011).
