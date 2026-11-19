---
id: EP-VER-EJECUCION
tipo: epica
titulo: "Ejecución de casos de prueba y evidencias"
etiquetas: [epic]
---

## Objetivo
Que quien tiene permiso para ejecutar pruebas registre el resultado de un caso de prueba (superado, fallido o bloqueado) con sus notas y con hasta cinco evidencias (capturas PNG o JPEG y documentos PDF), que cada evidencia quede guardada con su ejecución y se pueda ver y descargar solo desde el tenant al que pertenece, y que la ejecución nueva pase a ser la última del caso.

## Alcance
- `POST /api/test-cases/:code/runs`: quién puede registrar una ejecución (permiso `testrun.execute`), el orden de los rechazos, el resultado y las notas, las evidencias (tipo real, tamaño y cantidad), el efecto sobre el caso y el registro de auditoría.
- `GET /api/evidence/:id`: la descarga de una evidencia, sus cabeceras, el 404 y el aislamiento por tenant.
- Web, en `/verification/:code`: el formulario «Registrar ejecución», la elección de evidencias con sus avisos, el error del servidor y el historial de ejecuciones con sus evidencias.
- Móvil, en `/verification/:code`: el mismo formulario con botones de imagen y de PDF, y el historial con ampliación y descarga de las evidencias.
- iOS y Android: el selector de archivos del sistema para elegir evidencias y la hoja de compartir para entregar una descarga.

## Plataformas
API, web y móvil. Los selectores de archivos y la hoja de compartir son del sistema, así que su comportamiento observable se describe aparte para iOS y para Android.

## Historias
- US-VER-EJECUCION-001: [API] Solo quien tiene el permiso registra ejecuciones, y el orden de los rechazos
- US-VER-EJECUCION-002: [API] Registrar una ejecución con su resultado, sus notas y su efecto en el caso
- US-VER-EJECUCION-003: [API] Validar las evidencias de una ejecución: tipo real, tamaño y cantidad
- US-VER-EJECUCION-004: [API] Descargar una evidencia por su identificador, dentro de su tenant
- US-VER-EJECUCION-005: [Web] Registrar una ejecución desde el detalle del caso
- US-VER-EJECUCION-006: [Web] Elegir evidencias antes de enviar: tipo, tamaño, cantidad y quitarlas
- US-VER-EJECUCION-007: [Web] Ver el historial de ejecuciones con sus evidencias y descargarlas
- US-VER-EJECUCION-008: [Móvil] Registrar una ejecución desde el detalle del caso
- US-VER-EJECUCION-009: [Móvil] Elegir evidencias con los botones de imagen y de PDF
- US-VER-EJECUCION-010: [Móvil] Ver el historial, ampliar una imagen y descargar una evidencia
- US-VER-EJECUCION-011: [iOS] Elegir evidencias con el selector de iOS y entregar una descarga a la hoja de compartir
- US-VER-EJECUCION-012: [Android] Elegir evidencias con el selector de Android y entregar una descarga a la hoja de compartir

## Fuera de alcance
- La lista de casos de prueba, sus filtros, y la cabecera y los pasos del detalle: EP-VER-CASOS.
- El informe PDF del plan de verificación, también el que se descarga desde el detalle de un caso: EP-VER-INFORME.
- Editar o eliminar una ejecución o una evidencia: la API no tiene endpoints para ello y ninguna épica lo cubre todavía.
- El inicio de sesión con el que se registra la ejecución y la duración de la sesión: EP-LOGIN y EP-SESION.
- La consulta del registro de auditoría donde queda el evento de cada ejecución: la épica de Auditoría.
