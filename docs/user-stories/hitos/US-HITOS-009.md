---
id: US-HITOS-009
tipo: historia
epica: EP-HITOS
titulo: "[Web] Borrar un hito desde su menú con confirmación"
etiquetas: [web]
relacionadas: [US-HITOS-005, US-HITOS-006, US-HITOS-012]
verificacion: ejecutada
cubre: ["/programs/:code"]
permisos: [milestone.delete]
---

## Historia
Como gestor de programas que trabaja en la web, quiero borrar un hito que sobra desde su menú, con una confirmación antes,
para no perderlo por un clic accidental y ver el programa actualizado después de borrarlo.

## Reglas
- El menú ⋯ de cada fila, con el nombre «Acciones para el hito» seguido del nombre del hito, ofrece «Renombrar» y «Eliminar».
- «Eliminar» abre un diálogo de confirmación titulado «Eliminar hito», con el texto «¿Eliminar el hito «nombre»? El avance del programa se recalculará.» y los botones «Eliminar» y «Cancelar». Nada se borra hasta confirmar.
- «Cancelar» cierra el diálogo. El hito sigue en la tabla y no aparece ningún aviso.
- «Eliminar» borra el hito: desaparece de la tabla, aparece el aviso «Hito eliminado» con el nombre del hito, el recuento se actualiza y la cabecera del programa muestra su nuevo avance.
- Si el servidor rechaza el borrado, el hito sigue en la tabla y aparece el aviso «No se pudo guardar el hito».
- Los roles admin y program_manager pueden borrar. Con los roles consultant y auditor, la opción «Eliminar» del menú está deshabilitada y, al pasar el ratón por ella, se ve el motivo «Tu rol no permite eliminar hitos».
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos. SRR está cumplido, PDR va al 10 % y el resto al 0 %. El recuento es «1 de 9 hitos cumplidos» y el avance del programa es 11 %.
- Preparación de cada fila: en el tenant `alumno01`, se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada y se entra con la cuenta de la fila (`gestor@sigpro.test` con `Gestor1234!`, `consultor@sigpro.test` con `Consul1234!` o `auditor@sigpro.test` con `Audit1234!`) hasta llegar a `/programs`. Desde ahí se abre `/programs/PRG-001` y la pestaña «Hitos».
- Para la fila de error, la prueba responde 500 a `DELETE /api/milestones/PRG-001-M02` en el navegador antes de confirmar el borrado.

## Criterios de aceptación
```gherkin
Característica: Borrado de hitos en la web

  Esquema del escenario: Confirmar o cancelar el borrado de un hito
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada y ha elegido la pestaña «Hitos» de PRG-001
    Cuando abre el menú de <hito>, elige «Eliminar» y <accion>
    Entonces <resultado>

    Ejemplos:
      | hito | accion | resultado |
      | «PDR» | pulsa «Cancelar» | el diálogo se cierra, «PDR» sigue en la tabla y no aparece ningún aviso |
      | «PDR» | pulsa «Eliminar» | «PDR» desaparece de la tabla, aparece el aviso «Hito eliminado» con «PDR» y el recuento dice «1 de 8 hitos cumplidos» |
      | «SRR» | pulsa «Eliminar» | «SRR» desaparece de la tabla, el recuento dice «0 de 8 hitos cumplidos» y la cabecera del programa muestra 0% |

  Esquema del escenario: Un rol sin permiso de borrado no puede eliminar desde el menú
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha entrado en /programs con sesión iniciada y ha elegido la pestaña «Hitos» de PRG-001
    Cuando abre el menú de «SRR»
    Entonces «Eliminar» está deshabilitado y al pasar el ratón por él se ve el motivo «Tu rol no permite eliminar hitos»

    Ejemplos:
      | cuenta |
      | consultor@sigpro.test |
      | auditor@sigpro.test |

  Esquema del escenario: Un borrado que el servidor rechaza deja el hito en la tabla
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada, ha elegido la pestaña «Hitos» de PRG-001 y la prueba responde 500 a DELETE /api/milestones/PRG-001-M02 en el navegador
    Cuando abre el menú de <hito>, elige «Eliminar» y pulsa «Eliminar» en el diálogo
    Entonces ve el aviso «No se pudo guardar el hito» y <hito> sigue en la tabla

    Ejemplos:
      | hito |
      | «PDR» |
```

## Fuera de alcance
- Eliminar el programa completo: EP-PROG-GESTION.
- La tabla de hitos, su recuento y los permisos de cada rol: EP-HITOS, en la historia de la pestaña «Hitos» de la web.
- La regla de borrado de la API: EP-HITOS, en la historia de la API de borrado.
- La cabecera del programa y su avance: EP-PROG-DETALLE.
