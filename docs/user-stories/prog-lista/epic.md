---
id: EP-PROG-LISTA
tipo: epica
titulo: "Lista de programas: filtros, orden, paginación y búsqueda"
etiquetas: [epic]
---

## Objetivo
Que quien gestiona programas encuentre un programa o un grupo de programas en la lista: filtrándola por estado, por fechas y por responsable, buscándola por código o nombre, ordenándola por columna y pasando de página, con el mismo resultado en la API, en la web y en la app móvil.

## Alcance
- Respuesta paginada de `GET /api/programs`: diez programas por página, totales, forma de la respuesta y acceso con sesión.
- Filtros por estado, por rango de fechas («Inicio desde» y «Fin hasta», con los dos límites incluidos) y por responsable, y búsqueda por código o nombre.
- Orden por columna y sentido, con un orden que se mantiene entre páginas.
- Tabla de escritorio, lista de tarjetas del diseño responsive y lista de la app móvil: filtros, paginación o «Cargar más», y estados de carga, vacío y error.

## Plataformas
API, web (escritorio a partir de 1024 px de ancho y diseño responsive por debajo) y app móvil común a iOS y Android. No hay aquí un comportamiento propio de un sistema nativo.

## Historias
- US-PROG-LISTA-001: [API] Listar los programas en páginas de 10 con su total y su forma
- US-PROG-LISTA-002: [API] Filtrar la lista por estado, fechas, responsable y texto
- US-PROG-LISTA-003: [API] Ordenar la lista por columna y mantener el orden entre páginas
- US-PROG-LISTA-004: [Web] Filtrar y buscar en la lista de programas
- US-PROG-LISTA-005: [Web] Ver la lista de programas en tabla o en tarjetas y ordenarla por columna
- US-PROG-LISTA-006: [Web] Paginar la lista de programas de 10 en 10
- US-PROG-LISTA-007: [Web] Ver los estados de carga, vacío y error de la lista de programas
- US-PROG-LISTA-008: [Móvil] Ver la lista de programas en tarjetas con búsqueda, estado y «Cargar más»
- US-PROG-LISTA-009: [Móvil] Filtrar la lista de programas por fechas y responsable
- US-PROG-LISTA-010: [Móvil] Ver los estados de carga, vacío y error de la lista de programas

## Fuera de alcance
- Exportación a CSV, selección múltiple, acciones masivas y acciones de cada fila (archivar, duplicar, eliminar): EP-PROG-GESTION.
- Tarjetas de métricas de la cabecera: EP-PROG-METRICAS.
- Panel lateral, ficha y detalle de un programa: EP-PROG-DETALLE.
- Alta, asistente y edición de programas: EP-PROG-ALTA.
- Cómo se llega a la lista con una sesión iniciada: EP-LOGIN.
- Búsqueda global de la cabecera fuera de la lista de programas: EP-NAVEGACION.
- Aislamiento de los datos entre tenants: EP-MULTITENANT-PERMISOS.
