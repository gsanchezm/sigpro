---
id: US-MISION-FEED-008
tipo: historia
epica: EP-MISION-FEED
titulo: "[Web] Indicador de conexión en /mission: en vivo, sin conexión y vuelta al panel"
etiquetas: [web]
relacionadas: [US-MISION-FEED-001, US-MISION-FEED-006, US-MISION-FEED-007, US-MISION-FEED-011, US-SESION-006]
verificacion: codigo
cubre: ["/mission"]
---

## Historia
Como persona que sigue el panel de misión, quiero saber en todo momento si las cifras y la lista se actualizan solas,
para no fiarme de una pantalla que ya no recibe eventos y para ver que vuelve a recibirlos cuando la conexión se restablece.

## Reglas
- El indicador junto al título de la página dice «En vivo» mientras la conexión en tiempo real está abierta, «Conectando…» mientras intenta abrirla y «Sin conexión» cuando no la tiene. Al pasar el cursor por su icono, o al enfocarlo, aparece la explicación de ese estado: «Conectado por WebSocket: los eventos llegan solos.», «Abriendo la conexión en tiempo real…» o «Sin conexión en tiempo real. Se reintentará automáticamente.».
- Cuando la conexión se corta, el indicador pasa a «Sin conexión» sin recargar la página, y mientras dura el corte ningún evento llega a la lista por la conexión.
- Cuando la conexión se restablece, el indicador vuelve a «En vivo» sin recargar la página y los eventos nuevos vuelven a aparecer en la lista.
- Al restablecerse la conexión, el panel vuelve a pedir su resumen. Por eso «NC abiertas», su gráfica y «Hitos cumplidos» reflejan lo ocurrido durante el corte, y aparecen en la lista los eventos de ese tiempo que el resumen todavía trae (los 20 más recientes).
- Si el token de acceso ha caducado cuando la conexión vuelve, la sesión se renueva sin cambiar de pantalla y la conexión se restablece.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y antes de la fila se comprueba que el caos del tenant está apagado. Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se inicia sesión con `gestor@sigpro.test` (`Gestor1234!`) y se abre `/mission`. El corte se provoca cortando la conexión con la API (por ejemplo, poniendo el navegador sin conexión) y se restablece después, sin recargar la página. La API se arranca con `SIMULATOR_MS=0`.

## Criterios de aceptación
```gherkin
Característica: Indicador de conexión del panel de misión en la web

  Esquema del escenario: El indicador dice si la conexión en tiempo real está abierta
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto
    Cuando <situacion>
    Entonces el indicador dice <texto>
    Y al pasar el cursor por su icono se lee <explicacion>

    Ejemplos:
      | situacion | texto | explicacion |
      | la conexión en tiempo real está abierta | «En vivo» | «Conectado por WebSocket: los eventos llegan solos.» |
      | la prueba corta la conexión con la API y no la restablece | «Sin conexión» | «Sin conexión en tiempo real. Se reintentará automáticamente.» |

  Esquema del escenario: Al restablecerse la conexión vuelven el indicador «En vivo» y los eventos nuevos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto y la conexión con la API está cortada
    Cuando la prueba restablece la conexión y después alumno01@sigpro.lab provoca <n> eventos con POST /api/mission/tick
    Entonces el indicador dice «En vivo»
    Y la primera fila de la lista dice <texto_primero>

    Ejemplos:
      | n | texto_primero |
      | 1 | «Telemetría PRG-013: 766 paquetes/s» |
      | 2 | «Latido del centro de control (T+7)» |

  Esquema del escenario: Lo que ocurre durante el corte aparece al restablecerse la conexión
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto y la conexión con la API está cortada
    Cuando <accion_durante_corte> y la prueba restablece la conexión
    Entonces «NC abiertas» muestra <nc_abiertas>
    Y la lista <lista>

    Ejemplos:
      | accion_durante_corte | nc_abiertas | lista |
      | no ocurre ninguna acción | 8 | no incluye ningún evento nuevo |
      | alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución` | 9 | incluye el texto «NC-013 abierta (Menor) en PRG-002» |
      | alumno01@sigpro.lab provoca un evento con POST /api/mission/tick | 8 | incluye el texto «Telemetría PRG-013: 766 paquetes/s» |
```

## Fuera de alcance
- La renovación de la sesión cuando caduca el acceso, fuera del panel: EP-SESION (US-SESION-006 para la web).
- El inicio de sesión con el que se abre el panel: EP-LOGIN.
- La forma de los eventos y las cifras que llevan: US-MISION-FEED-003. Las cifras «NC abiertas», su gráfica y «Hitos cumplidos» en vivo: US-MISION-FEED-007.
- La campana de avisos y su contador, que también se ven en la cabecera: EP-NAVEGACION.

## Decisiones pendientes
- Si la web debe ofrecer un botón «Reintentar» cuando la conexión no se recupera sola. Hoy la web no tiene ese botón; la app móvil sí (US-MISION-FEED-011).
- Qué debe decir el aviso cuando la web agota los reintentos de renovación del token. Hoy, según el código, la web deja de intentar la conexión sin recargar la página, y el aviso sigue diciendo que se reintentará automáticamente. Esto describe lo que existe; no es un criterio.
