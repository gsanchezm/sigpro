---
id: US-LOGIN-004
tipo: historia
epica: EP-LOGIN
titulo: "[API] Cerrar sesión sin revocar los tokens ya emitidos"
etiquetas: [api]
relacionadas: [US-LOGIN-008, US-LOGIN-013]
verificacion: codigo
cubre: ["POST /api/auth/logout"]
---

## Historia
Como cliente de la API, quiero un endpoint de cierre de sesión que responda siempre lo mismo y una garantía explícita de lo que hace y de lo que no hace,
para descartar mis tokens con seguridad sabiendo que el servidor no los invalida.

## Reglas
- `POST /api/auth/logout` es público: no necesita cabecera `Authorization`, porque se puede cerrar una sesión cuyo token de acceso ya caducó.
- El cuerpo es opcional; el único campo que se tiene en cuenta es `refreshToken`, que puede ser un texto o `null`. Un `refreshToken` que no es texto ni `null` responde 422 `validation_failed`.
- **Lo que garantiza:** la respuesta es 204, sin cuerpo, también si el `refreshToken` ya no es válido, ya se usó para cerrar sesión o no se envía. Cerrar sesión dos veces no es un error. Cerrar la sesión consiste en que **el cliente descarte** su `accessToken` y su `refreshToken`.
- **Lo que no garantiza:** el servidor **no revoca ningún token**. Los tokens son sin estado (no hay registro de sesiones en el servidor), así que los ya emitidos siguen valiendo hasta caducar:
  - el `accessToken` (900 segundos desde que se emitió) sigue autorizando peticiones;
  - con el mismo `refreshToken` (7 días desde que se emitió si se inició sesión con `remember: true`, 12 horas con `remember: false`), `POST /api/auth/refresh` sigue respondiendo 200 con una sesión nueva mientras no caduque y la cuenta no esté bloqueada, pendiente de aprobación ni desactivada.
- Lo único que deja sin efecto un `refreshToken` antes de caducar es el estado de la cuenta: si la cuenta se bloquea o se desactiva, la renovación responde 401 `invalid_token`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); después `gestor@sigpro.test` inicia sesión en la propia fila con `POST /api/auth/login`, la cabecera `x-tenant: alumno01`, la contraseña `Gestor1234!` y el `remember` de la fila (`true` si la fila no lo dice), y guarda su `accessToken` y su `refreshToken`. Todas las peticiones de la fila llevan `x-tenant: alumno01` y se hacen en menos de 5 minutos desde ese inicio de sesión.

## Criterios de aceptación
```gherkin
Característica: Cierre de sesión por la API

  Esquema del escenario: El cierre de sesión responde 204 sin cuerpo
    Dado que en el tenant alumno01, recién reiniciado, <situacion>
    Cuando envía POST /api/auth/logout con el cuerpo <cuerpo>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | situacion | cuerpo | respuesta |
      | gestor@sigpro.test acaba de iniciar sesión | refreshToken igual a su refreshToken | 204 sin cuerpo |
      | gestor@sigpro.test acaba de iniciar sesión y ya envió POST /api/auth/logout con su refreshToken | refreshToken igual al mismo refreshToken | 204 sin cuerpo |
      | el cliente no ha iniciado sesión | refreshToken null | 204 sin cuerpo |
      | el cliente no ha iniciado sesión | (vacío) | 204 sin cuerpo |
      | el cliente no ha iniciado sesión | refreshToken igual al texto no-es-un-token | 204 sin cuerpo |
      | el cliente no ha iniciado sesión | refreshToken igual al número 123 | 422 validation_failed |

  Esquema del escenario: Cerrar sesión no revoca los tokens ya emitidos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test acaba de iniciar sesión con remember <remember>
    Y envía POST /api/auth/logout con su refreshToken y recibe 204
    Y después <cambio_de_cuenta>
    Cuando envía <peticion>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | remember | cambio_de_cuenta | peticion | respuesta |
      | true | nadie cambia la cuenta | POST /api/auth/refresh con ese refreshToken | 200 con un accessToken y un refreshToken nuevos |
      | false | nadie cambia la cuenta | POST /api/auth/refresh con ese refreshToken | 200 con un accessToken y un refreshToken nuevos |
      | true | nadie cambia la cuenta | GET /api/auth/me con ese accessToken | 200 con el usuario gestor@sigpro.test |
      | true | nadie cambia la cuenta | GET /api/programs con ese accessToken | 200 con los programas del tenant alumno01 |
      | true | alumno01@sigpro.lab desactiva la cuenta gestor@sigpro.test | POST /api/auth/refresh con ese refreshToken | 401 invalid_token |
```

## Fuera de alcance
- La renovación del token, su duración y la sesión del usuario (`/api/auth/refresh` y `/api/auth/me`): épica de Sesión y renovación de token. Aquí solo se usan para comprobar que el cierre de sesión no revoca nada.
- Lo que hacen la web y la app móvil al cerrar sesión: historias de esas plataformas en esta misma épica.
