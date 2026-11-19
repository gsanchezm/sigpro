---
id: US-REQ-FLUJO-011
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[Móvil] Confirmar, cancelar o ver el error del cambio de estado en la hoja"
etiquetas: [movil]
relacionadas: [US-REQ-FLUJO-007, US-REQ-FLUJO-008, US-REQ-FLUJO-010, US-REQ-FLUJO-012]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona que cambia el estado de un requisito desde el móvil, quiero confirmar o cancelar el cambio en una confirmación clara y, si el servidor lo rechaza, ver el error sin perder la confirmación,
para cambiar el estado con el mismo control que en la web y no perder lo que estaba haciendo.

## Reglas
- Pulsar un botón de transición habilitado abre una confirmación con el título «Cambiar el estado de <código>» y el texto «<código> pasará de <estado actual> a <estado nuevo>.», con los estados escritos con su nombre: Borrador, Aprobado, Verificado o Validado. Tiene los botones «Cancelar» y «Confirmar».
- «Cancelar» cierra la confirmación y el requisito conserva su estado. Mientras se espera la respuesta, «Cancelar» no se puede pulsar.
- «Confirmar» pide el paso. Si el paso se aplica, la confirmación se cierra, aparece el aviso «Estado actualizado» con el texto «<código> → <estado nuevo>», la hoja muestra el estado nuevo y el aviso se cierra solo a los 3 segundos, el plazo que el producto fija para los avisos emergentes.
- Si el servidor rechaza el paso, la confirmación sigue abierta y muestra dentro de ella un aviso de error. No aparece el aviso «Estado actualizado» y el requisito conserva el estado que tiene en el servidor.
- En la app móvil no se pide ningún paso que el rol no tiene, porque su botón está deshabilitado. El caso de error aparece cuando la hoja muestra un estado que el servidor ya no tiene, porque otra cuenta cambió el requisito después de abrirla.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la app está en /login sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y la persona se identifica como `gestor@sigpro.test` (`Gestor1234!`) o `consultor@sigpro.test` (`Consul1234!`). Tras el reinicio, `REQ-017` está en Borrador (en `PRG-002`), `REQ-001` en Aprobado y `REQ-002` en Verificado (estos dos en `PRG-001`). En el caso de error, después de abrir la hoja, `alumno01@sigpro.lab` cambia el requisito con la API, en un paso válido.

## Criterios de aceptación
```gherkin
Característica: Confirmación del cambio de estado en la app móvil

  Esquema del escenario: Confirmar aplica el paso y muestra el aviso de éxito en la hoja
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierta la hoja de <requisito> en /programs/<programa>/requirements, que muestra el estado <estado>
    Cuando pulsa <boton> y después «Confirmar» en la confirmación
    Entonces ve el aviso «Estado actualizado» con el texto <aviso>
    Y la hoja muestra el estado <nuevo>

    Ejemplos:
      | cuenta | requisito | programa | estado | boton | aviso | nuevo |
      | gestor@sigpro.test | REQ-017 | PRG-002 | Borrador | «Aprobar» | «REQ-017 → Aprobado» | Aprobado |
      | auditor@sigpro.test | REQ-002 | PRG-001 | Verificado | «Validar» | «REQ-002 → Validado» | Validado |

  Esquema del escenario: Cancelar la confirmación deja el requisito en su estado
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierta la hoja de <requisito> en /programs/<programa>/requirements, que muestra el estado <estado>
    Cuando pulsa <boton> y después «Cancelar» en la confirmación
    Entonces la confirmación se cierra y la hoja sigue mostrando el estado <estado>
    Y no aparece el aviso «Estado actualizado»

    Ejemplos:
      | cuenta | requisito | programa | estado | boton |
      | gestor@sigpro.test | REQ-017 | PRG-002 | Borrador | «Aprobar» |
      | consultor@sigpro.test | REQ-001 | PRG-001 | Aprobado | «Marcar como verificado» |

  Esquema del escenario: Un paso que el servidor rechaza deja la confirmación abierta con el error
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierta la hoja de <requisito> en /programs/<programa>/requirements, que muestra el estado <estado_mostrado>
    Y después alumno01@sigpro.lab cambia <requisito> a <estado_servidor> con la API
    Cuando pulsa <boton> y después «Confirmar» en la confirmación
    Entonces aparece dentro de la confirmación un aviso de error y la confirmación sigue abierta
    Y no aparece el aviso «Estado actualizado»
    Y una lectura de <requisito> con la API devuelve el estado <estado_servidor>

    Ejemplos:
      | cuenta | requisito | programa | estado_mostrado | estado_servidor | boton |
      | gestor@sigpro.test | REQ-017 | PRG-002 | Borrador | Aprobado | «Aprobar» |
      | consultor@sigpro.test | REQ-001 | PRG-001 | Aprobado | Borrador | «Marcar como verificado» |
```

## Fuera de alcance
- La lectura de la hoja del requisito y de sus campos: EP-REQ-ARBOL.
- Los botones de transición y sus motivos cuando están deshabilitados: en esta misma épica, en la historia de los botones de la app móvil.
- El cierre de la confirmación con el botón atrás del sistema en Android: en esta misma épica, en la historia de Android.
- La edición, el borrado y el movimiento de un requisito: EP-REQ-EDICION.

## Decisiones pendientes
- La línea de detalle técnico que muestra la confirmación bajo el aviso de error: hoy incluye la petición HTTP real (método, ruta, código de estado y traza), igual que en la web. No está decidido si forma parte del producto ni qué debe contener. Ningún ejemplo depende de su texto: el veredicto depende de que la confirmación siga abierta, de que no aparezca el aviso «Estado actualizado» y de que el estado no cambie.
