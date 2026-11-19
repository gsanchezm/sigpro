---
id: US-PROG-GESTION-005
tipo: historia
epica: EP-PROG-GESTION
titulo: "[Web] Seleccionar programas con la casilla de cabecera y ver el contador de la selección"
etiquetas: [web]
relacionadas: [US-LOGIN-007, US-PROG-LISTA-004, US-PROG-LISTA-005, US-PROG-LISTA-006, US-PROG-GESTION-006, US-PROG-GESTION-007]
verificacion: ejecutada
cubre: ["/programs"]
---

## Historia
Como persona que revisa la lista de programas en el escritorio, quiero marcar varios programas con casillas y ver cuántos llevo marcados,
para actuar sobre ellos a la vez en lugar de repetir la misma acción en cada fila.

## Reglas
- En escritorio (ancho de ventana de 1024 px o más) la tabla tiene una casilla por fila y una casilla en la cabecera. Cualquier rol puede marcarlas.
- Cada casilla de fila tiene el nombre accesible «Seleccionar» seguido del código del programa (por ejemplo, «Seleccionar PRG-002»).
- La casilla de la cabecera tiene el nombre «Seleccionar todos los programas de la página». Marcada, marca todas las filas de la página que se ve; desmarcada, quita todas. Si solo hay algunas filas marcadas, queda en estado parcial: ni marcada ni desmarcada.
- Marcar una casilla no abre el panel lateral del programa ni cambia de página.
- Con al menos una fila marcada aparece, encima de la tabla, la barra «Acciones masivas», con el texto «N seleccionados», donde N es el número de filas marcadas, también cuando N es 1. Sin filas marcadas, la barra no aparece.
- La selección se vacía, y la barra desaparece, al cambiar de página, al cambiar un filtro, al ordenar por una columna, al crear un programa y al pulsar «Quitar selección» en la barra.
- Las acciones de la barra y su habilitación por rol están en US-PROG-GESTION-007.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe la cuenta de la fila con su contraseña (`gestor@sigpro.test` con `Gestor1234!` si la fila no dice otra cosa; `consultor@sigpro.test` con `Consul1234!`, `auditor@sigpro.test` con `Audit1234!` o `admin@sigpro.test` con `Admin1234!`, que pide el código `123456`) y se llega a `/programs`.

## Criterios de aceptación
```gherkin
Característica: Selección de programas con casillas en la web

  Esquema del escenario: El contador cuenta las filas marcadas y la casilla de cabecera refleja la página
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en escritorio
    Cuando <accion>
    Entonces la barra de acciones masivas dice <contador>
    Y la casilla de cabecera queda <cabecera>

    Ejemplos:
      | accion | contador | cabecera |
      | marca «Seleccionar todos los programas de la página» | «10 seleccionados» | marcada |
      | marca «Seleccionar» de PRG-002 y de PRG-003 | «2 seleccionados» | parcial |
      | marca «Seleccionar» de PRG-002 | «1 seleccionados» | parcial |
      | marca «Seleccionar todos los programas de la página» y después desmarca «Seleccionar» de PRG-002 | «9 seleccionados» | parcial |

  Esquema del escenario: Cambiar la página, un filtro o el orden, o quitar la selección, vacía la selección
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha marcado PRG-002 y PRG-003 en /programs sin filtros en escritorio
    Cuando <accion>
    Entonces la barra de acciones masivas <barra>

    Ejemplos:
      | accion | barra |
      | pulsa «Página siguiente» | no aparece |
      | elige «En pausa» en «Estado» | no aparece |
      | pulsa «Nombre» en la cabecera de la tabla | no aparece |
      | pulsa «Quitar selección» en la barra de acciones masivas | no aparece |

  Esquema del escenario: Todos los roles pueden marcar programas con casillas
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha entrado en /programs sin filtros en escritorio
    Cuando marca «Seleccionar» de PRG-002 y de PRG-003
    Entonces la barra de acciones masivas dice «2 seleccionados»

    Ejemplos:
      | cuenta |
      | consultor@sigpro.test |
      | admin@sigpro.test |
```

## Decisiones pendientes
- Si el diseño responsive (ancho menor de 1024 px) debe tener casillas y la barra de acciones masivas. Hoy sus tarjetas no tienen casillas, y la app móvil sí las ofrece (US-PROG-GESTION-010).

## Fuera de alcance
- Las acciones de la barra (archivar, eliminar, exportar la selección): US-PROG-GESTION-007.
- El menú de acciones de una fila: US-PROG-GESTION-006.
- La exportación de la lista completa desde la cabecera: US-PROG-GESTION-009.
- El filtrado y el orden de la lista, y su paginación: EP-PROG-LISTA.
- El panel lateral y la ficha de un programa: EP-PROG-DETALLE.
