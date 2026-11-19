---
id: US-PROG-GESTION-007
tipo: historia
epica: EP-PROG-GESTION
titulo: "[Web] Archivar, eliminar o exportar en lote los programas marcados"
etiquetas: [web]
relacionadas: [US-LOGIN-007, US-PROG-GESTION-004, US-PROG-GESTION-005, US-PROG-GESTION-006, US-PROG-GESTION-008, US-PROG-GESTION-009]
verificacion: codigo
cubre: ["/programs"]
permisos: [program.archive, program.delete]
---

## Historia
Como persona que gestiona varios programas a la vez, quiero archivar, eliminar o exportar en un solo paso los programas que he marcado,
para no repetir la misma acción fila a fila.

## Reglas
- La barra «Acciones masivas» aparece en escritorio, encima de la tabla, cuando hay filas marcadas (US-PROG-GESTION-005). Tiene el texto «N seleccionados», los botones «Exportar selección», «Archivar» y «Eliminar», y el botón «Quitar selección», que muestra una cruz.
- «Archivar» pasa todos los programas marcados a «Cerrado», sin pedir confirmación. Con uno, el aviso de éxito es «PRG-002 archivado»; con más, «N programas archivados». Al terminar, la selección se vacía, la barra desaparece y las filas muestran el estado «Cerrado».
- «Eliminar» abre el diálogo de US-PROG-GESTION-008. Al confirmar, con un programa el aviso de éxito es «PRG-001 eliminado»; con más, «N programas eliminados». La lista se vuelve a leer y el recuento se actualiza.
- «Exportar selección» descarga `sigpro-programas.csv` solo con las filas marcadas, en el orden de la tabla y con la cabecera y el formato del CSV de la API (US-PROG-GESTION-004). La página genera el archivo con las filas que tiene a la vista. Aparece el aviso informativo «CSV generado» con «N filas exportadas», y la selección no cambia.
- «Archivar» está habilitado para el administrador y el gestor de programas. Para el consultor y el auditor aparece deshabilitado, con el motivo «Tu rol no permite archivar programas» como texto de ayuda.
- «Eliminar» está habilitado solo para el administrador. Para los demás roles aparece deshabilitado, con el motivo «Solo admin puede eliminar».
- «Exportar selección» lo tienen todos los roles.
- Un fallo de la API al archivar o al eliminar muestra un aviso de error con el título «Ha ocurrido un error inesperado» y la traza HTTP.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe la cuenta de la fila con su contraseña (`gestor@sigpro.test` con `Gestor1234!` si la fila no dice otra cosa; `consultor@sigpro.test` con `Consul1234!`, `auditor@sigpro.test` con `Audit1234!` o `admin@sigpro.test` con `Admin1234!`, que pide el código `123456`) y se llega a `/programs`.

## Criterios de aceptación
```gherkin
Característica: Acciones masivas sobre los programas marcados en la web

  Esquema del escenario: Archivar la selección cierra todos los programas marcados
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha marcado <marcados> en /programs sin filtros en escritorio
    Cuando pulsa «Archivar» en la barra de acciones masivas
    Entonces aparece el aviso de éxito <aviso>
    Y la barra de acciones masivas desaparece
    Y las filas de <marcados> muestran el estado «Cerrado»

    Ejemplos:
      | marcados | aviso |
      | PRG-002 | «PRG-002 archivado» |
      | PRG-002 y PRG-003 | «2 programas archivados» |

  Esquema del escenario: Eliminar la selección borra los programas marcados al confirmar
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test, con el segundo factor completado, ha marcado <marcados> en /programs sin filtros en escritorio
    Cuando pulsa «Eliminar» en la barra de acciones masivas y después «Eliminar» en el diálogo
    Entonces aparece el aviso de éxito <aviso>
    Y el recuento dice <recuento>

    Ejemplos:
      | marcados | aviso | recuento |
      | PRG-001 | «PRG-001 eliminado» | «1–10 de 23» |
      | PRG-001 y PRG-002 | «2 programas eliminados» | «1–10 de 22» |

  Esquema del escenario: Exportar la selección descarga solo las filas marcadas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha marcado <marcados> en /programs sin filtros en escritorio
    Cuando pulsa «Exportar selección» en la barra de acciones masivas
    Entonces se descarga sigpro-programas.csv con las filas de <codigos>, en ese orden
    Y aparece el aviso informativo «CSV generado» con «<filas> filas exportadas»
    Y la selección sigue marcada

    Ejemplos:
      | marcados | codigos | filas |
      | PRG-001 y PRG-003 | PRG-001 y PRG-003 | 2 |
      | PRG-002 | PRG-002 | 1 |

  Esquema del escenario: Cada rol ve habilitadas solo las acciones masivas que su permiso permite
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha marcado PRG-002 en /programs sin filtros en escritorio
    Cuando mira la barra de acciones masivas
    Entonces «Exportar selección» queda habilitado, «Archivar» queda <archivar> y «Eliminar» queda <eliminar>

    Ejemplos:
      | cuenta | archivar | eliminar |
      | gestor@sigpro.test | habilitado | deshabilitado, con el motivo «Solo admin puede eliminar» |
      | consultor@sigpro.test | deshabilitado, con el motivo «Tu rol no permite archivar programas» | deshabilitado, con el motivo «Solo admin puede eliminar» |
      | admin@sigpro.test | habilitado | habilitado |
```

## Fuera de alcance
- Marcar las filas y ver el contador: US-PROG-GESTION-005.
- Las acciones de una sola fila: US-PROG-GESTION-006.
- El texto y los botones del diálogo de borrado: US-PROG-GESTION-008.
- La exportación de la lista completa desde la cabecera: US-PROG-GESTION-009.
- Lo que hace la API con cada acción: US-PROG-GESTION-001, US-PROG-GESTION-003 y US-PROG-GESTION-004.
- La versión de la app móvil: US-PROG-GESTION-010 y US-PROG-GESTION-012.
