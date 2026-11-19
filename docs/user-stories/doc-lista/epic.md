---
id: EP-DOC-LISTA
tipo: epica
titulo: "Documentos: lista, detalle y descarga"
etiquetas: [epic]
---

## Objetivo
Que quien trabaja con los programas encuentre sus documentos, vea cuál es su versión vigente y su historial, lea una versión en el visor y descargue el PDF de la versión que necesita, con los mismos datos en la API, en la web y en la app móvil.

## Alcance
- Lista de documentos de `GET /api/documents`: campos, orden, filtros por programa, clasificación y texto, y aislamiento por tenant.
- Detalle de `GET /api/documents/:id` con su historial de versiones, y contenido en páginas de `GET /api/documents/:id/content` para el visor, de la última versión o de una elegida con `version`.
- Descarga en PDF de `GET /api/documents/:id/download`, con su nombre y su tipo, de la última versión o de una elegida con `version`.
- Pantallas de la web (`/documents`, `/documents/:id` y `/documents/:id/view`) y de la app móvil (`/documents` y `/documents/:id`), con sus estados de carga, vacío y error.

## Plataformas
API, web (escritorio a partir de 1024 px de ancho y diseño responsive por debajo) y app móvil. La entrega del PDF en iOS y en Android es la hoja de compartir del sistema, y tiene sus propias historias.

## Historias
- US-DOC-LISTA-001: [API] Listar los documentos del tenant con sus campos y su orden
- US-DOC-LISTA-002: [API] Filtrar la lista de documentos por programa, clasificación y texto
- US-DOC-LISTA-003: [API] Consultar el detalle de un documento con su historial de versiones
- US-DOC-LISTA-004: [API] Servir el contenido de una versión en páginas para el visor
- US-DOC-LISTA-005: [API] Descargar una versión de un documento como PDF con su nombre
- US-DOC-LISTA-006: [Web] Ver la tabla de documentos y el menú de acciones de cada fila
- US-DOC-LISTA-007: [Web] Buscar y filtrar la lista de documentos
- US-DOC-LISTA-008: [Web] Ver los estados de carga, vacío y error de la lista de documentos
- US-DOC-LISTA-009: [Web] Ver la ficha de un documento con su historial y sus acciones
- US-DOC-LISTA-010: [Web] Ver una versión de un documento en el visor
- US-DOC-LISTA-011: [Móvil] Ver la lista de documentos en tarjetas, buscarla y descargar su PDF
- US-DOC-LISTA-012: [Móvil] Ver la ficha de un documento con sus versiones y su contenido en páginas
- US-DOC-LISTA-013: [Móvil] Filtrar la lista de documentos por programa y clasificación
- US-DOC-LISTA-014: [iOS] Entregar el PDF de un documento a la hoja de compartir de iOS
- US-DOC-LISTA-015: [Android] Entregar el PDF de un documento a la hoja de compartir de Android

## Fuera de alcance
- Subir una versión nueva, el botón y el diálogo «Publicar nueva versión» y la comparación de versiones: EP-DOC-VERSIONES.
- El permiso `document.viewRestricted`, qué roles ven los documentos restringidos, el aviso de documentos ocultos de la lista y el 403 de la ficha, el visor, el contenido y la descarga: EP-DOC-RESTRINGIDOS.
- Cómo se inicia sesión antes de llegar a Documentos: EP-LOGIN. La renovación del `accessToken` y el cierre de sesión: EP-SESION.
- Cómo se llega a Documentos desde la pestaña «Más» de la app, y la búsqueda global de la cabecera, que también devuelve documentos: EP-NAVEGACION.
- La ficha del programa al que enlaza cada documento: EP-PROG-DETALLE.
- Los avisos generales de la aplicación, como los de falta de conexión: épica transversal de avisos (EP-TOASTS).
