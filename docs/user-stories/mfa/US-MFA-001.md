---
id: US-MFA-001
tipo: historia
epica: EP-MFA
titulo: "[API] Canjear el token temporal y el código por una sesión"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-MFA-002, US-MFA-003, US-MFA-004]
verificacion: ejecutada
cubre: ["POST /api/auth/mfa"]
---

## Historia
Como persona cuya cuenta exige verificación en dos pasos, quiero canjear el token temporal recibido tras mi contraseña y mi código,
para abrir la sesión solo después de completar ambos pasos.

## Reglas
- `POST /api/auth/mfa` es público (no pide `Authorization`) y recibe `mfaToken` y `code`. `mfaToken` es un texto no vacío y `code` tiene exactamente seis dígitos. Un cuerpo que no lo cumple responde 422 `validation_failed` con un motivo para cada campo no válido y no emite tokens.
- El `mfaToken` es el token temporal que devuelve el inicio de sesión de una cuenta con segundo factor. Dura cinco minutos para que quien tiene la contraseña no pueda dejar abierto el segundo paso indefinidamente: con cuatro minutos de antigüedad se puede canjear y con seis ya no. Identifica a la cuenta y a su tenant y solo sirve para este endpoint.
- Un `mfaToken` inválido, caducado o de otro tipo (un `accessToken` o un `refreshToken`) responde 401 `invalid_mfa` y no emite tokens.
- Un código incorrecto para esa cuenta responde 401 `invalid_mfa`, sin sesión. En los datos de demostración, el código de `admin@sigpro.test` es `123456` en cada tenant.
- Con token y código válidos y la cuenta apta para entrar, la respuesta es 200 con `accessToken`, `refreshToken`, `expiresIn: 900` y el usuario (`id`, `name`, `email`, `role`, `mfa`, `tenant`) del tenant y el rol de la cuenta.
- El `mfaToken`, por sí solo, no es una sesión: un endpoint protegido lo rechaza con 401 `invalid_token`. La sesión que se obtiene al canjearlo sí abre ese endpoint.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); después `admin@sigpro.test` (`Admin1234!`) envía `POST /api/auth/login` con `x-tenant: alumno01` y recibe `mfaRequired: true` y un `mfaToken`, sin tokens de sesión. Cada fila usa su propio `mfaToken`. Cuando se indique otro tipo de token, se inicia sesión con `gestor@sigpro.test` (`Gestor1234!`) en el mismo tenant y se usa su `accessToken` o su `refreshToken` en lugar del `mfaToken`. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Para las filas que hablan de la antigüedad del token, se obtiene el `mfaToken` en la propia fila y se canjea cuando ha pasado el tiempo indicado, sin volver a iniciar sesión entre medias.

## Criterios de aceptación
```gherkin
Característica: Canje del segundo factor por la API

  Esquema del escenario: El código correcto completa la sesión
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test ha recibido un mfaToken nuevo y aún no tiene sesión
    Cuando envía POST /api/auth/mfa con ese mfaToken y el código <codigo>
    Entonces la respuesta es <respuesta>
    Y <sesion>

    Ejemplos:
      | codigo | respuesta | sesion |
      | 123456 | 200 | trae accessToken, refreshToken, expiresIn 900 y el usuario admin del tenant alumno01 con mfa verdadero |
      | 000000 | 401 invalid_mfa | no trae tokens de sesión |
      | 123457 | 401 invalid_mfa | no trae tokens de sesión |

  Esquema del escenario: Un cuerpo con formato inválido no se canjea
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test ha recibido un mfaToken nuevo
    Cuando envía POST /api/auth/mfa con <mfaToken_enviado> como mfaToken y <codigo> como código
    Entonces la respuesta es 422 validation_failed con un motivo para <campo>
    Y no trae tokens de sesión

    Ejemplos:
      | mfaToken_enviado | codigo | campo |
      | ese mfaToken | 12345 | code |
      | ese mfaToken | 1234567 | code |
      | ese mfaToken | 12345a | code |
      | ese mfaToken | (vacío) | code |
      | ese mfaToken | (sin el campo) | code |
      | (vacío) | 123456 | mfaToken |
      | (sin el campo) | 123456 | mfaToken |

  Esquema del escenario: Un token distinto del segundo paso no abre sesión
    Dado que en el tenant alumno01, recién reiniciado, se ha obtenido <token>
    Cuando envía POST /api/auth/mfa con ese token como mfaToken y el código 123456
    Entonces la respuesta es 401 invalid_mfa
    Y no trae tokens de sesión

    Ejemplos:
      | token |
      | un texto que no es JWT |
      | el accessToken de admin@sigpro.test, obtenido al canjear su mfaToken con 123456 |
      | el refreshToken de admin@sigpro.test, obtenido al canjear su mfaToken con 123456 |

  Esquema del escenario: El token temporal no es una sesión y la sesión canjeada sí lo es
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test ha recibido un mfaToken nuevo
    Cuando envía GET /api/auth/me con <credencial> como Bearer
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | respuesta |
      | ese mfaToken | 401 invalid_token |
      | el accessToken obtenido al canjear ese mfaToken con 123456 | 200 con el correo admin@sigpro.test |

  Esquema del escenario: El token temporal caduca a los cinco minutos
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test obtuvo un mfaToken nuevo hace <antiguedad>
    Cuando envía POST /api/auth/mfa con ese mfaToken y el código 123456
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | antiguedad | respuesta |
      | cuatro minutos | 200 con accessToken y refreshToken |
      | seis minutos | 401 invalid_mfa sin tokens de sesión |
```

## Fuera de alcance
- Cómo se obtiene el token temporal con correo y contraseña: EP-LOGIN.
- La duración y renovación de los tokens de la sesión emitida: EP-SESION.
- Si el mismo `mfaToken` puede canjearse más de una vez y si los códigos incorrectos tienen un límite de intentos: no están decididos (ver «Decisiones pendientes»).

## Decisiones pendientes
- Si un `mfaToken` ya canjeado con éxito debe poder canjearse otra vez antes de caducar, y si los códigos incorrectos repetidos deben limitarse o bloquear algo. Hoy no hay límite ni consumo del token; esto describe lo que existe, no es un criterio, y que la app lo mantenga o lo cambie no se reporta como defecto.
