---
id: US-NC-GESTION-009
tipo: historia
epica: EP-NC-GESTION
titulo: "[Web] Cerrar una no conformidad con el comentario de cierre"
etiquetas: [web]
relacionadas: [US-NC-GESTION-005, US-NC-GESTION-012, US-NC-GESTION-008, US-NC-TABLERO-008, US-NC-TABLERO-009]
verificacion: ejecutada
cubre: ["/nc/:code"]
permisos: [nc.close]
---

## Historia
Como administrador o gestor de programas, quiero cerrar una no conformidad que está en «Acción correctiva» explicando cómo se resolvió,
para que el cierre quede justificado en su propio hilo de comentarios.

## Reglas
- El cierre se ofrece de dos maneras, con el mismo formulario:
  - en el detalle, con el botón «Pasar a «Cerrada»», que solo aparece cuando la no conformidad está en «Acción correctiva»; el formulario de cierre aparece en su lugar, dentro del detalle;
  - en el tablero, al soltar la tarjeta en la columna «Cerrada» desde «Acción correctiva»; se abre el diálogo «Cerrar NC-003» con el formulario.
- El formulario tiene el texto «Para cerrar la no conformidad indica cómo se resolvió. El comentario de cierre debe tener al menos 20 caracteres.», el campo «Comentario de cierre» (obligatorio), un contador «n / 20» que cuenta los caracteres sin los espacios del principio y del final y se actualiza al escribir, y los botones «Cancelar» y «Cerrar no conformidad».
- Antes de enviar se valida el texto recortado. Si está vacío, aparece «El comentario de cierre es obligatorio». Si tiene menos de 20 caracteres, aparece «El comentario de cierre debe tener al menos 20 caracteres». En los dos casos el mensaje aparece bajo el campo y no se envía ninguna petición.
- Con 20 caracteres o más se envía el texto recortado. La no conformidad pasa a «Cerrada»: aparece el aviso «NC-003 cerrada», el estado del detalle es «Cerrada», el comentario de cierre aparece al final del hilo con la etiqueta «Cierre» y la sección de cambio de estado dice «Sin más cambios de estado posibles».
- Pueden cerrar `admin` y `program_manager`. Los roles `consultant` y `auditor` ven el botón «Pasar a «Cerrada»» deshabilitado, con la explicación «Tu rol no permite cerrar no conformidades».
- «Cancelar» cierra el formulario o el diálogo sin enviar nada: la no conformidad sigue en «Acción correctiva».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona de la fila inicia sesión en /login?tenant=alumno01 y abre /nc/NC-003, que tras el reinicio está en «Acción correctiva».
- En los ejemplos, `(N letras a)` es un texto de N letras `a` seguidas, sin espacios; `(un espacio, N letras a y un espacio)` lleva un espacio delante y otro detrás.

## Criterios de aceptación
```gherkin
Característica: Cierre de una no conformidad en la web

  Esquema del escenario: El comentario de cierre debe tener al menos 20 caracteres tras recortar los espacios
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando pulsa «Pasar a «Cerrada»» y escribe <texto> en «Comentario de cierre»
    Entonces el contador muestra <contador>
    Cuando pulsa «Cerrar no conformidad»
    Entonces <resultado>

    Ejemplos:
      | texto | contador | resultado |
      | (19 letras a) | 19 / 20 | ve el mensaje «El comentario de cierre debe tener al menos 20 caracteres» bajo el campo y no se envía ninguna petición |
      | (20 letras a) | 20 / 20 | ve el aviso «NC-003 cerrada» |
      | (21 letras a) | 21 / 20 | ve el aviso «NC-003 cerrada» |
      | (un espacio, 19 letras a y un espacio) | 19 / 20 | ve el mensaje «El comentario de cierre debe tener al menos 20 caracteres» bajo el campo y no se envía ninguna petición |
      | (un espacio, 20 letras a y un espacio) | 20 / 20 | ve el aviso «NC-003 cerrada» |

  Esquema del escenario: Un comentario de cierre vacío no se envía
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando pulsa «Pasar a «Cerrada»» y escribe <texto> en «Comentario de cierre»
    Y pulsa «Cerrar no conformidad»
    Entonces ve el mensaje «El comentario de cierre es obligatorio» bajo el campo
    Y no se envía ninguna petición de cierre

    Ejemplos:
      | texto |
      | (vacío) |
      | (tres espacios) |

  Esquema del escenario: Solo admin y program_manager pueden cerrar desde el detalle
    Dado que en el tenant alumno01, recién reiniciado, <correo> ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando mira el botón «Pasar a «Cerrada»»
    Entonces <resultado>

    Ejemplos:
      | correo | resultado |
      | alumno01@sigpro.lab | el botón está habilitado y al pulsarlo aparece el formulario de cierre en el detalle |
      | gestor@sigpro.test | el botón está habilitado y al pulsarlo aparece el formulario de cierre en el detalle |
      | consultor@sigpro.test | el botón está deshabilitado con la explicación «Tu rol no permite cerrar no conformidades» |
      | auditor@sigpro.test | el botón está deshabilitado con la explicación «Tu rol no permite cerrar no conformidades» |

  Esquema del escenario: Soltar la tarjeta en «Cerrada» abre el mismo formulario en un diálogo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /nc con NC-003 en la columna «Acción correctiva»
    Cuando suelta la tarjeta de NC-003 en la columna «Cerrada», escribe <texto> en «Comentario de cierre» y pulsa «Cerrar no conformidad»
    Entonces <resultado>

    Ejemplos:
      | texto | resultado |
      | (19 letras a) | ve el mensaje «El comentario de cierre debe tener al menos 20 caracteres» y el diálogo «Cerrar NC-003» sigue abierto |
      | (20 letras a) | ve el aviso «NC-003 cerrada», el diálogo se cierra y la tarjeta queda en la columna «Cerrada» |

  Esquema del escenario: Cancelar no cierra la no conformidad
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el formulario de cierre de NC-003 con (20 letras a) escrito
    Cuando <intento>
    Entonces el formulario se cierra
    Y NC-003 sigue en «Acción correctiva»

    Ejemplos:
      | intento |
      | pulsa «Cancelar» |
```

## Fuera de alcance
- Los demás pasos de estado (en análisis, rechazo y reapertura) y el movimiento de las tarjetas hacia otras columnas: EP-NC-TABLERO.
- La API del cierre y el orden de sus comprobaciones: US-NC-GESTION-005.
- El cierre desde la app móvil: US-NC-GESTION-012.
- El hilo de comentarios y su contador: US-NC-GESTION-008.
