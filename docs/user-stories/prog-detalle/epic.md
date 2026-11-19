---
id: EP-PROG-DETALLE
tipo: epica
titulo: "Detalle de un programa"
etiquetas: [epic]
---

## Objetivo
Que cualquier persona con una sesión de acceso en SIGPRO pueda abrir la ficha de un programa de su tenant, con sus datos, sus pestañas y las acciones que su rol permite, y que un código que no corresponde a un programa de su tenant se trate como no encontrado, sin mostrar datos de otra organización.

## Alcance
- La respuesta de `GET /api/programs/:code`: los datos del programa, el 404 para un código que no es un programa del tenant y la exigencia de una sesión de acceso.
- La ficha en la web (`/programs/:code`): cabecera, datos del resumen, pestañas Resumen, Hitos y Requisitos con el enlace al árbol de requisitos, y el botón «Editar programa» según el rol.
- El panel lateral que se abre desde la lista de programas en escritorio, y el enlace a la ficha completa.
- La ficha en la app móvil (`/programs/:code`): cabecera, datos del resumen, opciones Resumen, Hitos y Proveedores, el botón «Ver requisitos» y el botón «Editar programa» según el rol.
- Los estados de la ficha en ambas plataformas: carga, programa no encontrado, error y vuelta a la lista.

## Plataformas
API, web y móvil común a iOS y Android. No hay aquí un comportamiento propio de uno de los sistemas nativos.

## Historias
- US-PROG-DETALLE-001: [API] Consultar el detalle de un programa del tenant
- US-PROG-DETALLE-002: [Web] Ver la ficha de un programa: cabecera, datos, pestañas y botón de editar según el rol
- US-PROG-DETALLE-003: [Web] Mostrar la carga, el aviso de no encontrado y el error de la ficha, y volver a Programas
- US-PROG-DETALLE-004: [Web] Ver el panel lateral de un programa desde la lista y pasar a su ficha completa
- US-PROG-DETALLE-005: [Móvil] Ver la ficha de un programa: cabecera, datos, opciones, requisitos y botón de editar según el rol
- US-PROG-DETALLE-006: [Móvil] Mostrar la carga, el aviso de no encontrado y el error de la ficha, y volver a Programas

## Fuera de alcance
- Los hitos del programa, con su alta, su edición, su avance y su borrado, y el panel de hitos que muestran las pestañas: EP-HITOS.
- Los proveedores contratados y el buscador de proveedores que muestran el resumen (web) y la opción Proveedores (móvil): EP-PROVEEDORES.
- El alta y la edición del programa, a la que lleva el botón «Editar programa»: EP-PROG-ALTA.
- Archivar, duplicar y eliminar un programa: EP-PROG-GESTION.
- El árbol y la matriz de requisitos a los que llevan los enlaces «Abrir el árbol de requisitos de este programa» y «Ver requisitos»: las épicas EP-REQ-*.
- La lista de programas, sus filtros, su selección y su paginación: EP-PROG-LISTA.
- La búsqueda global, desde la que también se puede llegar a la ficha: EP-NAVEGACION.
- El inicio de sesión con el que se llega a la ficha, y la duración de la sesión: EP-LOGIN y EP-SESION.
