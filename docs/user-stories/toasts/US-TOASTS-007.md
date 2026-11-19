---
id: US-TOASTS-007
tipo: historia
epica: EP-TOASTS
titulo: "[Móvil] Cerrar un aviso con «Cerrar» antes de que se retire solo"
etiquetas: [movil, no-implementada]
relacionadas: [US-TOASTS-004, US-TOASTS-006]
verificacion: no-ejecutable
---

## Historia
Como persona que usa la app móvil, quiero poder cerrar un aviso con un botón «Cerrar» cuando ya lo he leído,
para quitármelo de la pantalla como puedo hacer en la web.

## Reglas
- Lo mínimo acordado, por paridad con la web: cada aviso de la app móvil tiene un botón con el nombre «Cerrar», y pulsarlo retira ese aviso.
- Cerrar un aviso no cambia ningún dato ni lo que hay debajo de la pantalla.
- Los demás avisos siguen visibles hasta su propio plazo de 3 segundos desde que aparecieron.
- La forma del botón y el gesto con el que se cierra están en «Decisiones pendientes».

## Criterios de aceptación
```gherkin
Característica: Cierre a mano de los avisos en la app móvil

  Esquema del escenario: El botón «Cerrar» retira solo el aviso al que pertenece
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil y está en /programs
    Y abre las acciones de PRG-001 y pulsa «Archivar»
    Y, mientras el aviso «PRG-001 archivado» sigue a la vista, abre las acciones de PRG-002 y pulsa «Archivar»
    Cuando pulsa «Cerrar» del aviso <aviso>
    Entonces el aviso <aviso> deja de estar en la pantalla
    Y el aviso <otro> sigue a la vista

    Ejemplos:
      | aviso | otro |
      | «PRG-001 archivado» | «PRG-002 archivado» |
      | «PRG-002 archivado» | «PRG-001 archivado» |
```

## Fuera de alcance
- La posición de los avisos y su tono en la app móvil: la historia móvil de avisos arriba de la pantalla de esta épica.
- El plazo de 3 segundos y el apilado de los avisos: la historia transversal de varios avisos a la vez de esta épica.

## Decisiones pendientes
- Cómo se ve el botón: si es el texto «Cerrar» o un icono con ese nombre accesible, y dónde queda dentro del aviso.
- Si el aviso también se cierra con un gesto de deslizar.
- Si el aviso de error se cierra igual que los de los demás tonos.
