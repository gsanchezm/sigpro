---
id: US-MISION-FEED-003
tipo: historia
epica: EP-MISION-FEED
titulo: "[API] Forma, gravedad y cifras de cada evento de misión"
etiquetas: [api]
relacionadas: [US-MISION-FEED-001, US-MISION-FEED-002, US-PROG-METRICAS-004]
verificacion: ejecutada
---

## Historia
Como cliente de la API, quiero que cada evento llegue con la misma forma, con la gravedad que le corresponde y con las cifras de no conformidades abiertas tras el cambio,
para mostrarlo en el panel sin consultar nada más y saber cuántas no conformidades quedan abiertas después de cada cambio.

## Reglas
- Cada evento trae `id` (`EV-` seguido de cuatro cifras), `seq` (un entero que sube en 1 por cada evento del tenant), `at` (fecha y hora en formato ISO 8601), `type`, `severity` (`info`, `ok`, `warn` o `danger`), `programCode` (código del programa, o nulo), `vars` (los valores del texto) y `origin` (`simulator` o `system`).
- Los eventos de no conformidades (`nc_created`, `nc_updated`, `nc_moved`, `nc_closed` y `nc_commented`) tienen origen `system`. Los del simulador tienen origen `simulator`.
- Los eventos de no conformidades traen `ncOpen`, el número de no conformidades abiertas del tenant tras el cambio (abiertas son las que no están cerradas ni rechazadas), y `ncBySeverity`, las abiertas por `minor`, `major` y `critical`. Las dos cifras ya incluyen el cambio.
- La gravedad de `nc_created` sale de la gravedad de la no conformidad: `minor` da `info`, `major` da `warn` y `critical` da `danger`. `nc_closed` tiene gravedad `ok`. `nc_moved`, `nc_updated` y `nc_commented` tienen gravedad `info`.
- `nc_created` lleva en `vars` el código, la gravedad (`severity`) y el programa (`program`). `nc_moved` lleva el código, el estado de partida (`from`) y el de llegada (`to`), con los estados en bruto (`open`, `in_analysis`, `corrective_action`, `closed`, `rejected`). `nc_closed` lleva el código. `nc_updated` lleva el código y la gravedad nueva. `nc_commented` lleva el código.
- `nc_updated` se emite solo cuando cambia la gravedad.
- Una operación que la API rechaza no emite ningún evento.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Antes de la fila se comprueba que el caos del tenant está apagado. Una conexión en tiempo real se abre con el `accessToken` de `gestor@sigpro.test` (`Gestor1234!`). Las no conformidades del seed son `NC-001` a `NC-012`, con 8 abiertas. La API se arranca con `SIMULATOR_MS=0`.

## Criterios de aceptación
```gherkin
Característica: Contrato de los eventos de no conformidades

  Esquema del escenario: Una no conformidad nueva emite un evento con su gravedad y las cifras tras el alta
    Dado que en el tenant alumno01, recién reiniciado, hay una conexión abierta con el accessToken de gestor@sigpro.test
    Cuando alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad <gravedad> y la descripción `Desviación de prueba en la ejecución`
    Entonces la conexión recibe un evento nc_created con seq 7, origen system y programCode PRG-002
    Y el evento tiene severity <severidad_evento>, vars.code NC-013, vars.severity <gravedad> y vars.program PRG-002
    Y ncOpen vale 9 y ncBySeverity vale <conteo>

    Ejemplos:
      | gravedad | severidad_evento | conteo |
      | minor | info | minor 3, major 2, critical 4 |
      | major | warn | minor 2, major 3, critical 4 |
      | critical | danger | minor 2, major 2, critical 5 |

  Esquema del escenario: Cada cambio de una no conformidad existente emite su tipo y sus cifras tras el cambio
    Dado que en el tenant alumno01, recién reiniciado, hay una conexión abierta con el accessToken de gestor@sigpro.test
    Cuando alumno01@sigpro.lab <cambio>
    Entonces la conexión recibe un evento <tipo> con severity <severidad_evento>
    Y el evento lleva en vars <variables>
    Y ncOpen vale <ncOpen>

    Ejemplos:
      | cambio | tipo | severidad_evento | variables | ncOpen |
      | pasa NC-001 a in_analysis con POST /api/nc/NC-001/transition | nc_moved | info | code NC-001, from open, to in_analysis | 8 |
      | pasa NC-002 a rejected con POST /api/nc/NC-002/transition | nc_moved | info | code NC-002, from in_analysis, to rejected | 7 |
      | cierra NC-003 con POST /api/nc/NC-003/transition, to closed y el comentario `Acción correctiva verificada por calidad` | nc_closed | ok | code NC-003 | 7 |
      | cambia la gravedad de NC-001 a critical con PATCH /api/nc/NC-001 | nc_updated | info | code NC-001, severity critical | 8 |
      | añade a NC-006 el comentario `Seguimiento de prueba` con POST /api/nc/NC-006/comments | nc_commented | info | code NC-006 | 8 |

  Esquema del escenario: Una operación rechazada no emite ningún evento
    Dado que en el tenant alumno01, recién reiniciado, hay una conexión abierta con el accessToken de gestor@sigpro.test
    Cuando alumno01@sigpro.lab <operacion>
    Entonces la API responde <respuesta>
    Y la conexión no recibe ningún evento durante la observación

    Ejemplos:
      | operacion | respuesta |
      | pide pasar NC-001 a rejected desde open con POST /api/nc/NC-001/transition | 409 invalid_transition |
      | pide pasar NC-004, que está cerrada, a open con POST /api/nc/NC-004/transition | 409 invalid_transition |

  Esquema del escenario: La descripción de una no conformidad nueva necesita 10 caracteres para emitir su evento
    Dado que en el tenant alumno01, recién reiniciado, hay una conexión abierta con el accessToken de gestor@sigpro.test
    Cuando alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción <descripcion>
    Entonces la API responde <respuesta>
    Y la conexión <evento>

    Ejemplos:
      | descripcion | respuesta | evento |
      | `Desviació` (9 caracteres) | 422 validation_failed | no recibe ningún evento durante la observación |
      | `Desviación` (10 caracteres) | 201 | recibe el evento nc_created con seq 7 |
```

## Fuera de alcance
- Cómo se ven los eventos en la pantalla (texto, orden, cifras y origen en pantalla): US-MISION-FEED-006 para la web y US-MISION-FEED-009 para el móvil.
- Las reglas de las transiciones, de los comentarios y del cierre de una no conformidad (permisos, mínimo de caracteres del comentario de cierre, estados de partida): EP-NC-GESTION.
- Las cifras del resumen `GET /api/mission/summary` y su gráfica: EP-MISION-KPI.

## Decisiones pendientes
- Si el cambio de responsable o de descripción de una no conformidad debe emitir un evento. Hoy no emite ninguno: `nc_updated` solo se emite con un cambio de gravedad, y su texto solo habla de la gravedad.
- Si eliminar un programa con no conformidades abiertas debe emitir un evento. Hoy no emite ninguno, y la cifra «NC abiertas» de la web y del móvil solo se actualiza sin recargar si llega un evento (ver US-MISION-FEED-007). Esto describe lo que existe, no es un criterio.
