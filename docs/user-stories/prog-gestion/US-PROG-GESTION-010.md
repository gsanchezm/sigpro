---
id: US-PROG-GESTION-010
tipo: historia
epica: EP-PROG-GESTION
titulo: "[Móvil] Seleccionar programas con «Seleccionar» y actuar sobre la selección"
etiquetas: [movil]
relacionadas: [US-LOGIN-012, US-PROG-LISTA-008, US-PROG-GESTION-005, US-PROG-GESTION-007, US-PROG-GESTION-008, US-PROG-GESTION-011, US-PROG-GESTION-012]
verificacion: codigo
cubre: ["/programs"]
permisos: [program.archive, program.delete]
---

## Historia
Como persona que gestiona programas desde el móvil, quiero marcar varios programas de la lista y archivarlos, eliminarlos o exportarlos a la vez,
para hacer lo mismo que en la web sin abrir cada tarjeta.

## Reglas
- El botón «Seleccionar» de la lista activa el modo de selección y aparece pulsado mientras el modo está activo. En ese modo, cada tarjeta muestra una casilla con el nombre «Seleccionar» seguido del código del programa, y tocar la tarjeta marca o desmarca el programa en lugar de abrir su detalle.
- Con el modo activo y programas en la lista aparece «Seleccionar todos». Marca los programas que se ven en la página, o los desmarca si ya estaban todos marcados.
- Con al menos un programa marcado aparece la barra «Acciones masivas», con el texto «N seleccionados» (también con 1), «Exportar selección», «Archivar», «Eliminar» y «Quitar selección».
- Pulsar «Seleccionar» otra vez desactiva el modo y vacía la selección. «Quitar selección» vacía la selección y deja el modo activo.
- Cambiar el estado elegido en el filtro, o escribir en el buscador, vacía la selección.
- «Archivar» de la barra archiva sin pedir confirmación. Con uno, el aviso de éxito es «PRG-002 archivado»; con más, «N programas archivados». Al terminar, la selección se vacía y la lista se vuelve a leer.
- «Eliminar» de la barra abre la hoja de confirmación «Eliminar programa», con el mismo texto y los mismos botones «Cancelar» y «Eliminar» que la web (US-PROG-GESTION-008).
- Para el consultor y el auditor, «Archivar» y «Eliminar» aparecen deshabilitados y muestran su motivo como texto debajo: «Tu rol no permite archivar programas» y «Solo admin puede eliminar». «Exportar selección» lo tienen todos los roles.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app está en /login sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo»; se escribe la cuenta de la fila con su contraseña (`gestor@sigpro.test` con `Gestor1234!` si la fila no dice otra cosa; `consultor@sigpro.test` con `Consul1234!`, `auditor@sigpro.test` con `Audit1234!` o `admin@sigpro.test` con `Admin1234!`, que completa el segundo paso con el código `123456`) y se llega a /programs.

## Criterios de aceptación
```gherkin
Característica: Selección de programas y acciones masivas en la app móvil

  Esquema del escenario: El modo de selección marca programas al tocarlos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en la app móvil
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | pulsa «Seleccionar» | «Seleccionar» queda pulsado y cada tarjeta muestra su casilla |
      | pulsa «Seleccionar» y toca la tarjeta de PRG-002 | PRG-002 queda marcado, no se abre su detalle y la barra dice «1 seleccionados» |
      | pulsa «Seleccionar» y después «Seleccionar todos» | la barra dice «10 seleccionados» |
      | pulsa «Seleccionar», después «Seleccionar todos» y otra vez «Seleccionar todos» | la barra de acciones masivas no aparece |

  Esquema del escenario: Archivar la selección cierra los programas marcados sin pedir confirmación
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha marcado <marcados> en /programs sin filtros en la app móvil
    Cuando pulsa «Archivar» en la barra de acciones masivas
    Entonces aparece el aviso de éxito <aviso>
    Y la barra de acciones masivas no aparece
    Y las tarjetas de <marcados> muestran el estado «Cerrado»

    Ejemplos:
      | marcados | aviso |
      | PRG-002 | «PRG-002 archivado» |
      | PRG-002 y PRG-003 | «2 programas archivados» |

  Esquema del escenario: Eliminar la selección pide confirmación y solo al confirmar borra los programas
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test, con el segundo factor completado, ha marcado PRG-001 y PRG-002 en /programs sin filtros en la app móvil
    Cuando pulsa «Eliminar» en la barra de acciones masivas y después <salida> en la hoja de confirmación
    Entonces <resultado>
    Y el recuento dice <recuento>

    Ejemplos:
      | salida | resultado | recuento |
      | «Cancelar» | no aparece ningún aviso de éxito y los dos programas siguen en la lista | «1–10 de 24» |
      | «Eliminar» | aparece el aviso de éxito «2 programas eliminados» | «1–10 de 22» |

  Esquema del escenario: Cada rol ve habilitadas solo las acciones masivas que su permiso permite
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha marcado PRG-002 en /programs sin filtros en la app móvil
    Cuando mira la barra de acciones masivas
    Entonces «Archivar» queda <archivar> y «Eliminar» queda <eliminar>

    Ejemplos:
      | cuenta | archivar | eliminar |
      | gestor@sigpro.test | habilitado | deshabilitado, con el texto «Solo admin puede eliminar» |
      | consultor@sigpro.test | deshabilitado, con el texto «Tu rol no permite archivar programas» | deshabilitado, con el texto «Solo admin puede eliminar» |
      | admin@sigpro.test | habilitado | habilitado |
```

## Fuera de alcance
- Los filtros de estado y de búsqueda de la lista, y su paginación: EP-PROG-LISTA.
- El menú ⋯ de cada tarjeta, para una sola fila: US-PROG-GESTION-011.
- La exportación a CSV y la hoja de compartir: US-PROG-GESTION-012.
- La selección y las acciones masivas en la web: US-PROG-GESTION-005 y US-PROG-GESTION-007.
- Lo que hace la API con cada acción: US-PROG-GESTION-001 y US-PROG-GESTION-003.
