---
id: US-ADMIN-USUARIOS-010
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[Móvil] Ver a los usuarios del tenant en tarjetas y buscarlos"
etiquetas: [movil]
relacionadas: [US-ADMIN-USUARIOS-006, US-ADMIN-USUARIOS-007, US-ADMIN-USUARIOS-009, US-ADMIN-USUARIOS-011]
verificacion: codigo
---

## Historia
Como administrador de un tenant que usa la app móvil, quiero ver a cada persona en su propia tarjeta, con su rol y su estado, y poder buscarla por nombre o por correo,
para gestionar el tenant desde el móvil, donde una tabla no cabe en la pantalla.

## Reglas
- Cada usuario ocupa una tarjeta, en el orden de la lista de la API: la cuenta más antigua primero. La tarjeta muestra el avatar y el nombre, el correo, el selector de rol con el texto «Rol de» seguido del nombre de la persona, el interruptor con el texto «Activo:» seguido del nombre, y el estado de la cuenta.
- El estado de la tarjeta es «Normal», «Bloqueado», «Pendiente» o «Desactivado», con la misma prioridad que en la web: pendiente de aprobación, después bloqueada y después desactivada.
- Encima de la lista aparecen el campo «Buscar usuarios», con el texto de ayuda «Nombre o correo…», el recuento «N de M usuarios» y la nota «No puedes desactivarte ni cambiar tu propio rol, y siempre debe quedar al menos un admin activo.»
- La búsqueda filtra por nombre o por correo, sin distinguir mayúsculas y sin contar los espacios del principio y del final. El recuento sigue al filtro: M es siempre el total de cuentas del tenant.
- Si ninguna cuenta coincide con la búsqueda, aparece el aviso «Ningún usuario coincide con la búsqueda.».
- Mientras la lista se carga, el recuento muestra «…» y se ve el indicador de carga en lugar de tarjetas.
- Si la lista no se puede cargar, aparece el aviso «No se pudieron cargar los usuarios», con la traza del error y el botón «Reintentar». Al pulsarlo se pide la lista de nuevo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La persona inicia sesión en la app con `alumno01` en «Tenant de trabajo», va a «Más», abre «Administración» y elige la pestaña «Usuarios». Para las esperas y los fallos, la prueba intercepta en la app la petición `GET /api/admin/users` que la fila indique.

## Criterios de aceptación
```gherkin
Característica: Tarjetas de usuarios de Administración en la app móvil

  Esquema del escenario: Cada tarjeta muestra el rol y el estado de su cuenta
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Usuarios» de Administración
    Cuando mira la tarjeta de <correo>
    Entonces la tarjeta muestra el selector «Rol de <nombre>» con el valor <rol> y el estado <estado>

    Ejemplos:
      | correo | nombre | rol | estado |
      | admin@sigpro.test | Marta Ruiz | Admin | «Normal» |
      | bloqueado@sigpro.test | Carmen Vidal | Consultor | «Bloqueado» |
      | pendiente@sigpro.test | Pablo Serrano | Consultor | «Pendiente» |

  Esquema del escenario: La búsqueda filtra las tarjetas por nombre o correo
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Usuarios» de Administración
    Cuando escribe <busqueda> en «Buscar usuarios»
    Entonces el recuento dice <recuento> y <resultado>

    Ejemplos:
      | busqueda | recuento | resultado |
      | (GESTOR@SIGPRO.test con espacios delante y detrás) | «1 de 7 usuarios» | solo se ve la tarjeta de gestor@sigpro.test |
      | zzz | «0 de 7 usuarios» | se ve el aviso «Ningún usuario coincide con la búsqueda.» |

  Esquema del escenario: Si la lista no se puede cargar, el aviso ofrece reintentar y al reintentar aparecen las tarjetas
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y la prueba responde <codigo> a la primera petición de GET /api/admin/users
    Cuando abre la pestaña «Usuarios» de Administración
    Entonces ve el aviso «No se pudieron cargar los usuarios» con la traza del error y el botón «Reintentar»
    Cuando pulsa «Reintentar»
    Entonces ve las siete tarjetas del tenant

    Ejemplos:
      | codigo |
      | 500 |

  Esquema del escenario: Mientras la lista carga, el recuento muestra puntos suspensivos
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y la prueba retrasa <espera> la respuesta de GET /api/admin/users
    Cuando abre la pestaña «Usuarios» de Administración
    Entonces durante la espera el recuento muestra «…» y se ve el indicador de carga
    Y al llegar la respuesta ve las siete tarjetas del tenant

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |
```

## Fuera de alcance
- El cambio de rol y de estado desde la tarjeta y sus avisos: esta misma épica (historia 011).
- La entrada a Administración y las pestañas: esta misma épica (historia 009).
- La lista que devuelve la API y su orden: esta misma épica (historia 001).
- La versión de la web: esta misma épica (historia 007).
