---
id: US-PROG-ALTA-003
tipo: historia
epica: EP-PROG-ALTA
titulo: "[API] Editar un programa enviando solo los campos que cambian"
etiquetas: [api]
relacionadas: [US-PROG-ALTA-004, US-PROG-ALTA-005, US-PROG-ALTA-010, US-PROG-ALTA-013]
verificacion: ejecutada
cubre: ["PATCH /api/programs/:code"]
permisos: [program.edit]
---

## Historia
Como gestor de programas que corrige un dato de un programa, quiero enviar a la API solo el campo que cambia y recibir el programa actualizado,
para que el resto de sus datos siga igual que antes de la corrección.

## Reglas
- `PATCH /api/programs/:code` edita el programa `:code` del tenant del token y responde 200 con el programa actualizado, con el mismo formato que la respuesta del alta.
- Es una edición parcial: solo cambian los campos que llegan en el cuerpo. Un campo que no llega conserva su valor; no se repone por defecto.
- Campos editables: `name` (en las tablas, «nombre»), `description` («descripción»), `ownerId` («propietario», el id de la persona), `status` («estado»), `priority` («prioridad»), `classified` («clasificado»), `startDate` («inicio»), `endDate` («fin») y `budget` («presupuesto»).
- Un valor no válido se rechaza con el mismo motivo que en el alta: `requiredName` para un nombre de menos de tres caracteres, `dupName` para un nombre repetido o con «duplicado», `requiredOwner` para un propietario que no es de la lista, `endAfterStart` para un fin que no va después del inicio, `budgetPositive` para un presupuesto que no es mayor que 0, y un motivo por campo para una prioridad que no es `low`, `medium` o `high`. Una edición rechazada no cambia el programa.
- Un código que no existe en el tenant responde 404 con `code: "program_not_found"`. Un programa de otro tenant no se encuentra con ese código.
- Cada edición queda en la auditoría del tenant con la acción `program.updated` y la lista de campos que cambiaron.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `gestor@sigpro.test` (contraseña `Gestor1234!`) obtiene su token de acceso con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`. Tras el reinicio, `PRG-001` es «Sistema de mando táctico Ártemis», con responsable `u1` (Marta Ruiz), estado `active`, prioridad `medium`, clasificado `true`, presupuesto `450000`, inicio `2023-01-01` y fin `2024-07-01`. `PRG-024` existe también.
- En los ejemplos, `(sin el campo)` es un campo que no se envía.

## Criterios de aceptación
```gherkin
Característica: Edición parcial de un programa por la API

  Esquema del escenario: Un campo enviado cambia y el resto del programa no cambia
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso y PRG-001 tiene los datos de la semilla
    Cuando envía PATCH /api/programs/PRG-001 con x-tenant alumno01, ese token y solo el campo <campo> con el valor <valor>
    Entonces la respuesta es 200 con el campo <campo> como <resultado>
    Y el resto de campos de PRG-001 siguen con los valores de la semilla

    Ejemplos:
      | campo | valor | resultado |
      | nombre | Radar nuevo de prueba | Radar nuevo de prueba |
      | descripción | Descripción nueva | Descripción nueva |
      | propietario | u3 | u3 con ownerName Lucía Fernández |
      | estado | on_hold | on_hold |
      | prioridad | high | high |
      | clasificado | false | false |
      | presupuesto | 500000 | budgetEur 500000 |

  Esquema del escenario: Solo un programa existente en el tenant se edita
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía PATCH /api/programs/<codigo> con x-tenant alumno01, ese token y solo el campo nombre con el valor Radar nuevo de prueba
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | codigo | respuesta |
      | PRG-024 | 200 con el nombre Radar nuevo de prueba |
      | PRG-025 | 404 program_not_found |
      | PRG-000 | 404 program_not_found |
```

## Fuera de alcance
- Las comprobaciones de la edición cuando solo llega una fecha, y el cuerpo sin campos: EP-PROG-ALTA, historia de validación de la edición por la API.
- Los permisos que rechazan la edición de un rol sin permiso: EP-PROG-ALTA, historia de permisos por rol.
- La pantalla de edición de la web y de la app móvil: EP-PROG-ALTA, historias de edición de cada plataforma.
- Archivar un programa, que también cambia su estado: EP-PROG-GESTION.
