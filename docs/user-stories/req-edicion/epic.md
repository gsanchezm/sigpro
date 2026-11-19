---
id: EP-REQ-EDICION
tipo: epica
titulo: "Alta, edición, borrado y reordenación de requisitos"
etiquetas: [epic]
---

## Objetivo
Que una persona con un rol que puede editar requisitos añada, corrija, reordene y borre los requisitos de un programa de su tenant, con las mismas reglas en la API, en la web y en la app móvil: los campos obligatorios y sus motivos, el padre dentro del mismo programa, la vuelta a borrador al cambiar el texto y el borrado de los descendientes.

## Alcance
- `POST /api/requirements`: alta en borrador, con código asignado, padre opcional y motivos de rechazo.
- `PATCH /api/requirements/:code`: edición de título, descripción, prioridad y etiquetas, y vuelta a borrador al cambiar el texto.
- `POST /api/requirements/:code/move`: reordenación entre hermanos.
- `DELETE /api/requirements/:code`: borrado del requisito con sus descendientes y de sus enlaces con casos de prueba.
- Permisos `requirement.create`, `requirement.edit` y `requirement.delete` por rol.
- En la web y en la app móvil, en `/programs/:code/requirements`: el alta, la edición, la reordenación y el borrado, con sus avisos.

## Plataformas
API, web y móvil común a iOS y Android. Ningún comportamiento depende del sistema nativo.

## Historias
- US-REQ-EDICION-001: [API] Dar de alta un requisito en borrador
- US-REQ-EDICION-002: [API] Rechazar un alta con sus motivos
- US-REQ-EDICION-003: [API] Editar un requisito y devolverlo a borrador al cambiar el texto
- US-REQ-EDICION-004: [API] Borrar un requisito con sus descendientes y sus enlaces
- US-REQ-EDICION-005: [API] Reordenar un requisito entre sus hermanos
- US-REQ-EDICION-006: [API] Permisos de alta, edición, reordenación y borrado por rol
- US-REQ-EDICION-007: [API] Cambiar el padre de un requisito al reordenarlo
- US-REQ-EDICION-008: [Web] Dar de alta un requisito desde «Nuevo requisito»
- US-REQ-EDICION-009: [Web] Editar un requisito en su panel y en su fila
- US-REQ-EDICION-010: [Web] Reordenar con Subir, Bajar, el teclado y arrastrando
- US-REQ-EDICION-011: [Web] Eliminar un requisito con su confirmación
- US-REQ-EDICION-012: [Móvil] Dar de alta un requisito desde la lista
- US-REQ-EDICION-013: [Móvil] Editar un requisito en la hoja
- US-REQ-EDICION-014: [Móvil] Mover un requisito con «Mover a…»
- US-REQ-EDICION-015: [Móvil] Eliminar un requisito desde la hoja
- US-REQ-EDICION-016: [Móvil] Añadir un requisito hijo desde la hoja de otro requisito

## Fuera de alcance
- La lectura del árbol, la búsqueda y los datos que se muestran de cada requisito: EP-REQ-ARBOL.
- Las transiciones de estado (aprobar, verificar, validar y volver a borrador): EP-REQ-FLUJO.
- Los enlaces entre requisitos y casos de prueba, y la matriz de trazabilidad: EP-REQ-TRAZA.
- La creación y el borrado de programas: EP-PROG-ALTA y EP-PROG-GESTION.
- El inicio de sesión con el que se llega a los requisitos: EP-LOGIN.
