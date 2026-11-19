---
id: EP-VER-CASOS
tipo: epica
titulo: "Casos de prueba: lista y detalle"
etiquetas: [epic]
---

## Objetivo
Que quien verifica el sistema encuentre sus casos de prueba, vea de un vistazo el último resultado de cada uno y su número de ejecuciones, y abra la ficha de un caso con sus pasos, sus requisitos verificados y su historial de ejecuciones, con el mismo contenido en la API, en la web y en la app móvil.

## Alcance
- Respuesta de `GET /api/test-cases`: campos de cada caso, totales, paginación de 10 con tamaño y página acotados, acceso con sesión y aislamiento por tenant.
- Filtros por código o título, programa y último resultado, y orden por columna con su sentido, en la API y en las dos pantallas de lista.
- Respuesta de `GET /api/test-cases/:code`: pasos, resultado esperado, requisitos verificados, ejecuciones y el 404 para un código que no existe en el tenant.
- Pantalla `/verification` en la web (tabla desde 1024 px de ancho y tarjetas por debajo) y en la app móvil (tarjetas con «Cargar más»): buscador, filtros, orden, recuento y estados de carga, vacío y error.
- Pantalla `/verification/:code` en la web y en la app móvil: pasos, resultado esperado, requisitos, historial de ejecuciones y vuelta a la lista.

## Plataformas
API, web (escritorio a partir de 1024 px de ancho y diseño responsive por debajo) y app móvil común a iOS y Android. No hay aquí un comportamiento propio de un sistema nativo.

## Historias
- US-VER-CASOS-001: [API] Listar los casos de prueba en páginas de 10 con sus totales y su forma
- US-VER-CASOS-002: [API] Filtrar y ordenar la lista de casos de prueba
- US-VER-CASOS-003: [API] Consultar el detalle de un caso de prueba y su 404
- US-VER-CASOS-004: [Web] Ver la tabla de casos de prueba y sus estados de carga, vacío y error
- US-VER-CASOS-005: [Web] Buscar, filtrar, ordenar y paginar la lista de casos con la dirección de la página
- US-VER-CASOS-006: [Web] Abrir el detalle de un caso: pasos, requisitos, historial y volver
- US-VER-CASOS-007: [Móvil] Ver la lista de casos en tarjetas con «Cargar más» y sus estados
- US-VER-CASOS-008: [Móvil] Buscar, filtrar y ordenar la lista de casos
- US-VER-CASOS-009: [Móvil] Abrir el detalle de un caso y volver a la lista

## Fuera de alcance
- Registrar una ejecución con su resultado, sus notas y sus evidencias, el formulario «Registrar ejecución», la subida de archivos y la descarga de evidencias (`POST /api/test-cases/:code/runs`, `GET /api/evidence/:id`): EP-VER-EJECUCION.
- El informe PDF del plan y de una selección de casos, con sus botones, la selección de casos y su barra de acciones (`GET /api/verification/report`): EP-VER-INFORME.
- Los requisitos que se abren desde un caso y su detalle: EP-REQ-ARBOL. Enlazar y desenlazar casos con requisitos: EP-REQ-TRAZA.
- Cómo se llega a la lista con una sesión iniciada y la navegación entre secciones: EP-LOGIN y EP-NAVEGACION.
