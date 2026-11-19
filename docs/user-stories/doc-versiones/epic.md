---
id: EP-DOC-VERSIONES
tipo: epica
titulo: "Versiones de documentos: publicar y comparar"
etiquetas: [epic]
---

## Objetivo
Que una persona con un rol que puede publicar añada una versión nueva al contenido de un documento de su tenant, y que quien consulta un documento compare dos de sus versiones, con las mismas reglas en la API, en la web y en la app móvil: los límites del contenido y sus motivos de rechazo, la numeración y la última versión, quién puede publicar, y el diff alineado con sus estadísticas. Una versión se publica escribiendo su contenido por líneas; subir un archivo no existe en la app y tiene su propia historia, no implementada.

## Alcance
- `POST /api/documents/:id/versions`: publicar una versión con `lines` y `note`, su numeración, los límites y los motivos del 422, el permiso `document.publish` (admin y program_manager), el 404 y el aislamiento por tenant.
- `GET /api/documents/:id/compare`: comparar dos versiones, forma del diff y estadísticas, parámetros `from` y `to`, los 422 y 404, y el permiso de los documentos restringidos al comparar.
- En la web y en la app móvil, en `/documents/:id`: el diálogo «Publicar nueva versión» con su efecto en el historial, y el comparador de versiones.

## Plataformas
API, web y móvil común a iOS y Android. Ningún comportamiento de esta épica depende del sistema nativo: la app móvil publica el mismo contenido de texto que la web y no tiene selector de archivos.

## Historias
- US-DOC-VERSIONES-001: [API] Publicar una versión nueva: queda la última, con su nota y su autor
- US-DOC-VERSIONES-002: [API] Validar el contenido y la nota de una versión nueva
- US-DOC-VERSIONES-003: [API] Permiso para publicar, orden de las comprobaciones y aislamiento por tenant
- US-DOC-VERSIONES-004: [API] Comparar dos versiones: diff alineado y estadísticas
- US-DOC-VERSIONES-005: [Web] Publicar una versión nueva desde la ficha
- US-DOC-VERSIONES-006: [Web] Tras publicar, el historial de la ficha muestra la versión nueva primera
- US-DOC-VERSIONES-007: [Web] Comparar dos versiones en la ficha
- US-DOC-VERSIONES-008: [Web] Subir un archivo como nueva versión, en lugar de escribir su contenido
- US-DOC-VERSIONES-009: [Móvil] Publicar una versión nueva desde la ficha
- US-DOC-VERSIONES-010: [Móvil] Comparar dos versiones con las líneas apiladas

## Fuera de alcance
- La lista de documentos, la ficha como visor del contenido de una versión, el historial de versiones tal como se lee en general y la descarga del PDF: EP-DOC-LISTA.
- La visibilidad de los documentos restringidos en la lista y en la ficha: EP-DOC-RESTRINGIDOS.
- El inicio de sesión con el que se llega a los documentos: EP-LOGIN.
- La respuesta 401 cuando falta el token o no es válido, y la renovación del token: EP-SESION.
