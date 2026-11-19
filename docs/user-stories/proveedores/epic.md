---
id: EP-PROVEEDORES
tipo: epica
titulo: "Proveedores de un programa"
etiquetas: [epic]
---

## Objetivo
Que cualquier persona con una sesión de acceso en SIGPRO vea qué proveedores tiene contratados un programa de su tenant, con su NIF, el importe de su contrato con ese programa y si están aprobados, y que pueda buscar cualquier proveedor de su tenant para ver su ficha con todos sus contratos. La sección es de solo lectura: desde ella no se asignan, editan ni eliminan proveedores.

## Alcance
- La respuesta de `GET /api/suppliers`: los proveedores del tenant con sus contratos, su orden, los filtros por nombre o NIF y por programa, la exigencia de una sesión y el aislamiento por tenant.
- En la web, la sección «Proveedores» del Resumen de la ficha de un programa: los proveedores contratados, y el buscador de proveedores del tenant con la ficha del elegido.
- En la app móvil, la pestaña «Proveedores» de la ficha de un programa: lo mismo que en la web.

## Plataformas
API, web y móvil común a iOS y Android. No hay aquí un comportamiento propio de uno de los sistemas nativos.

## Historias
- US-PROVEEDORES-001: [API] Listar los proveedores del tenant con sus contratos y filtrarlos por nombre, NIF o programa
- US-PROVEEDORES-002: [Web] Ver los proveedores contratados en el Resumen de un programa
- US-PROVEEDORES-003: [Web] Buscar un proveedor del tenant desde el Resumen de un programa y ver su ficha
- US-PROVEEDORES-004: [Móvil] Ver los proveedores contratados y buscar un proveedor en la pestaña «Proveedores»

## Fuera de alcance
- Dar de alta, editar o eliminar proveedores, y asignar o quitar contratos de un programa: la API no tiene endpoints para ello y ninguna épica lo cubre todavía.
- La ficha del programa, su cabecera, sus datos, sus pestañas y la ruta `/programs/:code`: EP-PROG-DETALLE.
- El panel de hitos de la pestaña «Hitos»: EP-HITOS.
- El inicio de sesión con el que se llega a la ficha, y la duración de la sesión: EP-LOGIN y EP-SESION.
- La búsqueda global de la cabecera (`GET /api/search`): EP-NAVEGACION.
