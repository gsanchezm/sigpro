---
id: US-REQ-EDICION-003
tipo: historia
epica: EP-REQ-EDICION
titulo: "[API] Editar un requisito y devolverlo a borrador al cambiar el texto"
etiquetas: [api]
relacionadas: [US-REQ-EDICION-001, US-REQ-EDICION-009, US-REQ-EDICION-013]
verificacion: ejecutada
cubre: ["PATCH /api/requirements/:code"]
permisos: [requirement.edit]
---

## Historia
Como cliente de la API que mantiene requisitos, quiero cambiar su título, su descripción, su prioridad o sus etiquetas,
para corregir un requisito sabiendo que cambiar su texto lo devuelve a borrador hasta que quien aprueba lo revise.

## Reglas
- `PATCH /api/requirements/:code` exige un `accessToken` y el permiso `requirement.edit`, que tienen `admin`, `program_manager` y `consultant`. Sin cabecera `Authorization` la respuesta es 401 `missing_token`; con el rol `auditor`, 403 `forbidden`.
- El cuerpo admite `title`, `description`, `priority` y `tags`, todos opcionales. Las reglas de valor son las del alta: el título, tras recortar sus espacios, tiene entre 3 y 120 caracteres (motivos `titleShort` y `titleLong`); la descripción, tras sanearla, no supera 4000 caracteres (motivo `descLong`); la prioridad es `low`, `medium` o `high`; las etiquetas son del catálogo y se quitan las repetidas.
- Un cuerpo sin ningún campo responde 422 `validation_failed` con el motivo `nothingToUpdate` en `errors`, sin nombre de campo.
- Un campo con el mismo valor que ya tiene el requisito no cuenta como cambio. Para la descripción, el valor que se compara es el saneado.
- Cambiar el título o la descripción a un valor distinto devuelve el requisito a `draft` si estaba en `approved`, `verified` o `validated`. Un requisito en `draft` sigue en `draft`. Cambiar solo la prioridad o las etiquetas no cambia el estado.
- Una respuesta correcta es 200 con el requisito actualizado. Si la edición devuelve el requisito a borrador, el evento `requirement.updated` de la auditoría indica el estado anterior en `revertedFrom`.
- Un código que no existe en el tenant responde 404 `requirement_not_found` y no cambia nada.
- Convenciones de los ejemplos: `(cuerpo vacío)` es `{}`; `(N letras a)` es un texto de N letras «a» seguidas, sin espacios.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). El token de `gestor@sigpro.test` (contraseña `Gestor1234!`) se obtiene con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`.
- Estado del seed, sin pasos previos: `REQ-001` está en `approved` y se titula «Disponibilidad del subsistema 001»; `REQ-002` está en `verified`; `REQ-003` está en `validated` y se titula «Cifrado del subsistema 003»; `REQ-004` está en `draft`.

## Criterios de aceptación
```gherkin
Característica: Edición de requisitos por la API

  Esquema del escenario: Cada campo que se edita se valida con su motivo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso y REQ-001 está en approved
    Cuando envía PATCH /api/requirements/REQ-001 con x-tenant alumno01 y el cuerpo <cuerpo>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuerpo | respuesta |
      | (cuerpo vacío) | 422 validation_failed con errors igual a nothingToUpdate |
      | title ab | 422 validation_failed con errors.title igual a titleShort |
      | title (121 letras a) | 422 validation_failed con errors.title igual a titleLong |
      | description (4001 letras a) | 422 validation_failed con errors.description igual a descLong |
      | priority urgent | 422 validation_failed con un motivo para priority |
      | tags nope | 422 validation_failed con un motivo para tags |
      | priority low | 200 con priority low y state approved |
      | tags security, regulatory | 200 con tags security y regulatory y state approved |

  Esquema del escenario: Cambiar el texto devuelve el requisito a borrador y cambiar otros campos no
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso y <codigo> tiene state <estado_inicial>
    Cuando envía PATCH /api/requirements/<codigo> con x-tenant alumno01 y el cuerpo <cuerpo>
    Entonces la respuesta es 200 con state <estado_final>

    Ejemplos:
      | codigo | estado_inicial | cuerpo | estado_final |
      | REQ-001 | approved | title Disponibilidad revisada del subsistema 001 | draft |
      | REQ-002 | verified | description Texto revisado del requisito | draft |
      | REQ-003 | validated | title Cifrado del subsistema 003 | validated |
      | REQ-001 | approved | priority low | approved |
      | REQ-004 | draft | title Trazabilidad revisada del subsistema 004 | draft |

  Esquema del escenario: Un código que no existe en el tenant responde 404 y no cambia nada
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía PATCH /api/requirements/<codigo> con x-tenant alumno01 y el cuerpo title Título nuevo de prueba
    Entonces la respuesta es 404 requirement_not_found

    Ejemplos:
      | codigo |
      | REQ-999 |
      | REQ-041 |
```

## Fuera de alcance
- Los permisos de edición por rol y la respuesta 403 de un rol sin permiso: la historia de la API de permisos de esta misma épica.
- La edición desde la web y desde la app móvil, con sus avisos: las historias web y móvil de edición de esta misma épica.
- Aprobar, verificar y validar requisitos, y las transiciones de estado en general: EP-REQ-FLUJO.
