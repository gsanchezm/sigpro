---
id: EP-PROG-ALTA
tipo: epica
titulo: "Alta y edición de programas"
etiquetas: [epic]
---

## Objetivo
Que quien gestiona programas pueda crear uno nuevo con sus datos y corregirlo después, con las mismas reglas en la API, en la web y en la app móvil: nombre, responsable, estado, fechas, presupuesto, prioridad y clasificación, y el código `PRG-NNN` que asigna el sistema.

## Alcance
- Alta por la API (`POST /api/programs`): código asignado, valores por defecto y un motivo por cada dato no válido.
- Edición parcial por la API (`PATCH /api/programs/:code`) y lista de personas que pueden ser responsables (`GET /api/users/owners`).
- Asistente de alta de tres pasos en la web y en la app móvil, con el selector de responsable.
- Pantalla de edición `/programs/:code/edit` en la web y en la app móvil.
- Permisos `program.create` y `program.edit`: los tienen los roles administrador y gestor de programas.

## Plataformas
API, web y móvil común a iOS y Android. No hay aquí un comportamiento propio de uno de los sistemas nativos.

## Historias
- US-PROG-ALTA-001: [API] Crear un programa con los datos del alta
- US-PROG-ALTA-002: [API] Rechazar el alta con un motivo por cada dato no válido
- US-PROG-ALTA-003: [API] Editar un programa enviando solo los campos que cambian
- US-PROG-ALTA-004: [API] Validar la edición: nombre, propietario, fechas y cuerpo vacío
- US-PROG-ALTA-005: [API] Permisos de alta y edición por rol
- US-PROG-ALTA-006: [API] Listar las personas que pueden ser responsables
- US-PROG-ALTA-007: [Web] Abrir el asistente de alta y validar sus dos primeros pasos
- US-PROG-ALTA-008: [Web] Revisar, crear o cancelar el alta desde el asistente
- US-PROG-ALTA-009: [Web] Elegir el responsable con búsqueda en el asistente
- US-PROG-ALTA-010: [Web] Editar un programa y guardar o cerrar la edición
- US-PROG-ALTA-011: [Web] Avisos y accesos de la edición de un programa
- US-PROG-ALTA-012: [Móvil] Crear un programa con el asistente en una hoja
- US-PROG-ALTA-013: [Móvil] Editar un programa y guardar o cerrar la edición
- US-PROG-ALTA-014: [Web] Avisar al equipo por correo al crear un programa

## Fuera de alcance
- Archivar, duplicar, eliminar, exportar y la selección múltiple de programas: EP-PROG-GESTION.
- La lista de programas, sus filtros, su orden y su paginación: EP-PROG-LISTA.
- El detalle de un programa, sus pestañas, sus hitos y sus proveedores: EP-PROG-DETALLE.
- Requisitos del programa (`/programs/:code/requirements`): otra épica de requisitos, todavía sin escribir en `docs/user-stories/`.
- El inicio de sesión de quien crea o edita un programa: EP-LOGIN.
