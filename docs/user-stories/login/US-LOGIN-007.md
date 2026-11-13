---
id: US-LOGIN-007
tipo: historia
epica: EP-LOGIN
titulo: "[API] Rechazar el inicio de sesión de una cuenta desactivada"
etiquetas: [api]
relacionadas: [US-LOGIN-017, US-LOGIN-030, US-LOGIN-006]
verificacion: codigo
cubre: ["POST /api/auth/login"]
---

## Historia
Como administrador de un tenant, quiero que una cuenta que he desactivado no pueda abrir sesión,
para retirar el acceso a quien ya no debe usar SIGPRO sin borrar su historial.

## Reglas
- Una cuenta desactivada con la contraseña correcta responde 403 con `code: "account_disabled"` y no recibe ningún token.
- Con una contraseña incorrecta responde 401 `invalid_credentials` con `attempts`, como cualquier otra cuenta.
- Si la cuenta está a la vez pendiente de aprobación y desactivada, manda la pendiente: 403 `pending_approval`. Si además está bloqueada, manda el bloqueo: 423 `account_locked`.
- Al reactivarla, la cuenta vuelve a entrar con su contraseña.
- Ninguna cuenta de los datos de demostración nace desactivada: un administrador la desactiva desde Administración (por ejemplo `auditor@sigpro.test`, contraseña `Audit1234!`).

## Criterios de aceptación
```gherkin
Característica: Cuenta desactivada

  Esquema del escenario: Una cuenta desactivada no abre sesión
    Dado que un administrador ha <accion> la cuenta auditor@sigpro.test
    Cuando envía POST /api/auth/login con la contraseña <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | accion | contraseña | respuesta |
      | desactivado | Audit1234! | 403 account_disabled sin ningún token |
      | desactivado | incorrecta | 401 invalid_credentials con attempts 1 |
      | desactivado y vuelto a activar | Audit1234! | 200 con la sesión del rol auditor |

  Esquema del escenario: Orden de los estados que impiden entrar
    Dado que un administrador ha desactivado la cuenta <correo>, que además está <otro_estado>
    Cuando envía POST /api/auth/login con su contraseña correcta <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | correo | otro_estado | contraseña | respuesta |
      | auditor@sigpro.test | activa en lo demás | Audit1234! | 403 account_disabled |
      | pendiente@sigpro.test | pendiente de aprobación | Pend1234! | 403 pending_approval |
      | bloqueado@sigpro.test | bloqueada | Block1234! | 423 account_locked |
```
