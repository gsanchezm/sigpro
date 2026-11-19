---
id: US-MISION-KPI-012
tipo: historia
epica: EP-MISION-KPI
titulo: "[Móvil] Botón «Emitir evento de prueba»: solo lo pulsa el administrador"
etiquetas: [movil]
relacionadas: [US-MISION-KPI-004, US-MISION-KPI-005, US-MISION-KPI-009]
verificacion: codigo
cubre: ["/mission"]
permisos: [users.manage]
---

## Historia
Como administrador de un tenant que prueba el panel de misión desde el móvil, quiero pulsar «Emitir evento de prueba» para emitir ya el siguiente evento del simulador,
para comprobar el panel desde el móvil sin esperar al temporizador; y, como el resto de roles, quiero ver el botón deshabilitado con el motivo escrito debajo, para no pulsar un botón que no me corresponde.

## Reglas
- El botón «Emitir evento de prueba» está debajo de las gráficas del panel. Solo lo puede pulsar quien tiene el permiso `users.manage`, que es el administrador. Para los demás roles aparece deshabilitado y, debajo del botón, se lee el texto «Solo admin puede emitir eventos de prueba».
- Al pulsarlo, la app pide la emisión a la API. Mientras la emisión está en curso, el botón está ocupado y no se puede volver a pulsar.
- Si la emisión responde bien, aparece un aviso de éxito con el texto «Evento emitido». El aviso se cierra solo a los 3 segundos.
- Si la emisión falla, aparece un aviso de error con el título «Ha ocurrido un error inesperado». Debajo aparece la traza de la respuesta, que empieza por el método, la ruta y el código de estado, o, si no hubo respuesta, el texto «No se pudo contactar con el servidor». El aviso se cierra solo a los 3 segundos.
- Pulsar el botón no cambia las cuatro tarjetas ni las gráficas: el evento emitido llega al feed de la misión, que no forma parte de esta historia.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado. Después se abre la app móvil sin sesión, se escribe `alumno01` en «Tenant de trabajo», se inicia sesión con la cuenta de la fila y se abre la pestaña «Misión».

## Criterios de aceptación
```gherkin
Característica: Botón de emitir un evento de prueba en el panel de misión de la app móvil

  Esquema del escenario: Solo el administrador puede pulsar el botón
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la app móvil con la contraseña <contraseña>, con alumno01 en «Tenant de trabajo», y tiene abierta la pestaña «Misión»
    Cuando la carga ha terminado
    Entonces el botón «Emitir evento de prueba» <estado>

    Ejemplos:
      | cuenta | contraseña | estado |
      | alumno01@sigpro.lab | Alumno1234! | está habilitado |
      | gestor@sigpro.test | Gestor1234! | está deshabilitado y debajo se lee «Solo admin puede emitir eventos de prueba» |
      | auditor@sigpro.test | Audit1234! | está deshabilitado y debajo se lee «Solo admin puede emitir eventos de prueba» |

  Esquema del escenario: La respuesta de la emisión se muestra como aviso
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Misión» con las cifras cargadas
    Cuando pulsa «Emitir evento de prueba» y la respuesta de la emisión es <respuesta>
    Entonces <resultado>
    Y las cuatro tarjetas siguen mostrando 12, 49 %, 8 y 56 %

    Ejemplos:
      | respuesta | resultado |
      | 200 | aparece el aviso «Evento emitido» y el botón vuelve a estar habilitado |
      | 503 | aparece el aviso «Ha ocurrido un error inesperado» con la traza de la respuesta, que empieza por «POST /api/mission/tick → 503», y el botón vuelve a estar habilitado |
```

## Fuera de alcance
- El contrato de `POST /api/mission/tick`, su permiso y su respuesta: US-MISION-KPI-005, de esta misma épica.
- El evento que llega al feed de la misión y su texto: EP-MISION-FEED.
- El botón de la web: US-MISION-KPI-009, de esta misma épica.
