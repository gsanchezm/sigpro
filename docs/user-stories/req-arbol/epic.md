---
id: EP-REQ-ARBOL
tipo: epica
titulo: "Árbol de requisitos de un programa"
etiquetas: [epic]
---

## Objetivo
Que cualquier persona con una sesión de acceso en SIGPRO pueda leer los requisitos de un programa de su tenant como un árbol de hasta tres niveles, buscarlos, filtrarlos y abrir el detalle de uno para ver sus datos, sus casos de prueba enlazados y sus no conformidades, y que un código que no corresponde a un requisito o a un programa del tenant se trate como no encontrado.

## Alcance
- La respuesta de `GET /api/programs/:code/requirements`: el programa, la lista de sus requisitos con su padre y su posición entre hermanos, el 404 para un programa que no es del tenant y la exigencia de una sesión de acceso.
- La respuesta de `GET /api/requirements/:code`: los campos de un requisito, los códigos de sus casos de prueba enlazados con el resultado de su última ejecución, sus no conformidades y el 404 para un código que no es un requisito del tenant.
- La pantalla web `/programs/:code/requirements` en lo que se lee y se recorre: el árbol plegable, la búsqueda y el filtro por estado, el detalle en panel o a pantalla completa, el teclado, las cifras del programa, la vista Documento, la descarga CSV del listado y los estados de carga, vacío, error y programa no encontrado.
- La misma ruta en la app móvil, con las mismas lecturas. Lo que la web tiene y la app móvil no tiene se describe en historias `no-implementada`.

## Plataformas
API, web y móvil común a iOS y Android. No hay aquí un comportamiento propio de uno de los sistemas nativos.

## Historias
- US-REQ-ARBOL-001: [API] Listar los requisitos de un programa del tenant con su padre y su posición
- US-REQ-ARBOL-002: [API] Consultar el detalle de un requisito del tenant
- US-REQ-ARBOL-003: [Web] Ver el árbol de requisitos: jerarquía, orden, plegar y desplegar
- US-REQ-ARBOL-004: [Web] Buscar en el árbol por código o título y filtrar por estado
- US-REQ-ARBOL-005: [Web] Ver el detalle de un requisito: panel junto al árbol o pantalla completa
- US-REQ-ARBOL-006: [Web] Recorrer el árbol y las pestañas con el teclado
- US-REQ-ARBOL-007: [Web] Ver las cifras del programa, leer el documento de requisitos y descargar el CSV
- US-REQ-ARBOL-008: [Web] Mostrar la carga, el estado vacío, el error y el programa no encontrado
- US-REQ-ARBOL-009: [Móvil] Ver el árbol de requisitos: sangría, plegado, búsqueda y contador
- US-REQ-ARBOL-010: [Móvil] Ver el detalle de un requisito en una hoja: campos, casos de prueba y no conformidades
- US-REQ-ARBOL-011: [Móvil] Ver las cifras del programa y leer el documento de requisitos
- US-REQ-ARBOL-012: [Móvil] Mostrar la carga, el estado vacío, el error y el programa no encontrado
- US-REQ-ARBOL-013: [Móvil] Filtrar el árbol por estado y expandir o contraer todo
- US-REQ-ARBOL-014: [Móvil] Copiar el código de un requisito y exportar el listado a CSV
- US-REQ-ARBOL-015: [Móvil] Abrir desde un requisito sus casos de prueba y sus no conformidades, y cambiar de programa

## Fuera de alcance
- Crear, editar, borrar y reordenar requisitos, incluido «Mover a…» y arrastrar la fila, y los atajos que abren el alta o la edición: EP-REQ-EDICION.
- Las transiciones de estado (aprobar, verificar, validar y volver a borrador), sus permisos y los botones del flujo de aprobación: EP-REQ-FLUJO.
- Enlazar y desenlazar casos de prueba, la matriz de trazabilidad (pestaña «Matriz de trazabilidad») y `GET /api/programs/:code/traceability`: EP-REQ-TRAZA.
- Los casos de prueba y sus ejecuciones, y las no conformidades como entidades (su alta, su tablero y sus transiciones): las épicas de Verificación y de No conformidades, todavía sin escribir.
- El inicio de sesión, la renovación de la sesión y el segundo factor con los que se llega a la pantalla: EP-LOGIN, EP-SESION y EP-MFA.
- La lista de programas y la ficha del programa desde la que se llega a los requisitos: EP-PROG-LISTA y EP-PROG-DETALLE.
