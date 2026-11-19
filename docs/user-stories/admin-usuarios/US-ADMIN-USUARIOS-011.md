---
id: US-ADMIN-USUARIOS-011
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[Móvil] Cambiar el rol o el estado de un usuario desde su tarjeta"
etiquetas: [movil]
relacionadas: [US-ADMIN-USUARIOS-003, US-ADMIN-USUARIOS-005, US-ADMIN-USUARIOS-008, US-ADMIN-USUARIOS-009, US-ADMIN-USUARIOS-010]
verificacion: codigo
---

## Historia
Como administrador de un tenant que usa la app móvil, quiero cambiar el rol o el estado de una persona desde su tarjeta y ver si el cambio se ha guardado o si SIGPRO lo ha rechazado,
para gestionar las cuentas del tenant también desde el móvil.

## Reglas
- Elegir en el selector de rol de una tarjeta un rol distinto del que tiene la cuenta cambia el rol. El nuevo rol se ve al momento en la tarjeta. Cuando la API lo guarda, aparece el aviso emergente «Usuario actualizado» con el texto formado por el nombre de la persona, dos puntos, «rol =» y el nombre del rol (por ejemplo, «Lucía Fernández: rol = Auditor»). El aviso emergente se cierra solo a los 3 segundos, como en toda la aplicación.
- Elegir el rol que la cuenta ya tiene no cambia nada: no aparece ningún aviso y la tarjeta no cambia.
- Pulsar el interruptor «Activo» de una tarjeta cambia si la cuenta está activa. Cuando la API lo guarda, aparece el aviso «Usuario actualizado» con el texto formado por el nombre, dos puntos, «activo =» y «sí» o «no» (por ejemplo, «Andrés Molina: activo = no»).
- Mientras la API responde, la tarjeta ya muestra el valor nuevo. Si la API rechaza el cambio, la tarjeta vuelve a su valor anterior y aparece el aviso emergente «No se pudo guardar el cambio» con el motivo: si la API responde 409 `self_change`, «No puedes desactivarte ni cambiar tu propio rol»; si responde 409 `last_admin`, «Debe quedar al menos un admin activo en el tenant»; si responde 404 `user_not_found`, «El usuario ya no existe»; con cualquier otro error, la traza del error.
- La insignia de estado sigue la prioridad pendiente de aprobación, bloqueada, desactivada y normal: un cambio de activo no la cambia si la cuenta sigue bloqueada o pendiente de aprobación.
- En la tarjeta de la propia cuenta, el selector de rol y el interruptor están deshabilitados, y debajo de ellos se ve el texto «No puedes modificar tu propia cuenta». Junto al nombre aparece la marca «tú».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La persona inicia sesión en la app con `alumno01` en «Tenant de trabajo», va a «Más», abre «Administración» y elige la pestaña «Usuarios». Si una fila necesita que `auditor@sigpro.test` esté desactivada, la desactiva `alumno01@sigpro.lab` con `PATCH /api/admin/users/u4` y `active` falso después de reiniciar el tenant.
- Para los rechazos, la prueba responde en la app a `PATCH /api/admin/users/<id>` con el código que la fila indique, una sola vez.

## Criterios de aceptación
```gherkin
Característica: Cambio de rol o de estado desde las tarjetas de la app móvil

  Esquema del escenario: Un cambio de rol se guarda y lo confirma un aviso
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Usuarios» de Administración
    Cuando elige el rol <rol_nuevo> en la tarjeta de <correo>
    Entonces ve el aviso «Usuario actualizado» con el texto <aviso>
    Y tras volver a abrir la pestaña «Usuarios» la tarjeta de <correo> muestra el rol <rol_nuevo>

    Ejemplos:
      | correo | rol_nuevo | aviso |
      | consultor@sigpro.test | Auditor | «Lucía Fernández: rol = Auditor» |
      | auditor@sigpro.test | Gestor de programas | «Andrés Molina: rol = Gestor de programas» |

  Esquema del escenario: Elegir el rol que la cuenta ya tiene no cambia nada
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Usuarios» de Administración
    Cuando elige el rol <rol_actual> en la tarjeta de <correo>
    Entonces no aparece ningún aviso «Usuario actualizado» y la tarjeta sigue mostrando el rol <rol_actual>

    Ejemplos:
      | correo | rol_actual |
      | consultor@sigpro.test | Consultor |
      | admin@sigpro.test | Admin |

  Esquema del escenario: Un cambio de activo se guarda, lo confirma un aviso y actualiza el estado
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app con alumno01 en «Tenant de trabajo», tiene abierta la pestaña «Usuarios» de Administración y la cuenta <correo> tiene el interruptor de «Activo» en <activo_antes>
    Cuando pulsa el interruptor de la tarjeta de <correo>
    Entonces ve el aviso «Usuario actualizado» con el texto <aviso>
    Y la tarjeta muestra el estado <estado>

    Ejemplos:
      | correo | activo_antes | aviso | estado |
      | auditor@sigpro.test | sí | «Andrés Molina: activo = no» | «Desactivado» |
      | bloqueado@sigpro.test | sí | «Carmen Vidal: activo = no» | «Bloqueado» |

  Esquema del escenario: Si la API rechaza el cambio, la tarjeta vuelve a su valor y avisa del motivo
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Usuarios» de Administración, y la prueba responde <codigo> a PATCH /api/admin/users/<id> en la app
    Cuando <accion> en la tarjeta de <correo>
    Entonces la tarjeta vuelve a mostrar <valor_anterior>
    Y ve el aviso «No se pudo guardar el cambio» con <motivo>

    Ejemplos:
      | correo | id | accion | codigo | valor_anterior | motivo |
      | consultor@sigpro.test | u3 | elige el rol Auditor | 409 last_admin | el rol Consultor | el texto «Debe quedar al menos un admin activo en el tenant» |
      | auditor@sigpro.test | u4 | pulsa el interruptor | 500 | el interruptor encendido | una traza del error |

  Esquema del escenario: Con su propia tarjeta los controles están deshabilitados y el motivo se ve
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Usuarios» de Administración
    Cuando mira su propia tarjeta
    Entonces <control> está deshabilitado, debajo se ve el texto «No puedes modificar tu propia cuenta» y junto al nombre se ve la marca «tú»

    Ejemplos:
      | control |
      | el selector de rol «Rol de Alumno 01» |
      | el interruptor «Activo: Alumno 01» |
```

## Fuera de alcance
- La lista, la búsqueda y los avisos de carga, vacío y error: esta misma épica (historia 010).
- Las reglas de la API del cambio, la validación, la protección de la propia cuenta y del último admin activo: esta misma épica (historias 003, 004 y 005).
- La aprobación de una cuenta pendiente de aprobación y el desbloqueo de una cuenta bloqueada: esta misma épica, como capacidades futuras (historias 012 y 013).
- Los mismos cambios en la web: esta misma épica (historia 008).
