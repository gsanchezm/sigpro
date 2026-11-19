---
id: US-NC-GESTION-003
tipo: historia
epica: EP-NC-GESTION
titulo: "[API] Editar la severidad, la descripción o la asignación de una no conformidad"
etiquetas: [api]
relacionadas: [US-NC-GESTION-001, US-NC-GESTION-002, US-NC-GESTION-007, US-NC-GESTION-011]
verificacion: codigo
cubre: ["PATCH /api/nc/:code"]
permisos: [nc.edit]
---

## Historia
Como cliente de la API que mantiene una no conformidad, quiero cambiar su severidad, su descripción o su persona responsable sin reenviar el resto de sus datos,
para corregir lo que cambia sin tocar lo que sigue siendo cierto.

## Reglas
- `PATCH /api/nc/:code` cambia solo los campos que se envían: `severity`, `description` y `assigneeId`. Un campo que no se envía no cambia. `assigneeId: null` quita a la persona responsable.
- Lo pueden usar `admin`, `program_manager` y `consultant`, que tienen el permiso `nc.edit`. El rol `auditor` recibe 403 `forbidden` y la no conformidad no cambia.
- Un cuerpo sin ningún campo responde 422 `validation_failed` con el motivo `nothingToUpdate` (el motivo no lleva nombre de campo).
- Si la no conformidad no existe en el tenant, responde 404 `nc_not_found`.
- Un valor igual al que ya tiene la no conformidad no cambia nada y responde 200 con sus datos actuales.
- La respuesta es 200 con el detalle completo de la no conformidad: sus datos, sus comentarios y los estados a los que puede pasar.
- La descripción se valida como en el alta: debe tener al menos 10 caracteres de texto sin formato (motivo `descShort`).
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, cada cuenta obtiene su token con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`) y `auditor@sigpro.test` (`Audit1234!`). La no conformidad NC-003 del seed tiene la severidad `critical`, la descripción «Desviación detectada en la ejecución 003: el resultado no cumple el criterio de aceptación.» y está asignada a `u4` (Andrés Molina).
- En los ejemplos, `(N letras a)` es un texto de N letras `a` seguidas, sin espacios.

## Criterios de aceptación
```gherkin
Característica: Edición de una no conformidad por la API

  Esquema del escenario: Un rol con permiso de edición cambia los campos enviados
    Dado que en el tenant alumno01, recién reiniciado, <correo> inicia sesión con POST /api/auth/login
    Cuando envía PATCH /api/nc/NC-003 con x-tenant alumno01, su token y el cuerpo <cuerpo>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | correo | cuerpo | respuesta |
      | consultor@sigpro.test | {"severity": "minor"} | 200 con severity minor y el resto de datos sin cambios |
      | gestor@sigpro.test | {"assigneeId": "u3"} | 200 con assigneeId u3 y assigneeName Lucía Fernández |
      | gestor@sigpro.test | {"assigneeId": null} | 200 con assigneeId null y assigneeName null |
      | gestor@sigpro.test | {"severity": "critical"} | 200 con severity critical, igual que antes |

  Esquema del escenario: El rol auditor no puede editar y una no conformidad inexistente no responde
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test y auditor@sigpro.test inician sesión con POST /api/auth/login
    Cuando envía PATCH /api/nc/<codigo> con x-tenant alumno01, el token de <correo> y el cuerpo {"severity": "minor"}
    Entonces la respuesta es <respuesta>
    Y NC-003 sigue con severity critical

    Ejemplos:
      | codigo | correo | respuesta |
      | NC-003 | auditor@sigpro.test | 403 forbidden |
      | NC-999 | gestor@sigpro.test | 404 nc_not_found |

  Esquema del escenario: Cada campo editado se valida con el mismo motivo que en el alta
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía PATCH /api/nc/NC-003 con x-tenant alumno01, ese token y el campo <campo> con el valor <valor>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | campo | valor | respuesta |
      | severity | enorme | 422 validation_failed con el motivo severityRequired en severity |
      | description | (9 letras a) | 422 validation_failed con el motivo descShort en description |
      | description | (10 letras a) | 200 con la descripción (10 letras a) como texto |
      | description | (11 letras a) | 200 con la descripción (11 letras a) como texto |
      | assigneeId | u99 | 422 validation_failed con el motivo badAssignee en assigneeId |

  Esquema del escenario: Un cuerpo sin campos no cambia la no conformidad
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía PATCH /api/nc/NC-003 con x-tenant alumno01, ese token y el cuerpo <cuerpo>
    Entonces la respuesta es 422 validation_failed con el motivo nothingToUpdate
    Y NC-003 sigue con su severidad, su descripción y su persona responsable de antes

    Ejemplos:
      | cuerpo |
      | (vacío) |

## Fuera de alcance
- El alta de la no conformidad y sus motivos de rechazo: US-NC-GESTION-001 y US-NC-GESTION-002.
- La pantalla de edición de la web y de la app móvil: US-NC-GESTION-007 y US-NC-GESTION-011.
- El cambio de estado de la no conformidad, incluido el cierre: EP-NC-TABLERO y US-NC-GESTION-005.
- Los registros de auditoría de cada cambio: EP-AUDITORIA.

## Decisiones pendientes
- Si se puede editar la severidad, la descripción o la asignación de una no conformidad cerrada o rechazada. Hoy la API lo acepta y esta historia no lo afirma ni lo excluye.
