---
id: US-NC-GESTION-012
tipo: historia
epica: EP-NC-GESTION
titulo: "[Móvil] Comentar y cerrar una no conformidad desde su detalle"
etiquetas: [movil]
relacionadas: [US-NC-GESTION-004, US-NC-GESTION-005, US-NC-GESTION-008, US-NC-GESTION-009, US-NC-TABLERO-011]
verificacion: ejecutada
cubre: ["/nc"]
permisos: [nc.comment, nc.close]
---

## Historia
Como persona que sigue una no conformidad desde el móvil, quiero comentarla y cerrarla desde su detalle con las mismas reglas que en la web,
para que el hilo y el cierre sean los mismos en los dos lados.

## Reglas
- La hoja de detalle muestra «Comentarios (n)» con la lista de comentarios, el campo «Añadir comentario» con el texto de ayuda «Escribe un comentario para el equipo…» y el botón «Comentar». Cada comentario muestra su autor, la hora, el texto y, si no es un comentario normal, la etiqueta «Rápido» o «Cierre».
- Todos los roles pueden comentar, también `auditor`.
- Antes de enviar se recorta el texto. Si queda vacío, aparece «Escribe un comentario» bajo el campo y no se envía nada.
- Con texto válido, el comentario se añade al final de la lista, el número entre paréntesis sube en uno y el campo se vacía. La app móvil no muestra aviso al comentar (ver «Decisiones pendientes»).
- El botón «Mover a «Cerrada»» solo aparece cuando la no conformidad está en «Acción correctiva». No envía el cambio: abre dentro de la hoja el formulario de cierre, con el texto «Para cerrar la no conformidad indica cómo se resolvió. El comentario de cierre debe tener al menos 20 caracteres.», el campo «Comentario de cierre» con el contador «n / 20» (caracteres sin los espacios del principio y del final), y los botones «Cancelar» y «Cerrar no conformidad».
- La validación antes de enviar es la de la web: sin texto, «El comentario de cierre es obligatorio»; con menos de 20 caracteres, «El comentario de cierre debe tener al menos 20 caracteres». Bajo el campo, sin enviar nada.
- Con 20 caracteres o más, el cierre se envía con el texto recortado. Con éxito aparece el aviso «NC-003 cerrada» y la hoja de detalle se cierra.
- Permisos: `admin` y `program_manager` pueden cerrar. `consultant` ve «Mover a «Cerrada»» deshabilitado, con la explicación «Tu rol no permite cerrar no conformidades» visible bajo los botones. `auditor` no puede cambiar el estado: todos los botones «Mover a…» están deshabilitados, con la explicación «Tu rol no permite mover no conformidades» visible.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona de la fila abre la app en /login con `alumno01` en «Tenant de trabajo», inicia sesión, llega a /nc y toca NC-003, que tras el reinicio está en «Acción correctiva» y tiene 3 comentarios.
- En los ejemplos, `(N letras a)` es un texto de N letras `a` seguidas, sin espacios; `(tres espacios)` son tres espacios.

## Criterios de aceptación
```gherkin
Característica: Comentarios y cierre de una no conformidad en la app móvil

  Esquema del escenario: Un comentario válido se añade al final de la lista
    Dado que en el tenant alumno01, recién reiniciado, <correo> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto el detalle de NC-003
    Cuando escribe «Revisión pendiente de la acción correctiva» en «Añadir comentario» y pulsa «Comentar»
    Entonces el comentario aparece al final de la lista firmado por <autor>
    Y la sección muestra «Comentarios (4)»

    Ejemplos:
      | correo | autor |
      | gestor@sigpro.test | Javier Ortega |
      | auditor@sigpro.test | Andrés Molina |

  Esquema del escenario: Un comentario vacío no se envía
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto el detalle de NC-003
    Cuando escribe <texto> en «Añadir comentario» y pulsa «Comentar»
    Entonces ve el mensaje «Escribe un comentario» bajo el campo
    Y la sección sigue mostrando «Comentarios (3)»

    Ejemplos:
      | texto |
      | (vacío) |
      | (tres espacios) |

  Esquema del escenario: El cierre exige al menos 20 caracteres y muestra el contador
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto el detalle de NC-003
    Cuando pulsa «Mover a «Cerrada»» y escribe <texto> en «Comentario de cierre»
    Entonces el contador muestra <contador>
    Cuando pulsa «Cerrar no conformidad»
    Entonces <resultado>

    Ejemplos:
      | texto | contador | resultado |
      | (19 letras a) | 19 / 20 | ve el mensaje «El comentario de cierre debe tener al menos 20 caracteres» bajo el campo y no se envía nada |
      | (20 letras a) | 20 / 20 | ve el aviso «NC-003 cerrada» y la hoja de detalle se cierra |
      | (tres espacios) | 0 / 20 | ve el mensaje «El comentario de cierre es obligatorio» bajo el campo y no se envía nada |

  Esquema del escenario: Cada rol ve el cierre según su permiso
    Dado que en el tenant alumno01, recién reiniciado, <correo> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto el detalle de NC-003
    Cuando mira los botones de cambio de estado
    Entonces <resultado>

    Ejemplos:
      | correo | resultado |
      | gestor@sigpro.test | «Mover a «Cerrada»» está habilitado y al pulsarlo aparece el formulario de cierre |
      | consultor@sigpro.test | «Mover a «Cerrada»» está deshabilitado con la explicación «Tu rol no permite cerrar no conformidades» visible |
      | auditor@sigpro.test | todos los botones «Mover a…» están deshabilitados con la explicación «Tu rol no permite mover no conformidades» visible |
```

## Fuera de alcance
- Mover la no conformidad a los demás estados (en análisis, acción correctiva, rechazo y reapertura): EP-NC-TABLERO.
- La API del comentario y del cierre: US-NC-GESTION-004 y US-NC-GESTION-005.
- Las mismas acciones desde la web: US-NC-GESTION-008 y US-NC-GESTION-009.
- La edición de la no conformidad: US-NC-GESTION-011.

## Decisiones pendientes
- Si la app móvil debe mostrar el aviso «Comentario añadido» al comentar, como hace la web. Hoy no lo muestra.
- Si el hilo admite comentarios en una no conformidad cerrada o rechazada. Esta historia no lo afirma ni lo excluye.
