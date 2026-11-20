---
id: US-API-PLATAFORMA-004
tipo: historia
epica: EP-API-PLATAFORMA
titulo: "[API] Responder los errores con código, mensaje, traza y errores por campo"
etiquetas: [api]
relacionadas: [US-LOGIN-001]
verificacion: ejecutada
---

## Historia
Como cliente de la API, o persona que prueba sus fallos, quiero que cada respuesta de error tenga la misma forma y una traza,
para tratar igual cualquier error, saber qué campo falló y citar la traza al reportar un problema.

## Reglas
- Toda respuesta de error trae `statusCode` (el código HTTP), `error` (el texto del estado HTTP en inglés: `Not Found`, `Unauthorized` o `Unprocessable Entity`), `message` y `traceId`. La única excepción son las respuestas de la documentación protegida con credenciales, que son texto plano.
- `code` aparece solo en los errores que tienen un identificador propio de la API, como `missing_token`, `invalid_token` o `validation_failed`. Un error sin identificador propio no trae `code`.
- En un 422, `message` y `code` valen `validation_failed`, y `errors` es un mapa de cada campo a la clave de su motivo (`required`, `badEmail`), no a un texto traducido. Solo los 422 traen `errors`.
- `traceId` tiene la forma de cuatro caracteres hexadecimales, un guion y otros cuatro (por ejemplo `7f3a-c21d`), y es distinto en cada respuesta.
- Un error interno no previsto responde 500 con `message` igual a `internal_error` y sin `code`. Esta regla no tiene ejemplo: la prueba no provoca ese error.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Como el reinicio no apaga el caos, antes de cada fila se comprueba con `GET /api/config` (cabecera `x-tenant: alumno01`) que `chaos` tiene latencia 0, tasa de error 0 y etiquetas no variables; si no es así, se apaga con `PATCH /api/admin/chaos` y ese mismo token.

## Criterios de aceptación
```gherkin
Característica: Formato común de los errores de la API

  Esquema del escenario: Una ruta que no existe responde 404 con el formato común
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado
    Cuando envía <metodo> <ruta>
    Entonces la respuesta es 404 con error Not Found, message <mensaje> y sin el campo code

    Ejemplos:
      | metodo | ruta | mensaje |
      | GET | /api/ruta-que-no-existe | Cannot GET /api/ruta-que-no-existe |
      | POST | /api/health | Cannot POST /api/health |

  Esquema del escenario: Una ruta protegida sin un token válido responde 401 con su código
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado
    Cuando envía GET /api/auth/me con <autorizacion>
    Entonces la respuesta es 401 con code <codigo>, message <codigo> y sin el campo errors

    Ejemplos:
      | autorizacion | codigo |
      | (sin cabecera Authorization) | missing_token |
      | Authorization Bearer token-inventado | invalid_token |

  Esquema del escenario: Un cuerpo no válido responde 422 con el motivo de cada campo
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado
    Cuando envía POST /api/auth/login con el cuerpo <cuerpo>
    Entonces la respuesta es 422 con code validation_failed, message validation_failed y errors <errores>

    Ejemplos:
      | cuerpo | errores |
      | (email y contraseña vacíos) | email required y password required |
      | email ana@sigpro y password Gestor1234! | email badEmail |

  Esquema del escenario: Cada respuesta de error trae una traza propia
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado
    Cuando envía dos veces GET <ruta>
    Entonces cada traceId tiene la forma de cuatro caracteres hexadecimales, un guion y otros cuatro, y los dos traceId son distintos

    Ejemplos:
      | ruta |
      | /api/ruta-que-no-existe |
      | /api/auth/me |
```

## Fuera de alcance
- Los motivos concretos de cada módulo, como las credenciales incorrectas o la cuenta bloqueada en el inicio de sesión (épica EP-LOGIN) o el código incorrecto del segundo factor (épica EP-MFA): cada una de sus épicas.
- El contenido funcional de cada ruta, es decir, qué hace y qué devuelve en caso de éxito: cada una de sus épicas.
