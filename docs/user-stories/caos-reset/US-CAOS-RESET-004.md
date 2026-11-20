---
id: US-CAOS-RESET-004
tipo: historia
epica: EP-CAOS-RESET
titulo: "[API] El reinicio conserva el caos, las sesiones y los contadores de correos sin cuenta"
etiquetas: [api]
relacionadas: [US-CAOS-RESET-001, US-CAOS-RESET-006, US-LOGIN-001]
verificacion: ejecutada
cubre: ["POST /api/admin/reset"]
---

## Historia
Como alumno que prueba con el modo caos o con sesiones abiertas, quiero que el reinicio no cambie la configuración del caos ni cierre mis sesiones,
para que reiniciar mis datos no me obligue a volver a empezar todo lo demás.

## Reglas
- El reinicio conserva la configuración del modo caos del tenant: la latencia, la tasa de errores y los textos variables quedan como estaban antes del reinicio. Un reinicio no apaga el caos; quien prepara una fila lo apaga si hace falta.
- El reinicio no cierra sesiones ni invalida tokens: un token de acceso o de refresco emitido antes del reinicio sigue valiendo hasta que caduque.
- El reinicio no toca el contador de intentos de un correo sin cuenta. `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución (`nadie-` seguido de una marca de tiempo y `@sigpro.test`), y su contador sigue por donde iba, porque no es un dato del tenant.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos` y el cuerpo `{ "latencyMs": 0, "errorRate": 0, "flakyLabels": false }`. Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos.

## Criterios de aceptación
```gherkin
Característica: Lo que el reinicio no cambia

  Esquema del escenario: El reinicio conserva la configuración del modo caos
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab ha fijado con PATCH latencyMs <latencia>, errorRate <tasa> y flakyLabels <textos>
    Cuando envía POST /api/admin/reset con ese token
    Entonces la respuesta es 200
    Y GET /api/admin/chaos con ese token devuelve latencyMs <latencia>, errorRate <tasa> y flakyLabels <textos>

    Ejemplos:
      | latencia | tasa | textos |
      | 400 | 0.5 | true |
      | 0 | 1 | false |

  Esquema del escenario: El reinicio no cierra las sesiones abiertas
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, gestor@sigpro.test ha iniciado sesión con x-tenant alumno01 y tiene un token de acceso y un refreshToken
    Cuando envía POST /api/admin/reset con el token de alumno01@sigpro.lab
    Y después envía <peticion> con la credencial de gestor@sigpro.test
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | peticion | respuesta |
      | GET /api/auth/me con su token de acceso | 200 con el correo gestor@sigpro.test |
      | POST /api/auth/refresh con su refreshToken en el cuerpo | 200 con un accessToken nuevo |

  Esquema del escenario: El reinicio no reinicia el contador de un correo sin cuenta
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, (correo sin cuenta) ha fallado <fallos_previos> veces al entrar con x-tenant alumno01 y la contraseña x
    Cuando envía POST /api/admin/reset con el token de alumno01@sigpro.lab
    Y después envía POST /api/auth/login con x-tenant alumno01, ese correo y la contraseña x
    Entonces la respuesta es 401 invalid_credentials con attempts <intentos>

    Ejemplos:
      | fallos_previos | intentos |
      | 0 | 1 |
      | 2 | 3 |
```

## Fuera de alcance
- El cierre de sesión y la renovación de tokens: EP-SESION.
- La duración de cada token: EP-SESION.
- Las reglas de bloqueo de una cuenta que existe: EP-LOGIN.
