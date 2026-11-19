---
id: EP-PROG-GESTION
tipo: epica
titulo: "Gestión de programas: archivar, duplicar, eliminar, exportar y selección múltiple"
etiquetas: [epic]
---

## Objetivo
Que quien gestiona programas pueda archivarlos, copiarlos, eliminarlos y exportarlos, de uno en uno o en lote y desde la lista, con los mismos permisos, avisos y resultados en la API, en la web y en la app móvil.

## Alcance
- Archivar un programa (pasa a «Cerrado»), duplicarlo como borrador sin hitos y eliminarlo con todo lo que cuelga de él, en la API.
- Exportar la lista de programas a CSV con sus filtros y su orden, en la API, en la web y en la app móvil.
- Los permisos de cada acción por rol: `program.archive`, `program.create` para copiar, `program.delete` y `program.export`.
- En la web: casillas de selección con su contador, menú de acciones de cada programa (en escritorio y en la tarjeta del diseño responsive), acciones masivas y diálogo de confirmación del borrado.
- En la app móvil: el modo «Seleccionar» con sus acciones masivas, el menú de acciones de cada tarjeta y la exportación con la hoja de compartir.

## Plataformas
API; web de escritorio (ancho de 1024 px o más) y diseño responsive por debajo; app móvil común a iOS y Android. Ninguna historia describe un comportamiento propio de un sistema concreto: la hoja de compartir se describe como una hoja del sistema, sin fijar qué aplicaciones ofrece.

## Historias
- US-PROG-GESTION-001: [API] Archivar un programa: su estado pasa a closed y el resto de sus datos no cambia
- US-PROG-GESTION-002: [API] Duplicar un programa como borrador, sin hitos y con el código siguiente
- US-PROG-GESTION-003: [API] Eliminar un programa con todo lo que cuelga de él, sin posibilidad de deshacer
- US-PROG-GESTION-004: [API] Exportar los programas a CSV con los filtros y el orden de la lista
- US-PROG-GESTION-005: [Web] Seleccionar programas con la casilla de cabecera y ver el contador de la selección
- US-PROG-GESTION-006: [Web] Archivar, duplicar y eliminar un programa desde su menú de acciones
- US-PROG-GESTION-007: [Web] Archivar, eliminar o exportar en lote los programas marcados
- US-PROG-GESTION-008: [Web] Confirmar o cancelar el borrado de programas en un diálogo
- US-PROG-GESTION-009: [Web] Exportar a CSV la lista de programas desde la cabecera
- US-PROG-GESTION-010: [Móvil] Seleccionar programas con «Seleccionar» y actuar sobre la selección
- US-PROG-GESTION-011: [Móvil] Archivar, duplicar y eliminar un programa desde el menú de su tarjeta
- US-PROG-GESTION-012: [Móvil] Exportar la lista o la selección de programas con la hoja de compartir

## Fuera de alcance
- La lista de programas, sus filtros, su orden y su paginación: EP-PROG-LISTA.
- La ficha y el panel lateral de un programa: EP-PROG-DETALLE.
- El alta, el asistente y la edición de un programa: EP-PROG-ALTA.
- Las tarjetas de métricas de la cabecera y sus cifras: EP-PROG-METRICAS.
- Cómo se llega a la lista con una sesión iniciada: EP-LOGIN. El segundo factor del administrador: EP-MFA.
- El aislamiento de los datos entre tenants: EP-MULTITENANT-PERMISOS.
- La consulta del registro de auditoría.
