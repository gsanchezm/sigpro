---
id: US-ADMIN-USUARIOS-005
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[API] Impedir quitarse el acceso o dejar el tenant sin admin activo"
etiquetas: [api]
relacionadas: [US-ADMIN-USUARIOS-002, US-ADMIN-USUARIOS-003, US-ADMIN-USUARIOS-004, US-ADMIN-USUARIOS-008, US-ADMIN-USUARIOS-011]
verificacion: ejecutada
cubre: ["PATCH /api/admin/users/:id"]
---

## Historia
Como administrador de un tenant, quiero que SIGPRO me impida desactivarme, quitarme el rol admin o dejar el tenant sin ningún admin activo,
para que siempre haya alguien que pueda volver a administrar las cuentas del tenant.

## Reglas
- Nadie desactiva su propia cuenta ni cambia su propio rol. Un cambio sobre la cuenta del propio accessToken que la desactiva, o que le pone otro rol, responde 409 `self_change` y no cambia nada.
- Un cambio sobre la propia cuenta que la deja como está (`active` verdadero, o el mismo rol) responde 200 sin cambios.
- Un cambio que dejaría el tenant sin ningún admin activo responde 409 `last_admin`. Es el caso de desactivar, o de cambiar a otro rol, a un admin activo cuando es el único admin activo del tenant.
- El recuento de admins activos se hace antes del cambio y cuenta también a la cuenta cambiada.
- Si quien pide el cambio es la propia cuenta y además es el único admin activo, la respuesta es 409 `self_change`: esa comprobación va antes que la del último admin.
- Un cambio sobre una cuenta que no es un admin activo nunca responde 409 `last_admin`.
- Una cuenta desactivada conserva, mientras su accessToken siga vigente, los permisos del rol que lleva ese token. Por eso puede hacer un cambio que deja el tenant sin admin activo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y ese administrador obtiene su accessToken con `POST /api/auth/login`. En el seed, `admin@sigpro.test` (`u1`) y `alumno01@sigpro.lab` (`u7`) son los dos admins activos.
- Cuando una fila necesita que `admin@sigpro.test` actúe, esa cuenta inicia sesión con `Admin1234!`, completa el segundo factor con `POST /api/auth/mfa` y el código `123456`, y conserva el accessToken que recibe, aunque después se la desactive.
- Cuando una fila necesita tres admins activos, `alumno01@sigpro.lab` da el rol `admin` a `gestor@sigpro.test` (`u2`) con `PATCH /api/admin/users/u2` antes de la petición de la fila.
- Las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Protección de la propia cuenta y del último admin activo

  Esquema del escenario: Quien se pide a sí mismo un cambio que lo quita del acceso recibe 409 self_change
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador
    Cuando envía PATCH /api/admin/users/u7 con x-tenant alumno01, su accessToken y el cuerpo <cuerpo>
    Entonces la respuesta es <respuesta>
    Y la cuenta alumno01@sigpro.lab sigue activa con el rol admin

    Ejemplos:
      | cuerpo | respuesta |
      | {"active": false} | 409 self_change |
      | {"role": "consultant"} | 409 self_change |
      | {"role": "admin"} | 200 sin cambios |
      | {"active": true} | 200 sin cambios |

  Esquema del escenario: Con varios admins activos, un cambio que deja al menos uno se permite
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador y <preparacion>
    Cuando envía PATCH /api/admin/users/<id> con x-tenant alumno01, su accessToken y el cuerpo <cuerpo>
    Entonces la respuesta es 200 con <resultado>

    Ejemplos:
      | preparacion | id | cuerpo | resultado |
      | admin@sigpro.test es admin activo (dos admins activos en total) | u1 | {"role": "consultant"} | el rol consultant |
      | ha dado el rol admin a gestor@sigpro.test (tres admins activos en total) | u2 | {"active": false} | active false |

  Esquema del escenario: Un cambio que deja el tenant sin admin activo responde 409 last_admin
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador, admin@sigpro.test ha iniciado sesión con su segundo factor y conserva su accessToken, y después alumno01@sigpro.lab ha desactivado la cuenta admin@sigpro.test
    Cuando admin@sigpro.test, con ese accessToken anterior, envía PATCH /api/admin/users/u7 con x-tenant alumno01 y el cuerpo <cuerpo>
    Entonces la respuesta es <respuesta>
    Y la cuenta alumno01@sigpro.lab sigue activa con el rol admin

    Ejemplos:
      | cuerpo | respuesta |
      | {"active": false} | 409 last_admin |
      | {"role": "consultant"} | 409 last_admin |
      | {"active": true} | 200 sin cambios |
      | {"role": "admin"} | 200 sin cambios |

  Esquema del escenario: Con un solo admin activo, la propia cuenta recibe self_change y no last_admin
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador, admin@sigpro.test ha iniciado sesión con su segundo factor, y después alumno01@sigpro.lab ha desactivado la cuenta admin@sigpro.test
    Cuando alumno01@sigpro.lab envía PATCH /api/admin/users/u7 con x-tenant alumno01, su accessToken y el cuerpo <cuerpo>
    Entonces la respuesta es 409 self_change

    Ejemplos:
      | cuerpo |
      | {"active": false} |
      | {"role": "auditor"} |

  Esquema del escenario: Desactivar a una cuenta que no es admin activo nunca responde last_admin
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión como administrador, admin@sigpro.test ha iniciado sesión con su segundo factor y conserva su accessToken, y después alumno01@sigpro.lab ha desactivado la cuenta admin@sigpro.test
    Cuando admin@sigpro.test, con ese accessToken anterior, envía PATCH /api/admin/users/<id> con x-tenant alumno01 y el cuerpo <cuerpo>
    Entonces la respuesta es 200

    Ejemplos:
      | id | cuerpo |
      | u3 | {"active": false} |
      | u6 | {"role": "auditor"} |
```

## Fuera de alcance
- La validación del cuerpo y la cuenta inexistente, que se comprueban antes que estas reglas: esta misma épica (historia 004).
- El permiso de rol, que se comprueba antes que todo lo demás: esta misma épica (historia 002).
- Los avisos de la web y de la app móvil ante un 409: esta misma épica (historias 008 y 011).
- La renovación del accessToken de una cuenta desactivada: épica de Sesión y renovación de token (EP-SESION).
