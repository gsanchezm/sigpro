---
id: US-MFA-002
tipo: historia
epica: EP-MFA
titulo: "[API] Impedir el canje si la cuenta quedó bloqueada o desactivada"
etiquetas: [api]
relacionadas: [US-MFA-001, US-LOGIN-003, US-LOGIN-002]
verificacion: ejecutada
cubre: ["POST /api/auth/mfa"]
---

## Historia
Como administrador de un tenant, quiero que el segundo paso vuelva a comprobar el estado de la cuenta,
para que un token temporal emitido antes de un bloqueo o una desactivación no permita abrir una sesión nueva.

## Reglas
- El estado de la cuenta se comprueba al canjear el `mfaToken`, además de comprobarse al enviar la contraseña. Un token temporal válido no exime de esta comprobación.
- Con una cuenta bloqueada, `POST /api/auth/mfa` con el código correcto responde 423 `account_locked`; con una cuenta desactivada, 403 `account_disabled`. Ninguna respuesta emite tokens de sesión.
- Los estados se evalúan en el mismo orden que en el inicio de sesión: bloqueada, después pendiente de aprobación y después desactivada. Una cuenta bloqueada y desactivada responde 423 `account_locked`. Las cuentas con segundo factor de los datos de demostración no nacen pendientes de aprobación, así que esta historia solo ejercita el orden entre bloqueada y desactivada.
- Un código incorrecto sigue respondiendo 401 `invalid_mfa` con la cuenta en cualquiera de estos estados: el estado de la cuenta solo se conoce con el código correcto.
- Una desactivación no destruye el `mfaToken`: si se reactiva la cuenta antes de que el token caduque, el mismo token y el código correcto completan la sesión.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); `admin@sigpro.test` (`Admin1234!`) obtiene su `mfaToken` con `POST /api/auth/login`. Después, antes del canje y sin pasar de los cinco minutos de vida del token: para desactivar o reactivar la cuenta, `alumno01@sigpro.lab` envía `PATCH /api/admin/users/u1` con `active: false` o `active: true` (`u1` es `admin@sigpro.test` en los datos de demostración); para bloquearla, se envían cinco inicios de sesión con una contraseña incorrecta para `admin@sigpro.test`, después de obtener el token temporal. Para «bloqueada y desactivada» se desactiva primero y se bloquea después. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Estado de la cuenta durante el segundo paso

  Esquema del escenario: Un cambio de estado impide abrir sesión
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test obtuvo un mfaToken nuevo estando activa
    Y después su cuenta quedó <estado>
    Cuando envía POST /api/auth/mfa con ese mfaToken y el código <codigo>
    Entonces la respuesta es <respuesta>
    Y no trae tokens de sesión

    Ejemplos:
      | estado | codigo | respuesta |
      | bloqueada tras cinco contraseñas incorrectas | 123456 | 423 account_locked |
      | desactivada por el administrador del tenant | 123456 | 403 account_disabled |
      | desactivada y después bloqueada tras cinco contraseñas incorrectas | 123456 | 423 account_locked |
      | bloqueada tras cinco contraseñas incorrectas | 000000 | 401 invalid_mfa |
      | desactivada por el administrador del tenant | 000000 | 401 invalid_mfa |

  Esquema del escenario: Una cuenta reactivada puede completar el mismo intento
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test obtuvo un mfaToken nuevo estando activa
    Y después el administrador del tenant la desactivó y volvió a activarla
    Cuando envía POST /api/auth/mfa con ese mismo mfaToken y el código <codigo>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | codigo | respuesta |
      | 123456 | 200 con accessToken, refreshToken y el usuario admin del tenant alumno01 |
      | 000000 | 401 invalid_mfa sin tokens de sesión |
```

## Fuera de alcance
- Cómo administra las cuentas el usuario autorizado: EP-ADMIN-USUARIOS.
- El desbloqueo de una cuenta: EP-ADMIN-USUARIOS.
