---
id: US-SESION-005
tipo: historia
epica: EP-SESION
titulo: "[API] Identificar la sesión en GET /api/auth/me y rechazar las peticiones sin token válido"
etiquetas: [api]
relacionadas: [US-SESION-001, US-SESION-002, US-SESION-004, US-LOGIN-001, US-MFA-001]
verificacion: codigo
cubre: ["GET /api/auth/me"]
---

## Historia
Como cliente de la API, quiero preguntar con mi accessToken quién es la persona de la sesión, y que cualquier petición sin un accessToken válido se rechace con un código que diga por qué,
para mostrar su identidad y saber si debo renovar la sesión, volver a iniciarla o dejar de pedir datos.

## Reglas
- `GET /api/auth/me` necesita la cabecera `Authorization` con el esquema `Bearer` y un accessToken vigente.
- Con un accessToken vigente, la respuesta es 200 con `id`, `name`, `email`, `role`, `mfa` y `tenant` de la cuenta del token. `mfa` es verdadero si la cuenta tiene segundo factor.
- La identidad sale del token: el tenant de la respuesta es el del token, y la cabecera `x-tenant` no la cambia.
- Sin cabecera `Authorization`, con `Bearer` y ningún token, o con otro esquema de autenticación, la respuesta es 401 con `code: "missing_token"`.
- Un token que no es un accessToken válido responde 401 con `code: "invalid_token"`: un texto que no es un token, un token alterado, un refreshToken o un mfaToken, aunque estén vigentes, y un accessToken caducado.
- Las demás rutas protegidas de la API aplican la misma comprobación: sin token válido responden como aquí. Las comprobaciones de permiso por rol (403 `forbidden`) son de cada módulo.
- Un accessToken vigente sigue dando acceso aunque la cuenta se haya bloqueado o desactivado después de emitirse, hasta que caduca. Es una decisión de diseño del laboratorio: los tokens son sin estado y la API no consulta el estado de la cuenta en cada petición. El estado de la cuenta se comprueba al iniciar sesión, al completar el segundo paso y al renovar.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las cuentas de cada fila inician sesión en la propia fila, con `x-tenant: alumno01` y su contraseña de demostración.

## Criterios de aceptación
```gherkin
Característica: Identidad de la sesión y rechazo de tokens en la API

  Esquema del escenario: Un accessToken vigente identifica la cuenta de la sesión
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene una sesión iniciada <paso>
    Cuando envía GET /api/auth/me con su accessToken
    Entonces la respuesta es 200 con el usuario <cuenta>, el nombre <nombre>, el rol <rol> y mfa <mfa>
    Y el tenant del usuario es alumno01

    Ejemplos:
      | cuenta | paso | nombre | rol | mfa |
      | gestor@sigpro.test | con su contraseña | Javier Ortega | program_manager | false |
      | consultor@sigpro.test | con su contraseña | Lucía Fernández | consultant | false |
      | auditor@sigpro.test | con su contraseña | Andrés Molina | auditor | false |
      | alumno01@sigpro.lab | con su contraseña | Alumno 01 | admin | false |
      | admin@sigpro.test | con el segundo paso completado con el código 123456 | Marta Ruiz | admin | true |

  Esquema del escenario: Sin accessToken en la cabecera Authorization la respuesta es missing_token
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión
    Cuando envía GET /api/auth/me con <cabecera>
    Entonces la respuesta es 401 missing_token

    Ejemplos:
      | cabecera |
      | (sin cabecera Authorization) |
      | Authorization con solo la palabra Bearer |
      | Authorization con el esquema Basic y el accessToken de gestor@sigpro.test |

  Esquema del escenario: Un token que no es un accessToken válido responde invalid_token
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión y admin@sigpro.test ha recibido un mfaToken
    Cuando envía GET /api/auth/me con <token> como Bearer
    Entonces la respuesta es 401 invalid_token

    Ejemplos:
      | token |
      | un texto que no es un token |
      | el accessToken de gestor@sigpro.test con su última letra cambiada |
      | el refreshToken de gestor@sigpro.test |
      | el mfaToken de admin@sigpro.test |

  Esquema del escenario: Un accessToken sigue dando acceso hasta caducar aunque la cuenta cambie de estado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test obtuvo su accessToken y su refreshToken con remember true y después <cambio>
    Cuando envía GET /api/auth/me con ese accessToken
    Entonces la respuesta es 200 con el usuario gestor@sigpro.test
    Y la renovación con ese refreshToken responde 401 invalid_token

    Ejemplos:
      | cambio |
      | alumno01@sigpro.lab la desactiva con PATCH /api/admin/users/u2 y active false |
      | falla cinco veces seguidas con x-tenant alumno01 y la contraseña incorrecta, y la cuenta queda bloqueada |

  Esquema del escenario: El tenant de la identidad lo fija el accessToken
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test obtuvo su accessToken con remember true
    Cuando envía GET /api/auth/me con <cabecera> y ese accessToken
    Entonces la respuesta es 200 con el usuario gestor@sigpro.test del tenant alumno01

    Ejemplos:
      | cabecera |
      | x-tenant alumno01 |
      | x-tenant alumno02 |
      | (sin cabecera) |
```

## Decisiones pendientes
- Hoy `GET /api/auth/me` devuelve el rol que tiene la cuenta en ese momento, mientras que los permisos de las demás rutas siguen al rol que lleva el accessToken hasta que se renueva. Qué debe responder `/api/auth/me` cuando los dos roles difieren no está decidido, y las filas no lo comprueban.

## Fuera de alcance
- Los plazos del accessToken y del refreshToken: US-SESION-004 de esta épica.
- La renovación de la sesión y sus rechazos: US-SESION-001, US-SESION-002 y US-SESION-003 de esta épica.
- El inicio de sesión y el segundo paso: EP-LOGIN (US-LOGIN-001) y EP-MFA (US-MFA-001).
- El cierre de sesión y su garantía: EP-LOGIN (US-LOGIN-004).
