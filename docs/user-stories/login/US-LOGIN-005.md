---
id: US-LOGIN-005
tipo: historia
epica: EP-LOGIN
titulo: "[API] Rechazar el inicio de sesión de una cuenta bloqueada"
etiquetas: [api]
relacionadas: [US-LOGIN-004, US-LOGIN-015, US-LOGIN-028]
verificacion: codigo
cubre: ["POST /api/auth/login"]
---

## Historia
Como responsable de seguridad de un tenant, quiero que una cuenta bloqueada no pueda abrir sesión ni con su contraseña,
para que el bloqueo proteja la cuenta hasta que un administrador intervenga.

## Reglas
- Una cuenta bloqueada responde 423 con `code: "account_locked"` a todo intento de inicio de sesión, sea correcta o no la contraseña.
- La respuesta 423 no lleva `attempts` y el intento no cambia el contador de la cuenta.
- El bloqueo se comprueba antes que cualquier otro estado de la cuenta: una cuenta bloqueada y además pendiente de aprobación o desactivada responde 423.
- En los datos de demostración, `bloqueado@sigpro.test` (contraseña `Block1234!`, rol `consultant`) está bloqueada en todos los tenants.

## Criterios de aceptación
```gherkin
Característica: Cuenta bloqueada

  Esquema del escenario: Una cuenta bloqueada no abre sesión
    Dado que la cuenta "<correo>" está bloqueada
    Cuando envía POST /api/auth/login con la contraseña "<contraseña>"
    Entonces la respuesta es 423 con el código account_locked
    Y la respuesta no incluye "attempts" ni ningún token

    Ejemplos:
      | correo | contraseña |
      | bloqueado@sigpro.test | Block1234! |
      | bloqueado@sigpro.test | incorrecta |
      | BLOQUEADO@sigpro.test | Block1234! |

  Esquema del escenario: El bloqueo manda sobre los demás estados
    Dado que la cuenta "<correo>" está <estado>
    Cuando envía POST /api/auth/login con su contraseña correcta "<contraseña>"
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | correo | estado | contraseña | respuesta |
      | bloqueado@sigpro.test | bloqueada | Block1234! | 423 account_locked |
      | pendiente@sigpro.test | pendiente de aprobación y bloqueada tras 5 fallos | Pend1234! | 423 account_locked |
      | pendiente@sigpro.test | pendiente de aprobación | Pend1234! | 403 pending_approval |
```

## Fuera de alcance
- El desbloqueo de la cuenta por un administrador (épica de Usuarios y roles).
