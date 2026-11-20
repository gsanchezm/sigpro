---
id: US-ADMIN-USUARIOS-003
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[API] Cambiar el rol o el estado de un usuario del tenant"
etiquetas: [api]
relacionadas: [US-ADMIN-USUARIOS-001, US-ADMIN-USUARIOS-002, US-ADMIN-USUARIOS-004, US-ADMIN-USUARIOS-005, US-LOGIN-003, US-SESION-001, US-SESION-005]
verificacion: ejecutada
cubre: ["PATCH /api/admin/users/:id"]
---

## Historia
Como administrador de un tenant, quiero cambiar el rol de una cuenta o activarla y desactivarla, para dar a cada persona los permisos que necesita, retirárselos cuando ya no los necesite y dejar constancia de cada cambio.

## Reglas
- `PATCH /api/admin/users/:id` cambia la cuenta `:id` del tenant del token. Acepta `role` (`admin`, `program_manager`, `consultant` o `auditor`) y `active` (booleano). Los dos campos son opcionales y pueden venir juntos. Con éxito responde 200 con el usuario ya cambiado, con los campos del listado (`id`, `name`, `email`, `role`, `active`, `locked`, `pending` y `org`).
- Un valor igual al que la cuenta ya tiene no cambia nada: responde 200 con el usuario tal como estaba y no deja registro de auditoría.
- Cambiar el rol no toca el estado: `active`, el bloqueo, la pendencia de aprobación y la contraseña siguen igual. Cambiar `active` no toca el rol.
- Una cuenta desactivada no abre sesión: con su contraseña correcta, `POST /api/auth/login` responde 403 `account_disabled` sin ningún token; con una contraseña incorrecta, 401 `invalid_credentials` como cualquier otra cuenta. Su refreshToken deja de renovar la sesión y responde 401 `invalid_token`.
- Desactivar no cierra las sesiones ya abiertas: el accessToken que la cuenta tenía antes sigue aceptándose hasta que caduca, a los 900 segundos. Es una decisión de diseño del laboratorio: la API no consulta el estado de la cuenta en cada petición.
- Reactivar devuelve el acceso con la contraseña de siempre, salvo que la cuenta esté bloqueada o pendiente de aprobación. Reactivar no desbloquea una cuenta bloqueada, y activar una cuenta pendiente de aprobación no la aprueba: su inicio de sesión sigue respondiendo lo que corresponde a su bloqueo o a su pendencia.
- El permiso lo marca el rol que lleva el accessToken de la petición, no el que la cuenta tenga en la base de datos. Un accessToken emitido antes de un cambio de rol conserva el rol anterior hasta que caduca. El rol nuevo se aplica cuando la cuenta inicia sesión de nuevo o renueva su token.
- Cada cambio aplicado deja un registro en la auditoría del tenant: acción `user.updated`, entidad `user`, `entityId` con el id de la cuenta cambiada, `actorId` con el id del administrador que lo hizo y `diff` con solo los campos que cambiaron, con su valor nuevo (`active`, `role` o ambos). Se lee con `GET /api/audit`, que devuelve primero el registro más reciente.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y ese administrador obtiene su accessToken con `POST /api/auth/login`. Las peticiones llevan la cabecera `x-tenant: alumno01`.
- Si una fila necesita que `admin@sigpro.test` sea quien actúa, esa cuenta inicia sesión con `Admin1234!`, completa el segundo factor con `POST /api/auth/mfa` y el código `123456`, y usa el accessToken que recibe.

## Criterios de aceptación
```gherkin
Característica: Cambio de rol o de estado de una cuenta del tenant

  Esquema del escenario: Un rol válido se aplica a la cuenta
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador
    Cuando envía PATCH /api/admin/users/<id> con x-tenant alumno01, su accessToken y el cuerpo {"role": "<rol_nuevo>"}
    Entonces la respuesta es 200 con el usuario <correo> y el rol <rol_nuevo>
    Y GET /api/admin/users muestra el rol <rol_nuevo> para <correo>

    Ejemplos:
      | id | correo | rol_nuevo |
      | u3 | consultor@sigpro.test | auditor |
      | u2 | gestor@sigpro.test | admin |
      | u6 | pendiente@sigpro.test | program_manager |

  Esquema del escenario: Un valor igual al que la cuenta tiene no cambia nada
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador y ha anotado el total que devuelve GET /api/audit
    Cuando envía PATCH /api/admin/users/<id> con x-tenant alumno01, su accessToken y el cuerpo {"role": "<rol>"}
    Entonces la respuesta es 200 con el usuario <correo> tal como estaba, con el rol <rol>
    Y el total que devuelve GET /api/audit sigue igual

    Ejemplos:
      | id | correo | rol |
      | u1 | admin@sigpro.test | admin |
      | u2 | gestor@sigpro.test | program_manager |

  Esquema del escenario: La cuenta desactivada vuelve a abrir sesión solo cuando queda activa
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador y ha desactivado la cuenta auditor@sigpro.test
    Cuando envía PATCH /api/admin/users/u4 con x-tenant alumno01, su accessToken y el cuerpo {"active": <activa>}
    Entonces la respuesta es 200 con active <activa>
    Y auditor@sigpro.test inicia sesión en alumno01 con Audit1234! y la respuesta es <respuesta_login>

    Ejemplos:
      | activa | respuesta_login |
      | true | 200 con accessToken, refreshToken y el usuario con el rol auditor |
      | false | 403 account_disabled sin ningún token |

  Esquema del escenario: Reactivar no quita el bloqueo ni aprueba una cuenta pendiente de aprobación
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador y después ha desactivado y reactivado la cuenta <correo> con PATCH /api/admin/users/<id>
    Cuando <correo> inicia sesión en alumno01 con la contraseña <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | id | correo | contraseña | respuesta |
      | u5 | bloqueado@sigpro.test | Block1234! | 423 account_locked |
      | u6 | pendiente@sigpro.test | Pend1234! | 403 pending_approval |

  Esquema del escenario: Cada cambio aplicado deja su registro de auditoría
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador
    Cuando envía PATCH /api/admin/users/<id> con x-tenant alumno01, su accessToken y el cuerpo <cuerpo>
    Entonces la respuesta es 200
    Y el registro más reciente de GET /api/audit tiene la acción user.updated, la entidad user, el id <id>, el actor u7 y el diff con solo <diff>

    Ejemplos:
      | id | cuerpo | diff |
      | u4 | {"active": false} | active false |
      | u3 | {"role": "auditor"} | role auditor |
      | u3 | {"active": false, "role": "auditor"} | active false y role auditor |

  Esquema del escenario: El rol nuevo solo llega con un inicio de sesión nuevo
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión con Consul1234! y conserva ese accessToken, y después alumno01@sigpro.lab, que ha iniciado sesión como administrador, le ha cambiado el rol a <rol_nuevo>
    Cuando consultor@sigpro.test pide GET /api/admin/users con x-tenant alumno01 y ese accessToken anterior
    Entonces la respuesta es 403 forbidden
    Y después de volver a iniciar sesión con Consul1234!, la misma petición responde <respuesta_nueva>

    Ejemplos:
      | rol_nuevo | respuesta_nueva |
      | admin | 200 con la lista de usuarios |
      | auditor | 403 forbidden |
```

## Fuera de alcance
- La validación del cuerpo, la cuenta inexistente y el orden de las comprobaciones: esta misma épica (historia 004).
- La protección de la propia cuenta y del último admin activo: esta misma épica (historia 005).
- Los avisos de la tabla de la web y de la app móvil al cambiar un usuario: esta misma épica (historias 008 y 011).
- La aprobación de una cuenta pendiente y el desbloqueo de una cuenta bloqueada: esta misma épica, como capacidades futuras (historias 012 y 013).
- La renovación del token y lo que devuelve, con el rol actual de la cuenta: épica de Sesión y renovación de token (EP-SESION).
- El inicio de sesión de las cuentas bloqueadas, pendientes o desactivadas, con sus avisos: épica de Inicio y cierre de sesión (EP-LOGIN). El segundo factor: EP-MFA. La lectura del registro de auditoría: EP-AUDITORIA.
