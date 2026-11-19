---
id: EP-REQ-FLUJO
tipo: epica
titulo: "Flujo de estados de los requisitos y sus permisos"
etiquetas: [epic]
---

## Objetivo
Que cada requisito avance por sus estados (borrador, aprobado, verificado y validado) solo por los pasos que el flujo admite, que cada paso lo dé solo quien tiene el permiso de ese paso, y que cada cambio quede registrado, con los mismos avisos y confirmaciones en la API, en la web y en la app móvil.

## Alcance
- `POST /api/requirements/:code/transition` en la API: los seis pasos válidos, los pares que no existen, el permiso de cada paso (`requirement.approve`, `requirement.verify` y `requirement.validate`), el orden de las comprobaciones, los errores del cuerpo y del código, y los efectos de un paso (estado, registro de auditoría y resto del requisito intacto).
- En la web, en el detalle de un requisito de `/programs/:code/requirements`: los botones del paso actual, su explicación cuando están deshabilitados, la confirmación, el aviso de éxito, el error dentro del diálogo, el nombre del estado y el flujo de aprobación.
- En la app móvil, en la hoja del requisito de la misma ruta: los mismos botones, la misma confirmación y el mismo error, y el botón atrás de Android al cerrar la confirmación.

## Plataformas
API, web de escritorio y diseño responsive, y app móvil común a iOS y Android. Hay una historia de Android porque el botón atrás del sistema cambia lo que ocurre al cerrar la confirmación. No hay historias de iOS, porque en esta épica no se ha identificado un comportamiento del flujo que dependa de ese sistema.

## Historias
- US-REQ-FLUJO-001: [API] Dar un paso válido de la máquina de estados con el rol que lo puede dar
- US-REQ-FLUJO-002: [API] Rechazar con 409 invalid_transition un paso que la máquina de estados no tiene
- US-REQ-FLUJO-003: [API] Rechazar con 403 forbidden un paso válido que el rol no puede dar
- US-REQ-FLUJO-004: [API] Responder 401, 422 o 404 sin cambiar el estado, en el orden de las comprobaciones
- US-REQ-FLUJO-005: [API] Registrar cada paso aceptado en la auditoría y dejar intacto el resto del requisito
- US-REQ-FLUJO-006: [Web] Mostrar en el paso actual los botones de transición, habilitados o con su motivo
- US-REQ-FLUJO-007: [Web] Confirmar o cancelar el cambio de estado en un diálogo y ver el aviso de éxito
- US-REQ-FLUJO-008: [Web] Mostrar el error del servidor dentro del diálogo sin cambiar el estado
- US-REQ-FLUJO-009: [Web] Leer el estado con su nombre y el flujo de aprobación en sus cuatro pasos
- US-REQ-FLUJO-010: [Móvil] Mostrar en la hoja del requisito los botones de transición y sus motivos
- US-REQ-FLUJO-011: [Móvil] Confirmar, cancelar o ver el error del cambio de estado en la hoja
- US-REQ-FLUJO-012: [Android] Cerrar la confirmación del cambio de estado con el botón atrás del sistema

## Fuera de alcance
- La lectura del árbol, de las cifras y del detalle de un requisito, sin sus botones de transición: EP-REQ-ARBOL.
- Crear, editar, borrar y reordenar requisitos. Editar el título o la descripción de un requisito lo devuelve a borrador: EP-REQ-EDICION.
- Enlazar casos de prueba y la matriz de trazabilidad: EP-REQ-TRAZA.
- La pantalla del registro de auditoría (filtros, búsqueda y paginación): EP-AUDITORIA.
- El inicio de sesión y el segundo factor con los que se llega a los requisitos: EP-LOGIN y EP-MFA.
