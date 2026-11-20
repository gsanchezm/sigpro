---
id: US-MISION-KPI-001
tipo: historia
epica: EP-MISION-KPI
titulo: "[API] Resumen de misión: forma de la respuesta y sesión obligatoria"
etiquetas: [api]
relacionadas: [US-MISION-KPI-002, US-MISION-KPI-003, US-MISION-KPI-004, US-PROG-METRICAS-001]
verificacion: ejecutada
cubre: ["GET /api/mission/summary"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero pedir el resumen de misión del tenant con mi propia sesión,
para pintar el panel de misión y saber con certeza qué bloques y qué campos trae la respuesta.

## Reglas
- `GET /api/mission/summary` exige un `accessToken` válido en la cabecera `Authorization: Bearer`. No exige ningún permiso: cualquier rol autenticado (program_manager, consultant, auditor o admin) recibe la misma forma de respuesta.
- Sin cabecera `Authorization` la respuesta es 401 `missing_token`. Con un token que la API no ha emitido, la respuesta es 401 `invalid_token`.
- Con una sesión válida, la respuesta es 200 y tiene exactamente estos bloques de primer nivel: `kpis`, `milestonesByProgram`, `ncBySeverity`, `recent` y `simulatorMs`. No trae ningún otro.
- `kpis` trae nueve cifras enteras: `activePrograms`, `programsTotal`, `programsProgress`, `milestonesDone`, `milestonesTotal`, `ncOpen`, `ncTotal`, `verificationPass` y `casesWithRuns`.
- `milestonesByProgram` es una lista que puede venir vacía. `ncBySeverity` trae siempre las tres claves `minor`, `major` y `critical`, aunque valgan cero.
- Todos los bloques se calculan sobre el tenant del token. La cabecera `x-tenant` no cambia nada en este endpoint.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`, obtenido con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`). Antes de cada fila, el caos del tenant debe estar apagado: si no lo está, se apaga con `PATCH /api/admin/chaos` y ese mismo token. Las cuentas de la fila inician sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Forma y acceso del resumen de misión

  Esquema del escenario: El resumen trae los bloques del panel y ninguno más
    Dado que en el tenant alumno01, recién reiniciado, existen los 24 programas del seed
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant alumno01
    Entonces la respuesta es 200 y tiene el bloque <bloque> con <contenido>
    Y el resumen no trae ningún otro bloque de primer nivel

    Ejemplos:
      | bloque | contenido |
      | kpis | nueve cifras enteras: activePrograms, programsTotal, programsProgress, milestonesDone, milestonesTotal, ncOpen, ncTotal, verificationPass y casesWithRuns |
      | milestonesByProgram | una lista de como mucho 8 elementos |
      | ncBySeverity | las claves minor, major y critical, con un número entero cada una |
      | recent | una lista de como mucho 20 eventos, el más reciente primero |
      | simulatorMs | un número entero |

  Esquema del escenario: Sin una sesión válida no hay resumen
    Dado que en el tenant alumno01, recién reiniciado, existen los 24 programas del seed
    Cuando envía GET /api/mission/summary con <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cabecera | respuesta |
      | (sin cabecera) | 401 missing_token |
      | (token inventado) | 401 invalid_token |
```

## Fuera de alcance
- El valor de cada bloque: las gráficas de avance y de NC en US-MISION-KPI-002, la verificación en US-MISION-KPI-003 y la actividad reciente en US-MISION-KPI-004, todas de esta misma épica.
- Las cuatro tarjetas de la cabecera de la lista de programas (`kpis` usado por esa lista): EP-PROG-METRICAS.
- El feed en vivo por WebSocket: EP-MISION-FEED.
