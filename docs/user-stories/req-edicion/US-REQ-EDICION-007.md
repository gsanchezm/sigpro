---
id: US-REQ-EDICION-007
tipo: historia
epica: EP-REQ-EDICION
titulo: "[API] Cambiar el padre de un requisito al reordenarlo"
etiquetas: [api, no-implementada]
relacionadas: [US-REQ-EDICION-005, US-REQ-EDICION-010, US-REQ-EDICION-014]
verificacion: no-ejecutable
---

## Historia
Como persona que organiza el árbol de un programa, quiero llevar un requisito a otro nivel, bajo otro padre, al reordenarlo,
para corregir una mala ubicación sin borrar el requisito y volver a darlo de alta.

## Reglas
- Hoy no existe. `POST /api/requirements/:code/move` solo reordena entre hermanos: el padre del requisito no cambia, y un destino que tenga otro padre responde 422 con el motivo `badTarget`.
- La historia no afirma cómo debe comportarse la capacidad: eso está en «Decisiones pendientes».

## Criterios de aceptación
```gherkin
Característica: Cambio de padre al reordenar un requisito

  Esquema del escenario: El requisito queda bajo el padre elegido al reordenarlo
    Dado que en el tenant alumno01, recién reiniciado, REQ-002 es hijo de REQ-001
    Cuando lleva REQ-002 bajo <destino> al reordenarlo
    Entonces REQ-002 queda como hijo de <destino>

    Ejemplos:
      | destino |
      | REQ-006 |
      | REQ-004 |
```

## Decisiones pendientes
- Cómo se elige el nuevo padre: en la API, con un campo nuevo en la misma petición de reordenar o con otra petición; en la web, arrastrando hasta un nivel distinto o con una lista.
- En qué posición queda el requisito dentro del nuevo padre: al final, o según el destino elegido.
- Qué ocurre con sus descendientes: se llevan con él o se quedan en su padre anterior.
- Si un requisito puede quedar dentro de sus propios descendientes, y, si no puede, qué código de respuesta y qué motivo devuelve la API.
- Si el cambio de padre devuelve el requisito a borrador, como ocurre al cambiar su texto.
- Si se permite entre programas o solo dentro del mismo programa.
- Qué roles pueden hacerlo.

## Fuera de alcance
- Reordenar entre hermanos, que sí existe: EP-REQ-EDICION.
