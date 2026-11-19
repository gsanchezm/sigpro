---
id: US-HITOS-012
tipo: historia
epica: EP-HITOS
titulo: "[Móvil] Mover el avance de un hito de 5 en 5 y borrarlo con confirmación"
etiquetas: [movil]
relacionadas: [US-HITOS-004, US-HITOS-005, US-HITOS-008, US-HITOS-009]
verificacion: codigo
cubre: ["/programs/:code"]
permisos: [milestone.edit, milestone.delete]
---

## Historia
Como gestor de programas que trabaja desde el móvil, quiero subir o bajar el avance de un hito de 5 en 5, y borrar un hito con confirmación,
para registrar el avance sobre la marcha y quitar un hito que sobra sin equivocarme.

## Reglas
- Cada tarjeta de hito tiene un control de avance, «Avance de» seguido del nombre del hito, con los botones «−» y «+». Cada pulsación cambia el avance en 5 puntos. El avance no baja de 0 % ni sube de 100 %: el botón que no puede aplicarse queda deshabilitado.
- Cada pulsación guarda el avance. El valor nuevo se muestra mientras se guarda y, si el servidor rechaza el cambio, vuelve al valor anterior y aparece el aviso «No se pudo guardar el hito» con una línea técnica que esta historia no afirma. Con varias pulsaciones seguidas, el valor que queda es el de la última.
- Con un avance de 100 el hito queda «Cumplido». Cada cambio guardado muestra el aviso «Hito actualizado» con «nombre del hito · avance n %». El recuento de la pestaña se actualiza.
- El menú ⋯ de cada tarjeta, con el nombre «Acciones para el hito» seguido del nombre del hito, ofrece «Eliminar». Esta opción abre una hoja de confirmación titulada «Eliminar hito», con el texto «¿Eliminar el hito «nombre»? El avance del programa se recalculará.» y los botones «Eliminar» y «Cancelar».
- «Cancelar» cierra la hoja sin borrar. «Eliminar» borra el hito: desaparece de la lista, aparece el aviso «Hito eliminado» con el nombre del hito y el recuento se actualiza.
- Los roles admin y program_manager pueden mover el avance y borrar. Con los roles consultant y auditor, los botones de avance quedan deshabilitados y «Eliminar» también, y cada uno muestra su motivo como texto: «Tu rol no permite modificar hitos» y «Tu rol no permite eliminar hitos».
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos. SRR está cumplido, PDR va al 10 % y el resto al 0 %. El recuento es «1 de 9 hitos cumplidos».
- Preparación de cada fila: en el tenant `alumno01`, se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, en la app móvil, se entra con `gestor@sigpro.test` (`Gestor1234!`) con `alumno01` en «Tenant de trabajo», hasta llegar a Programas. Desde ahí se abre `/programs/PRG-001` y elige la pestaña «Hitos». Las filas que necesitan un avance concreto lo fijan antes con `PATCH /api/milestones/PRG-001-M02` y el `accessToken` de `gestor@sigpro.test`, obtenido con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`.
- Para la fila de error, la prueba responde 500 a `PATCH /api/milestones/PRG-001-M02` en la app antes de pulsar.

## Criterios de aceptación
```gherkin
Característica: Avance de 5 en 5 y borrado de hitos en la app móvil

  Esquema del escenario: Los botones − y + mueven el avance de 5 en 5 sin salirse de 0 a 100
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil, ha elegido la pestaña «Hitos» de PRG-001 y <preparacion>
    Cuando pulsa el botón <boton> del control de avance de <hito>
    Entonces <resultado>

    Ejemplos:
      | hito | preparacion | boton | resultado |
      | «PDR» | PDR tiene el avance del seed (10 %) | «+» | el avance de PDR pasa a 15 % y su estado sigue «En curso» |
      | «CDR» | CDR tiene el avance del seed (0 %) | «−» | el botón «−» está deshabilitado y el avance de CDR sigue en 0 % |
      | «SRR» | SRR tiene el avance del seed (100 %) | «+» | el botón «+» está deshabilitado y el avance de SRR sigue en 100 % |
      | «SRR» | SRR tiene el avance del seed (100 %) | «−» | el avance de SRR pasa a 95 %, su estado pasa a «En curso» y el recuento dice «0 de 9 hitos cumplidos» |
      | «PDR» | PDR se ha llevado a 95 % con PATCH /api/milestones/PRG-001-M02 | «+» | el avance de PDR pasa a 100 %, su estado pasa a «Cumplido» y el recuento dice «2 de 9 hitos cumplidos» |

  Esquema del escenario: Un avance que el servidor rechaza vuelve al valor anterior
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil, ha elegido la pestaña «Hitos» de PRG-001 y la prueba responde 500 a PATCH /api/milestones/PRG-001-M02 en la app
    Cuando pulsa el botón «+» del control de avance de «PDR»
    Entonces ve el aviso «No se pudo guardar el hito», el avance de PDR vuelve a 10 % y su estado sigue «En curso»

    Ejemplos:
      | hito |
      | PDR |

  Esquema del escenario: Eliminar un hito desde su menú pide confirmación
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha elegido la pestaña «Hitos» de PRG-001
    Cuando abre el menú de «PDR», pulsa «Eliminar» y <accion>
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | pulsa «Cancelar» | la hoja se cierra y «PDR» sigue en la lista sin ningún aviso |
      | pulsa «Eliminar» | «PDR» desaparece de la lista, aparece el aviso «Hito eliminado» con «PDR» y el recuento dice «1 de 8 hitos cumplidos» |
```

## Fuera de alcance
- El alta, la edición del nombre y de la fecha, y el aviso de guardado de la hoja de edición: EP-HITOS, en la historia móvil de hojas.
- La lista de hitos en tarjetas, sus estados y los permisos de cada rol: EP-HITOS, en la historia móvil de la lista.
- La regla del avance que aplica la API y el borrado en la API y en la web: EP-HITOS, en sus historias de la API de avance y de borrado, y en la historia web de borrado.
- La ficha del programa y sus demás opciones: EP-PROG-DETALLE.
