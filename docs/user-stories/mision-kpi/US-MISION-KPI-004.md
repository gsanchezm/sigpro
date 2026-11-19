---
id: US-MISION-KPI-004
tipo: historia
epica: EP-MISION-KPI
titulo: "[API] Resumen de misión: actividad reciente y valor del simulador"
etiquetas: [api]
relacionadas: [US-MISION-KPI-001, US-MISION-KPI-005, US-MISION-KPI-009, US-MISION-KPI-012, US-MISION-FEED-003, US-MISION-FEED-005]
verificacion: codigo
cubre: ["GET /api/mission/summary"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero que el resumen de misión traiga los últimos eventos del tenant y el intervalo del simulador,
para mostrar la actividad reciente al abrir el panel sin tener que esperar a que llegue un evento nuevo.

## Reglas
- `recent` trae los últimos eventos del tenant, el más reciente primero, como mucho 20. El tenant guarda hasta 50 eventos, pero el resumen muestra solo los 20 más recientes.
- Cada evento trae `id` (`EV-` seguido de cuatro cifras), `seq` (número de orden dentro del tenant, que crece con cada evento), `at` (instante en formato ISO 8601), `type` (tipo de evento), `severity` (`info`, `ok`, `warn` o `danger`), `programCode` (código del programa que cita, o `null` si no cita ninguno), `vars` (valores del texto del evento) y `origin` (`simulator` en los eventos del simulador).
- Tras reiniciar el tenant, el primer resumen o la primera emisión de eventos crea la historia inicial del tenant: seis eventos, con los identificadores `EV-0001` a `EV-0006`, y con instantes separados 45 segundos entre sí, de forma que el más reciente es `EV-0006`. Su contenido es el de la tabla de los criterios.
- Reiniciar el tenant borra sus eventos: el siguiente resumen vuelve a crear la historia inicial.
- Cada tenant tiene su propio historial: sus identificadores y sus números de orden no dependen de los de otro tenant.
- `simulatorMs` trae el intervalo del simulador en milisegundos, o 0 si el simulador está apagado. En el entorno de las pruebas el simulador está apagado (`SIMULATOR_MS=0`), así que `simulatorMs` vale 0.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`, obtenido con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`). Antes de cada fila, el caos del tenant debe estar apagado. Las emisiones de eventos de una fila se hacen con `POST /api/mission/tick` y ese mismo token. Si una fila usa `alumno02`, se reinicia también ese tenant con el token de `alumno02@sigpro.lab` y su cabecera `x-tenant: alumno02`.

## Criterios de aceptación
```gherkin
Característica: Actividad reciente y valor del simulador en el resumen de misión

  Esquema del escenario: Tras reiniciar, la actividad reciente trae la historia inicial
    Dado que en el tenant alumno01 está recién reiniciado
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant alumno01
    Entonces recent tiene 6 eventos y el elemento <posicion> es <id>, de tipo <tipo>, con gravedad <gravedad>, programCode <programa> y vars con <variables>

    Ejemplos:
      | posicion | id | tipo | gravedad | programa | variables |
      | 1 | EV-0006 | link_lost | danger | PRG-004 | program PRG-004 y value 5 |
      | 2 | EV-0005 | test_pass | ok | PRG-001 | program PRG-001 y code TC-021 |
      | 3 | EV-0004 | telemetry | info | PRG-004 | program PRG-004 y value 511 |
      | 4 | EV-0003 | thermal | warn | PRG-001 | program PRG-001 y value 72 |
      | 5 | EV-0002 | milestone | ok | PRG-004 | program PRG-004 y name PDR |
      | 6 | EV-0001 | link | info | PRG-001 | program PRG-001 y value 20 |

  Esquema del escenario: La actividad reciente muestra como mucho 20 eventos
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha emitido <emitidos> eventos con POST /api/mission/tick
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant alumno01
    Entonces recent tiene <elementos> elementos, el primero es <primero> y el último es <ultimo>

    Ejemplos:
      | emitidos | elementos | primero | ultimo |
      | 13 | 19 | EV-0019 | EV-0001 |
      | 14 | 20 | EV-0020 | EV-0001 |
      | 15 | 20 | EV-0021 | EV-0002 |

  Esquema del escenario: Los eventos de un tenant no aparecen en otro
    Dado que en el tenant alumno01 está recién reiniciado, en el tenant alumno02 también, y alumno01@sigpro.lab ha emitido un evento con POST /api/mission/tick en alumno01
    Cuando <cuenta> pide GET /api/mission/summary con su accessToken y la cabecera x-tenant <tenant>
    Entonces recent tiene 6 elementos y ninguno cita el programa PRG-013 ni tiene el identificador EV-0007

    Ejemplos:
      | tenant | cuenta |
      | alumno02 | alumno02@sigpro.lab |

  Esquema del escenario: El intervalo del simulador es el del entorno de la prueba
    Dado que en el tenant alumno01, recién reiniciado, el entorno de la prueba tiene el intervalo del simulador <intervalo>
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant alumno01
    Entonces simulatorMs vale <valor>

    Ejemplos:
      | intervalo | valor |
      | SIMULATOR_MS=0 (apagado) | 0 |
```

## Fuera de alcance
- El texto traducido de cada evento, el feed en vivo por WebSocket, su pausa y el temporizador del simulador: EP-MISION-FEED.
- La emisión de eventos con `POST /api/mission/tick` y su permiso: esta misma épica, en US-MISION-KPI-005.
- La cabecera de las cifras de `kpis`: esta misma épica, en US-MISION-KPI-001.
