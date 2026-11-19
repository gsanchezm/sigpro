---
id: US-HITOS-005
tipo: historia
epica: EP-HITOS
titulo: "[API] Eliminar un hito del programa"
etiquetas: [api]
relacionadas: [US-HITOS-001, US-HITOS-009, US-HITOS-012]
verificacion: codigo
cubre: ["DELETE /api/milestones/:id"]
permisos: [milestone.delete]
---

## Historia
Como gestor de programas que usa la API (o una suite de pruebas), quiero eliminar un hito que sobra,
para que deje de aparecer en la lista del programa y de contar en su avance.

## Reglas
- `DELETE /api/milestones/:id` exige sesión y el permiso `milestone.delete`, que tienen los roles admin y program_manager. Un rol consultant o auditor recibe 403 `forbidden`, aunque el hito no exista.
- Con éxito responde 204 sin cuerpo. El hito deja de aparecer en la lista de su programa. Los demás hitos no cambian de fecha, de nombre ni de avance.
- El avance del programa se calcula de nuevo con los hitos que quedan: porcentaje entero (redondeado) de hitos cumplidos sobre el total de hitos restantes.
- Un `id` que no es un hito del tenant de la sesión responde 404 `milestone_not_found`, también si ese mismo `id` existe en otro tenant.
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos (`PRG-001-M01` a `PRG-001-M09`), y `PRG-001-M01` (SRR) está cumplido. `PRG-004` tiene 9 hitos, de los que `PRG-004-M01` y `PRG-004-M02` están cumplidos y `PRG-004-M04` (TRR) está pendiente.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `POST /api/auth/login` con la cabecera `x-tenant: alumno01` da el `accessToken` de la cuenta que indique la fila: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o `alumno01@sigpro.lab` (rol admin, sin segundo factor). Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Para la fila del hito de otro tenant: se reinicia también `alumno02` con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`) y, con ese token, `POST /api/programs/PRG-001/milestones` crea un hito en `alumno02`, que recibe el id `PRG-001-M10`. En `alumno01` ese id no existe. Al terminar la fila se reinicia también `alumno02`.

## Criterios de aceptación
```gherkin
Característica: Borrado de hitos por la API

  Esquema del escenario: Eliminar un hito responde 204 y lo quita de la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía DELETE /api/milestones/<hito>
    Y pide GET /api/programs/PRG-001/milestones
    Entonces la respuesta al borrado es 204 y la lista tiene 8 hitos sin <hito>

    Ejemplos:
      | hito |
      | PRG-001-M03 |
      | PRG-001-M01 |

  Esquema del escenario: El avance del programa se calcula sin el hito eliminado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía DELETE /api/milestones/<hito> y después pide GET /api/programs/<programa>
    Entonces el programa tiene progress <progreso>, milestonesDone <cumplidos> y milestonesTotal 8

    Ejemplos:
      | hito | programa | progreso | cumplidos |
      | PRG-001-M01 | PRG-001 | 0 | 0 |
      | PRG-004-M04 | PRG-004 | 25 | 2 |

  Esquema del escenario: Un hito que no existe en el tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y <situacion>
    Cuando envía DELETE /api/milestones/<hito>
    Entonces la respuesta es 404 milestone_not_found y la lista de PRG-001 sigue con 9 hitos

    Ejemplos:
      | hito | situacion |
      | PRG-001-M99 | no existe ningún hito con ese id |
      | PRG-001-M10 | en alumno02 se ha creado ese hito durante la preparación y en alumno01 no existe |

  Esquema del escenario: Solo admin y program_manager eliminan hitos
    Dado que en el tenant alumno01, recién reiniciado, PRG-001 tiene sus 9 hitos del seed
    Cuando envía DELETE /api/milestones/<hito> con <credencial> como Bearer
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | hito | respuesta |
      | el accessToken de consultor@sigpro.test | PRG-001-M03 | 403 forbidden |
      | el accessToken de auditor@sigpro.test | PRG-001-M03 | 403 forbidden |
      | el accessToken de consultor@sigpro.test | PRG-001-M99 | 403 forbidden |
      | el accessToken de gestor@sigpro.test | PRG-001-M03 | 204 |
```

## Fuera de alcance
- El alta, la edición y el avance de hitos: EP-HITOS, en las historias de la API de alta, edición y avance.
- El borrado desde la tabla de la web y desde la app móvil: EP-HITOS, en sus historias de interfaz.
- El borrado del propio programa: EP-PROG-GESTION.
