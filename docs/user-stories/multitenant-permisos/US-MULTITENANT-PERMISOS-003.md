---
id: US-MULTITENANT-PERMISOS-003
tipo: historia
epica: EP-MULTITENANT-PERMISOS
titulo: "[API] Un token no escribe en otro tenant: los recursos ajenos responden 404"
etiquetas: [api]
relacionadas: [US-MULTITENANT-PERMISOS-002, US-PROG-GESTION-003, US-DOC-VERSIONES-003, US-AUDITORIA-003, US-HITOS-005]
verificacion: ejecutada
cubre: ["POST /api/programs", "PATCH /api/programs/:code", "DELETE /api/programs/:code", "POST /api/programs/:code/archive", "POST /api/programs/:code/milestones", "POST /api/requirements", "PATCH /api/requirements/:code", "DELETE /api/requirements/:code", "POST /api/requirements/:code/move", "POST /api/nc", "PATCH /api/nc/:code", "POST /api/nc/:code/comments", "PATCH /api/milestones/:id", "DELETE /api/milestones/:id", "POST /api/test-cases/:code/runs", "POST /api/documents/:id/versions"]
---

## Historia
Como alumno que trabaja en su tenant, quiero que ninguna escritura de mi token llegue a un recurso de otro tenant, aunque tenga el mismo código,
para que lo que yo cambio, publico o elimino no altere los datos de otro alumno.

## Reglas
- Una operación sobre un recurso que solo existe en otro tenant responde 404 con el código de su módulo (`program_not_found`, `requirement_not_found`, `nc_not_found`, `milestone_not_found`). El recurso ajeno no cambia.
- Un código ajeno que llega en el cuerpo de la petición no se busca en el tenant ajeno: si el cuerpo nombra un programa ajeno para crear un requisito, la respuesta es 404 `program_not_found`; si lo nombra para crear una no conformidad o para mover un requisito, la respuesta es 422 `validation_failed` con el motivo en el campo que lo nombra (`programRequired` o `badTarget`).
- Una escritura del propio tenant solo cambia el propio tenant. Un código que existe en los dos tenants cambia solo en el del token.
- Preparación de cada fila: se reinician `alumno01` y `alumno02` con `POST /api/admin/reset`, cada uno con el token de su administrador (`alumno01@sigpro.lab` y `alumno02@sigpro.lab`, contraseña `Alumno1234!`) y la cabecera `x-tenant` de su tenant, con el caos apagado. Cada administrador inicia sesión con `POST /api/auth/login`, su cabecera `x-tenant` y su contraseña, y usa el `accessToken` que recibe. Después `alumno02@sigpro.lab`, con su token, crea lo que solo existe en `alumno02`: renombra `PRG-001` a «Programa de aislamiento»; crea el programa `PRG-025` «Programa de aislamiento nuevo» (responsable `u1`, inicio `2026-03-01`, fin `2026-12-31`, presupuesto `150000`); crea el requisito `REQ-041` en `PRG-001` con el título «Requisito solo de alumno02»; crea la no conformidad `NC-013` en `PRG-025` (gravedad `minor`, descripción «Desviación solo de alumno02»); crea el hito `PRG-025-M01` en `PRG-025` (nombre «Hito solo de alumno02», fecha `2026-06-30`); registra una ejecución de `TC-001` con resultado `pass`; y publica la versión 4 de `DOC-001` con la línea «Versión solo de alumno02». `alumno01` no recibe ninguna de estas operaciones.

## Criterios de aceptación
```gherkin
Característica: Escrituras dentro del tenant del token

  Esquema del escenario: Una escritura sobre un recurso de otro tenant responde 404 y no lo cambia
    Dado que en los tenants alumno01 y alumno02, recién reiniciados y con la preparación de la regla, la cuenta de administración de alumno01 tiene su accessToken
    Cuando envía <operacion> con ese accessToken y la cabecera x-tenant alumno01
    Entonces la respuesta es <respuesta>
    Y <comprobacion>

    Ejemplos:
      | operacion | respuesta | comprobacion |
      | PATCH /api/programs/PRG-025 con {"description": "Descripción de otro tenant"} | 404 program_not_found | el programa PRG-025 de alumno02 sigue con el nombre «Programa de aislamiento nuevo» y la descripción que tenía antes del intento |
      | DELETE /api/programs/PRG-025 | 404 program_not_found | el programa PRG-025 sigue existiendo en alumno02 |
      | POST /api/programs/PRG-025/archive | 404 program_not_found | el programa PRG-025 de alumno02 sigue en estado borrador |
      | PATCH /api/requirements/REQ-041 con {"priority": "high"} | 404 requirement_not_found | el requisito REQ-041 de alumno02 sigue con priority medium |
      | DELETE /api/requirements/REQ-041 | 404 requirement_not_found | el requisito REQ-041 sigue existiendo en alumno02 |
      | PATCH /api/nc/NC-013 con {"severity": "major"} | 404 nc_not_found | la no conformidad NC-013 de alumno02 sigue con severity minor |
      | POST /api/nc/NC-013/comments con {"body": "Comentario de otro tenant"} | 404 nc_not_found | la no conformidad NC-013 de alumno02 no recibe ese comentario |
      | PATCH /api/milestones/PRG-025-M01 con {"name": "Hito de otro tenant"} | 404 milestone_not_found | el hito PRG-025-M01 de alumno02 sigue con el nombre «Hito solo de alumno02» |
      | DELETE /api/milestones/PRG-025-M01 | 404 milestone_not_found | el hito PRG-025-M01 sigue existiendo en alumno02 |
      | POST /api/programs/PRG-025/milestones con {"name": "Hito de otro tenant", "dueDate": "2026-07-01"} | 404 program_not_found | PRG-025 de alumno02 sigue con un único hito |
      | POST /api/requirements/REQ-041/move con {"targetCode": "REQ-001", "placement": "after"} | 404 requirement_not_found | el orden de los requisitos de PRG-001 en alumno02 no cambia |

  Esquema del escenario: Un código de otro tenant dentro del cuerpo no se resuelve
    Dado que en los tenants alumno01 y alumno02, recién reiniciados y con la preparación de la regla, la cuenta de administración de alumno01 tiene su accessToken
    Cuando envía <operacion> con ese accessToken y la cabecera x-tenant alumno01
    Entonces la respuesta es <respuesta>
    Y <comprobacion>

    Ejemplos:
      | operacion | respuesta | comprobacion |
      | POST /api/requirements con {"programCode": "PRG-025", "title": "Requisito de otro tenant"} | 404 program_not_found | en alumno01 no aparece ningún requisito nuevo en PRG-001 |
      | POST /api/requirements/REQ-001/move con {"targetCode": "REQ-041", "placement": "after"} | 422 validation_failed con targetCode «badTarget» | el orden de los hermanos de REQ-001 en alumno01 no cambia |
      | POST /api/nc con {"programCode": "PRG-025", "severity": "minor", "description": "Desviación de otro tenant"} | 422 validation_failed con programCode «programRequired» | GET /api/nc/NC-013 con el mismo token responde 404 nc_not_found |

  Esquema del escenario: Una escritura en el propio tenant solo cambia el propio tenant
    Dado que en los tenants alumno01 y alumno02, recién reiniciados y con la preparación de la regla, la cuenta de administración de alumno01 tiene su accessToken
    Cuando envía <operacion> con ese accessToken y la cabecera x-tenant alumno01
    Entonces la respuesta es <respuesta>
    Y <comprobacion>

    Ejemplos:
      | operacion | respuesta | comprobacion |
      | POST /api/programs con {"name": "Programa de otro tenant", "ownerId": "u1", "startDate": "2026-03-01", "endDate": "2026-12-31", "budget": 150000} | 201 con el código PRG-025 | en alumno02, PRG-025 sigue con el nombre «Programa de aislamiento nuevo» y el listado de alumno02 sigue con 25 programas |
      | PATCH /api/programs/PRG-001 con {"name": "Programa solo de alumno01"} | 200 con el nombre «Programa solo de alumno01» | en alumno02, PRG-001 sigue con el nombre «Programa de aislamiento» |
      | POST /api/documents/DOC-001/versions con {"lines": ["Versión solo de alumno01"]} | 201 con la versión 4 | en alumno02, DOC-001 sigue con su versión 4, «Versión solo de alumno02» |
      | POST /api/test-cases/TC-001/runs con el resultado pass | 201 con una ejecución nueva | la ficha de TC-001 de alumno02 no incluye la ejecución de alumno01 |

  Esquema del escenario: El registro de auditoría de un tenant no recoge las escrituras del otro
    Dado que en los tenants alumno01 y alumno02, recién reiniciados y con la preparación de la regla, la cuenta de administración de alumno01 tiene su accessToken
    Cuando envía POST /api/programs con {"name": "Programa de otro tenant", "ownerId": "u1", "startDate": "2026-03-01", "endDate": "2026-12-31", "budget": 150000} con ese accessToken y la cabecera x-tenant alumno01
    Entonces la respuesta es 201 con el código PRG-025
    Y en alumno01, GET /api/audit?q=<codigo> responde 200 con total <total_alumno01>
    Y en alumno02, GET /api/audit?q=<codigo> responde 200 con total <total_alumno02>

    Ejemplos:
      | codigo | total_alumno01 | total_alumno02 |
      | PRG-025 | 1 | 2 |
```

## Fuera de alcance
- Las reglas de validación de cada operación (nombres, fechas, presupuesto, transiciones, comentarios de cierre): cada una en la épica de su módulo.
- La comprobación de permisos de cada operación, que se decide antes que el recurso: US-MULTITENANT-PERMISOS-005.
- Los proveedores no tienen escritura en la API: solo se comprueban en lectura (US-MULTITENANT-PERMISOS-002).
- La clave de administración del reinicio nocturno: EP-CAOS-RESET.
