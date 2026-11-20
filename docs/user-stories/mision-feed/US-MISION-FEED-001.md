---
id: US-MISION-FEED-001
tipo: historia
epica: EP-MISION-FEED
titulo: "[API] Abrir la conexión en tiempo real solo con un token de acceso vigente"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-MFA-001, US-SESION-004]
verificacion: ejecutada
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero abrir una conexión en tiempo real con mi token de acceso,
para recibir los eventos de mi tenant mientras tengo el panel de misión abierto, y que nadie sin una sesión válida reciba esos eventos.

## Reglas
- La conexión en tiempo real se abre contra el mismo servidor de la API, en la ruta `/socket.io` (no bajo `/api`), y envía el token de acceso en el campo `auth.token` de la conexión.
- Solo se acepta un token de acceso vigente: firmado por la API, de tipo `access` y no caducado. Un token de acceso caduca a los 900 segundos (US-SESION-004).
- Un token que no cumple lo anterior se rechaza: la API no abre la conexión y responde con el error `invalid_token`. Esto incluye la ausencia de token, un texto que no es un token, un token de acceso con la firma alterada, un `refreshToken`, un `mfaToken` y un token de acceso caducado.
- Una conexión rechazada no recibe ningún evento, tampoco de un tenant que sí existe.
- Una conexión aceptada queda asociada al tenant que figura en el token. La cabecera `x-tenant` no cambia ese tenant.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Antes de la fila se comprueba que el caos del tenant está apagado. Los tokens se obtienen con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`: el `accessToken` y el `refreshToken` de `gestor@sigpro.test` (`Gestor1234!`) y el `mfaToken` que devuelve el inicio de sesión de `admin@sigpro.test` (`Admin1234!`). La API se arranca con `SIMULATOR_MS=0`.

## Criterios de aceptación
```gherkin
Característica: Conexión en tiempo real con el token

  Esquema del escenario: Solo un token de acceso vigente abre la conexión
    Dado que en el tenant alumno01, recién reiniciado, se ha obtenido <token>
    Cuando abre una conexión en tiempo real con la API y envía ese token en el campo auth.token
    Entonces <resultado>

    Ejemplos:
      | token | resultado |
      | el accessToken de gestor@sigpro.test | la conexión se abre y queda a la espera de eventos |
      | el accessToken de gestor@sigpro.test con la última letra cambiada | la API rechaza la conexión con el error invalid_token y no se abre |
      | (sin el campo) | la API rechaza la conexión con el error invalid_token y no se abre |
      | un texto que no es un token | la API rechaza la conexión con el error invalid_token y no se abre |
      | el refreshToken de gestor@sigpro.test | la API rechaza la conexión con el error invalid_token y no se abre |
      | el mfaToken de admin@sigpro.test | la API rechaza la conexión con el error invalid_token y no se abre |

  Esquema del escenario: Una conexión rechazada no recibe eventos de su tenant
    Dado que en el tenant alumno01, recién reiniciado, se ha intentado abrir una conexión con <token>
    Cuando alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución`
    Entonces la conexión <resultado_conexion> y <resultado_evento>

    Ejemplos:
      | token | resultado_conexion | resultado_evento |
      | el accessToken de gestor@sigpro.test | está abierta | recibe el evento nc_created con seq 7 |
      | el refreshToken de gestor@sigpro.test | no se ha abierto | no recibe ningún evento durante la observación |
      | el mfaToken de admin@sigpro.test | no se ha abierto | no recibe ningún evento durante la observación |

  Esquema del escenario: La cabecera del tenant no cambia el tenant de la conexión
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken vigente de alumno01
    Cuando abre una conexión en tiempo real con ese token y la cabecera x-tenant <cabecera>, y alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución`
    Entonces la conexión recibe el evento nc_created con seq 7 y el código NC-013

    Ejemplos:
      | cabecera |
      | alumno01 |
      | alumno02 |
      | (sin cabecera) |
```

## Fuera de alcance
- Qué eventos recibe una conexión ya abierta, con qué forma y con qué cifras: esta épica, historias US-MISION-FEED-002 y US-MISION-FEED-003.
- El inicio de sesión y el segundo factor con los que se obtienen los tokens: EP-LOGIN y EP-MFA.
- La renovación del `accessToken` cuando caduca, y la duración de los tokens de renovación: EP-SESION.

## Decisiones pendientes
- Si una conexión ya abierta debe cerrarse cuando su cuenta se desactiva o se bloquea. Hoy el token se comprueba solo al abrir la conexión: una conexión abierta sigue recibiendo eventos aunque la cuenta cambie de estado. Esto describe lo que existe; no es un criterio.
