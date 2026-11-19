---
id: US-HITOS-010
tipo: historia
epica: EP-HITOS
titulo: "[Móvil] Ver los hitos en tarjetas: estado, avance, permisos y estados de carga, vacío y error"
etiquetas: [movil]
relacionadas: [US-HITOS-001, US-HITOS-006, US-PROG-DETALLE-005]
verificacion: ejecutada
cubre: ["/programs/:code"]
permisos: [milestone.edit, milestone.delete]
---

## Historia
Como persona con una cuenta en la app móvil que gestiona o consulta programas, quiero ver los hitos del programa en tarjetas, con su estado y su avance,
para saber cuántos están cumplidos y qué puedo cambiar según mi rol, sin necesidad de una tabla.

## Reglas
- En la ficha de un programa, la pestaña «Hitos» muestra una tarjeta por hito, en orden de fecha límite y, con la misma fecha, por código.
- Cada tarjeta muestra el nombre del hito, su estado, su fecha límite como dd/mm/aaaa, un control de avance con el nombre «Avance de» seguido del nombre del hito y el valor «n %», y un botón ⋯ para abrir sus acciones.
- El estado es «Cumplido» con un avance de 100 %, «En curso» con un avance entre 1 % y 99 % y «Pendiente» con 0 %.
- Encima de la lista se ve el recuento «n de N hitos cumplidos». Con permiso de edición, la pestaña muestra además un texto de ayuda sobre cómo cambiar los hitos; su contenido exacto no se afirma aquí (ver «Decisiones pendientes»).
- Con permiso de creación, el botón «Nuevo hito» queda habilitado. Sin él, queda deshabilitado y se ve el texto «Tu rol no permite crear hitos».
- Los roles admin y program_manager tienen los permisos `milestone.edit` y `milestone.delete`. Los roles consultant y auditor no los tienen: los botones «−» y «+» del control de avance de cada tarjeta quedan deshabilitados y se ve, dentro de la tarjeta y bajo ese control, el texto «Tu rol no permite modificar hitos». Al abrir el menú ⋯, «Renombrar» y «Eliminar» aparecen deshabilitados, con los motivos «Tu rol no permite modificar hitos» y «Tu rol no permite eliminar hitos» escritos junto a cada opción.
- Mientras llega la lista se ve un indicador de carga y ninguna tarjeta. Si la lista llega vacía, se ve «Este programa todavía no tiene hitos.». Si la carga falla, se ve «No se pudieron cargar los hitos» con el botón «Reintentar».
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos. SRR está cumplido, PDR va al 10 % y el resto al 0 %. `PRG-004` tiene 9 hitos: SRR y PDR están cumplidos y CDR va al 45 %.
- Preparación de cada fila: en el tenant `alumno01`, se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, en la app móvil, se entra con la cuenta de la fila (`gestor@sigpro.test` con `Gestor1234!`, `consultor@sigpro.test` con `Consul1234!` o `auditor@sigpro.test` con `Audit1234!`) con `alumno01` en «Tenant de trabajo», hasta llegar a Programas. Desde ahí se abre el programa de la fila y la pestaña «Hitos».
- Para la fila de vacío, se borran uno a uno todos los hitos del programa con `DELETE /api/milestones/<id>` usando el `accessToken` de `gestor@sigpro.test` (obtenido con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`). Para la fila de carga y la de error, la prueba retrasa o responde la petición `GET /api/programs/PRG-001/milestones`.

## Criterios de aceptación
```gherkin
Característica: Hitos en tarjetas en la app móvil

  Esquema del escenario: Cada tarjeta muestra su estado y su avance
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y abre /programs/PRG-001 y elige la pestaña «Hitos»
    Cuando mira la tarjeta de <hito>
    Entonces la tarjeta muestra <dato> como <valor>

    Ejemplos:
      | hito | dato | valor |
      | «SRR» | el estado | «Cumplido» |
      | «SRR» | el avance | 100 % |
      | «PDR» | el estado | «En curso» |
      | «PDR» | el avance | 10 % |
      | «CDR» | el estado | «Pendiente» |

  Esquema del escenario: El recuento cambia con los hitos cumplidos del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y abre /programs/<programa> y elige la pestaña «Hitos»
    Cuando mira el recuento de la pestaña
    Entonces el recuento dice <recuento>

    Ejemplos:
      | programa | recuento |
      | PRG-001 | «1 de 9 hitos cumplidos» |
      | PRG-004 | «2 de 9 hitos cumplidos» |

  Esquema del escenario: Cada rol ve los controles de hitos según su permiso
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha entrado en la app móvil y abre /programs/PRG-001 y elige la pestaña «Hitos»
    Cuando mira la cabecera de la pestaña, una tarjeta y el menú ⋯ de esa tarjeta
    Entonces ve <resultado>

    Ejemplos:
      | cuenta | resultado |
      | gestor@sigpro.test | «Nuevo hito» habilitado, los botones «−» y «+» del control de avance de «SRR» habilitados donde el avance lo permite, y «Renombrar» y «Eliminar» habilitados |
      | consultor@sigpro.test | el texto «Tu rol no permite crear hitos» bajo «Nuevo hito», el texto «Tu rol no permite modificar hitos» bajo el control de avance de la tarjeta, los botones «−» y «+» sin poder pulsarse, y «Renombrar» y «Eliminar» deshabilitados con sus motivos |
      | auditor@sigpro.test | el texto «Tu rol no permite crear hitos» bajo «Nuevo hito», el texto «Tu rol no permite modificar hitos» bajo el control de avance de la tarjeta, los botones «−» y «+» sin poder pulsarse, y «Renombrar» y «Eliminar» deshabilitados con sus motivos |

  Esquema del escenario: La pestaña muestra el estado de carga, el vacío o el error de la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y <situacion>
    Cuando abre /programs/<programa> y elige la pestaña «Hitos»
    Entonces ve <resultado>

    Ejemplos:
      | programa | situacion | resultado |
      | PRG-001 | la prueba retrasa 3 segundos la respuesta de GET /api/programs/PRG-001/milestones | un indicador de carga y ninguna tarjeta; al llegar la respuesta, los 9 hitos del programa |
      | PRG-003 | se han borrado, uno a uno y con su id, todos los hitos de PRG-003 mediante DELETE hasta que su lista está vacía | el aviso «Este programa todavía no tiene hitos.» y el recuento «0 de 0 hitos cumplidos» |
      | PRG-001 | la prueba responde 500 a GET /api/programs/PRG-001/milestones | el aviso «No se pudieron cargar los hitos» con el botón «Reintentar»; al pulsarlo, cuando la prueba ya no responde 500, ve los 9 hitos |
```

## Fuera de alcance
- La ficha del programa, su cabecera y sus opciones Resumen y Proveedores: EP-PROG-DETALLE.
- El alta, la edición en hojas, el avance con los botones − y + y el borrado: EP-HITOS, en sus historias móviles de hojas, de avance y de borrado.
- Cómo se entra en la app móvil: EP-LOGIN.

## Decisiones pendientes
- Qué texto de ayuda se muestra sobre la lista de hitos con permiso de edición y qué ocurre al tocar una tarjeta. Hoy el texto de ayuda habla de tocar un hito para renombrarlo o cambiar su fecha, pero solo el botón ⋯ de cada tarjeta abre sus acciones. No está decidido si debe cambiar el texto, o si tocar la tarjeta debe abrir sus acciones.
