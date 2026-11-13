---
id: US-LOGIN-006
tipo: historia
epica: EP-LOGIN
titulo: "[API] Rechazar el inicio de sesión de una cuenta pendiente de aprobación"
etiquetas: [api]
relacionadas: [US-LOGIN-016, US-LOGIN-029, US-LOGIN-007]
verificacion: codigo
cubre: ["POST /api/auth/login"]
---

## Historia
Como administrador de un tenant, quiero que una cuenta que ha solicitado acceso no pueda entrar hasta que se apruebe,
para decidir quién usa SIGPRO antes de que vea ningún dato.

## Reglas
- Una cuenta pendiente de aprobación con la contraseña correcta responde 403 con `code: "pending_approval"` y no recibe ningún token.
- Con una contraseña incorrecta responde como cualquier otra cuenta: 401 `invalid_credentials` con `attempts` (US-LOGIN-003). Así el estado de la cuenta solo lo conoce quien sabe la contraseña.
- La contraseña correcta pone el contador de intentos fallidos a cero aunque la respuesta sea 403.
- Toda cuenta creada con una solicitud de acceso nace pendiente de aprobación.
- En los datos de demostración, `pendiente@sigpro.test` (contraseña `Pend1234!`, rol `consultant`) está pendiente en todos los tenants.

## Criterios de aceptación
```gherkin
Característica: Cuenta pendiente de aprobación

  Esquema del escenario: Una cuenta pendiente no abre sesión
    Dado que la cuenta "<correo>" está pendiente de aprobación
    Cuando envía POST /api/auth/login con la contraseña "<contraseña>"
    Entonces la respuesta es <respuesta>
    Y la respuesta no incluye ningún token

    Ejemplos:
      | correo | contraseña | respuesta |
      | pendiente@sigpro.test | Pend1234! | 403 pending_approval |
      | pendiente@sigpro.test | incorrecta | 401 invalid_credentials con attempts 1 |
      | nueva@organizacion.es (recién solicitada con la contraseña Abcdefghij1!) | Abcdefghij1! | 403 pending_approval |
      | nueva@organizacion.es (recién solicitada con la contraseña Abcdefghij1!) | Abcdefghij1 | 401 invalid_credentials con attempts 1 |

  Esquema del escenario: La contraseña correcta reinicia el contador aunque la cuenta siga pendiente
    Dado que "pendiente@sigpro.test" acumula <fallos_previos> intentos fallidos consecutivos
    Y envía su contraseña correcta "Pend1234!" y recibe 403 pending_approval
    Cuando vuelve a enviar la contraseña "incorrecta"
    Entonces la respuesta es 401 con "attempts" igual a 1

    Ejemplos:
      | fallos_previos |
      | 1 |
      | 4 |
```

## Fuera de alcance
- La aprobación de la cuenta por un administrador (épica de Usuarios y roles).
- La solicitud de acceso que crea la cuenta (épica de Registro).
