---
id: US-SESION-002
tipo: historia
epica: EP-SESION
titulo: "[API] Rechazar la renovación de una cuenta bloqueada o desactivada"
etiquetas: [api]
relacionadas: [US-SESION-001, US-SESION-003, US-SESION-005, US-LOGIN-002, US-LOGIN-003]
verificacion: codigo
cubre: ["POST /api/auth/refresh"]
---

## Historia
Como administrador de un tenant, quiero que una cuenta bloqueada o desactivada no pueda renovar su sesión, aunque conserve el refreshToken que recibió al iniciar sesión,
para que retirar el acceso a alguien surta efecto también en sus renovaciones.

## Reglas
- Una cuenta desactivada o bloqueada responde 401 con `code: "invalid_token"` a la renovación, aunque el refreshToken sea el que recibió al iniciar sesión y no haya caducado.
- La cuenta que vuelve a estar activa y sin bloqueo renueva con el mismo refreshToken (200). No hace falta iniciar sesión otra vez.
- Como en el inicio de sesión, la cuenta se bloquea en el 5.º fallo consecutivo, y con 4 fallos sigue activa.
- La cuenta pendiente de aprobación también responde 401 `invalid_token`. Esta regla no tiene fila: una cuenta pendiente no recibe tokens, y la API no permite dejar pendiente de aprobación una cuenta que ya tuvo sesión (la petición de administración solo cambia `active` y `role`), así que el caso no se da con los datos del seed.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, en la propia fila, `gestor@sigpro.test` inicia sesión con `POST /api/auth/login`, la cabecera `x-tenant: alumno01`, la contraseña `Gestor1234!` y `remember` verdadero, y guarda su `refreshToken`. Los fallos de la fila son `POST /api/auth/login` con la cabecera `x-tenant: alumno01`, ese correo y una contraseña incorrecta, enviados después de guardar el `refreshToken`.

## Criterios de aceptación
```gherkin
Característica: Renovación de cuentas bloqueadas o desactivadas

  Esquema del escenario: Una cuenta desactivada no renueva hasta que se vuelve a activar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión con remember true y guarda su refreshToken
    Y alumno01@sigpro.lab envía PATCH /api/admin/users/u2 con <cambio>
    Cuando envía POST /api/auth/refresh con x-tenant alumno01 y ese refreshToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cambio | respuesta |
      | active false | 401 invalid_token |
      | active false y después active true | 200 con un accessToken, un refreshToken y el usuario gestor@sigpro.test |

  Esquema del escenario: Una cuenta bloqueada no renueva con el quinto fallo consecutivo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión con remember true, guarda su refreshToken y después envía <fallos> veces POST /api/auth/login con x-tenant alumno01, ese correo y la contraseña incorrecta
    Cuando envía POST /api/auth/refresh con x-tenant alumno01 y ese refreshToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | fallos | respuesta |
      | 4 | 200 con un accessToken, un refreshToken y el usuario gestor@sigpro.test |
      | 5 | 401 invalid_token |
```

## Fuera de alcance
- El bloqueo de la cuenta en el inicio de sesión y sus respuestas: EP-LOGIN (US-LOGIN-002).
- La pendiente de aprobación en el inicio de sesión: EP-LOGIN (US-LOGIN-003).
- El desbloqueo de cuentas y la aprobación de las solicitudes de acceso: épica de Usuarios y roles.
- Lo que sigue valiendo en `GET /api/auth/me` con un accessToken emitido antes del bloqueo o de la desactivación: US-SESION-005 de esta épica.
