---
id: US-PROG-METRICAS-001
tipo: historia
epica: EP-PROG-METRICAS
titulo: "[API] Indicadores de programas en el resumen de misión"
etiquetas: [api]
relacionadas: [US-PROG-METRICAS-002, US-PROG-METRICAS-005]
verificacion: ejecutada
cubre: ["GET /api/mission/summary"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero pedir el resumen de indicadores del tenant,
para mostrar en la lista de programas el número de programas, los activos, el avance medio de la cartera y las no conformidades abiertas.

## Reglas
- `GET /api/mission/summary` exige un `accessToken` válido en la cabecera `Authorization: Bearer`. No exige ningún permiso: cualquier rol autenticado (program_manager, consultant, auditor o admin) recibe la misma respuesta.
- Sin cabecera `Authorization`, la respuesta es 401 `missing_token`. Con un token que la API no ha emitido, la respuesta es 401 `invalid_token`.
- El tenant es el del token. La cabecera `x-tenant` no cambia nada en este endpoint: con el token de una cuenta de `alumno01`, las cifras son siempre las de `alumno01`.
- El bloque `kpis` de la respuesta se calcula sobre todos los programas y todas las no conformidades (NC) del tenant:
  - `programsTotal`: programas en cualquier estado (borrador, activo, en pausa, cerrado o cancelado). Un programa archivado, que queda en estado cerrado, cuenta.
  - `activePrograms`: programas en estado activo.
  - `programsProgress`: media entera, de 0 a 100, del avance de todos los programas, también de los que no están activos. El avance de un programa es el porcentaje entero de sus hitos cumplidos; un programa sin hitos cuenta 0 %.
  - `milestonesDone` y `milestonesTotal`: hitos cumplidos y hitos totales de todos los programas del tenant.
  - `ncOpen`: NC que no están cerradas ni rechazadas. `ncTotal`: todas las NC del tenant.
- Datos del seed tras reiniciar el tenant `alumno01`: 24 programas (`PRG-001` a `PRG-024`), 12 de ellos en estado activo, 175 hitos de los que 86 están cumplidos, y 12 NC (`NC-001` a `NC-012`) de las que 8 están abiertas. Todos los tenants reciben el mismo seed. En ese seed, `NC-001` está en estado `open`, `NC-002` en `in_analysis` y `NC-003` en `corrective_action`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). El token de cada cuenta de la fila se obtiene con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`. Los cambios de programas de una fila se hacen con el token de `alumno01@sigpro.lab`, que tiene el rol de administrador y no tiene segundo factor. Los cambios de estado de una NC se hacen con ese mismo token, con `POST /api/nc/:code/transition`.
- Preparación de la fila que usa `alumno02`: se reinicia también el tenant `alumno02` con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`) y su cabecera `x-tenant: alumno02`, y el cambio se hace con ese token.

## Criterios de aceptación
```gherkin
Característica: Indicadores de programas en el resumen de misión

  Esquema del escenario: Cualquier rol autenticado recibe las mismas cifras del tenant
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión con la contraseña <contraseña>
    Cuando envía GET /api/mission/summary con ese accessToken y la cabecera x-tenant alumno01
    Entonces la respuesta es 200 y en kpis programsTotal vale <programas>, activePrograms vale <activos>, programsProgress vale <avance>, milestonesDone vale <hitos_cumplidos>, milestonesTotal vale <hitos>, ncOpen vale <nc_abiertas> y ncTotal vale <nc_total>

    Ejemplos:
      | cuenta | contraseña | programas | activos | avance | hitos_cumplidos | hitos | nc_abiertas | nc_total |
      | gestor@sigpro.test | Gestor1234! | 24 | 12 | 49 | 86 | 175 | 8 | 12 |
      | consultor@sigpro.test | Consul1234! | 24 | 12 | 49 | 86 | 175 | 8 | 12 |
      | auditor@sigpro.test | Audit1234! | 24 | 12 | 49 | 86 | 175 | 8 | 12 |
      | alumno01@sigpro.lab | Alumno1234! | 24 | 12 | 49 | 86 | 175 | 8 | 12 |

  Esquema del escenario: Cada cambio en los programas mueve solo las cifras que le corresponden
    Dado que en el tenant alumno01, recién reiniciado, <cambio>
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant alumno01
    Entonces en kpis programsTotal vale <programas>, activePrograms vale <activos>, programsProgress vale <avance>, milestonesDone vale <hitos_cumplidos>, milestonesTotal vale <hitos>, ncOpen vale <nc_abiertas> y ncTotal vale <nc_total>

    Ejemplos:
      | cambio | programas | activos | avance | hitos_cumplidos | hitos | nc_abiertas | nc_total |
      | no hay ningún cambio en los programas | 24 | 12 | 49 | 86 | 175 | 8 | 12 |
      | alumno01@sigpro.lab archiva PRG-001 con POST /api/programs/PRG-001/archive | 24 | 11 | 49 | 86 | 175 | 8 | 12 |
      | alumno01@sigpro.lab duplica PRG-001 con POST /api/programs/PRG-001/duplicate | 25 | 12 | 47 | 86 | 175 | 8 | 12 |
      | alumno01@sigpro.lab elimina PRG-001 con DELETE /api/programs/PRG-001 | 23 | 11 | 51 | 85 | 166 | 5 | 8 |

  Esquema del escenario: El resumen exige un accessToken válido
    Dado que en el tenant alumno01, recién reiniciado, existen los 24 programas del seed
    Cuando envía GET /api/mission/summary con <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cabecera | respuesta |
      | (sin cabecera) | 401 missing_token |
      | (token inventado) | 401 invalid_token |

  Esquema del escenario: El resumen cuenta solo los programas del tenant del token
    Dado que en el tenant alumno01, recién reiniciado, y en el tenant alumno02, también recién reiniciado, alumno02@sigpro.lab archiva PRG-001 en alumno02 con POST /api/programs/PRG-001/archive
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant <cabecera>
    Entonces en kpis activePrograms vale 12 y programsTotal vale 24

    Ejemplos:
      | cabecera |
      | alumno01 |
      | alumno02 |

  Esquema del escenario: Una transición de una NC cambia ncOpen solo si deja de estar abierta
    Dado que en el tenant alumno01, recién reiniciado, <cambio>
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant alumno01
    Entonces en kpis ncOpen vale <nc_abiertas> y ncTotal vale <nc_total>

    Ejemplos:
      | cambio | nc_abiertas | nc_total |
      | alumno01@sigpro.lab pasa NC-001 a `in_analysis` con POST /api/nc/NC-001/transition | 8 | 12 |
      | alumno01@sigpro.lab pasa NC-002 a `rejected` con POST /api/nc/NC-002/transition | 7 | 12 |
      | alumno01@sigpro.lab pasa NC-003 a `closed` con POST /api/nc/NC-003/transition y el comentario `Acción correctiva verificada por calidad` | 7 | 12 |
```

## Fuera de alcance
- Las demás cifras del mismo resumen (verificación, hitos por programa, NC por gravedad, eventos recientes e intervalo del simulador): la épica del panel de misión.
- La lista de programas y sus recuentos: EP-PROG-LISTA.
- El inicio de sesión que entrega el `accessToken` y su caducidad: EP-LOGIN y EP-SESION.
