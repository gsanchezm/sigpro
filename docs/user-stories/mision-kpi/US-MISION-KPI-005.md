---
id: US-MISION-KPI-005
tipo: historia
epica: EP-MISION-KPI
titulo: "[API] Emitir el siguiente evento del simulador con POST /api/mission/tick (solo admin)"
etiquetas: [api]
relacionadas: [US-MISION-KPI-004, US-MISION-KPI-009, US-MISION-KPI-012, US-MISION-FEED-004]
verificacion: ejecutada
cubre: ["POST /api/mission/tick"]
permisos: [users.manage]
---

## Historia
Como administrador de un tenant que prueba el panel de misión, quiero emitir ya el siguiente evento del simulador,
para ver un evento nuevo en el panel sin esperar al temporizador del simulador.

## Reglas
- `POST /api/mission/tick` no lleva cuerpo. Exige una sesión válida (sin cabecera `Authorization` responde 401 `missing_token`; con un token que la API no ha emitido, 401 `invalid_token`) y el permiso `users.manage`, que solo tiene el administrador. Cualquier otro rol recibe 403 `forbidden`.
- Con permiso, responde 200 (no 201) con un objeto `event`: el evento emitido, con la misma forma que los eventos de la actividad reciente y `origin` igual a `simulator`.
- El evento es el siguiente de una secuencia fija de ocho tipos que empieza en el reinicio del tenant. La secuencia es determinista: la misma posición produce siempre el mismo tipo, gravedad y valores. Tras el reinicio, la primera emisión llega después de la historia inicial de seis eventos.
- Los eventos que citan un programa usan los programas activos del tenant, en orden de código (hasta 12). Un evento sin programa (el latido del centro de control) trae `programCode` igual a `null`.
- Emitir un evento no escribe en la base de datos: no cambia programas, hitos, no conformidades ni ejecuciones de verificación.
- Funciona aunque el temporizador del simulador esté apagado (`SIMULATOR_MS=0`, como en las pruebas) y aunque no haya ningún cliente conectado al panel: la respuesta sigue siendo 200.
- El evento emitido pasa a ser el primero de la actividad reciente de su tenant, y no aparece en ningún otro tenant.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`, obtenido con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`). Antes de cada fila, el caos del tenant debe estar apagado. Las cuentas de la fila inician sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Emisión de un evento de prueba por la API

  Esquema del escenario: Solo el administrador del tenant puede emitir un evento
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión con la contraseña <contraseña>
    Cuando envía POST /api/mission/tick con ese accessToken y la cabecera x-tenant alumno01
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | contraseña | respuesta |
      | alumno01@sigpro.lab | Alumno1234! | 200 con un evento |
      | gestor@sigpro.test | Gestor1234! | 403 forbidden |
      | consultor@sigpro.test | Consul1234! | 403 forbidden |
      | auditor@sigpro.test | Audit1234! | 403 forbidden |

  Esquema del escenario: Sin una sesión válida no se emite ningún evento
    Dado que en el tenant alumno01 está recién reiniciado
    Cuando envía POST /api/mission/tick con <cabecera>
    Entonces la respuesta es <respuesta>
    Y al pedir GET /api/mission/summary, recent tiene 6 elementos

    Ejemplos:
      | cabecera | respuesta |
      | (sin cabecera) | 401 missing_token |
      | (token inventado) | 401 invalid_token |

  Esquema del escenario: Cada emisión produce el siguiente evento de la secuencia
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha emitido <emitidos> eventos con POST /api/mission/tick
    Cuando alumno01@sigpro.lab emite otro evento con POST /api/mission/tick y la cabecera x-tenant alumno01
    Entonces el evento tiene el identificador <id>, tipo <tipo>, gravedad <gravedad>, programCode <programa> y vars con <valor>

    Ejemplos:
      | emitidos | id | tipo | gravedad | programa | valor |
      | 0 | EV-0007 | telemetry | info | PRG-013 | value 766 |
      | 1 | EV-0008 | heartbeat | info | (ninguno) | value T+7 |
      | 2 | EV-0009 | link | info | PRG-001 | value 76 |
```

## Decisiones pendientes
- Qué programa cita un evento que necesita un programa cuando el tenant no tiene ninguno activo. Hoy cita `PRG-001`, aunque ese programa no esté activo (o ya no exista). Ninguna fila de esta historia depende de ello.

## Fuera de alcance
- El temporizador del simulador, que emite un evento cada intervalo a los clientes conectados, y el feed en vivo: EP-MISION-FEED.
- El texto traducido del evento que llega al feed: EP-MISION-FEED.
- Los avisos que muestran la web y la app móvil al pulsar el botón de emisión: esta misma épica, en US-MISION-KPI-009 y US-MISION-KPI-012.
