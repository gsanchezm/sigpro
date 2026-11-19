---
id: EP-PROG-METRICAS
tipo: epica
titulo: "Métricas de la cartera de programas"
etiquetas: [epic]
---

## Objetivo
Que quien abre la lista de programas vea, sin haber filtrado nada, las cifras de todo el tenant (cuántos programas hay, cuántos están activos, el avance medio de la cartera y las no conformidades abiertas) y que esas cifras se pongan al día cuando cambian los programas o las no conformidades.

## Alcance
- Las cuatro tarjetas de la cabecera de la lista (Programas, Activos, Avance medio y NC abiertas), con sus textos, sus cifras, sus líneas auxiliares y la barra de avance, en la web y en la app móvil.
- El subtítulo de la cabecera («N programas · M activo»).
- Su origen: el resumen de indicadores de la API y las reglas con las que calcula cada cifra.
- Cómo reaccionan las cifras a los filtros, a los cambios de programas (copia, archivado, eliminación) y a las no conformidades que llegan en vivo.
- Los estados de carga, de error y de vacío de las tarjetas.

## Plataformas
API, web y móvil común a iOS y Android. No hay aquí un comportamiento propio de uno de los sistemas nativos.

## Historias
- US-PROG-METRICAS-001: [API] Indicadores de programas en el resumen de misión
- US-PROG-METRICAS-002: [Web] Cuatro tarjetas y subtítulo de la lista de programas
- US-PROG-METRICAS-003: [Web] Carga, error, vacío y actualización de las cifras de programas
- US-PROG-METRICAS-004: [Web] NC abiertas al día: eventos en vivo y eliminación de un programa
- US-PROG-METRICAS-005: [Móvil] Cuatro tarjetas y subtítulo de la lista de programas

## Fuera de alcance
- La lista de programas: búsqueda, filtros, orden, paginación, exportación y selección múltiple, así como el recuento «de N» de la parte inferior de la lista: EP-PROG-LISTA.
- El detalle de un programa, con sus hitos: EP-PROG-DETALLE.
- El alta y la edición de un programa: EP-PROG-ALTA.
- Archivar, duplicar y eliminar un programa en sí, con sus confirmaciones y avisos: EP-PROG-GESTION.
- Las demás cifras del resumen de misión (gráficas, eventos recientes, verificación) y el panel de misión en sí: la épica del panel de misión.
- Registrar, editar o cambiar el estado de una no conformidad: la épica de no conformidades.
