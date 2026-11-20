---
id: US-CAOS-RESET-006
tipo: historia
epica: EP-CAOS-RESET
titulo: "[API] Leer y fijar el modo caos del tenant"
etiquetas: [api]
relacionadas: [US-CAOS-RESET-005, US-CAOS-RESET-007, US-CAOS-RESET-010, US-CAOS-RESET-011]
verificacion: ejecutada
cubre: ["GET /api/admin/chaos", "PATCH /api/admin/chaos"]
---

## Historia
Como administrador de un tenant de prácticas, quiero leer y fijar con dos peticiones la latencia, la tasa de errores y los textos variables de mi tenant,
para preparar el caos de una práctica y apagarlo al terminar.

## Reglas
- La configuración tiene tres campos: `latencyMs`, un entero de 0 a 5000 (ambos incluidos); `errorRate`, un número de 0 a 1 (ambos incluidos); y `flakyLabels`, un booleano. Con el caos apagado valen 0, 0 y false.
- `GET /api/admin/chaos` responde 200 con los tres campos del tenant del token.
- `PATCH /api/admin/chaos` cambia solo los campos que envía; los demás se quedan como estaban. Responde 200 con la configuración guardada completa. Un cuerpo vacío (`{}`) responde 200 y no cambia nada.
- Un valor fuera de rango o de otro tipo responde 422 `validation_failed` con una entrada en `errors` para ese campo, y no cambia la configuración guardada.
- La cabecera `x-tenant` no cambia la configuración que se lee o se fija: es siempre la del tenant del token. Los ejemplos que la usan con otro tenant lo hacen con `alumno02`, cuyo caos se fija y se apaga con su propio administrador.
- La configuración guardada se ve también en el campo `chaos` de `GET /api/config`, para el tenant de la cabecera `x-tenant`. Ese endpoint es de otra épica; aquí solo se usa para comprobar el campo.
- Cada cambio aplicado queda registrado en la auditoría del tenant con la acción `chaos.updated`.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos` y el cuerpo `{ "latencyMs": 0, "errorRate": 0, "flakyLabels": false }`. Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos. El tenant `alumno02` solo aparece en un ejemplo: se reinicia con su propio token y se deja con el caos apagado al terminar.

## Criterios de aceptación
```gherkin
Característica: Lectura y fijación del modo caos

  Esquema del escenario: Leer el modo caos devuelve los valores de reposo
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab tiene un token de acceso
    Cuando envía GET /api/admin/chaos con ese token y la cabecera x-tenant <cabecera>
    Entonces la respuesta es 200 con latencyMs 0, errorRate 0 y flakyLabels false

    Ejemplos:
      | cabecera |
      | alumno01 |

  Esquema del escenario: La cabecera x-tenant no cambia la configuración que se lee
    Dado que en el tenant alumno02, recién reiniciado con el token de alumno02@sigpro.lab y con el modo caos apagado, alumno02@sigpro.lab ha fijado con PATCH latencyMs 400, errorRate 0.5 y flakyLabels true
    Y en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab tiene un token de acceso
    Cuando envía GET /api/admin/chaos con el token de alumno01@sigpro.lab y la cabecera x-tenant <cabecera>
    Entonces la respuesta es 200 con latencyMs 0, errorRate 0 y flakyLabels false
    Y GET /api/config con la cabecera x-tenant <cabecera> devuelve el campo chaos con latencyMs 400, errorRate 0.5 y flakyLabels true

    Ejemplos:
      | cabecera |
      | alumno02 |

  Esquema del escenario: Un cambio parcial conserva los demás campos
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab ha fijado con PATCH latencyMs 400 y flakyLabels true
    Cuando envía PATCH /api/admin/chaos con el cuerpo <cuerpo> y su token
    Entonces la respuesta es 200 con latencyMs 400, errorRate <tasa> y flakyLabels <textos>
    Y GET /api/admin/chaos devuelve los mismos valores

    Ejemplos:
      | cuerpo | tasa | textos |
      | { "errorRate": 0.25 } | 0.25 | true |
      | { "flakyLabels": false } | 0 | false |
      | {} | 0 | true |

  Esquema del escenario: Un valor fuera de rango o de otro tipo no se guarda
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab tiene un token de acceso
    Cuando envía PATCH /api/admin/chaos con el cuerpo <cuerpo> y ese token
    Entonces la respuesta es 422 validation_failed con un motivo para <campo>
    Y GET /api/admin/chaos devuelve latencyMs 0, errorRate 0 y flakyLabels false

    Ejemplos:
      | cuerpo | campo |
      | { "latencyMs": -1 } | latencyMs |
      | { "latencyMs": 5001 } | latencyMs |
      | { "latencyMs": 400.5 } | latencyMs |
      | { "errorRate": -0.01 } | errorRate |
      | { "errorRate": 1.01 } | errorRate |
      | { "flakyLabels": "true" } | flakyLabels |

  Esquema del escenario: Un valor en el límite se guarda
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab tiene un token de acceso
    Cuando envía PATCH /api/admin/chaos con el cuerpo <cuerpo> y ese token
    Entonces la respuesta es 200 con <campo> igual a <valor>

    Ejemplos:
      | cuerpo | campo | valor |
      | { "latencyMs": 0 } | latencyMs | 0 |
      | { "latencyMs": 1 } | latencyMs | 1 |
      | { "latencyMs": 4999 } | latencyMs | 4999 |
      | { "latencyMs": 5000 } | latencyMs | 5000 |
      | { "errorRate": 0 } | errorRate | 0 |
      | { "errorRate": 1 } | errorRate | 1 |
      | { "flakyLabels": true } | flakyLabels | true |

  Esquema del escenario: La configuración guardada aparece en la configuración pública del tenant
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab ha fijado con PATCH latencyMs 400, errorRate 0.5 y flakyLabels true
    Cuando envía GET /api/config con la cabecera x-tenant <cabecera>
    Entonces el campo chaos de la respuesta tiene latencyMs 400, errorRate 0.5 y flakyLabels true

    Ejemplos:
      | cabecera |
      | alumno01 |
```

## Fuera de alcance
- Los demás campos de `GET /api/config` y los endpoints `GET /api/config/tenants`, `GET /api/config/test-users` y `GET /api/health`: EP-API-PLATAFORMA.
- Los efectos del caos sobre las demás peticiones: otra historia de EP-CAOS-RESET.
- La consulta de la auditoría donde quedan los cambios del modo caos: EP-AUDITORIA.
