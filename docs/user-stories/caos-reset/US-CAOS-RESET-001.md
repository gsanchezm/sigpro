---
id: US-CAOS-RESET-001
tipo: historia
epica: EP-CAOS-RESET
titulo: "[API] Restaurar el tenant con el token de su administrador"
etiquetas: [api]
relacionadas: [US-CAOS-RESET-002, US-CAOS-RESET-005, US-CAOS-RESET-009, US-CAOS-RESET-014]
verificacion: codigo
cubre: ["POST /api/admin/reset"]
---

## Historia
Como alumno que prueba contra su propio tenant, quiero reiniciar los datos de mi tenant con una sola petición y el token de su administrador,
para dejarlo en el estado inicial del seed antes de cada prueba, sin que el reinicio toque los datos de otros tenants.

## Reglas
- `POST /api/admin/reset` restaura el seed completo del tenant del token y responde 200 con dos campos: `tenant`, el tenant reiniciado, y `ms`, los milisegundos que tardó el reinicio.
- El plan fija que el reinicio dure menos de 2 segundos (`ms` menor que 2000), porque la preparación de cada fila depende de ello. Es un requisito del producto, no una tolerancia de la prueba.
- El tenant lo fija el token, no la cabecera: `x-tenant` no cambia qué tenant se reinicia. Una petición con el token de `alumno01@sigpro.lab` reinicia `alumno01` aunque lleve otra cabecera `x-tenant`.
- Sin la clave de infraestructura, la variante con `?all=true` se rechaza: aunque el token sea de un administrador, responde 403 `admin_key_required` y no reinicia ningún tenant.
- Repetir el reinicio sobre un tenant ya reiniciado responde 200 y deja el mismo estado.
- Los ejemplos de aislamiento usan también el tenant `alumno02`, que se reinicia con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`) y se deja con el modo caos apagado al terminar. Ningún ejemplo envía el token de otro tenant.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos` y el cuerpo `{ "latencyMs": 0, "errorRate": 0, "flakyLabels": false }`. Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos.

## Criterios de aceptación
```gherkin
Característica: Reinicio del tenant por la API

  Esquema del escenario: El reinicio responde con el tenant del token
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab tiene un token de acceso
    Cuando envía POST /api/admin/reset con ese token y la cabecera x-tenant <cabecera>
    Entonces la respuesta es 200
    Y el campo tenant de la respuesta es alumno01
    Y el campo ms de la respuesta es menor que 2000

    Ejemplos:
      | cabecera |
      | alumno01 |
      | (sin cabecera) |
      | alumno02 |

  Esquema del escenario: La variante global se rechaza sin la clave de infraestructura
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab tiene un token de acceso
    Cuando envía POST /api/admin/reset?all=true con ese token y la cabecera x-tenant alumno01
    Entonces la respuesta es 403 con el código admin_key_required

    Ejemplos:
      | ruta |
      | POST /api/admin/reset?all=true |

  Esquema del escenario: El reinicio de alumno01 no toca los datos de alumno02
    Dado que en el tenant alumno02, recién reiniciado con el token de alumno02@sigpro.lab y con el modo caos apagado, gestor@sigpro.test ha iniciado sesión y ha dado de alta un programa con el cuerpo base, que recibe el código PRG-025
    Cuando envía POST /api/admin/reset con el token de alumno01@sigpro.lab y la cabecera x-tenant <tenant_ajeno>
    Entonces la respuesta es 200 con el tenant alumno01
    Y GET /api/programs/PRG-025 con la cabecera x-tenant alumno02 y el token de gestor@sigpro.test de alumno02 responde 200 con el programa dado de alta

    Ejemplos:
      | tenant_ajeno |
      | alumno02 |
```

## Fuera de alcance
- Lo que el reinicio restaura, borra y conserva: otras historias de EP-CAOS-RESET.
- La variante del reinicio con la clave de infraestructura (todos los tenants, cron nocturno): no se describe en esta épica.
- Los permisos y la autenticación del reinicio: otra historia de EP-CAOS-RESET.
