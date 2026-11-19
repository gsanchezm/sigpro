---
id: US-NC-TABLERO-005
tipo: historia
epica: EP-NC-TABLERO
titulo: "[API] Rechazar con 422 un cuerpo de paso no válido y con 404 una no conformidad inexistente"
etiquetas: [api]
relacionadas: [US-NC-TABLERO-003, US-NC-TABLERO-004]
verificacion: codigo
cubre: ["POST /api/nc/:code/transition"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero que un paso con un estado desconocido, un comentario demasiado largo o una no conformidad inexistente se rechace con un error que diga qué falla,
para corregir la petición sin adivinar qué hace mal.

## Reglas
- `to` es obligatorio y debe ser uno de los cinco estados (`open`, `in_analysis`, `corrective_action`, `closed` o `rejected`). Un valor distinto, o vacío, responde 422 `validation_failed` con `errors.to` igual a `badState`, y la no conformidad no cambia.
- `comment` es opcional y admite hasta 1000 caracteres. Con más de 1000 responde 422 `validation_failed` con `errors.comment` igual a `commentLong`. El límite vale para cualquier paso.
- Un código de no conformidad que no existe en el tenant responde 404 `nc_not_found`.
- Los mensajes de los campos son claves de la API: `badState` y `commentLong`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token del administrador del tenant. Después, `alumno01@sigpro.lab` inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken`.

## Criterios de aceptación
```gherkin
Característica: Errores de la petición de paso por la API

  Esquema del escenario: Un estado desconocido o vacío se rechaza con 422 y no cambia la no conformidad
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab tiene un accessToken y NC-001 está en open
    Cuando envía POST /api/nc/NC-001/transition con x-tenant alumno01, ese accessToken y to <destino>
    Entonces la respuesta es 422 validation_failed con un motivo para to igual a badState
    Y GET /api/nc/NC-001 devuelve state open

    Ejemplos:
      | destino |
      | cerrada |
      | (vacío) |

  Esquema del escenario: El comentario admite hasta 1000 caracteres
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab tiene un accessToken y NC-001 está en open
    Cuando envía POST /api/nc/NC-001/transition con x-tenant alumno01, ese accessToken, to in_analysis y un comment de <longitud> caracteres
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | longitud | respuesta |
      | 999 | 200 con state in_analysis |
      | 1000 | 200 con state in_analysis |
      | 1001 | 422 validation_failed con un motivo para comment igual a commentLong |

  Esquema del escenario: Un código que no existe en el tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab tiene un accessToken
    Cuando envía POST /api/nc/<codigo>/transition con x-tenant alumno01, ese accessToken, to in_analysis y sin el campo comment
    Entonces la respuesta es 404 nc_not_found

    Ejemplos:
      | codigo |
      | NC-013 |
      | NC-000 |
```

## Decisiones pendientes
- No está decidido si un cuerpo no válido dirigido a una no conformidad inexistente debe responder 422 o 404. Ninguna fila de esta historia combina las dos cosas.

## Fuera de alcance
- Los pasos admitidos y no admitidos por la máquina de estados: US-NC-TABLERO-003.
- El permiso `nc.transition` por rol: US-NC-TABLERO-004.
- El comentario de cierre y su longitud mínima, que se exigen al cerrar: EP-NC-GESTION.
