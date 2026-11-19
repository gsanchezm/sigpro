---
id: US-NC-GESTION-008
tipo: historia
epica: EP-NC-GESTION
titulo: "[Web] Comentar una no conformidad en su hilo de comentarios"
etiquetas: [web]
relacionadas: [US-NC-GESTION-004, US-NC-GESTION-012, US-NC-GESTION-009]
verificacion: codigo
cubre: ["/nc/:code"]
permisos: [nc.comment]
---

## Historia
Como persona que sigue una no conformidad, quiero escribir un comentario en su hilo y verlo al final con mi nombre y la hora,
para que el equipo sepa lo que se ha hecho y lo que queda pendiente.

## Reglas
- La sección «Comentarios» del detalle muestra el número entre paréntesis, por ejemplo «Comentarios (3)». Cada comentario muestra el nombre de su autor, la fecha y la hora, el texto y, si no es un comentario normal, una etiqueta: «Rápido» para el comentario rápido y «Cierre» para el comentario de cierre.
- Sin comentarios aparece «Todavía no hay comentarios».
- Debajo de la lista están el campo «Añadir comentario», con el texto de ayuda «Escribe un comentario para el equipo…», y el botón «Comentar».
- Todos los roles pueden comentar, también `auditor`.
- Antes de enviar se recorta el texto de los espacios del principio y del final. Si queda vacío, aparece «Escribe un comentario» bajo el campo. Si tiene más de 1000 caracteres tras recortar, aparece «El comentario es demasiado largo (máx. 1000 caracteres)». En los dos casos no se envía nada.
- Con texto válido, el comentario se añade al final de la lista, el número del título sube en uno, el campo se vacía y aparece el aviso «Comentario añadido».
- Tras el reinicio, NC-003 tiene 3 comentarios: el segundo, de «Pablo Serrano», lleva la etiqueta «Rápido». NC-004 está cerrada y tiene un único comentario, el de cierre, de «Javier Ortega», con la etiqueta «Cierre».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona de la fila inicia sesión en /login?tenant=alumno01 y abre /nc/NC-003.
- En los ejemplos, `(1000 letras a)` es un texto de mil letras `a` seguidas, sin espacios; `(tres espacios)` son tres espacios.

## Criterios de aceptación
```gherkin
Característica: Comentarios de una no conformidad en la web

  Esquema del escenario: Un comentario válido se añade al final del hilo
    Dado que en el tenant alumno01, recién reiniciado, <correo> ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando escribe «Revisión pendiente de la acción correctiva» en «Añadir comentario» y pulsa «Comentar»
    Entonces ve el aviso «Comentario añadido»
    Y la sección muestra «Comentarios (4)» con el comentario nuevo al final, firmado por <autor>

    Ejemplos:
      | correo | autor |
      | gestor@sigpro.test | Javier Ortega |
      | auditor@sigpro.test | Andrés Molina |

  Esquema del escenario: Un comentario vacío no se envía
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando escribe <texto> en «Añadir comentario» y pulsa «Comentar»
    Entonces ve el mensaje «Escribe un comentario» bajo el campo
    Y la sección sigue mostrando «Comentarios (3)»
    Y no se envía ninguna petición de comentario

    Ejemplos:
      | texto |
      | (vacío) |
      | (tres espacios) |

  Esquema del escenario: El texto se acepta hasta 1000 caracteres
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando escribe <texto> en «Añadir comentario» y pulsa «Comentar»
    Entonces <resultado>

    Ejemplos:
      | texto | resultado |
      | (1000 letras a) | ve el aviso «Comentario añadido» y la sección muestra «Comentarios (4)» |
      | (1001 letras a) | ve el mensaje «El comentario es demasiado largo (máx. 1000 caracteres)» bajo el campo, la sección sigue mostrando «Comentarios (3)» y no se envía ninguna petición |

  Esquema del escenario: Cada comentario muestra la etiqueta de su tipo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01
    Cuando abre /nc/<codigo>
    Entonces el comentario de <autor> lleva la etiqueta <etiqueta>

    Ejemplos:
      | codigo | autor | etiqueta |
      | NC-003 | Pablo Serrano | «Rápido» |
      | NC-004 | Javier Ortega | «Cierre» |
```

## Fuera de alcance
- El comentario rápido que se escribe desde la tarjeta del tablero con el diálogo del navegador: EP-NC-TABLERO.
- El comentario de cierre que crea el cierre de la no conformidad: US-NC-GESTION-009.
- La misma función desde la app móvil: US-NC-GESTION-012.
- Las reglas de la API para el comentario: US-NC-GESTION-004.

## Decisiones pendientes
- Si el hilo admite comentarios en una no conformidad cerrada o rechazada. Esta historia no lo afirma ni lo excluye.
