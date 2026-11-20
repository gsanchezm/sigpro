---
id: US-MISION-FEED-011
tipo: historia
epica: EP-MISION-FEED
titulo: "[Móvil] Indicador de conexión, «Reintentar» y resumen tras una caída en /mission"
etiquetas: [movil]
relacionadas: [US-MISION-FEED-001, US-MISION-FEED-008, US-MISION-FEED-010, US-SESION-009]
verificacion: ejecutada
cubre: ["/mission"]
---

## Historia
Como persona que sigue el panel de misión desde la app móvil, quiero saber en todo momento si las cifras y la lista se actualizan solas, y poder volver a conectar yo mismo cuando no se recupera,
para no fiarme de una pantalla que ya no recibe eventos.

## Reglas
- El indicador de la cabecera de la pantalla dice «En vivo» mientras la conexión en tiempo real está abierta, «Conectando…» mientras intenta abrirla y «Sin conexión» cuando no la tiene.
- Debajo del título «Eventos en directo» aparece la explicación del estado: «Conectado por WebSocket: los eventos llegan solos.», «Abriendo la conexión en tiempo real…» o «Sin conexión en tiempo real. Se reintentará automáticamente.».
- Con «Sin conexión», aparece el botón «Reintentar», debajo de esa explicación. Con la conexión abierta o intentando abrirse, el botón no aparece.
- Pulsar «Reintentar» pone el indicador en «Conectando…». Si la API responde, el indicador pasa a «En vivo» y el botón desaparece. Si no responde, el indicador vuelve a «Sin conexión» y el botón sigue.
- Cuando la conexión vuelve tras una caída, la pantalla pide otra vez su resumen sin recargarse: las cifras de no conformidades, su gráfica y los hitos reflejan lo ocurrido durante la caída, y aparecen en la lista los eventos de ese tiempo que el resumen todavía trae (los 20 más recientes).
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y antes de la fila se comprueba que el caos del tenant está apagado. Después se abre `/login` en la app sin ninguna sesión de SIGPRO guardada en el dispositivo, se escribe `alumno01` en «Tenant de trabajo», se inicia sesión con `gestor@sigpro.test` (`Gestor1234!`) y se abre `/mission`. El corte se provoca cortando la conexión con la API (por ejemplo, poniendo el navegador de la app sin conexión). La API se arranca con `SIMULATOR_MS=0`.

## Criterios de aceptación
```gherkin
Característica: Conexión del panel de misión en la app móvil

  Esquema del escenario: El indicador dice si la conexión en tiempo real está abierta y muestra «Reintentar» solo sin conexión
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto
    Cuando <situacion>
    Entonces el indicador dice <texto>
    Y el botón «Reintentar» <boton>

    Ejemplos:
      | situacion | texto | boton |
      | la conexión en tiempo real está abierta | «En vivo» | no aparece |
      | la prueba corta la conexión con la API y no la restablece | «Sin conexión» | aparece |

  Esquema del escenario: «Reintentar» vuelve a conectar solo si la API responde
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto y el indicador dice «Sin conexión» con el botón «Reintentar»
    Cuando <situacion> y pulsa «Reintentar»
    Entonces el indicador dice <texto>
    Y el botón «Reintentar» <boton>

    Ejemplos:
      | situacion | texto | boton |
      | la prueba restablece la conexión con la API antes de pulsar | «En vivo» | desaparece |
      | la API sigue sin responder al pulsar | «Sin conexión» | sigue |

  Esquema del escenario: Lo que ocurre durante la caída aparece al volver la conexión
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto y la conexión con la API está cortada
    Cuando <accion_durante_caida> y la conexión vuelve a abrirse
    Entonces la tarjeta «NC abiertas» muestra <nc_abiertas>
    Y la lista <lista>

    Ejemplos:
      | accion_durante_caida | nc_abiertas | lista |
      | no ocurre ninguna acción | 8 | no incluye ningún evento nuevo |
      | alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución` | 9 | incluye el texto «NC-013 abierta (Menor) en PRG-002» |
      | alumno01@sigpro.lab provoca un evento con POST /api/mission/tick | 8 | incluye el texto «Telemetría PRG-013: 766 paquetes/s» |
```

## Fuera de alcance
- La renovación de la sesión cuando caduca el acceso, fuera del panel: EP-SESION (US-SESION-009 para el móvil).
- El inicio de sesión con el que se abre el panel: EP-LOGIN.
- La forma de los eventos y sus cifras: US-MISION-FEED-003. Las cifras en vivo y su gráfica: US-MISION-FEED-010. La lista de eventos: US-MISION-FEED-009.
- La campana de avisos y la preferencia «Notificaciones en tiempo real» del Perfil: EP-NAVEGACION y EP-PERFIL.

## Decisiones pendientes
- Si la recuperación tras una caída debe traer también los eventos de ese tiempo que ya no están entre los 20 más recientes del resumen. Hoy no los trae, porque el resumen devuelve solo los 20 más recientes. Esto describe lo que existe; no es un criterio.
