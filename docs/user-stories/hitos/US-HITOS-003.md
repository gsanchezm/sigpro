---
id: US-HITOS-003
tipo: historia
epica: EP-HITOS
titulo: "[API] Editar el nombre y la fecha límite de un hito"
etiquetas: [api]
relacionadas: [US-HITOS-001, US-HITOS-007, US-HITOS-011]
verificacion: ejecutada
cubre: ["PATCH /api/milestones/:id"]
permisos: [milestone.edit]
---

## Historia
Como gestor de programas que usa la API (o una suite de pruebas), quiero cambiar el nombre o la fecha límite de un hito,
para corregir la planificación sin borrar el hito y perder su avance.

## Reglas
- `PATCH /api/milestones/:id` exige sesión y el permiso `milestone.edit`, que tienen los roles admin y program_manager. Un rol consultant o auditor recibe 403 `forbidden`, aunque el cuerpo no sea válido o el hito no exista.
- El cuerpo puede llevar `name` y `dueDate`, cada uno opcional. Las reglas de cada campo son las del alta: el nombre se recorta y tiene entre 2 y 80 caracteres después de recortarlo, y la fecha tiene la forma AAAA-MM-DD y existe en el calendario.
- Un cuerpo sin ningún campo responde 422 `validation_failed` con el motivo `nothingToUpdate`, que no va asociado a ningún campo.
- Un valor igual al que ya tiene el hito no cambia nada: la respuesta es 200 con el hito tal como estaba.
- Con cambios válidos, la respuesta es 200 con el hito actualizado. El `id` no cambia. Si cambia la fecha límite, el hito pasa a ocupar el lugar que le corresponde en la lista de su programa.
- Un `id` que no es un hito del tenant de la sesión responde 404 `milestone_not_found`, también si ese mismo `id` existe en otro tenant.
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos (`PRG-001-M01` a `PRG-001-M09`) y `PRG-001-M01` se llama SRR, está cumplido y tiene la fecha que da el seed.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `POST /api/auth/login` con la cabecera `x-tenant: alumno01` da el `accessToken` de la cuenta que indique la fila: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o `alumno01@sigpro.lab` (rol admin, sin segundo factor). Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Para la fila del hito de otro tenant: se reinicia también `alumno02` con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`) y, con ese token, `POST /api/programs/PRG-001/milestones` crea un hito en `alumno02`, que recibe el id `PRG-001-M10`. En `alumno01` ese id no existe. Al terminar la fila se reinicia también `alumno02`.

## Criterios de aceptación
```gherkin
Característica: Edición de hitos por la API

  Esquema del escenario: Un cambio guarda solo los campos enviados
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía PATCH /api/milestones/PRG-001-M01 con <cambio>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cambio | respuesta |
      | solo el nombre (espacios delante y detrás de Revisión PDR) | 200 con name Revisión PDR y dueDate igual que antes |
      | solo la fecha límite 2027-03-15 | 200 con name SRR y dueDate 2027-03-15 |
      | el nombre Revisión PDR y la fecha límite 2027-03-15 | 200 con name Revisión PDR y dueDate 2027-03-15 |
      | el nombre SRR, que ya tiene | 200 con name SRR y sin cambios |
      | (sin campos) | 422 validation_failed con el motivo nothingToUpdate y sin motivo de ningún campo |

  Esquema del escenario: Cambiar la fecha límite reordena la lista del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía PATCH /api/milestones/<hito> con la fecha límite <fecha>
    Y pide GET /api/programs/PRG-001/milestones
    Entonces <hito> es <posicion> de la lista

    Ejemplos:
      | hito | fecha | posicion |
      | PRG-001-M01 | 2027-03-15 | el último |
      | PRG-001-M09 | 2022-12-31 | el primero |

  Esquema del escenario: El nombre y la fecha límite se validan como en el alta
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía PATCH /api/milestones/PRG-001-M01 con el campo <campo> igual a <valor>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | campo | valor | respuesta |
      | name | (tres espacios) | 422 validation_failed con el motivo nameShort en name |
      | name | (81 caracteres) | 422 validation_failed con el motivo nameLong en name |
      | name | (80 caracteres) | 200 con ese nombre |
      | name | Ab | 200 con name Ab |
      | dueDate | (vacío) | 422 validation_failed con el motivo dateInvalid en dueDate |
      | dueDate | 2027-02-29 | 422 validation_failed con el motivo dateInvalid en dueDate |
      | dueDate | 2028-02-29 | 200 con dueDate 2028-02-29 |

  Esquema del escenario: Solo admin y program_manager editan hitos
    Dado que en el tenant alumno01, recién reiniciado, PRG-001 tiene sus 9 hitos del seed
    Cuando envía PATCH /api/milestones/PRG-001-M01 con <credencial> como Bearer y el nombre <nombre>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | nombre | respuesta |
      | el accessToken de consultor@sigpro.test | Revisión PDR | 403 forbidden |
      | el accessToken de consultor@sigpro.test | (tres espacios) | 403 forbidden |
      | el accessToken de auditor@sigpro.test | Revisión PDR | 403 forbidden |
      | el accessToken de alumno01@sigpro.lab | Revisión PDR | 200 con name Revisión PDR |

  Esquema del escenario: Un hito que no existe en el tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y <situacion>
    Cuando envía PATCH /api/milestones/<hito> con el nombre Revisión PDR
    Entonces la respuesta es 404 milestone_not_found

    Ejemplos:
      | hito | situacion |
      | PRG-001-M99 | no existe ningún hito con ese id |
      | PRG-001-M10 | en alumno02 se ha creado ese hito durante la preparación y en alumno01 no existe |
```

## Fuera de alcance
- El alta de hitos: EP-HITOS, en la historia de la API de alta.
- El avance y el cumplido de un hito: EP-HITOS, en la historia de la API de avance.
- El borrado de hitos: EP-HITOS, en la historia de la API de borrado.
- La edición en línea de la tabla de la web y la hoja «Editar hito» de la app móvil: EP-HITOS, en sus historias de interfaz.
