---
id: EP-MISION-KPI
tipo: epica
titulo: "Panel de misión: indicadores"
etiquetas: [epic]
---

## Objetivo
Que quien abre el panel de misión vea de un vistazo los indicadores del tenant (programas activos, hitos cumplidos, no conformidades abiertas y verificación superada), las gráficas de avance por programa y de no conformidades por severidad, y que el resumen que los alimenta tenga una forma y unos valores que se puedan comprobar con los datos de demostración. Incluye el botón de emitir un evento de prueba, que solo puede pulsar el administrador.

## Alcance
- `GET /api/mission/summary` completo: sesión obligatoria, forma de la respuesta y cada uno de sus bloques (cifras de los indicadores, datos de las gráficas, verificación, actividad reciente y valor del simulador), con sus valores tras reiniciar el tenant.
- `POST /api/mission/tick`: emisión del siguiente evento del simulador, permiso de administrador, efecto (solo en la memoria del tenant, sin tocar sus datos) y condiciones.
- Pantalla web `/mission`: cuatro indicadores, gráficas con vista de tabla, estados de carga, vacío y error, y el botón «Simular evento».
- Pantalla móvil `/mission`: lo mismo en la app móvil, con la hoja de explicación de cada indicador y el botón «Emitir evento de prueba».

## Plataformas
API, web y móvil común a iOS y Android. No hay aquí un comportamiento propio de uno de los sistemas nativos.

## Historias
- US-MISION-KPI-001: [API] Resumen de misión: forma de la respuesta y sesión obligatoria
- US-MISION-KPI-002: [API] Resumen de misión: datos de las gráficas de avance por programa y de NC por severidad
- US-MISION-KPI-003: [API] Resumen de misión: verificación superada por caso de prueba
- US-MISION-KPI-004: [API] Resumen de misión: actividad reciente y valor del simulador
- US-MISION-KPI-005: [API] Emitir el siguiente evento del simulador con POST /api/mission/tick (solo admin)
- US-MISION-KPI-006: [Web] Panel de misión: cuatro indicadores con su cifra y su explicación
- US-MISION-KPI-007: [Web] Panel de misión: gráficas de hitos y de NC con vista de tabla
- US-MISION-KPI-008: [Web] Panel de misión: estados de carga, vacío y error
- US-MISION-KPI-009: [Web] Botón «Simular evento»: solo lo pulsa el administrador
- US-MISION-KPI-010: [Móvil] Panel de misión: cuatro indicadores y su hoja de explicación
- US-MISION-KPI-011: [Móvil] Panel de misión: gráficas, leyenda, vista de tabla y estados de carga y vacío
- US-MISION-KPI-012: [Móvil] Botón «Emitir evento de prueba»: solo lo pulsa el administrador

## Fuera de alcance
- El feed en tiempo real por WebSocket, el indicador de conexión, la pausa del feed, la actualización en vivo de las NC abiertas y el simulador en marcha con su temporizador: EP-MISION-FEED.
- Las cuatro tarjetas de la cabecera de la lista de programas y sus cifras: EP-PROG-METRICAS.
- Registrar, editar o cambiar el estado de una no conformidad: EP-NC-GESTION y EP-NC-TABLERO.
- Ejecutar casos de prueba y subir sus evidencias: EP-VER-EJECUCION.
