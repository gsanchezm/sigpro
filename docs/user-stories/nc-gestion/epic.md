---
id: EP-NC-GESTION
tipo: epica
titulo: "Gestión de no conformidades: alta, edición, asignación, comentarios y cierre"
etiquetas: [epic]
---

## Objetivo
Que quien trabaja con una desviación pueda abrir una no conformidad de un programa, corregir su severidad, su descripción y su responsable, comentarla y cerrarla con una justificación de al menos 20 caracteres, en la API, en la web y en la app móvil, con las mismas reglas y los mismos mensajes.

## Alcance
- Alta de una no conformidad con `POST /api/nc`: programa, severidad y descripción obligatorios, asignación opcional, código `NC-NNN` correlativo y estado «Abierta».
- Edición de la severidad, la descripción y el responsable con `PATCH /api/nc/:code`, incluida la quita del responsable.
- Comentarios con `POST /api/nc/:code/comments`, normales y rápidos, con texto obligatorio y longitud máxima.
- Cierre con un comentario de cierre de al menos 20 caracteres, que se aplica en el paso a «Cerrada» (`POST /api/nc/:code/transition`) y exige el permiso `nc.close`.
- Permisos por rol de estas acciones: abrir y comentar para todos los roles; editar para admin, gestor y consultor; cerrar para admin y gestor.
- Pantallas de alta y de detalle (edición, asignación, comentarios y cierre) en la web, en `/nc` y `/nc/:code`, y en la app móvil, en `/nc`, con sus avisos.
- Lo que la app móvil todavía no tiene respecto de la web (formato enriquecido de la descripción), como capacidad futura.

## Plataformas
API, web y app móvil (común a iOS y Android; ningún comportamiento depende del sistema).

## Historias
- US-NC-GESTION-001: [API] Dar de alta una no conformidad con código NC-NNN
- US-NC-GESTION-002: [API] Rechazar el alta de una no conformidad con motivos de validación
- US-NC-GESTION-003: [API] Editar la severidad, la descripción o la asignación de una no conformidad
- US-NC-GESTION-004: [API] Añadir un comentario a una no conformidad
- US-NC-GESTION-005: [API] Cerrar una no conformidad con un comentario de cierre de al menos 20 caracteres
- US-NC-GESTION-006: [Web] Abrir una no conformidad desde el formulario de alta
- US-NC-GESTION-007: [Web] Editar la severidad, la descripción y la asignación en el detalle de una no conformidad
- US-NC-GESTION-008: [Web] Comentar una no conformidad en su hilo de comentarios
- US-NC-GESTION-009: [Web] Cerrar una no conformidad con el comentario de cierre
- US-NC-GESTION-010: [Móvil] Abrir una no conformidad desde el diálogo de alta
- US-NC-GESTION-011: [Móvil] Editar la severidad, la descripción y la asignación desde el detalle
- US-NC-GESTION-012: [Móvil] Comentar y cerrar una no conformidad desde su detalle
- US-NC-GESTION-013: [Móvil] Dar formato a la descripción de una no conformidad

La historia 013 lleva la etiqueta `no-implementada`: es una capacidad futura, no se prueba contra la app y dice en «Decisiones pendientes» lo que aún no está decidido. Las demás son vigentes.

## Fuera de alcance
- El tablero por estado, sus filtros, el movimiento de las tarjetas, los pasos de estado que no son el cierre (en análisis, acción correctiva, rechazo y reapertura) y el comentario rápido de la tarjeta: EP-NC-TABLERO.
- El indicador «NC abiertas» del panel de misión y su actualización en vivo: EP-MISION-FEED.
- Los registros de auditoría de las acciones sobre no conformidades: EP-AUDITORIA.
- La relación de las no conformidades con requisitos o casos de prueba, que ni el alta ni el detalle ofrecen: EP-REQ-TRAZA.
- El aislamiento entre tenants y la matriz de permisos transversal: EP-MULTITENANT-PERMISOS.
- La renovación de la sesión y la caducidad del token: EP-SESION.
