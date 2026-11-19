---
id: US-NC-TABLERO-010
tipo: historia
epica: EP-NC-TABLERO
titulo: "[Móvil] Ver el tablero de no conformidades con su búsqueda y su filtro por severidad"
etiquetas: [movil]
relacionadas: [US-NC-TABLERO-001, US-NC-TABLERO-006, US-NC-TABLERO-007, US-NC-TABLERO-011, US-NC-TABLERO-012]
verificacion: codigo
cubre: ["/nc"]
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero ver en la pestaña «No conformidades» las no conformidades de mi tenant repartidas por estado, y acotarlas por texto o por severidad,
para revisar lo abierto desde el teléfono sin depender del ordenador.

## Reglas
- La pestaña «No conformidades» muestra el tablero con cinco columnas en el orden «Abierta», «En análisis», «Acción correctiva», «Cerrada» y «Rechazada». Las columnas se recorren en horizontal, una a una. Cada columna lleva su título y el número de tarjetas que contiene.
- Cada tarjeta muestra su código, una descripción resumida, su severidad como texto («Menor», «Mayor» o «Crítica»), el código de su programa, su comentario, que dice «1 comentario» si hay uno y «N comentarios» en cualquier otro caso, y su responsable o «Sin asignar». Tocar la tarjeta abre su detalle, desde el que se cambia el estado de la no conformidad.
- El campo «Buscar no conformidades», con el texto de ayuda «Código o descripción…», filtra el tablero por texto. Las opciones «Todas», «Crítica», «Mayor» y «Menor» filtran por severidad: solo una está elegida a la vez, y al abrir la pantalla está elegida «Todas».
- El recuento dice «12 no conformidades · 8 abiertas» sin filtros, y «N de 12 no conformidades» con filtros.
- Si ninguna no conformidad cumple los filtros, la pantalla dice «Ninguna no conformidad coincide con los filtros aplicados.».
- Si la lista no llega, la pantalla muestra «No se pudo cargar el tablero» con el botón «Reintentar».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga. Después, `gestor@sigpro.test` (`Gestor1234!`) inicia sesión en la app con `alumno01` en «Tenant de trabajo» y abre la pestaña «No conformidades».
- Para los fallos, la prueba hace que la primera petición de `GET /api/nc` responda con el código HTTP de la fila; las siguientes llegan al servidor.

## Criterios de aceptación
```gherkin
Característica: Tablero de no conformidades en la app móvil

  Esquema del escenario: Cada columna lleva su título y el número de tarjetas de su estado
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo»
    Cuando abre la pestaña «No conformidades»
    Entonces la columna «<titulo>» muestra el contador <contador>

    Ejemplos:
      | titulo | contador |
      | Abierta | 4 |
      | Rechazada | 2 |

  Esquema del escenario: Cada tarjeta muestra su severidad como texto, su programa, sus comentarios y su responsable
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y ha abierto la pestaña «No conformidades»
    Cuando mira la tarjeta <codigo>
    Entonces la tarjeta muestra la severidad <severidad>, el programa <programa>, el comentario <comentarios> y el responsable <responsable>

    Ejemplos:
      | codigo | severidad | programa | comentarios | responsable |
      | NC-003 | «Crítica» | PRG-001 | «3 comentarios» | Andrés Molina |
      | NC-005 | «Mayor» | PRG-002 | «1 comentario» | «Sin asignar» |

  Esquema del escenario: La severidad y la búsqueda acotan el tablero
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y ha abierto la pestaña «No conformidades»
    Cuando <accion>
    Entonces el recuento dice <recuento> y las tarjetas que se ven son <codigos>

    Ejemplos:
      | accion | recuento | codigos |
      | elige la severidad «Crítica» | «4 de 12 no conformidades» | NC-003, NC-006, NC-009 y NC-012 |
      | elige la severidad «Menor» | «4 de 12 no conformidades» | NC-001, NC-004, NC-007 y NC-010 |
      | escribe nc-01 en «Buscar no conformidades» | «3 de 12 no conformidades» | NC-010, NC-011 y NC-012 |

  Esquema del escenario: Un texto que no coincide con ninguna no conformidad muestra el aviso de filtro vacío
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y ha abierto la pestaña «No conformidades»
    Cuando escribe <texto> en «Buscar no conformidades»
    Entonces ve el aviso «Ninguna no conformidad coincide con los filtros aplicados.»

    Ejemplos:
      | texto |
      | zzzz-no-existe |

  Esquema del escenario: Un fallo de la lista muestra el aviso con su botón de reintento
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y la prueba hace que la primera petición de GET /api/nc responda <codigo_http>
    Cuando abre la pestaña «No conformidades»
    Entonces ve el aviso «No se pudo cargar el tablero» con el botón «Reintentar»

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |
```

## Decisiones pendientes
- Ninguna.

## Fuera de alcance
- Filtrar por programa y por sin asignar, que la web tiene y la app móvil todavía no: US-NC-TABLERO-012.
- El detalle de una no conformidad y su cambio de estado: US-NC-TABLERO-011.
- La alta, la edición, los comentarios y el cierre de una no conformidad: EP-NC-GESTION.
- El KPI «NC abiertas» del panel de misión, que se actualiza en vivo: EP-MISION-FEED.
