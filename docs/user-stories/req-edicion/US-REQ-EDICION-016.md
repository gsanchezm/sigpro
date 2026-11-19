---
id: US-REQ-EDICION-016
tipo: historia
epica: EP-REQ-EDICION
titulo: "[Móvil] Añadir un requisito hijo desde la hoja de otro requisito"
etiquetas: [movil, no-implementada]
relacionadas: [US-REQ-EDICION-012, US-REQ-EDICION-008]
verificacion: no-ejecutable
---

## Historia
Como gestor de un programa que trabaja desde el móvil, quiero añadir un requisito hijo directamente desde la hoja de otro requisito,
para crear una rama del árbol sin buscar el padre en la lista del diálogo de alta.

## Reglas
- Hoy la app móvil no ofrece esta acción. La hoja de un requisito solo tiene «Editar», «Mover a…» y «Eliminar».
- En la web, la acción existe en el menú de la fila de cada requisito.
- Mientras no exista, el padre de un requisito nuevo se elige en el diálogo «Nuevo requisito» de la lista del programa.

## Criterios de aceptación
```gherkin
Característica: Añadir un hijo desde la hoja de un requisito en la app móvil

  Esquema del escenario: Añadir un hijo desde la hoja abre el alta con ese requisito como padre
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto la hoja de REQ-001
    Cuando elige «Añadir hijo» del requisito REQ-001
    Entonces ve el diálogo «Nuevo requisito» con «Requisito padre» igual a «REQ-001 · Disponibilidad del subsistema 001»

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | consultor@sigpro.test |
```

## Decisiones pendientes
- Dónde aparece la acción: en la hoja del requisito, o en el menú de cada requisito de la lista.
- Cómo se abre el alta del hijo: si la hoja del padre se cierra antes, o si el alta tiene una pantalla propia con el padre ya elegido.
- Qué motivo ve la persona cuando su rol no puede crear requisitos.

## Fuera de alcance
- Editar, mover y eliminar desde la hoja, que sí existen: las historias móviles de edición, reordenación y borrado de esta misma épica.
- Añadir un hijo desde el menú de la fila en la web: la historia web de alta de esta misma épica.
