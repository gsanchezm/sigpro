---
id: US-ADMIN-USUARIOS-008
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[Web] Cambiar el rol o el estado de un usuario desde su fila"
etiquetas: [web]
relacionadas: [US-ADMIN-USUARIOS-001, US-ADMIN-USUARIOS-003, US-ADMIN-USUARIOS-004, US-ADMIN-USUARIOS-005, US-ADMIN-USUARIOS-006, US-ADMIN-USUARIOS-007, US-ADMIN-USUARIOS-011]
verificacion: ejecutada
---

## Historia
Como administrador de un tenant, quiero cambiar el rol o el estado de una persona desde su fila y ver si el cambio se ha guardado o si SIGPRO lo ha rechazado,
para que la tabla muestre siempre el estado real de cada cuenta.

## Reglas
- Elegir un rol en el selector «Rol» de una fila cambia el rol de esa cuenta. El nuevo rol aparece al momento en la fila. Cuando la API lo guarda, aparece el aviso emergente «Usuario actualizado» con el texto formado por el nombre de la persona, dos puntos, «rol =» y el nombre del rol (por ejemplo, «Lucía Fernández: rol = Auditor»). El aviso emergente se cierra solo a los 3 segundos, como en toda la aplicación.
- Pulsar el interruptor de la columna «Activo» de una fila cambia si la cuenta está activa. Cuando la API lo guarda, aparece el aviso «Usuario actualizado» con el texto formado por el nombre, dos puntos, «activo =» y «sí» o «no» (por ejemplo, «Andrés Molina: activo = no»).
- Mientras la API responde, la fila ya muestra el valor nuevo. Si la API rechaza el cambio, la fila vuelve a su valor anterior y aparece el aviso emergente «No se pudo guardar el cambio» con el motivo: si la API responde 409 `self_change`, «No puedes desactivarte ni cambiar tu propio rol»; si responde 409 `last_admin`, «Debe quedar al menos un admin activo en el tenant»; si responde 404 `user_not_found`, «El usuario ya no existe»; con cualquier otro error, la traza del error.
- La insignia de «Estado» sigue la prioridad pendiente de aprobación, bloqueada, desactivada y normal: un cambio de activo no la cambia si la cuenta sigue bloqueada o pendiente de aprobación. Desactivar una cuenta bloqueada la deja en «Bloqueado», y desactivar una cuenta pendiente la deja en «Pendiente».
- La fila de la propia cuenta tiene el selector «Rol» y el interruptor de «Activo» deshabilitados, con la explicación «No puedes modificar tu propia cuenta» al pasar el cursor por encima.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La persona inicia sesión en la web con esa cuenta y abre la pestaña «Usuarios» de Administración. Si una fila necesita que `auditor@sigpro.test` esté desactivada, la desactiva `alumno01@sigpro.lab` con `PATCH /api/admin/users/u4` y `active` falso después de reiniciar el tenant.
- Para los rechazos, la prueba responde en el navegador a `PATCH /api/admin/users/<id>` con el código que la fila indique, una sola vez. Para las esperas, la prueba retrasa esa misma respuesta.
- En los ejemplos, `(cuenta recién solicitada en alumno01)` es una cuenta creada en la propia fila con `POST /api/auth/register` y la cabecera `x-tenant: alumno01`, con el nombre Ana Prueba, el correo `nueva-` seguido de una marca de tiempo y `@organizacion.es`, la organización Unidad de pruebas, el rol consultant y la contraseña `Abcdefghij1!`. Esa cuenta aparece en la tabla como pendiente de aprobación.

## Criterios de aceptación
```gherkin
Característica: Cambio de rol o de estado desde la tabla de usuarios

  Esquema del escenario: Un cambio de rol se guarda, lo confirma un aviso y persiste al recargar
    Dado que el tenant alumno01 está recién reiniciado y alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234! y tiene abierta la pestaña «Usuarios» de Administración
    Cuando elige el rol <rol_nuevo> en la fila de <correo>
    Entonces ve el aviso «Usuario actualizado» con el texto <aviso>
    Y tras recargar la página la fila de <correo> muestra el rol <rol_nuevo>

    Ejemplos:
      | correo | rol_nuevo | aviso |
      | consultor@sigpro.test | Auditor | «Lucía Fernández: rol = Auditor» |
      | gestor@sigpro.test | Admin | «Javier Ortega: rol = Admin» |
      | auditor@sigpro.test | Gestor de programas | «Andrés Molina: rol = Gestor de programas» |

  Esquema del escenario: Un cambio de activo se guarda, lo confirma un aviso y actualiza la insignia de estado
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234!, tiene abierta la pestaña «Usuarios» de Administración y la cuenta <correo> tiene el interruptor de «Activo» en <activo_antes>
    Cuando pulsa el interruptor de la columna «Activo» de la fila de <correo>
    Entonces ve el aviso «Usuario actualizado» con el texto <aviso>
    Y la insignia de «Estado» de esa fila muestra <estado>

    Ejemplos:
      | correo | activo_antes | aviso | estado |
      | auditor@sigpro.test | sí | «Andrés Molina: activo = no» | «Desactivado» |
      | auditor@sigpro.test | no | «Andrés Molina: activo = sí» | «Normal» |
      | bloqueado@sigpro.test | sí | «Carmen Vidal: activo = no» | «Bloqueado» |
      | pendiente@sigpro.test | sí | «Pablo Serrano: activo = no» | «Pendiente» |

  Esquema del escenario: Mientras la API responde, la fila ya muestra el cambio
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234! y tiene abierta la pestaña «Usuarios» de Administración, y la prueba retrasa <espera> la respuesta de PATCH /api/admin/users/u3 en el navegador
    Cuando elige el rol «Auditor» en la fila de consultor@sigpro.test
    Entonces antes de la respuesta el selector de esa fila ya muestra «Auditor»
    Y al llegar la respuesta ve el aviso «Usuario actualizado» con el texto «Lucía Fernández: rol = Auditor»

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Si la API rechaza el cambio, la fila vuelve a su valor y avisa del motivo
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234! y tiene abierta la pestaña «Usuarios» de Administración, y la prueba responde <codigo> a PATCH /api/admin/users/<id> en el navegador
    Cuando <accion> en la fila de <correo>
    Entonces la fila vuelve a mostrar <valor_anterior>
    Y ve el aviso «No se pudo guardar el cambio» con <motivo>

    Ejemplos:
      | correo | id | accion | codigo | valor_anterior | motivo |
      | consultor@sigpro.test | u3 | elige el rol «Auditor» | 409 last_admin | el rol «Consultor» | el texto «Debe quedar al menos un admin activo en el tenant» |
      | consultor@sigpro.test | u3 | elige el rol «Auditor» | 409 self_change | el rol «Consultor» | el texto «No puedes desactivarte ni cambiar tu propio rol» |
      | auditor@sigpro.test | u4 | pulsa el interruptor de la columna «Activo» | 500 | el interruptor encendido | una traza del error |

  Esquema del escenario: Una cuenta que el reinicio del tenant ha borrado no se puede cambiar
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234!, existe (cuenta recién solicitada en alumno01) y esa cuenta aparece en la pestaña «Usuarios» de Administración
    Y después la prueba reinicia el tenant con POST /api/admin/reset y el token de alumno01@sigpro.lab, sin recargar la página
    Cuando <accion> en la fila de esa cuenta
    Entonces la fila vuelve a mostrar <valor_anterior>
    Y ve el aviso «No se pudo guardar el cambio» con el texto «El usuario ya no existe»

    Ejemplos:
      | accion | valor_anterior |
      | elige el rol «Auditor» | el rol «Consultor» |
      | pulsa el interruptor de la columna «Activo» | el interruptor encendido |

  Esquema del escenario: Los controles de la propia cuenta están deshabilitados y explicados
    Dado que el tenant alumno01 está recién reiniciado y alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234! y tiene abierta la pestaña «Usuarios» de Administración
    Cuando mira la fila de alumno01@sigpro.lab
    Entonces <control> está deshabilitado y su explicación es «No puedes modificar tu propia cuenta»

    Ejemplos:
      | control |
      | el selector de la columna «Rol» |
      | el interruptor de la columna «Activo» |
```

## Fuera de alcance
- La forma de la lista, la búsqueda y los avisos de carga, vacío y error: esta misma épica (historia 007).
- Las reglas de la API: el cambio, la validación, la protección de la propia cuenta y del último admin activo: esta misma épica (historias 003, 004 y 005).
- La aprobación de una cuenta pendiente de aprobación y el desbloqueo de una cuenta bloqueada, que la tabla no ofrece: esta misma épica, como capacidades futuras (historias 012 y 013).
- Los mismos cambios en la app móvil: esta misma épica (historia 011).
