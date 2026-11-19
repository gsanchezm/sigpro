---
id: US-NC-TABLERO-012
tipo: historia
epica: EP-NC-TABLERO
titulo: "[Móvil] Filtrar el tablero por programa y por sin asignar, como en la web"
etiquetas: [movil, no-implementada]
relacionadas: [US-NC-TABLERO-007, US-NC-TABLERO-010]
verificacion: no-ejecutable
---

## Historia
Como persona que revisa las no conformidades desde el móvil, quiero acotar el tablero a un programa o a las no conformidades sin responsable,
para ver en el teléfono lo mismo que veo en la web sin tener que recorrer todas las tarjetas.

## Reglas
- La web filtra el tablero por programa y ofrece la casilla «Solo sin asignar». La app móvil, hoy, solo filtra por texto y por severidad. Esta historia describe la paridad acordada: la pestaña «No conformidades» de la app ofrece también esos dos filtros.
- Con un programa elegido, el tablero muestra solo sus no conformidades, y el recuento dice «N de 12 no conformidades».
- Con «Solo sin asignar» marcada, el tablero muestra solo las no conformidades sin responsable.
- Los dos filtros se combinan entre sí y con la búsqueda y la severidad, y la lista se pide al servidor, como en la web.
- Quitar el filtro devuelve el tablero a lo que mostraba antes de elegirlo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y `gestor@sigpro.test` inicia sesión en la app con `alumno01` en «Tenant de trabajo» y abre la pestaña «No conformidades».

## Criterios de aceptación
```gherkin
Característica: Filtros por programa y sin asignar en la app móvil

  Esquema del escenario: El filtro acota el tablero como en la web
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y ha abierto la pestaña «No conformidades»
    Cuando <accion>
    Entonces el recuento dice <recuento> y las tarjetas que se ven son <codigos>

    Ejemplos:
      | accion | recuento | codigos |
      | elige el programa PRG-002 en el filtro por programa | «4 de 12 no conformidades» | NC-005, NC-006, NC-007 y NC-008 |
      | marca «Solo sin asignar» | «2 de 12 no conformidades» | NC-005 y NC-010 |
```

## Decisiones pendientes
- Qué forma tienen los dos controles en la app móvil: una lista desplegable, chips de selección única como los de severidad o una casilla.
- Si «Solo sin asignar» conserva ese texto en la app móvil o se nombra de otra forma.
- Dónde se colocan los controles en la pantalla, y si caben junto a la búsqueda y a las opciones de severidad sin cortar nada.
- Si el filtro por programa se conserva al abrir y cerrar el detalle de una no conformidad.

## Fuera de alcance
- La búsqueda por texto y el filtro por severidad, que la app móvil ya tiene: US-NC-TABLERO-010.
- Los mismos filtros en la web: US-NC-TABLERO-007.
