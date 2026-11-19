---
id: EP-DOC-RESTRINGIDOS
tipo: epica
titulo: "Documentos restringidos y clasificados"
etiquetas: [epic]
---

## Objetivo
Que un documento restringido lo vea solo quien tiene el permiso de verlo (admin, gestor de programa y auditor), y que quien no lo tiene no obtenga su contenido ni lo encuentre en listas o resultados de búsqueda, con las mismas reglas en la API, en la web y en la app móvil. Incluye la marca de clasificación con la que se reconoce un restringido y que publicar una versión nueva no cambia ni su clasificación ni quién lo ve.

## Alcance
- `GET /api/documents`: los restringidos se omiten para quien no tiene el permiso `document.viewRestricted`, y la respuesta dice cuántos ha omitido (`hiddenCount`).
- `GET /api/documents/:id`, `/content` y `/download` de un restringido: 403 sin el permiso y 200 con él; 404 para un código que no existe.
- `POST /api/documents/:id/versions` sobre un restringido: la versión nueva no cambia su clasificación ni quién lo ve.
- `GET /api/search`: el grupo de documentos no incluye los restringidos a quien no los puede ver.
- Web y móvil: el aviso de ocultos en la lista, la insignia «Restringido» y la página «No tienes permiso para ver este documento» en la ficha y en el visor.
- La visibilidad la decide la clasificación de cada documento y el rol de quien pide.

## Plataformas
API, web y móvil común a iOS y Android. Ningún comportamiento depende del sistema nativo.

## Historias
- US-DOC-RESTRINGIDOS-001: [API] Lista de documentos sin los restringidos para quien no tiene el permiso
- US-DOC-RESTRINGIDOS-002: [API] Ficha, contenido y descarga de un restringido según el permiso
- US-DOC-RESTRINGIDOS-003: [API] Publicar una versión de un restringido no cambia su clasificación ni su visibilidad
- US-DOC-RESTRINGIDOS-004: [API] La búsqueda global no devuelve los restringidos a quien no los ve
- US-DOC-RESTRINGIDOS-005: [Web] Lista de documentos: el consultor no ve los restringidos y lee cuántos hay ocultos
- US-DOC-RESTRINGIDOS-006: [Web] Ficha y visor de un restringido: aviso de «No tienes permiso» o documento con su marca
- US-DOC-RESTRINGIDOS-007: [Móvil] Lista y ficha de un restringido: lo que ve cada rol en la app

## Fuera de alcance
- La lista general de documentos (orden, filtros por programa y por clasificación, búsqueda por texto, menú de acciones, paginación) y la ficha, el visor y la descarga de los documentos públicos: EP-DOC-LISTA.
- Quién puede publicar una versión, la validación de su contenido, el orden de sus comprobaciones, el historial de versiones, la comparación entre versiones (también la de un restringido) y el diálogo «Publicar nueva versión»: EP-DOC-VERSIONES.
- La búsqueda global en sí (grupos de programas, requisitos, casos y no conformidades, mínimo de caracteres, enlaces de cada resultado) y su pantalla: EP-NAVEGACION.
- El inicio de sesión y el segundo factor con los que se llega a estas pantallas: EP-LOGIN y EP-MFA.
