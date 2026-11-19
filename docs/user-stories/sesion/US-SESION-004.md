---
id: US-SESION-004
tipo: historia
epica: EP-SESION
titulo: "[API] Duración de los tokens: 900 segundos de acceso y 7 días o 12 horas de renovación"
etiquetas: [api]
relacionadas: [US-SESION-001, US-SESION-003, US-SESION-005, US-LOGIN-001, US-MFA-001]
verificacion: codigo
---

## Historia
Como responsable de seguridad de un tenant, quiero que cada token de una sesión tenga un plazo fijo y conocido, de 15 minutos el de acceso y de 7 días o 12 horas el de renovación según la casilla «Mantener la sesión en este equipo» con la que se inició la sesión,
para que una sesión olvidada en un equipo compartido deje de servir en un plazo acotado.

## Reglas
- El `accessToken` caduca 900 segundos (15 minutos) después de emitirse. Es el plazo que fija el producto, y por eso la respuesta del inicio de sesión y la de la renovación traen `expiresIn: 900`.
- El `refreshToken` caduca 7 días (604800 segundos) después de emitirse si el inicio de sesión llevó `remember` verdadero, que es el valor por defecto cuando el cuerpo no lo trae, y 12 horas (43200 segundos) si llevó `remember` falso.
- Cada renovación emite un `refreshToken` con el mismo indicador y el plazo completo contado desde esa renovación. Una sesión que se renueva dentro de su plazo sigue viva, y el plazo no se suma al de la primera emisión.
- El plazo de cada token está escrito dentro del propio token, como su fecha de emisión y su fecha de caducidad. Medir el plazo como la diferencia entre ambas no exige verificar la firma del token.
- Un accessToken caducado responde 401 `invalid_token` en cualquier petición protegida, y un refreshToken caducado responde 401 `invalid_token` a la renovación. El plazo cuenta desde la emisión, no desde la última petición.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Las filas que hablan de la antigüedad de un token obtienen el token en la propia fila, con `gestor@sigpro.test` y `Gestor1234!`, y lo usan cuando ha pasado el tiempo indicado, sin volver a iniciar sesión entre medias.

## Criterios de aceptación
```gherkin
Característica: Duración de los tokens

  Esquema del escenario: El inicio de sesión emite los plazos del producto
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con x-tenant alumno01 y la contraseña Gestor1234! <inicio>
    Cuando lee los tokens de esa respuesta
    Entonces el accessToken dura 900 segundos desde su emisión
    Y el refreshToken dura <duracion> segundos desde su emisión
    Y la respuesta trae expiresIn 900

    Ejemplos:
      | inicio | duracion |
      | con remember true | 604800 |
      | con remember false | 43200 |
      | sin el campo remember | 604800 |

  Esquema del escenario: Cada renovación emite un refreshToken con el plazo completo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión con remember <remember>
    Cuando envía POST /api/auth/refresh con x-tenant alumno01 y el refreshToken de ese inicio de sesión
    Entonces el refreshToken de la renovación dura <duracion> segundos desde su emisión
    Y su accessToken dura 900 segundos desde su emisión

    Ejemplos:
      | remember | duracion |
      | true | 604800 |
      | false | 43200 |

  Esquema del escenario: El accessToken caduca a los 900 segundos y el refreshToken sigue renovando
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test obtuvo su accessToken y su refreshToken con remember true hace <antiguedad>
    Cuando envía <peticion>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | antiguedad | peticion | respuesta |
      | catorce minutos | GET /api/auth/me con el accessToken de ese inicio de sesión | 200 con el correo gestor@sigpro.test |
      | dieciséis minutos | GET /api/auth/me con el accessToken de ese inicio de sesión | 401 invalid_token |
      | dieciséis minutos | POST /api/auth/refresh con el refreshToken de ese inicio de sesión | 200 con un accessToken y un refreshToken |
```

## Fuera de alcance
- Cómo se obtienen los tokens al iniciar sesión: EP-LOGIN (US-LOGIN-001) y el segundo paso de EP-MFA (US-MFA-001).
- La respuesta de la renovación y sus rechazos: US-SESION-001, US-SESION-002 y US-SESION-003 de esta épica.
- Lo que hacen la web y la app móvil cuando el acceso caduca: US-SESION-006 y US-SESION-009 de esta épica.
