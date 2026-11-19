---
id: EP-VER-INFORME
tipo: epica
titulo: "Informe de verificación"
etiquetas: [epic]
---

## Objetivo
Que quien verifica o audita el sistema pueda descargar un informe PDF del plan de verificación, con su resumen por resultado y una ficha por caso, de todo el tenant, de un programa o de una selección de casos, y que obtenga el mismo contenido en la API, en la web y en la app móvil.

## Alcance
- `GET /api/verification/report` en la API: sesión y tenant del token, el alcance que elige la consulta (selección, programa o todos los casos), el nombre del archivo, el 404 cuando el alcance no tiene casos y el contenido del PDF.
- La presentación en la web: el botón «Descargar informe PDF» de la lista de «Verificación» (con el programa del filtro), las casillas de selección y la barra «Informe de la selección», la opción «Informe PDF» del menú de cada fila en escritorio y el botón del detalle de un caso.
- La presentación en la app móvil: los mismos botones en /verification y en /verification/<código>, la selección por tarjetas, el motivo visible cuando no hay casos y la entrega del archivo.

## Plataformas
API, web (escritorio a partir de 1024 px de ancho y diseño responsive por debajo) y app móvil común a iOS y Android. La entrega del PDF en el móvil abre la hoja de compartir del sistema tanto en iOS como en Android, con el mismo comportamiento, así que no hay historias separadas por sistema.

## Historias
- US-VER-INFORME-001: [API] Descargar el informe solo con sesión y con los datos del tenant del token
- US-VER-INFORME-002: [API] Elegir el alcance del informe: selección, programa o todos los casos
- US-VER-INFORME-003: [API] Contenido del PDF: resumen por resultado y una ficha por caso
- US-VER-INFORME-004: [Web] Descargar el informe desde «Verificación»: cabecera, selección y menú de fila
- US-VER-INFORME-005: [Web] Descargar el informe de un caso desde su detalle
- US-VER-INFORME-006: [Móvil] Descargar el informe desde «Verificación» y desde el detalle, con selección y entrega

## Fuera de alcance
- La lista de casos de prueba, sus filtros, su orden y el detalle de cada caso: EP-VER-CASOS.
- Registrar una ejecución, sus evidencias y su descarga: EP-VER-EJECUCION.
- Otros formatos del informe (hoja de cálculo, CSV) o una vista para imprimir: no existen en la aplicación y no están en el alcance de esta épica.
- El inicio de sesión que entrega el `accessToken`: EP-LOGIN.
