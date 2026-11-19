---
id: US-SESION-003
tipo: historia
epica: EP-SESION
titulo: "[API] Rechazar la renovación con un token que no sirve o con un cuerpo inválido"
etiquetas: [api]
relacionadas: [US-SESION-001, US-SESION-002, US-SESION-004, US-MFA-001, US-LOGIN-004]
verificacion: ejecutada
cubre: ["POST /api/auth/refresh"]
---

## Historia
Como cliente de la API, quiero que la renovación rechace con un código claro todo lo que no es un refreshToken vigente,
para distinguir una sesión que hay que volver a iniciar de un error en mi propia petición.

## Reglas
- Un refreshToken inválido, alterado, caducado o de otro tipo responde 401 con `code: "invalid_token"` y no trae tokens. Caducado significa que ha pasado su plazo: 7 días con la sesión de «Mantener la sesión» y 12 horas sin ella.
- Un accessToken o un mfaToken no renuevan la sesión, aunque estén vigentes: responden 401 `invalid_token`.
- El cuerpo se valida antes de mirar el token. Sin el campo `refreshToken`, con el campo vacío, con un valor que no es texto o sin cuerpo, la respuesta es 422 `validation_failed` con un motivo para `refreshToken`, y no trae tokens.
- Un texto de un solo carácter cumple la validación del cuerpo y, como no es un token válido, responde 401 `invalid_token`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` inicia sesión con `POST /api/auth/login`, la cabecera `x-tenant: alumno01`, la contraseña `Gestor1234!` y `remember` verdadero, y `admin@sigpro.test` inicia sesión con `Admin1234!` y recibe su `mfaToken` sin completar el segundo paso. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Rechazo de la renovación

  Esquema del escenario: Un token que no es un refreshToken vigente no renueva la sesión
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión y admin@sigpro.test ha recibido un mfaToken
    Cuando envía POST /api/auth/refresh con x-tenant alumno01 y <token> como refreshToken
    Entonces la respuesta es 401 invalid_token
    Y no trae tokens de sesión

    Ejemplos:
      | token |
      | un texto que no es un token |
      | la letra x |
      | el refreshToken de gestor@sigpro.test con su última letra cambiada |
      | el accessToken de gestor@sigpro.test |
      | el mfaToken de admin@sigpro.test |

  Esquema del escenario: Un cuerpo sin refreshToken válido responde 422 y no renueva
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión con remember true
    Cuando envía POST /api/auth/refresh con x-tenant alumno01 y el cuerpo <cuerpo>
    Entonces la respuesta es 422 validation_failed con un motivo para refreshToken
    Y no trae tokens de sesión

    Ejemplos:
      | cuerpo |
      | (sin cuerpo) |
      | (sin el campo refreshToken) |
      | refreshToken igual a (vacío) |
      | refreshToken igual a null |
      | refreshToken igual al número 123 |
```

## Fuera de alcance
- Las cuentas bloqueadas o desactivadas: US-SESION-002 de esta épica.
- Los plazos de caducidad de cada token: US-SESION-004 de esta épica.
- El segundo paso de verificación y su `mfaToken`: EP-MFA (US-MFA-001).
- El cierre de sesión y su garantía: EP-LOGIN (US-LOGIN-004).
