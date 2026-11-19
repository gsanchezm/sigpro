---
id: EP-MISION-FEED
tipo: epica
titulo: "Panel de misión: feed en tiempo real"
etiquetas: [epic]
---

## Objetivo
Que quien tiene el panel de misión abierto vea los eventos de su tenant según ocurren, sin recargar la página: el feed de actividad, la cifra «NC abiertas», su gráfica por severidad y «Hitos cumplidos» se actualizan solos, y el indicador de conexión dice en todo momento si esas actualizaciones están llegando. Y que ningún evento de un tenant llegue nunca a otro.

## Alcance
- La conexión en tiempo real de la API: qué token acepta, a qué tenant pertenece cada conexión y qué eventos recibe.
- El contrato de cada evento: forma, tipo, gravedad, programa, variables, origen y las cifras de no conformidades abiertas que lleva.
- El simulador de misión (`SIMULATOR_MS`) y la secuencia fija de sus eventos.
- Lo que el feed hace en `/mission`, en la web y en la app móvil: lista de eventos, pausa, tope de 50 eventos, cifras en vivo, indicador de conexión, reintento y resumen tras una caída.
- La cifra «NC abiertas» de la lista de programas no se repite aquí: la describen las historias de EP-PROG-METRICAS.

## Plataformas
API, web y móvil común a iOS y Android. La conexión y el feed no tienen un comportamiento propio de uno de los sistemas nativos.

## Historias
- US-MISION-FEED-001: [API] Abrir la conexión en tiempo real solo con un token de acceso vigente
- US-MISION-FEED-002: [API] Entregar cada evento solo a las conexiones de su tenant
- US-MISION-FEED-003: [API] Forma, gravedad y cifras de cada evento de misión
- US-MISION-FEED-004: [API] Simulador de misión: apagado, encendido solo con conexiones abiertas y secuencia fija
- US-MISION-FEED-005: [API] Reiniciar el tenant devuelve el feed a su historia inicial
- US-MISION-FEED-006: [Web] Ver los eventos en directo en /mission: historia inicial, orden, pausa y tope de 50
- US-MISION-FEED-007: [Web] Actualizar en vivo «NC abiertas», su gráfica por severidad y «Hitos cumplidos» sin recargar
- US-MISION-FEED-008: [Web] Indicador de conexión en /mission: en vivo, sin conexión y vuelta al panel
- US-MISION-FEED-009: [Móvil] Ver los eventos en directo en /mission: historia inicial, pausa y tope de 50
- US-MISION-FEED-010: [Móvil] Actualizar en vivo «NC abiertas», su gráfica por severidad y «Hitos cumplidos» sin recargar
- US-MISION-FEED-011: [Móvil] Indicador de conexión, «Reintentar» y resumen tras una caída en /mission

## Fuera de alcance
- Los indicadores estáticos del panel, el resumen `GET /api/mission/summary`, el endpoint `POST /api/mission/tick` con su permiso y sus errores, el botón de emitir un evento de prueba y el aviso de error del resumen: EP-MISION-KPI.
- La cifra «NC abiertas» de la lista de programas, sus tarjetas y su actualización al eliminar un programa: EP-PROG-METRICAS.
- La campana de avisos, su contador, la insignia de «NC» del menú: EP-NAVEGACION. La preferencia «Notificaciones en tiempo real» del Perfil: EP-PERFIL.
- El inicio de sesión y el segundo factor con los que se obtienen los tokens: EP-LOGIN y EP-MFA. La renovación de la sesión cuando caduca el acceso: EP-SESION.
- La creación, edición, transición, comentario y cierre de las no conformidades (salvo lo necesario para provocar eventos): EP-NC-TABLERO y EP-NC-GESTION.
- Los hitos en sí (alta, edición, avance, borrado): EP-HITOS.
- El aislamiento de los datos de las pantallas (listas, tableros, programas) fuera del panel de misión: EP-MULTITENANT-PERMISOS.
