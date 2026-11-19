---
id: EP-NC-TABLERO
tipo: epica
titulo: "Tablero de no conformidades y sus transiciones"
etiquetas: [epic]
---

## Objetivo
Que cualquier persona con una sesión en SIGPRO vea las no conformidades de su tenant agrupadas por estado en un tablero, pueda acotarlas por texto, programa, severidad o responsable, abra el detalle de una y la mueva al siguiente estado que la máquina de estados admite. Quien solo lee ve el tablero completo; quien tiene el permiso `nc.transition` puede mover las no conformidades; y un paso no admitido se rechaza con un aviso claro, sin cambiar nada.

## Alcance
- La lista `GET /api/nc`: sus campos, su orden, los filtros por texto, programa, severidad y responsable, y el aislamiento por tenant.
- El detalle `GET /api/nc/:code`: sus campos, los pasos que la máquina admite desde su estado y su respuesta 404.
- El paso `POST /api/nc/:code/transition` para los pasos que no cierran la no conformidad: la matriz completa de pasos admitidos y no admitidos, el permiso `nc.transition` por rol y los códigos 403, 404, 409 y 422 de esta petición.
- En la web, el tablero de `/nc` (cinco columnas por estado en escritorio y una pestaña por estado por debajo de 1024 px), sus filtros, el cambio de estado desde el tablero y el detalle de `/nc/:code`.
- En la app móvil, el tablero de `/nc` con su búsqueda y su filtro por severidad, y el cambio de estado desde el detalle con «Mover a…».

## Plataformas
API, web y móvil común a iOS y Android. No hay aquí un comportamiento propio de uno de los sistemas nativos. La app móvil no arrastra tarjetas: su alternativa es «Mover a…» en el detalle, como dice la paridad funcional de la app.

## Historias
- US-NC-TABLERO-001: [API] Listar las no conformidades del tenant con sus campos, su orden y sus filtros
- US-NC-TABLERO-002: [API] Consultar el detalle de una no conformidad y los pasos que admite
- US-NC-TABLERO-003: [API] Dar un paso permitido por la máquina de estados y rechazar los no admitidos con 409
- US-NC-TABLERO-004: [API] Permitir el paso solo a los roles con el permiso nc.transition
- US-NC-TABLERO-005: [API] Rechazar con 422 un cuerpo de paso no válido y con 404 una no conformidad inexistente
- US-NC-TABLERO-006: [Web] Ver el tablero de no conformidades por estado, con sus tarjetas, sus avisos y la vista de pestañas
- US-NC-TABLERO-007: [Web] Filtrar el tablero por texto, programa, severidad y sin asignar
- US-NC-TABLERO-008: [Web] Cambiar el estado de una no conformidad desde el tablero
- US-NC-TABLERO-009: [Web] Abrir el detalle de una no conformidad en /nc/:code y cambiar su estado desde ahí
- US-NC-TABLERO-010: [Móvil] Ver el tablero de no conformidades con su búsqueda y su filtro por severidad
- US-NC-TABLERO-011: [Móvil] Cambiar el estado de una no conformidad desde su detalle con «Mover a…»
- US-NC-TABLERO-012: [Móvil] Filtrar el tablero por programa y por sin asignar, como en la web

Las historias 001 a 011 son vigentes. La 012 lleva la etiqueta `no-implementada`: es una capacidad de la web que la app móvil todavía no tiene, y no se prueba contra la app.

## Fuera de alcance
- La alta de una no conformidad, su edición (severidad, descripción y asignación), sus comentarios y el comentario rápido: EP-NC-GESTION.
- El paso a «Cerrada»: el formulario o el diálogo de cierre, el comentario de cierre y su longitud mínima, el permiso `nc.close` y los avisos que genera. Lo cubre EP-NC-GESTION.
- El KPI «NC abiertas» del panel de misión, que se actualiza en vivo: EP-MISION-FEED.
- La búsqueda global de la cabecera y sus resultados de no conformidades: EP-NAVEGACION.
- El inicio de sesión y la duración de la sesión con la que se llega al tablero: EP-LOGIN y EP-SESION.
