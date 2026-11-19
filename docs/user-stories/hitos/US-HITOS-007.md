---
id: US-HITOS-007
tipo: historia
epica: EP-HITOS
titulo: "[Web] Crear un hito en el diálogo «Nuevo hito» y editar su nombre o su fecha en la tabla"
etiquetas: [web]
relacionadas: [US-HITOS-002, US-HITOS-003, US-HITOS-011]
verificacion: ejecutada
cubre: ["/programs/:code"]
permisos: [milestone.edit]
---

## Historia
Como gestor de programas que trabaja en la web, quiero añadir un hito con su nombre y su fecha límite, y corregir el nombre o la fecha de un hito directamente en la tabla,
para mantener la planificación al día sin salir de la pestaña «Hitos».

## Reglas
- El botón «Nuevo hito» abre un diálogo titulado «Nuevo hito», con el código del programa, los campos «Nombre» y «Fecha límite» (los dos obligatorios) y los botones «Cancelar» y «Crear hito».
- Al enviar, los campos se validan con las mismas reglas que la API. El nombre se recorta y debe tener de 2 a 80 caracteres. La fecha límite debe estar escrita. Un campo no válido muestra su motivo debajo de él, con el texto exacto: «El nombre debe tener al menos 2 caracteres», «El nombre es demasiado largo (máx. 80 caracteres)» o «Indica una fecha válida». Mientras haya un error, el diálogo sigue abierto y no se envía nada.
- Con los datos válidos, el diálogo se cierra, aparece el aviso «Hito creado» con «nombre · código del hito» (por ejemplo «Revisión de diseño · PRG-001-M10») y el hito ocupa su lugar por fecha límite. El recuento se actualiza.
- Para editar el nombre de un hito, se hace doble clic sobre el nombre, o se pulsa F2 o Intro con la celda enfocada. Se abre un campo de texto. Intro guarda; Esc o sacar el foco de la celda cancela sin guardar. Si el nombre recortado no cambia, la celda se cierra sin aviso y sin petición.
- Un nombre que no cumple las reglas deja el campo abierto, marcado como no válido, con el motivo al pasar el ratón por el campo; nada se guarda hasta que se corrige o se cancela.
- Al guardar un nombre válido aparece el aviso «Hito actualizado» con «nuevo nombre · nombre actualizado».
- Para editar la fecha límite se hace lo mismo sobre la celda de la fecha, con un campo de fecha. Al guardar una fecha válida, aparece el aviso «Hito actualizado» con «nombre · fecha límite dd/mm/aaaa» y la fila se coloca según la fecha nueva. Una fecha vacía no se guarda: el campo sigue abierto, marcado como no válido, con el motivo «Indica una fecha válida» al pasar el ratón.
- Solo los roles admin y program_manager pueden crear y editar. Con los roles consultant y auditor, «Nuevo hito» está deshabilitado y la celda de nombre o de fecha no se abre con doble clic, F2 ni Intro.
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos, y el primero se llama SRR.
- Preparación de cada fila: en el tenant `alumno01`, se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada y se entra con `gestor@sigpro.test` (`Gestor1234!`) hasta llegar a `/programs`. Desde ahí se abre `/programs/PRG-001` y la pestaña «Hitos».

## Criterios de aceptación
```gherkin
Característica: Alta de hitos y edición en línea en la web

  Esquema del escenario: El diálogo «Nuevo hito» valida el nombre y la fecha antes de crear
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada y ha elegido la pestaña «Hitos» de PRG-001
    Cuando abre «Nuevo hito», escribe <nombre> en «Nombre», escribe <fecha> en «Fecha límite» y pulsa «Crear hito»
    Entonces <resultado>

    Ejemplos:
      | nombre | fecha | resultado |
      | (vacío) | 2027-03-15 | ve «El nombre debe tener al menos 2 caracteres» debajo de «Nombre» y el diálogo sigue abierto |
      | A | 2027-03-15 | ve «El nombre debe tener al menos 2 caracteres» debajo de «Nombre» y el diálogo sigue abierto |
      | (81 caracteres) | 2027-03-15 | ve «El nombre es demasiado largo (máx. 80 caracteres)» debajo de «Nombre» y el diálogo sigue abierto |
      | Revisión de diseño | (vacío) | ve «Indica una fecha válida» debajo de «Fecha límite» y el diálogo sigue abierto |
      | Revisión de diseño | 2027-03-15 | el diálogo se cierra, ve el aviso «Hito creado» con «Revisión de diseño · PRG-001-M10» y la fila «Revisión de diseño» es la última de la tabla |

  Esquema del escenario: Editar el nombre en la tabla guarda solo un nombre válido
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada y ha elegido la pestaña «Hitos» de PRG-001
    Cuando <accion> en la celda de «SRR»
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | hace doble clic, escribe Revisión PDR y pulsa Intro | ve el aviso «Hito actualizado» con «Revisión PDR · nombre actualizado» y la celda muestra «Revisión PDR» |
      | hace doble clic, escribe Revisión PDR y pulsa Esc | la celda vuelve a mostrar «SRR» y no aparece ningún aviso de guardado |
      | hace doble clic, escribe Revisión PDR y saca el foco de la celda | la celda vuelve a mostrar «SRR» y no aparece ningún aviso de guardado |
      | hace doble clic, deja «SRR» tal cual y pulsa Intro | la celda sigue mostrando «SRR» y no aparece ningún aviso de guardado |
      | pulsa F2, escribe A y pulsa Intro | el campo sigue abierto, marcado como no válido, con el motivo «El nombre debe tener al menos 2 caracteres» al pasar el ratón por él, y no aparece ningún aviso de guardado |

  Esquema del escenario: Editar la fecha límite en la tabla guarda solo una fecha válida
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada y ha elegido la pestaña «Hitos» de PRG-001
    Cuando cambia la fecha límite de «SRR» a <fecha> y pulsa Intro
    Entonces <resultado>

    Ejemplos:
      | fecha | resultado |
      | 2027-03-15 | ve el aviso «Hito actualizado» con «SRR · fecha límite 15/03/2027» y la fila de «SRR» pasa a ser la última de la tabla |
      | (vacío) | el campo sigue abierto, marcado como no válido, con el motivo «Indica una fecha válida» al pasar el ratón por él, y no aparece ningún aviso de guardado |
```

## Fuera de alcance
- La tabla de hitos, su recuento y los permisos de cada rol: EP-HITOS, en la historia de la pestaña «Hitos» de la web.
- El avance con el deslizador: EP-HITOS, en la historia de avance de la web.
- El borrado desde el menú de cada hito: EP-HITOS, en la historia de borrado de la web.
- Las reglas de guardado de la API: EP-HITOS, en sus historias de la API.
- La ficha del programa y su cabecera: EP-PROG-DETALLE.

## Decisiones pendientes
- Si el motivo de un valor no válido en la edición en línea debe verse también como texto junto al campo, y no solo al pasar el ratón por él. Hoy solo aparece al pasar el ratón.
