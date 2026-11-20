---
id: US-AUDITORIA-005
tipo: historia
epica: EP-AUDITORIA
titulo: "[API] Eventos de no conformidades, hitos, usuarios, modo caos y registro, y ninguno en las operaciones rechazadas"
etiquetas: [api]
relacionadas: [US-AUDITORIA-004, US-NC-GESTION-001, US-NC-GESTION-003, US-NC-GESTION-004, US-HITOS-002, US-HITOS-003, US-HITOS-005, US-REGISTRO-001]
verificacion: codigo
---

## Historia
Como auditor, quiero que las no conformidades, los hitos, los usuarios, el modo caos y las solicitudes de acceso dejen su rastro en el registro,
y que una operación rechazada no deje ninguno, para que el registro refleje solo lo que de verdad cambió.

## Reglas
- Igual que en las demás operaciones, cada cambio aceptado escribe su evento en la misma transacción. Un cambio que no se guarda no deja evento.
- Un `PATCH` de una no conformidad, de un hito o de un usuario que no cambia nada no escribe ningún evento: la operación responde 200 con el dato actual y el registro no crece.
- Una solicitud de acceso (`POST /api/auth/register`) deja un evento sin actor: `actorId` y `actorName` son `null`, y la pantalla lo muestra con el nombre «Sistema». Su `entityId` es el identificador de la cuenta nueva, que empieza por `r` seguido de ocho caracteres hexadecimales y no se fija de antemano. Su detalle contiene el correo en minúsculas y el rol pedido.
- Para los ejemplos, `(correo nuevo)` es `nueva-` seguido de una marca de tiempo y `@organizacion.es`, un correo que no existe en el tenant en cada fila. El cuerpo de `POST /api/auth/register` es `first` Ana, `last` Prueba, `email` (correo nuevo), `org` Unidad de pruebas, `role` consultant, `password` y `confirm` Abcdefghij1! y `terms` true.
- Un rechazo o una lectura no deja ningún evento. En particular, iniciar sesión no deja evento, aunque sea correcto.
- Preparación de cada fila, en el tenant `alumno01`: antes de cada fila se comprueba que el caos del tenant está apagado: `GET /api/config` con la cabecera `x-tenant: alumno01` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Solo después se reinicia el tenant con `POST /api/admin/reset`, ese mismo token y la cabecera `x-tenant: alumno01`. Cada cuenta que actúa en la fila inicia sesión con `POST /api/auth/login`, la cabecera `x-tenant: alumno01` y su contraseña de demostración; `auditor@sigpro.test` (contraseña `Audit1234!`) lee después el registro.
- La semilla tiene 130 eventos y el primero del registro es `AL-130` (`requirement.created` sobre `REQ-011`, hecho por Lucía Fernández). Un evento escrito durante la fila es posterior y pasa a ser el primero.

## Criterios de aceptación
```gherkin
Característica: Eventos de no conformidades, hitos, usuarios, modo caos y registro, y operaciones rechazadas

  Esquema del escenario: Cada operación aceptada deja su evento como primer elemento del registro
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando <operacion>
    Entonces la respuesta es <respuesta>
    Y el primer evento de GET /api/audit tiene la acción <accion> y la entidad <entidad>
    Y su entityId es <codigo>
    Y lo hizo <actor>
    Y el detalle <detalle>

    Ejemplos:
      | operacion | respuesta | accion | entidad | codigo | actor | detalle |
      | consultor@sigpro.test envía POST /api/nc con programa PRG-001, severidad minor y descripción «Desviación de prueba para la auditoría» | 201 | nc.created | nc | (código de la respuesta) | Lucía Fernández | contiene program PRG-001 y severity minor |
      | consultor@sigpro.test envía PATCH /api/nc/NC-001 con severidad critical | 200 | nc.updated | nc | NC-001 | Lucía Fernández | contiene severity critical |
      | consultor@sigpro.test envía POST /api/nc/NC-001/transition con to in_analysis | 200 | nc.state_changed | nc | NC-001 | Lucía Fernández | contiene from open y to in_analysis |
      | auditor@sigpro.test envía POST /api/nc/NC-001/comments con el texto «Revisión de auditoría» | 201 | nc.commented | nc | NC-001 | Andrés Molina | contiene kind comment |
      | gestor@sigpro.test envía POST /api/programs/PRG-001/milestones con nombre «Hito de auditoría» y fecha límite 2026-06-30 | 201 | milestone.created | milestone | (id de la respuesta) | Javier Ortega | contiene program PRG-001 y name «Hito de auditoría» |
      | gestor@sigpro.test envía PATCH /api/milestones/PRG-001-M01 con nombre «Revisión de sistemas» | 200 | milestone.updated | milestone | PRG-001-M01 | Javier Ortega | contiene name «Revisión de sistemas» |
      | gestor@sigpro.test envía DELETE /api/milestones/PRG-001-M01 | 204 | milestone.deleted | milestone | PRG-001-M01 | Javier Ortega | contiene program PRG-001 y name SRR |
      | alumno01@sigpro.lab envía PATCH /api/admin/users/u3 con active false | 200 | user.updated | user | u3 | Alumno 01 | contiene active false |
      | alumno01@sigpro.lab envía PATCH /api/admin/chaos con latencyMs 0, errorRate 0 y flakyLabels false | 200 | chaos.updated | tenant | alumno01 | Alumno 01 | contiene latencyMs 0, errorRate 0 y flakyLabels false |
      | sin cuenta, envía POST /api/auth/register con x-tenant alumno01 y el cuerpo de las Reglas, con el correo (correo nuevo) | 201 | auth.register | user | (identificador que empieza por r) | (ninguno) | contiene email (correo nuevo en minúsculas) y role consultant |

  Esquema del escenario: Una operación rechazada o una lectura no deja ningún evento
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando <operacion>
    Entonces la respuesta es <respuesta>
    Y total de GET /api/audit vale 130
    Y el primer evento sigue siendo AL-130

    Ejemplos:
      | operacion | respuesta |
      | consultor@sigpro.test envía POST /api/programs con nombre «Programa de auditoría», responsable u2, inicio 2026-03-01, fin 2026-12-31 y presupuesto 150000 | 403 forbidden |
      | gestor@sigpro.test envía POST /api/programs con nombre «Programa duplicado de auditoría», responsable u2, inicio 2026-03-01, fin 2026-12-31 y presupuesto 150000 | 422 duplicate_name |
      | alumno01@sigpro.lab envía PATCH /api/admin/users/u7 con active false | 409 self_change |
      | consultor@sigpro.test envía PATCH /api/nc/NC-001 con la severidad que ya tiene, minor | 200 |
      | gestor@sigpro.test inicia sesión con POST /api/auth/login, su correo y la contraseña correcta | 200 |
```

## Fuera de alcance
- Las reglas de cada operación de no conformidades (EP-NC-GESTION y EP-NC-TABLERO), hitos (EP-HITOS), usuarios (EP-ADMIN-USUARIOS) y modo caos (EP-CAOS-RESET): cada una en su épica.
- Las operaciones de programas, requisitos, ejecuciones y documentos: las cubre EP-AUDITORIA en su historia de esas operaciones.
- La pantalla del registro: la cubre EP-AUDITORIA en sus pantallas.

## Decisiones pendientes
- Un `PATCH` del modo caos que no cambia nada deja hoy su evento, igual que un cambio. No está decidido si debe ser así; la fila que envía latencyMs 0, errorRate 0 y flakyLabels false lo ejercita sin cambio, porque la preparación deja el caos apagado, y su resultado depende de esa decisión.
