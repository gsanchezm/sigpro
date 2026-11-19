---
id: US-MISION-FEED-004
tipo: historia
epica: EP-MISION-FEED
titulo: "[API] Simulador de misión: apagado, encendido solo con conexiones abiertas y secuencia fija"
etiquetas: [api]
relacionadas: [US-MISION-FEED-002, US-MISION-FEED-003, US-MISION-FEED-005]
verificacion: codigo
---

## Historia
Como quien prueba el panel de misión, quiero un simulador que pueda apagarse y que, cuando está encendido, emita siempre la misma secuencia de eventos,
para que las pruebas del feed sean repetibles y no dependan del azar ni de cambios ajenos del tenant.

## Reglas
- El simulador lo gobierna la variable `SIMULATOR_MS` con la que se arranca la API. Con `0`, el simulador está apagado y no emite nada por su cuenta. Con un valor positivo (4000 milisegundos si la API no recibe otro valor), emite un evento cada `SIMULATOR_MS` milisegundos, y solo a los tenants que tienen alguna conexión abierta en ese momento.
- Los eventos del simulador son de origen `simulator`. No escriben en la base de datos: ninguna no conformidad, programa ni hito cambia por ellos.
- Un evento del simulador se guarda en el historial de su tenant solo cuando se emite. Por eso, un tenant sin conexión abierta no recibe eventos del simulador y su último `seq` no cambia.
- La secuencia es fija. El simulador recorre un ciclo de ocho tipos, en este orden: `link`, `milestone`, `thermal`, `telemetry`, `test_pass`, `link_lost`, `telemetry`, `heartbeat`, y vuelve a empezar. La gravedad de cada tipo es `info` en `link`, `telemetry` y `heartbeat`, `ok` en `milestone` y `test_pass`, `warn` en `thermal` y `danger` en `link_lost`.
- Después de la historia inicial, los programas que cita el simulador son los programas activos del tenant, ordenados por código y sin pasar de doce. La historia inicial cita siempre `PRG-001` a `PRG-006`, tengan el estado que tengan. Un evento de tipo `heartbeat` no lleva programa: su `programCode` es nulo.
- En un tenant recién reiniciado, el primer evento que provoca el simulador es el séptimo del ciclo (`seq` 7, de tipo `telemetry`): los seis primeros de la secuencia son su historia inicial (US-MISION-FEED-005).
- Para provocar eventos sin esperar al temporizador, la prueba usa `POST /api/mission/tick` con el token de un administrador del tenant. Ese endpoint, con sus permisos y su respuesta completa, lo describe EP-MISION-KPI; aquí solo se usa para provocar el siguiente evento de la secuencia, también con el simulador apagado.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Antes de la fila se comprueba que el caos del tenant está apagado. Cada Esquema dice con qué valor de `SIMULATOR_MS` se arranca la API. Una conexión en tiempo real se abre con el `accessToken` de `gestor@sigpro.test` (`Gestor1234!`) cuando la fila la necesita.

## Criterios de aceptación
```gherkin
Característica: Simulador de misión

  Esquema del escenario: Con el simulador apagado no llega ningún evento sin una acción
    Dado que en el tenant alumno01, recién reiniciado, la API se arranca con SIMULATOR_MS 0
    Cuando <situacion> y pasa una ventana de observación que elige la prueba sin ninguna acción en el tenant
    Entonces <resultado>

    Ejemplos:
      | situacion | resultado |
      | gestor@sigpro.test tiene una conexión abierta | la conexión no recibe ningún evento y el último seq del historial sigue en 6 |
      | no hay ninguna conexión abierta en alumno01 | el último seq del historial sigue en 6 |

  Esquema del escenario: Con el simulador encendido solo reciben eventos los tenants con una conexión abierta
    Dado que en el tenant alumno01, recién reiniciado, la API se arranca con SIMULATOR_MS 4000
    Cuando <situacion> y pasa una ventana de observación que elige la prueba
    Entonces <resultado>

    Ejemplos:
      | situacion | resultado |
      | gestor@sigpro.test tiene una conexión abierta | la conexión recibe al menos un evento de origen simulator antes de agotar la espera de la prueba, el último seq sube por encima de 6 y el número de NC abiertas del resumen sigue en 8 |
      | no hay ninguna conexión abierta en alumno01 | el último seq sigue en 6 |

  Esquema del escenario: La secuencia del simulador es fija
    Dado que en el tenant alumno01, recién reiniciado, la API se arranca con SIMULATOR_MS 0 y no se ha provocado ningún evento
    Cuando alumno01@sigpro.lab provoca <n> eventos con POST /api/mission/tick
    Entonces el último evento provocado tiene seq <seq>, tipo <tipo>, programCode <programa> y el texto <texto>

    Ejemplos:
      | n | seq | tipo | programa | texto |
      | 1 | 7 | telemetry | PRG-013 | «Telemetría PRG-013: 766 paquetes/s» |
      | 2 | 8 | heartbeat | (ninguno) | «Latido del centro de control (T+7)» |
      | 3 | 9 | link | PRG-001 | «Enlace de datos PRG-001: latencia 76 ms» |
```

## Fuera de alcance
- La respuesta completa de `POST /api/mission/tick`, su permiso (solo administradores) y sus errores: EP-MISION-KPI.
- Cómo se ven en pantalla los eventos del simulador: US-MISION-FEED-006 para la web y US-MISION-FEED-009 para el móvil.
- La historia inicial de cada tenant y su reinicio: esta épica, historia US-MISION-FEED-005.

## Decisiones pendientes
- Si los eventos que el simulador habría emitido mientras un tenant no tiene conexión abierta deben guardarse en el historial. Hoy no se emiten ni se guardan, así que el historial no los tiene. Esto describe lo que existe; no es un criterio.
