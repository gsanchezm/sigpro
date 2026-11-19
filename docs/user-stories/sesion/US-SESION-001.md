---
id: US-SESION-001
tipo: historia
epica: EP-SESION
titulo: "[API] Renovar la sesión con el refreshToken"
etiquetas: [api]
relacionadas: [US-SESION-002, US-SESION-003, US-SESION-004, US-SESION-006, US-LOGIN-001, US-LOGIN-004]
verificacion: codigo
cubre: ["POST /api/auth/refresh"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero canjear el refreshToken de una sesión vigente por una sesión nueva,
para seguir llamando a los endpoints protegidos en nombre de la misma persona sin volver a escribir su contraseña.

## Reglas
- `POST /api/auth/refresh` es público: no necesita cabecera `Authorization`.
- El cuerpo lleva `refreshToken`, el texto que devolvió el inicio de sesión o la renovación anterior. Un cuerpo que no lo cumple responde 422 `validation_failed` con un motivo para `refreshToken`.
- Con un refreshToken vigente de una cuenta activa, sin bloqueo ni desactivación, la respuesta es 200 con `user` (`id`, `name`, `email`, `role`, `mfa` y `tenant`), un `accessToken` y un `refreshToken` emitidos en esa renovación, y `expiresIn: 900`.
- Renovar no pide la contraseña ni el segundo paso, y la respuesta no trae `mfaRequired` ni `mfaToken`.
- Los datos de `user` son los de la cuenta en el momento de la renovación: si un administrador ha cambiado el rol, la renovación devuelve el rol nuevo.
- Renovar no gasta el refreshToken: el mismo refreshToken sigue renovando mientras no caduque. Es una decisión de diseño del laboratorio: los tokens son sin estado y el servidor no guarda la lista de los tokens emitidos (ver el cierre de sesión en EP-LOGIN).
- El tenant de la renovación lo fija el refreshToken. La cabecera `x-tenant` no lo cambia.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, en la propia fila, `gestor@sigpro.test` inicia sesión con `POST /api/auth/login`, la cabecera `x-tenant: alumno01`, la contraseña `Gestor1234!` y el campo `remember` que diga la fila, y guarda su `refreshToken`. Cuando la fila cambia el rol, `alumno01@sigpro.lab` envía `PATCH /api/admin/users/u2` con el rol de la fila antes de renovar.

## Criterios de aceptación
```gherkin
Característica: Renovación de la sesión por la API

  Esquema del escenario: Un refreshToken vigente devuelve una sesión nueva
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión <inicio> y guarda su refreshToken
    Cuando envía POST /api/auth/refresh con x-tenant alumno01 y ese refreshToken
    Entonces la respuesta es 200
    Y trae el usuario <cuenta> con el rol <rol> y el tenant alumno01
    Y trae un accessToken, un refreshToken y expiresIn 900

    Ejemplos:
      | cuenta | inicio | rol |
      | gestor@sigpro.test | con remember true | program_manager |
      | consultor@sigpro.test | con remember false | consultant |
      | auditor@sigpro.test | sin el campo remember | auditor |

  Esquema del escenario: La renovación devuelve el rol actual de la cuenta
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión con remember true y guarda su refreshToken
    Y alumno01@sigpro.lab cambia el rol de gestor@sigpro.test a <rol> con PATCH /api/admin/users/u2
    Cuando envía POST /api/auth/refresh con x-tenant alumno01 y ese refreshToken
    Entonces la respuesta es 200 con el usuario gestor@sigpro.test y el rol <rol>

    Ejemplos:
      | rol |
      | consultant |
      | auditor |

  Esquema del escenario: El refreshToken sigue renovando después de haber renovado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión con remember true, guarda su refreshToken y ya lo ha usado para renovar <renovaciones>
    Cuando envía POST /api/auth/refresh con x-tenant alumno01 y ese mismo refreshToken
    Entonces la respuesta es 200 con un accessToken y un refreshToken

    Ejemplos:
      | renovaciones |
      | una vez |
      | dos veces |

  Esquema del escenario: El tenant de la renovación lo fija el refreshToken
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión con remember true y guarda su refreshToken
    Cuando envía POST /api/auth/refresh con <cabecera> y ese refreshToken
    Entonces la respuesta es 200 con el usuario gestor@sigpro.test del tenant alumno01

    Ejemplos:
      | cabecera |
      | x-tenant alumno01 |
      | x-tenant alumno02 |
      | (sin cabecera) |
```

## Fuera de alcance
- Los refreshToken de cuentas bloqueadas o desactivadas, y los tokens que no sirven o el cuerpo inválido: US-SESION-002 y US-SESION-003 de esta épica.
- La duración de cada token: US-SESION-004 de esta épica.
- El cierre de sesión y su garantía (el servidor no revoca tokens): EP-LOGIN.
- Lo que la web y la app móvil hacen con la renovación: US-SESION-006 y US-SESION-009 de esta épica.
