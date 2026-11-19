---
id: US-NC-TABLERO-011
tipo: historia
epica: EP-NC-TABLERO
titulo: "[Móvil] Cambiar el estado de una no conformidad desde su detalle con «Mover a…»"
etiquetas: [movil]
relacionadas: [US-NC-TABLERO-003, US-NC-TABLERO-004, US-NC-TABLERO-008, US-NC-TABLERO-010]
verificacion: codigo
cubre: ["/nc"]
permisos: [nc.transition]
---

## Historia
Como persona con permiso para mover no conformidades que trabaja desde el móvil, quiero abrir el detalle de una no conformidad y elegir a qué estado pasa con «Mover a…»,
para avanzar su ciclo sin ordenador y sin tener que arrastrar tarjetas.

## Reglas
- Tocar una tarjeta del tablero abre su detalle en una hoja con el título «Detalle de <código>». La hoja muestra el estado y la severidad como texto, el programa, la descripción, el responsable y los comentarios.
- La sección «Mover a…» tiene un botón «Mover a «<estado>»» por cada paso que la máquina admite desde el estado actual. Si no hay pasos, muestra el texto «Sin más cambios de estado posibles».
- Pulsar un botón mueve la no conformidad: la hoja se cierra, el tablero se recarga con la tarjeta en su nueva columna y aparece el aviso «<código> pasó a «<estado>»».
- Quien no tiene el permiso para mover (`auditor`) ve los botones «Mover a…» deshabilitados, y el motivo «Tu rol no permite mover no conformidades» aparece como texto junto a ellos.
- Si el servidor no puede dar el paso por un fallo, la hoja sigue abierta con la no conformidad en su estado anterior y muestra «No se pudo mover <código>» junto a los botones, con el mismo aviso emergente.
- Esta historia no prueba el paso a «Cerrada», que pide un comentario de cierre y se describe en EP-NC-GESTION.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga. Después, la cuenta de la fila inicia sesión en la app con `alumno01` en «Tenant de trabajo», abre la pestaña «No conformidades» y abre el detalle de la no conformidad de la fila. Las cuentas son `gestor@sigpro.test` (`Gestor1234!`) y `auditor@sigpro.test` (`Audit1234!`).
- Para los fallos, la prueba hace que la petición `POST /api/nc/NC-001/transition` responda con el código HTTP de la fila.

## Criterios de aceptación
```gherkin
Característica: Cambio de estado desde el detalle en la app móvil

  Esquema del escenario: «Mover a…» cambia el estado, cierra la hoja y avisa
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y ha abierto el detalle de <codigo> desde la pestaña «No conformidades»
    Cuando pulsa «Mover a «<destino>»»
    Entonces ve el aviso «<aviso>», la hoja se cierra y la columna «<destino>» muestra la tarjeta <codigo>

    Ejemplos:
      | codigo | destino | aviso |
      | NC-001 | En análisis | NC-001 pasó a «En análisis» |
      | NC-002 | Rechazada | NC-002 pasó a «Rechazada» |
      | NC-005 | Abierta | NC-005 pasó a «Abierta» |

  Esquema del escenario: El detalle ofrece solo los pasos que la máquina admite desde el estado actual
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y ha abierto el detalle de <codigo> desde la pestaña «No conformidades»
    Cuando mira la sección «Mover a…»
    Entonces ve <pasos>

    Ejemplos:
      | codigo | pasos |
      | NC-001 | solo el botón «Mover a «En análisis»» |
      | NC-002 | los botones «Mover a «Acción correctiva»», «Mover a «Rechazada»» y «Mover a «Abierta»» |
      | NC-004 | el texto «Sin más cambios de estado posibles» y ningún botón |

  Esquema del escenario: Quien solo lee ve los pasos deshabilitados con su motivo
    Dado que el tenant alumno01 está recién reiniciado, auditor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y ha abierto el detalle de <codigo> desde la pestaña «No conformidades»
    Cuando mira la sección «Mover a…»
    Entonces el botón «Mover a «En análisis»» está deshabilitado y junto a él se lee «Tu rol no permite mover no conformidades»

    Ejemplos:
      | codigo |
      | NC-001 |

  Esquema del escenario: Un fallo del servidor al mover deja la hoja abierta con la no conformidad en su estado anterior
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo», ha abierto el detalle de NC-001 desde la pestaña «No conformidades» y la prueba hace que la petición POST /api/nc/NC-001/transition responda <codigo_http>
    Cuando pulsa «Mover a «En análisis»»
    Entonces ve el aviso «No se pudo mover NC-001» y la hoja sigue abierta con NC-001 en «Abierta»

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |
```

## Decisiones pendientes
- Ninguna.

## Fuera de alcance
- Filtrar el tablero por texto y por severidad: US-NC-TABLERO-010. Por programa y por sin asignar: US-NC-TABLERO-012.
- Arrastrar las tarjetas: la app móvil no lo tiene, y esta historia es su alternativa.
- El paso a «Cerrada», con su comentario de cierre, y la edición y los comentarios del detalle: EP-NC-GESTION.
- Los pasos que la máquina admite y el permiso por rol en la API: US-NC-TABLERO-003 y US-NC-TABLERO-004.
