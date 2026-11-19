---
id: US-REQ-EDICION-004
tipo: historia
epica: EP-REQ-EDICION
titulo: "[API] Borrar un requisito con sus descendientes y sus enlaces"
etiquetas: [api]
relacionadas: [US-REQ-EDICION-006, US-REQ-EDICION-011, US-REQ-EDICION-015]
verificacion: codigo
cubre: ["DELETE /api/requirements/:code"]
permisos: [requirement.delete]
---

## Historia
Como cliente de la API con un rol que administra el árbol de un programa, quiero borrar un requisito,
para quitarlo del programa junto con todo lo que cuelga de él, sin tocar los casos de prueba que tenía enlazados.

## Reglas
- `DELETE /api/requirements/:code` exige un `accessToken` y el permiso `requirement.delete`, que tienen `admin` y `program_manager`. Sin cabecera `Authorization` la respuesta es 401 `missing_token`. Con `consultant` o `auditor` la respuesta es 403 `forbidden`, aunque el código no exista.
- Una petición correcta responde 204 sin cuerpo.
- Se borran el requisito y todos sus descendientes, a cualquier nivel, con sus enlaces con casos de prueba. Los descendientes están en el mismo programa.
- Los casos de prueba enlazados no se borran: siguen existiendo con sus ejecuciones; solo desaparece el enlace.
- Los hermanos y el resto del árbol no cambian de posición. Puede quedar un hueco en `position`, sin efecto sobre el orden.
- Un código que no existe en el tenant responde 404 `requirement_not_found` y no se borra nada.
- Un borrado correcto deja un evento `requirement.deleted` en la auditoría; una petición rechazada no deja evento.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Los tokens de `gestor@sigpro.test`, `consultor@sigpro.test` y `auditor@sigpro.test` se obtienen con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`.
- Estado del seed, sin pasos previos: `REQ-001` tiene como descendientes `REQ-002`, `REQ-003`, `REQ-004` y `REQ-005`; `REQ-006` tiene como descendientes `REQ-007`, `REQ-008`, `REQ-009` y `REQ-010`; `REQ-004` no tiene descendientes. `REQ-004` está enlazado con `TC-004`, y `REQ-001` con `TC-001`.

## Criterios de aceptación
```gherkin
Característica: Borrado de requisitos por la API

  Esquema del escenario: El borrado quita el requisito y todos sus descendientes
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía DELETE /api/requirements/<codigo> con x-tenant alumno01
    Entonces la respuesta es 204
    Y cada uno de <borrados> responde 404 requirement_not_found al pedirlo con GET /api/requirements/:code
    Y siguen existiendo <siguen>

    Ejemplos:
      | codigo | borrados | siguen |
      | REQ-004 | REQ-004 | REQ-003 y REQ-005 |
      | REQ-001 | REQ-001, REQ-002, REQ-003, REQ-004 y REQ-005 | REQ-006 y REQ-011 |
      | REQ-006 | REQ-006, REQ-007, REQ-008, REQ-009 y REQ-010 | REQ-001 y REQ-011 |

  Esquema del escenario: El borrado quita los enlaces con los casos de prueba y no borra los casos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso y <codigo> está enlazado con <caso>
    Cuando envía DELETE /api/requirements/<codigo> con x-tenant alumno01
    Entonces la respuesta es 204
    Y GET /api/programs/PRG-001/traceability ya no lista el enlace entre <codigo> y <caso>
    Y GET /api/test-cases/<caso> responde 200

    Ejemplos:
      | codigo | caso |
      | REQ-004 | TC-004 |
      | REQ-001 | TC-001 |

  Esquema del escenario: Un código que no existe en el tenant responde 404 y no borra nada
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía DELETE /api/requirements/<codigo> con x-tenant alumno01
    Entonces la respuesta es 404 requirement_not_found y el programa PRG-001 conserva sus 14 requisitos

    Ejemplos:
      | codigo |
      | REQ-999 |
      | REQ-041 |
```

## Fuera de alcance
- La matriz de trazabilidad completa y la consulta de la auditoría: EP-REQ-TRAZA.
- La confirmación del borrado en la web y en la app móvil: esta misma épica, en sus historias de borrado de cada plataforma.
