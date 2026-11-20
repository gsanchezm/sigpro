---
id: US-MISION-KPI-009
tipo: historia
epica: EP-MISION-KPI
titulo: "[Web] Botón «Simular evento»: solo lo pulsa el administrador"
etiquetas: [web]
relacionadas: [US-MISION-KPI-004, US-MISION-KPI-005, US-MISION-KPI-012, US-MISION-FEED-006]
verificacion: ejecutada
cubre: ["/mission"]
permisos: [users.manage]
---

## Historia
Como administrador de un tenant que prueba el panel de misión en la web, quiero pulsar «Simular evento» para emitir ya el siguiente evento del simulador,
para comprobar el panel sin esperar al temporizador; y, como el resto de roles, quiero ver el botón deshabilitado con el motivo escrito, para no pulsar un botón que no me corresponde.

## Reglas
- El botón «Simular evento» está en la cabecera del panel, junto al indicador de conexión. Solo lo puede pulsar quien tiene el permiso `users.manage`, que es el administrador. Para los demás roles aparece deshabilitado y, al pasar el puntero sobre él, muestra el texto «Solo admin puede emitir eventos de prueba».
- Al pulsarlo, la web pide la emisión a la API. Mientras la petición está en curso, el botón está ocupado y deshabilitado, y no se puede volver a pulsar.
- Pulsar el botón no cambia las cuatro tarjetas ni las gráficas: el evento emitido llega al feed de la misión, que no forma parte de esta historia.
- Si la petición falla, aparece un aviso de error con el título «Ha ocurrido un error inesperado». Debajo aparece la traza de la respuesta, que empieza por el método, la ruta y el código de estado, o, si no hubo respuesta, el texto «No se pudo contactar con el servidor». El aviso se cierra solo a los 3 segundos.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado. Después se abre `/login?tenant=alumno01` en un navegador sin sesión de SIGPRO guardada, se inicia sesión con la cuenta de la fila y se abre `/mission`.

## Criterios de aceptación
```gherkin
Característica: Botón de emitir un evento de prueba en el panel de misión de la web

  Esquema del escenario: Solo el administrador puede pulsar el botón
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la web con la contraseña <contraseña> y tiene abierto /mission
    Cuando la página ha terminado de cargar
    Entonces el botón «Simular evento» <estado>

    Ejemplos:
      | cuenta | contraseña | estado |
      | alumno01@sigpro.lab | Alumno1234! | está habilitado |
      | gestor@sigpro.test | Gestor1234! | está deshabilitado y, al pasar el puntero sobre él, muestra «Solo admin puede emitir eventos de prueba» |
      | auditor@sigpro.test | Audit1234! | está deshabilitado y, al pasar el puntero sobre él, muestra «Solo admin puede emitir eventos de prueba» |

  Esquema del escenario: Pulsar el botón emite un evento y no cambia las cifras
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234! y tiene abierto /mission con las cifras cargadas
    Cuando pulsa «Simular evento» y la respuesta de la emisión es <respuesta>
    Entonces <resultado>
    Y las cuatro tarjetas siguen mostrando 12, 49 %, 8 y 56 %

    Ejemplos:
      | respuesta | resultado |
      | 200 | el botón vuelve a estar habilitado y no aparece ningún aviso de error |
      | 503 | aparece el aviso «Ha ocurrido un error inesperado» con la traza de la respuesta, que empieza por «POST /api/mission/tick → 503», y el botón vuelve a estar habilitado |
```

## Decisiones pendientes
- Si al emitir con éxito debe aparecer el aviso «Evento emitido». El catálogo de textos lo tiene y la app móvil lo muestra al emitir, pero hoy la web no muestra ningún aviso de éxito. Ninguna fila lo afirma ni lo excluye.

## Fuera de alcance
- El contrato de `POST /api/mission/tick`, su permiso y su respuesta: US-MISION-KPI-005, de esta misma épica.
- El evento que llega al feed de la misión y su texto: EP-MISION-FEED.
- El botón de emitir en la app móvil: US-MISION-KPI-012, de esta misma épica.
