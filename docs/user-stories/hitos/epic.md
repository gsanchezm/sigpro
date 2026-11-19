---
id: EP-HITOS
tipo: epica
titulo: "Hitos de un programa"
etiquetas: [epic]
---

## Objetivo
Que quien gestiona un programa pueda planificarlo con hitos: añadirlos, ponerles nombre y fecha límite, registrar su avance hasta el 100 % y quitar los que sobran; y que quien solo consulta el programa vea cuántos hitos están cumplidos. Debe dar el mismo resultado en la API, en la web y en la app móvil.

## Alcance
- Los cuatro endpoints de hitos de la API: lista del programa, alta, edición del nombre, de la fecha límite o del avance, y borrado. Con sus validaciones, sus códigos de error y sus permisos (`milestone.edit` y `milestone.delete`).
- La regla del cumplido: con un avance de 100 el hito queda cumplido, y bajar el avance por debajo de 100 lo deja no cumplido. El avance del programa se calcula con sus hitos cumplidos.
- La pestaña «Hitos» de la ficha de un programa en la web y en la app móvil: lista ordenada por fecha límite, alta, edición, avance con deslizador (web) o con los botones − y + (móvil), borrado con confirmación, permisos por rol y estados de carga, vacío y error.

## Plataformas
API, web y app móvil común a iOS y Android. No hay aquí un comportamiento propio de un sistema nativo.

## Historias
- US-HITOS-001: [API] Listar los hitos de un programa por fecha límite
- US-HITOS-002: [API] Crear un hito con nombre y fecha límite en un programa
- US-HITOS-003: [API] Editar el nombre y la fecha límite de un hito
- US-HITOS-004: [API] Registrar el avance de un hito: con el 100 % queda cumplido
- US-HITOS-005: [API] Eliminar un hito del programa
- US-HITOS-006: [Web] Ver la pestaña «Hitos»: tabla, recuento, estados y permisos de cada rol
- US-HITOS-007: [Web] Crear un hito en el diálogo «Nuevo hito» y editar su nombre o su fecha en la tabla
- US-HITOS-008: [Web] Mover el avance de un hito con el deslizador
- US-HITOS-009: [Web] Borrar un hito desde su menú con confirmación
- US-HITOS-010: [Móvil] Ver los hitos en tarjetas: estado, avance, permisos y estados de carga, vacío y error
- US-HITOS-011: [Móvil] Crear un hito y editar su nombre o su fecha en una hoja
- US-HITOS-012: [Móvil] Mover el avance de un hito de 5 en 5 y borrarlo con confirmación

## Fuera de alcance
- La ficha del programa, su cabecera, su resumen y las pestañas Requisitos y Proveedores: EP-PROG-DETALLE, que además cubre la ruta de la ficha. La pestaña «Hitos» y su contenido son de esta épica.
- Los proveedores del programa: EP-PROVEEDORES.
- El alta, la edición, el archivado, la duplicación y el borrado del propio programa: EP-PROG-ALTA y EP-PROG-GESTION.
- El avance que se muestra en la lista de programas y en las tarjetas de métricas: EP-PROG-LISTA y EP-PROG-METRICAS.
- El aviso de hito cumplido en el panel de misión y el registro de auditoría de los cambios de hitos: EP-MISION-KPI y EP-MISION-FEED (panel de misión) y EP-AUDITORIA (registro de auditoría).
- El inicio de sesión y la renovación de la sesión: EP-LOGIN y EP-SESION.
- El aislamiento de datos entre tenants más allá de los 404 de programas e hitos que describen las historias de la API: EP-MULTITENANT-PERMISOS.
