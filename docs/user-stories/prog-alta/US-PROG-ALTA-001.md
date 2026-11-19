---
id: US-PROG-ALTA-001
tipo: historia
epica: EP-PROG-ALTA
titulo: "[API] Crear un programa con los datos del alta"
etiquetas: [api]
relacionadas: [US-PROG-ALTA-002, US-PROG-ALTA-005, US-PROG-ALTA-008, US-PROG-ALTA-012]
verificacion: ejecutada
cubre: ["POST /api/programs"]
permisos: [program.create]
---

## Historia
Como gestor de programas o administrador que da de alta un programa, quiero enviar sus datos a la API y recibir el programa creado con su código,
para que quede en la lista identificado con ese código y con los valores que no envié por defecto.

## Reglas
- `POST /api/programs` crea un programa del tenant del token y responde 201 con el programa: `code`, `name`, `description`, `status`, `priority`, `classified`, `ownerId`, `ownerName`, `startDate`, `endDate`, `budgetEur`, `progress`, `milestonesDone` y `milestonesTotal`.
- Campos obligatorios del cuerpo: `name`, `ownerId`, `startDate`, `endDate` y `budget`. Opcionales: `description`, `status`, `priority` y `classified`. El cuerpo admite también `notify`, un booleano que no cambia la respuesta del alta.
- En las tablas, «nombre» es `name`; «propietario», `ownerId` (el id de la persona); «inicio», `startDate`; «fin», `endDate`; «presupuesto», `budget`; «prioridad», `priority`; «clasificado», `classified`; «estado», `status`, y «descripción», `description`.
- Cuerpo base de los ejemplos: nombre `Programa de prueba alfa`, propietario `u2` (Javier Ortega), inicio `2027-03-01`, fin `2027-03-02` y presupuesto `900000`. Cada Esquema cambia solo lo que dice su tabla.
- Un campo opcional que no se envía toma su valor por defecto: descripción vacía, estado `draft` (borrador), prioridad `medium` (media) y clasificado `false`.
- El código lo asigna la API: el siguiente al mayor código del tenant, con el formato `PRG-` seguido de tres cifras. Tras el reinicio del tenant, el primer alta recibe `PRG-025`, porque la semilla llega hasta `PRG-024`; un alta posterior recibe el siguiente.
- El alta queda en la auditoría del tenant con la acción `program.created` y el código asignado.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la cuenta de la fila obtiene su token de acceso con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`. Las peticiones de programas llevan esa cabecera y el token en `Authorization: Bearer`. Tras el reinicio, el tenant tiene los programas `PRG-001` a `PRG-024` de la semilla.

## Criterios de aceptación
```gherkin
Característica: Alta de un programa por la API

  Esquema del escenario: Un alta válida crea el programa con el código siguiente
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene un token de acceso
    Cuando envía POST /api/programs con x-tenant alumno01, ese token y el cuerpo base
    Entonces la respuesta es 201 con el código PRG-025 y el responsable Javier Ortega
    Y GET /api/programs/PRG-025 con ese token devuelve el mismo programa, en borrador, con prioridad medium, sin clasificar y con la descripción vacía
    Y una segunda alta con el nombre Programa de prueba beta recibe el código PRG-026

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | alumno01@sigpro.lab |
```

## Fuera de alcance
- Los motivos de cada dato no válido del alta: EP-PROG-ALTA, historia de validación del alta por la API.
- La edición de un programa: EP-PROG-ALTA, historias de edición por la API.
- Los permisos por rol de alta y edición: EP-PROG-ALTA, historia de permisos.
- El aviso por correo al equipo que ofrece el asistente: EP-PROG-ALTA, historia no implementada de aviso por correo.
- Archivar o duplicar un programa: EP-PROG-GESTION.
