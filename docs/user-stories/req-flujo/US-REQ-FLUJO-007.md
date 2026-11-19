---
id: US-REQ-FLUJO-007
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[Web] Confirmar o cancelar el cambio de estado en un diálogo y ver el aviso de éxito"
etiquetas: [web]
relacionadas: [US-REQ-FLUJO-006, US-REQ-FLUJO-008, US-REQ-FLUJO-009, US-REQ-ARBOL-005]
verificacion: ejecutada
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona que cambia el estado de un requisito en la web, quiero leer en un diálogo qué va a pasar antes de confirmarlo, poder cancelarlo sin consecuencias y ver el resultado cuando se aplica,
para no cambiar un requisito por un clic equivocado y saber en qué estado queda.

## Reglas
- Pulsar un botón de transición habilitado abre el diálogo «Cambiar el estado de <código>». Su texto es «<código> pasará de <estado actual> a <estado nuevo>.», con los estados escritos con su nombre: Borrador, Aprobado, Verificado o Validado. Tiene los botones «Cancelar» y «Confirmar».
- «Cancelar» cierra el diálogo y el requisito conserva su estado.
- «Confirmar» pide el paso. Mientras se espera la respuesta, «Confirmar» está deshabilitado con la explicación «Procesando…».
- Si el paso se aplica, el diálogo se cierra y aparece el aviso «Estado actualizado» con el texto «<código> → <estado nuevo>». El aviso se cierra solo a los 3 segundos, el plazo que el producto fija para los avisos emergentes. El detalle pasa a mostrar el estado nuevo y el flujo de aprobación pasa al paso que le corresponde, y la fila del requisito en el árbol muestra también el estado nuevo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada y se identifica con su cuenta y su contraseña: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`) o `auditor@sigpro.test` (`Audit1234!`). Tras el reinicio, `REQ-001` está en Aprobado, `REQ-002` en Verificado y `REQ-017` en Borrador. La persona abre el detalle del requisito desde su fila en `/programs/<programa>/requirements`.

## Criterios de aceptación
```gherkin
Característica: Confirmación del cambio de estado en la web

  Esquema del escenario: Cancelar el diálogo deja el requisito en su estado
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de <requisito> en /programs/<programa>/requirements, que muestra el estado <estado>
    Cuando pulsa <boton> y después «Cancelar» en el diálogo
    Entonces el diálogo se cierra y el detalle sigue mostrando el estado <estado>
    Y no aparece el aviso «Estado actualizado»

    Ejemplos:
      | cuenta | requisito | programa | estado | boton |
      | gestor@sigpro.test | REQ-017 | PRG-002 | Borrador | «Aprobar» |
      | consultor@sigpro.test | REQ-001 | PRG-001 | Aprobado | «Marcar como verificado» |

  Esquema del escenario: Confirmar aplica el paso y muestra el aviso de éxito
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de <requisito> en /programs/<programa>/requirements, que muestra el estado <estado>
    Cuando pulsa <boton> y después «Confirmar» en el diálogo
    Entonces ve el aviso «Estado actualizado» con el texto <aviso>
    Y el detalle muestra el estado <nuevo>
    Y la fila de <requisito> en el árbol muestra el estado <nuevo>

    Ejemplos:
      | cuenta | requisito | programa | estado | boton | aviso | nuevo |
      | gestor@sigpro.test | REQ-017 | PRG-002 | Borrador | «Aprobar» | «REQ-017 → Aprobado» | Aprobado |
      | consultor@sigpro.test | REQ-001 | PRG-001 | Aprobado | «Marcar como verificado» | «REQ-001 → Verificado» | Verificado |
      | auditor@sigpro.test | REQ-002 | PRG-001 | Verificado | «Validar» | «REQ-002 → Validado» | Validado |
      | gestor@sigpro.test | REQ-001 | PRG-001 | Aprobado | «Volver a borrador» | «REQ-001 → Borrador» | Borrador |

  Esquema del escenario: Mientras se espera la respuesta, «Confirmar» no se puede volver a pulsar
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de REQ-017 en /programs/PRG-002/requirements, que muestra el estado Borrador
    Y la prueba retrasa <espera> la respuesta de POST /api/requirements/REQ-017/transition en el navegador
    Cuando pulsa «Aprobar» y después «Confirmar» en el diálogo
    Entonces durante la espera «Confirmar» está deshabilitado con la explicación «Procesando…»
    Y al llegar la respuesta ve el aviso «Estado actualizado» con el texto «REQ-017 → Aprobado»

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |
```

## Fuera de alcance
- Los botones que llevan al cambio y su explicación cuando están deshabilitados: en esta misma épica, en la historia de los botones de la web.
- El error del servidor dentro del diálogo: en esta misma épica, en la historia de los errores de la web.
- La lectura del estado con su nombre y del flujo de aprobación: en esta misma épica, en la historia del flujo de la web.
- La edición del título o de la descripción, que devuelve el requisito a borrador: EP-REQ-EDICION.
