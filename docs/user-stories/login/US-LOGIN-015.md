---
id: US-LOGIN-015
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Avisar del bloqueo de la cuenta"
etiquetas: [web]
relacionadas: [US-LOGIN-004, US-LOGIN-005, US-LOGIN-014, US-LOGIN-028]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero ver un aviso claro cuando mi cuenta se bloquea o ya está bloqueada,
para saber que debo pedir ayuda a un administrador y no seguir intentando.

## Reglas
- La cuenta se bloquea en el 5.º intento fallido consecutivo; con 4 sigue activa.
- Una cuenta bloqueada muestra el aviso de error «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» con el detalle «POST /api/auth/login → 423 Locked», sin número de intento.
- Una cuenta bloqueada no entra ni con la contraseña correcta.
- Un acceso correcto antes del 5.º fallo entra y reinicia el contador de intentos.

## Criterios de aceptación
```gherkin
Característica: Aviso de cuenta bloqueada en la web

  Esquema del escenario: El quinto intento fallido bloquea la cuenta
    Dado que "gestor@sigpro.test" ya acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login escribe ese correo y una contraseña <contraseña>
    Y pulsa "Entrar"
    Entonces ve "<mensaje>"
    Y la cuenta queda <cuenta>

    Ejemplos:
      | fallos_previos | contraseña | mensaje | cuenta |
      | 3 | incorrecta | Correo o contraseña incorrectos | activa |
      | 4 | incorrecta | Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador. | bloqueada |
      | 4 | correcta (Gestor1234!) | Sesión iniciada. Redirigiendo a Programas… | activa |
      | 5 | correcta (Gestor1234!) | Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador. | bloqueada |

  Esquema del escenario: Una cuenta ya bloqueada no entra
    Dado que la cuenta "bloqueado@sigpro.test" está bloqueada
    Cuando en /login escribe ese correo y la contraseña "<contraseña>"
    Y pulsa "Entrar"
    Entonces ve el aviso de error "Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador."
    Y el detalle "POST /api/auth/login → 423 Locked"
    Y sigue en /login sin sesión

    Ejemplos:
      | contraseña |
      | Block1234! |
      | incorrecta |
```

## Fuera de alcance
- El desbloqueo de la cuenta por un administrador (épica de Usuarios y roles).
