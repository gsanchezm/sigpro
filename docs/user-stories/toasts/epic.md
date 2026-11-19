---
id: EP-TOASTS
tipo: epica
titulo: "Avisos emergentes"
etiquetas: [epic]
---

## Objetivo
Que cada acción que termina con un resultado se confirme con un aviso breve y legible: si salió bien, si falló, si es informativo o si no se pudo intentar por una regla. El aviso lleva un título, puede llevar una línea debajo, no bloquea la pantalla y se retira solo a los 3 segundos. Esta épica fija esa regla común; lo que dice cada aviso concreto y cuándo sale lo fija la épica de la pantalla que lo produce.

## Alcance
- Los cuatro tonos (de éxito, de error, informativo y de advertencia): qué indica cada uno y cómo se ve su franja.
- El título y el cuerpo de cada aviso.
- El rol con el que se anuncia a quien usa un lector de pantalla: de alerta para el error y de estado para los demás tonos.
- El cierre automático a los 3 segundos, el cierre a mano en la web y su falta en la app móvil.
- Varios avisos a la vez, su apilado y su posición en la pantalla.
- El aviso de error del servidor cuando la acción no tiene un mensaje propio, y la falta de respuesta del servidor.

## Plataformas
Transversal: los tonos, el texto, el rol, el plazo de 3 segundos y el apilado valen en todas las plataformas. Web: posición de escritorio y de ventana estrecha, cierre con «Cerrar», tonos informativo y de advertencia. Móvil: posición arriba de la pantalla, rol por tono y tonos de éxito, error e información; el cierre a mano es una capacidad no implementada.

## Historias
- US-TOASTS-001: [Transversal] Cuatro tonos de aviso: qué indica cada uno, su título y su cuerpo
- US-TOASTS-002: [Transversal] Error del servidor: aviso de error con el título «Ha ocurrido un error inesperado» y rol de alerta
- US-TOASTS-003: [Transversal] Varios avisos a la vez y cierre automático a los 3 segundos
- US-TOASTS-004: [Web] Avisos emergentes: esquina inferior derecha, cierre con «Cerrar» y rol de cada tono
- US-TOASTS-005: [Web] Avisos informativos y de advertencia con su texto exacto
- US-TOASTS-006: [Móvil] Avisos arriba de la pantalla, rol por tono y avisos de éxito, error e información
- US-TOASTS-007: [Móvil] Cerrar un aviso con «Cerrar» antes de que se retire solo

## Fuera de alcance
- Lo que dice cada aviso concreto y cuándo sale: la épica de la pantalla que lo produce (por ejemplo, EP-PROG-GESTION para «PRG-001 archivado», EP-NC-TABLERO para los avisos del tablero y EP-DOC-LISTA para «Descarga iniciada»).
- Los avisos de validación de un formulario, que se muestran junto al campo y no son emergentes.
- Los errores de carga de una lista, que se muestran como estado de error de su propia pantalla.
- La falta de conexión en la recuperación de contraseña: EP-RECUPERAR.
- Qué debe contener la línea de detalle técnico de un aviso: decisión de producto pendiente, descrita en las historias que la muestran.
