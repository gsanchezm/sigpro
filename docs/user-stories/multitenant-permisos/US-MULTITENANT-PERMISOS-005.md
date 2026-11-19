---
id: US-MULTITENANT-PERMISOS-005
tipo: historia
epica: EP-MULTITENANT-PERMISOS
titulo: "[API] Permisos por rol: la matriz de cada familia y el orden 401 → 403"
etiquetas: [api]
relacionadas: [US-PROG-ALTA-005, US-PROG-GESTION-001, US-REQ-EDICION-006, US-REQ-FLUJO-003, US-VER-EJECUCION-001, US-DOC-RESTRINGIDOS-002, US-DOC-VERSIONES-003, US-AUDITORIA-003, US-ADMIN-USUARIOS-002, US-NC-TABLERO-004, US-NC-GESTION-005, US-HITOS-005, US-CAOS-RESET-005]
verificacion: codigo
cubre: ["POST /api/programs", "PATCH /api/programs/:code", "POST /api/programs/:code/archive", "DELETE /api/programs/:code", "GET /api/programs/export", "POST /api/requirements", "PATCH /api/requirements/:code", "DELETE /api/requirements/:code", "POST /api/requirements/:code/transition", "POST /api/test-cases/:code/runs", "GET /api/documents/:id", "POST /api/documents/:id/versions", "GET /api/audit", "GET /api/admin/users", "POST /api/nc", "POST /api/nc/:code/comments", "PATCH /api/nc/:code", "POST /api/nc/:code/transition", "PATCH /api/milestones/:id", "DELETE /api/milestones/:id"]
permisos: [program.create, program.edit, program.archive, program.delete, program.export, requirement.create, requirement.edit, requirement.delete, requirement.approve, requirement.verify, requirement.validate, testrun.execute, document.viewRestricted, document.publish, audit.view, users.manage, nc.create, nc.comment, nc.edit, nc.transition, nc.close, milestone.edit, milestone.delete]
---

## Historia
Como persona que trabaja en SIGPRO con un rol (administrador, gestor de programa, consultor o auditor), quiero que la API me deje hacer solo lo que la matriz de permisos concede a mi rol y me responda 403 a lo demás,
para que ninguna cuenta pueda hacer con su rol lo que su rol no tiene, y para que una petición sin sesión válida reciba 401 antes que cualquier 403.

## Reglas
- Roles y cuentas del tenant `alumno01`: `admin` es `alumno01@sigpro.lab` (contraseña `Alumno1234!`, sin segundo factor); `program_manager` es `gestor@sigpro.test` (`Gestor1234!`); `consultant` es `consultor@sigpro.test` (`Consul1234!`); `auditor` es `auditor@sigpro.test` (`Audit1234!`). Cada cuenta inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken`.
- Cada clave de la matriz tiene al menos un rol que la tiene y otro que no, salvo `program.export`, `nc.create` y `nc.comment`: estas tres las tienen los cuatro roles, así que en sus filas ningún rol recibe 403 por permiso.
- Un rol sin el permiso recibe 403 `forbidden`, y el permiso se comprueba antes que la validación del cuerpo y que la existencia del recurso: un 403 gana aunque el cuerpo no sea válido o el código no exista. Un token ausente o no válido recibe 401 antes que cualquier 403.
- Operaciones de la matriz, cada una con la petición mínima que ejercita su permiso:
  - crear programa: `POST /api/programs` con {"name": "Programa de permisos", "ownerId": "u1", "startDate": "2026-03-01", "endDate": "2026-12-31", "budget": 150000}.
  - editar programa: `PATCH /api/programs/PRG-001` con {"description": "Descripción de prueba de permisos"}.
  - archivar programa: `POST /api/programs/PRG-001/archive`, sin cuerpo.
  - eliminar programa: `DELETE /api/programs/PRG-024`, sin cuerpo (el programa no tiene requisitos, casos, documentos, no conformidades ni contratos).
  - exportar programas: `GET /api/programs/export`.
  - crear requisito: `POST /api/requirements` con {"programCode": "PRG-001", "title": "Requisito de permisos"}.
  - editar requisito: `PATCH /api/requirements/REQ-001` con {"priority": "high"}.
  - eliminar requisito: `DELETE /api/requirements/REQ-040` (hoja sin hijos).
  - aprobar requisito: `POST /api/requirements/REQ-017/transition` con {"to": "approved"} (`REQ-017` está en borrador).
  - verificar requisito: `POST /api/requirements/REQ-001/transition` con {"to": "verified"} (`REQ-001` está aprobado).
  - validar requisito: `POST /api/requirements/REQ-002/transition` con {"to": "validated"} (`REQ-002` está verificado).
  - ejecutar caso: `POST /api/test-cases/TC-001/runs` con el resultado `pass`, sin archivos.
  - ver documento restringido: `GET /api/documents/DOC-003` (`DOC-003` es restringido).
  - publicar versión: `POST /api/documents/DOC-001/versions` con {"lines": ["Línea de permisos"]}.
  - ver auditoría: `GET /api/audit`.
  - listar usuarios: `GET /api/admin/users`.
  - abrir no conformidad: `POST /api/nc` con {"programCode": "PRG-001", "severity": "minor", "description": "Desviación de prueba de permisos"}.
  - comentar no conformidad: `POST /api/nc/NC-001/comments` con {"body": "Comentario de prueba de permisos"}.
  - editar no conformidad: `PATCH /api/nc/NC-001` con {"severity": "major"}.
  - mover no conformidad: `POST /api/nc/NC-001/transition` con {"to": "in_analysis"} (`NC-001` está abierta).
  - cerrar no conformidad: `POST /api/nc/NC-003/transition` con {"to": "closed", "comment": "Cierre de prueba de permisos"} (`NC-003` está en acción correctiva).
  - editar hito: `PATCH /api/milestones/PRG-001-M01` con {"name": "Hito de permisos"}.
  - eliminar hito: `DELETE /api/milestones/PRG-001-M01`.
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset`, el token de `alumno01@sigpro.lab` y la cabecera `x-tenant: alumno01`, con el caos apagado. Después la cuenta del rol de la fila inicia sesión. Cada fila parte de un tenant recién reiniciado, así que las operaciones que borran o cierran no afectan a otras filas.

## Criterios de aceptación
```gherkin
Característica: Matriz de permisos por rol en la API

  Esquema del escenario: Los permisos de programas
    Dado que en el tenant alumno01, recién reiniciado, la cuenta del rol <rol> ha iniciado sesión con x-tenant alumno01
    Cuando envía <operacion> con su accessToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | rol | operacion | respuesta |
      | admin | crear programa | 201 |
      | program_manager | crear programa | 201 |
      | consultant | crear programa | 403 forbidden |
      | auditor | crear programa | 403 forbidden |
      | admin | editar programa | 200 |
      | program_manager | editar programa | 200 |
      | consultant | editar programa | 403 forbidden |
      | auditor | editar programa | 403 forbidden |
      | admin | archivar programa | 200 |
      | program_manager | archivar programa | 200 |
      | consultant | archivar programa | 403 forbidden |
      | auditor | archivar programa | 403 forbidden |
      | admin | eliminar programa | 204 |
      | program_manager | eliminar programa | 403 forbidden |
      | consultant | eliminar programa | 403 forbidden |
      | auditor | eliminar programa | 403 forbidden |
      | admin | exportar programas | 200 |
      | program_manager | exportar programas | 200 |
      | consultant | exportar programas | 200 |
      | auditor | exportar programas | 200 |

  Esquema del escenario: Los permisos de requisitos
    Dado que en el tenant alumno01, recién reiniciado, la cuenta del rol <rol> ha iniciado sesión con x-tenant alumno01
    Cuando envía <operacion> con su accessToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | rol | operacion | respuesta |
      | admin | crear requisito | 201 |
      | program_manager | crear requisito | 201 |
      | consultant | crear requisito | 201 |
      | auditor | crear requisito | 403 forbidden |
      | admin | editar requisito | 200 |
      | program_manager | editar requisito | 200 |
      | consultant | editar requisito | 200 |
      | auditor | editar requisito | 403 forbidden |
      | admin | eliminar requisito | 204 |
      | program_manager | eliminar requisito | 204 |
      | consultant | eliminar requisito | 403 forbidden |
      | auditor | eliminar requisito | 403 forbidden |
      | admin | aprobar requisito | 200 |
      | program_manager | aprobar requisito | 200 |
      | consultant | aprobar requisito | 403 forbidden |
      | auditor | aprobar requisito | 403 forbidden |
      | admin | verificar requisito | 200 |
      | program_manager | verificar requisito | 403 forbidden |
      | consultant | verificar requisito | 200 |
      | auditor | verificar requisito | 403 forbidden |
      | admin | validar requisito | 200 |
      | program_manager | validar requisito | 403 forbidden |
      | consultant | validar requisito | 403 forbidden |
      | auditor | validar requisito | 200 |

  Esquema del escenario: El permiso de registrar ejecuciones de pruebas
    Dado que en el tenant alumno01, recién reiniciado, la cuenta del rol <rol> ha iniciado sesión con x-tenant alumno01
    Cuando envía <operacion> con su accessToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | rol | operacion | respuesta |
      | admin | ejecutar caso | 201 |
      | program_manager | ejecutar caso | 403 forbidden |
      | consultant | ejecutar caso | 201 |
      | auditor | ejecutar caso | 403 forbidden |

  Esquema del escenario: Los permisos de documentos
    Dado que en el tenant alumno01, recién reiniciado, la cuenta del rol <rol> ha iniciado sesión con x-tenant alumno01
    Cuando envía <operacion> con su accessToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | rol | operacion | respuesta |
      | admin | ver documento restringido | 200 |
      | program_manager | ver documento restringido | 200 |
      | consultant | ver documento restringido | 403 forbidden |
      | auditor | ver documento restringido | 200 |
      | admin | publicar versión | 201 |
      | program_manager | publicar versión | 201 |
      | consultant | publicar versión | 403 forbidden |
      | auditor | publicar versión | 403 forbidden |

  Esquema del escenario: El permiso de auditoría
    Dado que en el tenant alumno01, recién reiniciado, la cuenta del rol <rol> ha iniciado sesión con x-tenant alumno01
    Cuando envía <operacion> con su accessToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | rol | operacion | respuesta |
      | admin | ver auditoría | 200 |
      | program_manager | ver auditoría | 403 forbidden |
      | consultant | ver auditoría | 403 forbidden |
      | auditor | ver auditoría | 200 |

  Esquema del escenario: El permiso de administración de usuarios
    Dado que en el tenant alumno01, recién reiniciado, la cuenta del rol <rol> ha iniciado sesión con x-tenant alumno01
    Cuando envía <operacion> con su accessToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | rol | operacion | respuesta |
      | admin | listar usuarios | 200 |
      | program_manager | listar usuarios | 403 forbidden |
      | consultant | listar usuarios | 403 forbidden |
      | auditor | listar usuarios | 403 forbidden |

  Esquema del escenario: Los permisos de no conformidades
    Dado que en el tenant alumno01, recién reiniciado, la cuenta del rol <rol> ha iniciado sesión con x-tenant alumno01
    Cuando envía <operacion> con su accessToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | rol | operacion | respuesta |
      | admin | abrir no conformidad | 201 |
      | program_manager | abrir no conformidad | 201 |
      | consultant | abrir no conformidad | 201 |
      | auditor | abrir no conformidad | 201 |
      | admin | comentar no conformidad | 201 |
      | program_manager | comentar no conformidad | 201 |
      | consultant | comentar no conformidad | 201 |
      | auditor | comentar no conformidad | 201 |
      | admin | editar no conformidad | 200 |
      | program_manager | editar no conformidad | 200 |
      | consultant | editar no conformidad | 200 |
      | auditor | editar no conformidad | 403 forbidden |
      | admin | mover no conformidad | 200 |
      | program_manager | mover no conformidad | 200 |
      | consultant | mover no conformidad | 200 |
      | auditor | mover no conformidad | 403 forbidden |
      | admin | cerrar no conformidad | 200 |
      | program_manager | cerrar no conformidad | 200 |
      | consultant | cerrar no conformidad | 403 forbidden |
      | auditor | cerrar no conformidad | 403 forbidden |

  Esquema del escenario: Los permisos de hitos
    Dado que en el tenant alumno01, recién reiniciado, la cuenta del rol <rol> ha iniciado sesión con x-tenant alumno01
    Cuando envía <operacion> con su accessToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | rol | operacion | respuesta |
      | admin | editar hito | 200 |
      | program_manager | editar hito | 200 |
      | consultant | editar hito | 403 forbidden |
      | auditor | editar hito | 403 forbidden |
      | admin | eliminar hito | 204 |
      | program_manager | eliminar hito | 204 |
      | consultant | eliminar hito | 403 forbidden |
      | auditor | eliminar hito | 403 forbidden |

  Esquema del escenario: Sin un token válido la respuesta es 401, aunque el rol no tuviera el permiso
    Dado que en el tenant alumno01, recién reiniciado, el recurso de la operación existe con los datos del seed
    Cuando envía <operacion> con la cabecera Authorization <credencial>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | operacion | respuesta |
      | (sin cabecera) | eliminar programa | 401 missing_token |
      | Bearer texto-sin-formato-JWT | eliminar programa | 401 invalid_token |
      | (sin cabecera) | listar usuarios | 401 missing_token |
      | Bearer texto-sin-formato-JWT | ver auditoría | 401 invalid_token |
      | (sin cabecera) | cerrar no conformidad | 401 missing_token |
```

## Fuera de alcance
- Las reglas de validación, de estados y de respuesta de cada operación (campos, transiciones, longitudes, formatos): cada una en la épica de su módulo.
- La comprobación de permisos sobre lo que se ve en pantalla: US-MULTITENANT-PERMISOS-007, 008 y 009.
- El aislamiento entre tenants: US-MULTITENANT-PERMISOS-002 y US-MULTITENANT-PERMISOS-003.
- El reinicio del tenant y el modo caos, con su propia matriz de administración: EP-CAOS-RESET.
