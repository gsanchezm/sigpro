---
id: US-AUDITORIA-004
tipo: historia
epica: EP-AUDITORIA
titulo: "[API] Qué evento deja cada operación de programas, requisitos, ejecuciones y documentos"
etiquetas: [api]
relacionadas: [US-AUDITORIA-001, US-AUDITORIA-005, US-PROG-ALTA-001, US-PROG-GESTION-003, US-REQ-EDICION-001, US-REQ-FLUJO-005, US-REQ-TRAZA-002, US-VER-EJECUCION-002]
verificacion: ejecutada
---

## Historia
Como auditor, quiero que cada cambio de un programa, de un requisito, de una ejecución de prueba o de un documento quede registrado con quién lo hizo y qué cambió,
para reconstruir después qué pasó en el tenant sin preguntar a nadie.

## Reglas
- Cada operación aceptada que cambia datos escribe su evento en la misma transacción que el cambio: si el cambio queda guardado, el evento existe; si la operación se rechaza, no queda ningún evento.
- El evento lleva el actor de la operación (`actorId` y `actorName` de la cuenta que la envió), la acción (`action`), la entidad (`entity`) y el código afectado (`entityId`). En las operaciones que crean algo, `entityId` es el código o el id que devuelve la propia respuesta.
- El detalle (`diff`) contiene los datos de la tabla. La tabla dice qué claves contiene: no fija el orden de las claves ni el valor de las que no cita. Si el detalle es `null`, la tabla lo dice.
- Cada tipo de evento tiene una operación de ejemplo sobre la semilla de `alumno01`. Las operaciones de ejemplo son las que describe la épica de su módulo; aquí solo se comprueba el evento que dejan.
- Preparación de cada fila, en el tenant `alumno01`: antes de cada fila se comprueba que el caos del tenant está apagado: `GET /api/config` con la cabecera `x-tenant: alumno01` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Solo después se reinicia el tenant con `POST /api/admin/reset`, ese mismo token y la cabecera `x-tenant: alumno01`. Cada cuenta que actúa en la fila inicia sesión con `POST /api/auth/login`, la cabecera `x-tenant: alumno01` y su contraseña de demostración (`gestor@sigpro.test` `Gestor1234!`, `consultor@sigpro.test` `Consul1234!`, `auditor@sigpro.test` `Audit1234!`, `alumno01@sigpro.lab` `Alumno1234!`), y usa su `accessToken` como `Authorization: Bearer`. Después, la lectura del registro la hace `auditor@sigpro.test`.
- «El primer evento» es el primero de `items` de `GET /api/audit` sin filtros, leído por `auditor@sigpro.test` justo después de la operación de la fila. Como la operación es posterior a la semilla, es el evento de la operación.
- Nombres de las cuentas del seed en el tenant: Javier Ortega (`gestor@sigpro.test`), Lucía Fernández (`consultor@sigpro.test`), Andrés Molina (`auditor@sigpro.test`) y Alumno 01 (`alumno01@sigpro.lab`).

## Criterios de aceptación
```gherkin
Característica: Eventos que dejan las operaciones de programas, requisitos, ejecuciones y documentos

  Esquema del escenario: Cada operación deja su evento como primer elemento del registro
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando <operacion>
    Entonces la respuesta es <respuesta>
    Y el primer evento de GET /api/audit tiene la acción <accion> y la entidad <entidad>
    Y su entityId es <codigo>
    Y lo hizo <actor>
    Y el detalle <detalle>

    Ejemplos:
      | operacion | respuesta | accion | entidad | codigo | actor | detalle |
      | gestor@sigpro.test envía POST /api/programs con nombre «Programa de auditoría», responsable u2, inicio 2026-03-01, fin 2026-12-31 y presupuesto 150000 | 201 | program.created | program | (código de la respuesta) | Javier Ortega | contiene name «Programa de auditoría» |
      | gestor@sigpro.test envía PATCH /api/programs/PRG-001 con nombre «Programa de auditoría revisado» | 200 | program.updated | program | PRG-001 | Javier Ortega | contiene fields con name |
      | gestor@sigpro.test envía POST /api/programs/PRG-001/archive | 200 | program.archived | program | PRG-001 | Javier Ortega | contiene status closed |
      | gestor@sigpro.test envía POST /api/programs/PRG-001/duplicate | 201 | program.duplicated | program | (código de la respuesta) | Javier Ortega | contiene from PRG-001 |
      | alumno01@sigpro.lab envía DELETE /api/programs/PRG-024 | 204 | program.deleted | program | PRG-024 | Alumno 01 | es null |
      | consultor@sigpro.test envía POST /api/requirements con programa PRG-001 y título «Requisito de auditoría» | 201 | requirement.created | requirement | (código de la respuesta) | Lucía Fernández | contiene title «Requisito de auditoría» y parent null |
      | consultor@sigpro.test envía PATCH /api/requirements/REQ-001 con título «Disponibilidad revisada» | 200 | requirement.updated | requirement | REQ-001 | Lucía Fernández | contiene fields con title y revertedFrom approved |
      | gestor@sigpro.test envía POST /api/requirements/REQ-017/transition con to approved | 200 | requirement.state_changed | requirement | REQ-017 | Javier Ortega | contiene from draft y to approved |
      | gestor@sigpro.test envía POST /api/requirements/REQ-001/move con targetCode REQ-006 y placement after | 200 | requirement.moved | requirement | REQ-001 | Javier Ortega | contiene target REQ-006 y placement after |
      | gestor@sigpro.test envía DELETE /api/requirements/REQ-005 | 204 | requirement.deleted | requirement | REQ-005 | Javier Ortega | contiene descendants 0 |
      | consultor@sigpro.test envía PUT /api/requirements/REQ-002/tests/TC-001 | 204 | requirement.linked | requirement | REQ-002 | Lucía Fernández | contiene testCase TC-001 |
      | consultor@sigpro.test envía DELETE /api/requirements/REQ-001/tests/TC-001 | 204 | requirement.unlinked | requirement | REQ-001 | Lucía Fernández | contiene testCase TC-001 |
      | consultor@sigpro.test envía POST /api/test-cases/TC-001/runs con resultado pass y sin archivos | 201 | testrun.executed | testrun | (id de la respuesta) | Lucía Fernández | contiene testCase TC-001, result pass y files 0 |
      | gestor@sigpro.test envía POST /api/documents/DOC-001/versions con la línea «Línea de auditoría» y la nota «Revisión de auditoría» | 201 | document.version_published | document | DOC-001 | Javier Ortega | contiene version 4 y lines 1 |
```

## Fuera de alcance
- Las reglas de cada operación (validaciones, estados, permisos y respuestas de error): cada una en la épica de su módulo.
- Las operaciones sobre no conformidades, hitos, usuarios, modo caos y solicitudes de acceso: los cubre EP-AUDITORIA en su historia de esas operaciones.
- Los rechazos y las lecturas, que no dejan evento: los cubre EP-AUDITORIA en su historia de operaciones rechazadas.

## Decisiones pendientes
- Un `PATCH` de programa o de requisito que no cambia nada hoy sí deja un evento con la lista de campos vacía. No está decidido si debe ser así; ninguna fila de esta historia lo ejercita.
