---
id: EP-REQ-TRAZA
tipo: epica
titulo: "Trazabilidad de requisitos con casos de prueba"
etiquetas: [epic]
---

## Objetivo
Que quien gestiona los requisitos de un programa vea qué casos de prueba verifican cada requisito y qué requisitos todavía no tienen ningún caso, y que pueda enlazar o desenlazar un caso con un requisito del mismo programa desde la API, la web o la app móvil, con la misma regla en todas partes.

## Alcance
- La respuesta de `GET /api/programs/:code/traceability`: los requisitos, los casos y los enlaces de un programa, el último resultado de cada caso y el 404 de un programa que no es del tenant.
- `PUT /api/requirements/:code/tests/:testCaseCode` y `DELETE /api/requirements/:code/tests/:testCaseCode`: enlazar y desenlazar, sus respuestas, su idempotencia, sus rechazos y quién puede hacerlo (permiso `requirement.edit`).
- La pestaña «Matriz de trazabilidad» de `/programs/:code/requirements` en la web: leer la matriz, marcar y desmarcar cruces, y sus estados de carga, vacío y error.
- La misma pestaña en la app móvil, con las mismas reglas.

## Plataformas
API, web y móvil común a iOS y Android. No hay aquí un comportamiento propio de uno de los sistemas nativos.

## Historias
- US-REQ-TRAZA-001: [API] Consultar la matriz de trazabilidad de un programa
- US-REQ-TRAZA-002: [API] Enlazar un caso de prueba con un requisito del mismo programa
- US-REQ-TRAZA-003: [API] Rechazar un enlace que no puede crearse
- US-REQ-TRAZA-004: [API] Desenlazar un caso de prueba de un requisito
- US-REQ-TRAZA-005: [Web] Leer la matriz de trazabilidad del programa
- US-REQ-TRAZA-006: [Web] Marcar y desmarcar un cruce en la matriz de trazabilidad
- US-REQ-TRAZA-007: [Móvil] Leer, marcar y desmarcar cruces en la matriz de trazabilidad

## Fuera de alcance
- El listado de requisitos en forma de árbol, `GET /api/programs/:code/requirements`, la búsqueda, el filtro, las cifras del programa y el detalle de un requisito, con su bloque de casos enlazados y no conformidades, que solo se lee: EP-REQ-ARBOL.
- Crear, editar, reordenar y borrar requisitos: EP-REQ-EDICION.
- Las transiciones de estado y el flujo de aprobación: EP-REQ-FLUJO.
- Los casos de prueba, su ficha en `/verification/:code` y sus ejecuciones: las épicas de Verificación, todavía sin escribir.
- El registro de auditoría donde quedan estos cambios: su épica, todavía sin escribir.
- Enlazar un caso desde el panel de detalle de un requisito: hoy ese panel solo muestra los casos enlazados, y el enlace se hace desde la matriz. Ninguna historia de esta épica lo describe desde el detalle.
- Cómo se obtienen los tokens de acceso y la renovación de la sesión: EP-LOGIN y EP-SESION.
