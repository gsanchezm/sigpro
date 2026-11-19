---
id: US-REQ-EDICION-006
tipo: historia
epica: EP-REQ-EDICION
titulo: "[API] Permisos de alta, edición, reordenación y borrado por rol"
etiquetas: [api]
relacionadas: [US-REQ-EDICION-001, US-REQ-EDICION-003, US-REQ-EDICION-004, US-REQ-EDICION-005]
verificacion: codigo
cubre: ["POST /api/requirements", "PATCH /api/requirements/:code", "POST /api/requirements/:code/move", "DELETE /api/requirements/:code"]
permisos: [requirement.create, requirement.edit, requirement.delete]
---

## Historia
Como administrador de un tenant, quiero que cada rol pueda solo las acciones de requisitos que le corresponden,
para que un auditor consulte el árbol sin modificarlo y un consultor no pueda borrar lo que otros aprueban.

## Reglas
- Los permisos de requisitos son estos: `requirement.create` (alta) lo tienen `admin`, `program_manager` y `consultant`; `requirement.edit` (edición y reordenación) lo tienen `admin`, `program_manager` y `consultant`; `requirement.delete` (borrado) lo tienen `admin` y `program_manager`. El rol `auditor` no tiene ninguno de los tres.
- La comprobación de permiso ocurre antes que la validación del cuerpo: un `auditor` que envía un alta sin campos recibe 403, no 422.
- Sin cabecera `Authorization`, las cuatro peticiones responden 401 `missing_token`; con un token que la API no ha emitido, 401 `invalid_token`.
- Un permiso denegado no cambia nada y no deja evento de auditoría.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). El token de cada cuenta de la fila se obtiene con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, con la contraseña del seed de esa cuenta (`gestor@sigpro.test` `Gestor1234!`, `consultor@sigpro.test` `Consul1234!`, `auditor@sigpro.test` `Audit1234!`).
- Las filas que cambian datos usan el requisito `REQ-001` o `REQ-004` del seed, y cada fila parte de un tenant recién reiniciado.

## Criterios de aceptación
```gherkin
Característica: Permisos de requisitos por rol

  Esquema del escenario: Cada rol puede o no puede hacer cada acción de requisitos
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene un token de acceso
    Cuando envía <peticion> con x-tenant alumno01
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | peticion | respuesta |
      | auditor@sigpro.test | POST /api/requirements con programCode PRG-001 y title Requisito de prueba | 403 forbidden |
      | auditor@sigpro.test | POST /api/requirements sin ningún campo | 403 forbidden, antes de la validación |
      | auditor@sigpro.test | PATCH /api/requirements/REQ-001 con title Disponibilidad revisada | 403 forbidden |
      | auditor@sigpro.test | POST /api/requirements/REQ-001/move con targetCode REQ-011 y placement after | 403 forbidden |
      | auditor@sigpro.test | DELETE /api/requirements/REQ-004 | 403 forbidden |
      | consultor@sigpro.test | POST /api/requirements con programCode PRG-001 y title Requisito de prueba | 201 |
      | consultor@sigpro.test | PATCH /api/requirements/REQ-001 con title Disponibilidad revisada | 200 |
      | consultor@sigpro.test | POST /api/requirements/REQ-001/move con targetCode REQ-011 y placement after | 200 |
      | consultor@sigpro.test | DELETE /api/requirements/REQ-004 | 403 forbidden |
      | gestor@sigpro.test | DELETE /api/requirements/REQ-004 | 204 |
      | alumno01@sigpro.lab | DELETE /api/requirements/REQ-004 | 204 |

  Esquema del escenario: Sin un token válido la API no atiende la petición
    Dado que en el tenant alumno01, recién reiniciado, existe REQ-001 en el seed
    Cuando envía <peticion> con <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | peticion | cabecera | respuesta |
      | DELETE /api/requirements/REQ-004 | (sin cabecera Authorization) | 401 missing_token |
      | PATCH /api/requirements/REQ-001 con title Disponibilidad revisada | (token inventado) | 401 invalid_token |
```

## Fuera de alcance
- La forma de cada respuesta y sus motivos de validación: las historias de alta, edición, reordenación y borrado de esta misma épica.
- Los permisos de las transiciones de estado (aprobar, verificar y validar): EP-REQ-FLUJO.
