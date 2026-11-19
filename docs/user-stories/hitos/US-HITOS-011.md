---
id: US-HITOS-011
tipo: historia
epica: EP-HITOS
titulo: "[Móvil] Crear un hito y editar su nombre o su fecha en una hoja"
etiquetas: [movil]
relacionadas: [US-HITOS-002, US-HITOS-003, US-HITOS-007]
verificacion: codigo
cubre: ["/programs/:code"]
permisos: [milestone.edit]
---

## Historia
Como gestor de programas que trabaja desde el móvil, quiero añadir un hito y cambiar su nombre o su fecha límite en una hoja,
para planificar sobre la marcha sin tener que abrir la web.

## Reglas
- «Nuevo hito» abre una hoja titulada «Nuevo hito», con el código del programa, los campos «Nombre» y «Fecha límite» (este último con el marcador «AAAA-MM-DD») y los botones «Cancelar» y «Crear hito».
- Al enviar, los campos se validan con las reglas de la API: el nombre se recorta y debe tener de 2 a 80 caracteres, y la fecha límite debe tener la forma AAAA-MM-DD y existir en el calendario. Un campo no válido muestra su motivo debajo de él, con el texto exacto: «El nombre debe tener al menos 2 caracteres», «El nombre es demasiado largo (máx. 80 caracteres)» o «Indica una fecha válida». La hoja sigue abierta y no se envía nada.
- Con los datos válidos, la hoja se cierra, aparece el aviso «Hito creado» con «nombre · código del hito» y la tarjeta ocupa su lugar por fecha límite.
- «Renombrar», en el menú ⋯ de un hito, abre una hoja titulada «Editar hito», con los campos «Nombre del hito» y «Fecha límite» y los botones «Cancelar» y «Guardar hito». Solo se envía lo que cambió.
- Sin cambios, «Guardar hito» está deshabilitado y se ve junto a él el motivo «No hay cambios que guardar».
- Al guardar con éxito, la hoja se cierra y aparece el aviso «Hito actualizado» con «nuevo nombre · nombre actualizado» si cambió el nombre, con «nombre · fecha límite dd/mm/aaaa» si cambió la fecha, o con las dos partes unidas por « · » si cambiaron ambos. Si cambia la fecha, la tarjeta pasa a su nuevo lugar en la lista.
- Un valor no válido muestra el motivo debajo de su campo y la hoja queda abierta. El nombre de la tarjeta no cambia hasta que se guarda con éxito.
- Solo los roles admin y program_manager pueden crear y editar. Con los roles consultant y auditor, «Nuevo hito» aparece deshabilitado con su motivo y «Renombrar» también.
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos, y el primero se llama SRR.
- Preparación de cada fila: en el tenant `alumno01`, se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, en la app móvil, se entra con `gestor@sigpro.test` (`Gestor1234!`) con `alumno01` en «Tenant de trabajo», hasta llegar a Programas. Desde ahí se abre `/programs/PRG-001` y elige la pestaña «Hitos».

## Criterios de aceptación
```gherkin
Característica: Alta de hitos y edición en hojas en la app móvil

  Esquema del escenario: La hoja «Nuevo hito» valida el nombre y la fecha antes de crear
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha elegido la pestaña «Hitos» de PRG-001
    Cuando pulsa «Nuevo hito», escribe <nombre> en «Nombre», escribe <fecha> en «Fecha límite» y pulsa «Crear hito»
    Entonces <resultado>

    Ejemplos:
      | nombre | fecha | resultado |
      | (vacío) | 2027-03-15 | ve «El nombre debe tener al menos 2 caracteres» debajo de «Nombre» y la hoja sigue abierta |
      | (81 caracteres) | 2027-03-15 | ve «El nombre es demasiado largo (máx. 80 caracteres)» debajo de «Nombre» y la hoja sigue abierta |
      | Revisión de diseño | (vacío) | ve «Indica una fecha válida» debajo de «Fecha límite» y la hoja sigue abierta |
      | Revisión de diseño | 2027-03-15 | la hoja se cierra, ve el aviso «Hito creado» con «Revisión de diseño · PRG-001-M10» y la tarjeta «Revisión de diseño» es la última de la lista |

  Esquema del escenario: La hoja de edición cambia el nombre o la fecha y valida lo que cambia
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha elegido la pestaña «Hitos» de PRG-001
    Cuando abre «Renombrar» en el menú de «SRR» y <cambio>
    Entonces <resultado>

    Ejemplos:
      | cambio | resultado |
      | cambia «Nombre del hito» a Revisión PDR y pulsa «Guardar hito» | ve el aviso «Hito actualizado» con «Revisión PDR · nombre actualizado» y la tarjeta muestra «Revisión PDR» |
      | cambia «Fecha límite» a 2027-03-15 y pulsa «Guardar hito» | ve el aviso «Hito actualizado» con «SRR · fecha límite 15/03/2027» y la tarjeta de «SRR» pasa a ser la última de la lista |
      | no cambia ningún campo | «Guardar hito» está deshabilitado y se ve el motivo «No hay cambios que guardar» |
      | cambia «Nombre del hito» a A y pulsa «Guardar hito» | ve «El nombre debe tener al menos 2 caracteres» debajo de «Nombre del hito», la hoja sigue abierta y la tarjeta sigue mostrando «SRR» |
```

## Fuera de alcance
- El avance con los botones − y + y el borrado de un hito: EP-HITOS, en sus historias móviles de avance y de borrado.
- La lista de hitos en tarjetas, sus estados y los permisos de cada rol: EP-HITOS, en la historia móvil de la lista.
- La edición en la tabla de la web: EP-HITOS, en la historia web de crear y editar en la tabla.
- La ficha del programa y sus demás opciones: EP-PROG-DETALLE.
