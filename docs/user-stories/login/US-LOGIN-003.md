---
id: US-LOGIN-003
tipo: historia
epica: EP-LOGIN
titulo: "[API] Rechazar el inicio de sesión de una cuenta pendiente de aprobación o desactivada"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-LOGIN-002, US-LOGIN-007, US-LOGIN-012]
verificacion: codigo
cubre: ["POST /api/auth/login"]
---

## Historia
Como administrador de un tenant, quiero que una cuenta que aún no he aprobado o que he desactivado no pueda abrir sesión,
para decidir quién usa SIGPRO y retirar el acceso a quien ya no debe usarlo sin borrar su historial.

## Reglas
- Una cuenta pendiente de aprobación con la contraseña correcta responde 403 con `code: "pending_approval"` y no recibe ningún token. Toda cuenta creada con una solicitud de acceso nace pendiente de aprobación.
- Una cuenta desactivada con la contraseña correcta responde 403 con `code: "account_disabled"` y no recibe ningún token. Al reactivarla, vuelve a entrar con su contraseña.
- Con una contraseña incorrecta, las dos responden como cualquier otra cuenta: 401 `invalid_credentials` con `attempts`. Así el estado de la cuenta solo lo conoce quien sabe la contraseña.
- Orden de los estados que impiden entrar: bloqueada (423 `account_locked`), después pendiente de aprobación (403 `pending_approval`) y después desactivada (403 `account_disabled`).
- La contraseña correcta pone el contador de intentos fallidos a cero aunque la respuesta sea 403.
- En los datos de demostración, `pendiente@sigpro.test` (contraseña `Pend1234!`, rol `consultant`) está pendiente de aprobación en todos los tenants y ninguna cuenta nace desactivada.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Para desactivar o reactivar una cuenta, ese mismo administrador envía `PATCH /api/admin/users/<id>` con `active: false` o `active: true` (ids del seed: `u4` para `auditor@sigpro.test`, `u5` para `bloqueado@sigpro.test`, `u6` para `pendiente@sigpro.test`), o lo hace desde Administración. Los fallos previos se envían después del reinicio, con la contraseña incorrecta. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- En los ejemplos, `(cuenta recién solicitada)` es una solicitud de acceso hecha en la propia fila en el tenant `alumno01` («Solicitar acceso» en `/register?tenant=alumno01`) con un correo nuevo (`nueva-` seguido de una marca de tiempo y `@organizacion.es`) y la contraseña `Abcdefghij1!`.

## Criterios de aceptación
```gherkin
Característica: Cuentas pendientes de aprobación o desactivadas

  Esquema del escenario: Una cuenta pendiente de aprobación no abre sesión
    Dado que en el tenant alumno01, recién reiniciado, la cuenta <correo> está pendiente de aprobación y sin intentos fallidos
    Cuando envía POST /api/auth/login con x-tenant alumno01, ese correo y la contraseña <contraseña>
    Entonces la respuesta es <respuesta>
    Y la respuesta no incluye ningún token

    Ejemplos:
      | correo | contraseña | respuesta |
      | pendiente@sigpro.test | Pend1234! | 403 pending_approval |
      | pendiente@sigpro.test | incorrecta | 401 invalid_credentials con attempts 1 |
      | (cuenta recién solicitada) | Abcdefghij1! | 403 pending_approval |
      | (cuenta recién solicitada) | Abcdefghij1 | 401 invalid_credentials con attempts 1 |

  Esquema del escenario: Una cuenta desactivada no abre sesión hasta que se reactiva
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha <accion> la cuenta auditor@sigpro.test
    Cuando envía POST /api/auth/login con x-tenant alumno01, ese correo y la contraseña <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | accion | contraseña | respuesta |
      | desactivado | Audit1234! | 403 account_disabled sin ningún token |
      | desactivado | incorrecta | 401 invalid_credentials con attempts 1 |
      | desactivado y vuelto a activar | Audit1234! | 200 con accessToken, refreshToken y el usuario con el rol auditor |

  Esquema del escenario: Orden de los estados que impiden entrar
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha desactivado la cuenta <correo>, que además está <otro_estado>
    Cuando envía POST /api/auth/login con x-tenant alumno01, ese correo y su contraseña correcta <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | correo | otro_estado | contraseña | respuesta |
      | auditor@sigpro.test | activa en lo demás | Audit1234! | 403 account_disabled |
      | pendiente@sigpro.test | pendiente de aprobación | Pend1234! | 403 pending_approval |
      | bloqueado@sigpro.test | bloqueada | Block1234! | 423 account_locked |

  Esquema del escenario: La contraseña correcta reinicia el contador aunque la cuenta siga pendiente
    Dado que en el tenant alumno01, recién reiniciado, pendiente@sigpro.test acumula <fallos_previos> intentos fallidos consecutivos
    Y después envía su contraseña correcta Pend1234! y recibe 403 pending_approval
    Cuando vuelve a enviar ese correo con la contraseña incorrecta
    Entonces la respuesta es 401 invalid_credentials con attempts 1

    Ejemplos:
      | fallos_previos |
      | 1 |
      | 4 |
```

## Fuera de alcance
- La aprobación, la desactivación y la reactivación de cuentas por un administrador: épica de Usuarios y roles.
- La solicitud de acceso que crea la cuenta: épica de Registro.
