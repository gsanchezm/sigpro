---
id: US-LOGIN-028
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Avisar del bloqueo de la cuenta"
etiquetas: [movil]
relacionadas: [US-LOGIN-004, US-LOGIN-005, US-LOGIN-015, US-LOGIN-027]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero ver en el móvil un aviso claro cuando mi cuenta se bloquea o ya está bloqueada,
para saber que debo pedir ayuda a un administrador y no seguir intentando.

## Reglas
- La cuenta se bloquea en el 5.º intento fallido consecutivo; con 4 sigue activa.
- Una cuenta bloqueada muestra el aviso de error «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» con el detalle «POST /api/auth/login → 423 Locked».
- Una cuenta bloqueada no entra ni con la contraseña correcta.
- Un correo sin cuenta muestra el mismo aviso de bloqueo en su 5.º intento fallido y en los siguientes.
- En los ejemplos, `(correo sin cuenta)` es un correo que nunca se ha usado en ese tenant, como `nadie-` seguido de una marca de tiempo y `@sigpro.test`.

## Criterios de aceptación
```gherkin
Característica: Aviso de cuenta bloqueada en la app móvil

  Esquema del escenario: El quinto intento fallido bloquea la cuenta
    Dado que <correo> ya acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces <resultado>

    Ejemplos:
      | correo | fallos_previos | contraseña | resultado |
      | consultor@sigpro.test | 3 | incorrecta | ve «Correo o contraseña incorrectos» con el detalle «POST /api/auth/login → 401 Unauthorized · attempts=4» |
      | consultor@sigpro.test | 4 | incorrecta | ve «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» con el detalle «POST /api/auth/login → 423 Locked» |
      | consultor@sigpro.test | 4 | Consul1234! | llega a /programs |
      | consultor@sigpro.test | 5 | Consul1234! | ve «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» con el detalle «POST /api/auth/login → 423 Locked» |
      | (correo sin cuenta) | 4 | incorrecta | ve «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» con el detalle «POST /api/auth/login → 423 Locked» |
      | (correo sin cuenta) | 5 | incorrecta | ve «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» con el detalle «POST /api/auth/login → 423 Locked» |

  Esquema del escenario: Una cuenta ya bloqueada no entra
    Dado que la cuenta bloqueado@sigpro.test está bloqueada
    Cuando en /login escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces ve el aviso de error «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.»
    Y el detalle «POST /api/auth/login → 423 Locked»
    Y sigue en /login sin sesión

    Ejemplos:
      | contraseña |
      | Block1234! |
      | incorrecta |
```

## Fuera de alcance
- El desbloqueo de la cuenta por un administrador (épica de Usuarios y roles).
