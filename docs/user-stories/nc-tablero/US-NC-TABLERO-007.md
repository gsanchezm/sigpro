---
id: US-NC-TABLERO-007
tipo: historia
epica: EP-NC-TABLERO
titulo: "[Web] Filtrar el tablero por texto, programa, severidad y sin asignar"
etiquetas: [web]
relacionadas: [US-NC-TABLERO-001, US-NC-TABLERO-006, US-NC-TABLERO-010, US-NC-TABLERO-012]
verificacion: codigo
cubre: ["/nc"]
---

## Historia
Como persona que revisa las no conformidades de un programa o de un responsable, quiero acotar el tablero por texto, por programa, por severidad o solo por las no asignadas,
para encontrar las no conformidades que me interesan sin recorrer las doce.

## Reglas
- Encima del tablero hay cuatro controles: el campo «Buscar no conformidades», con el texto de ayuda «Código o descripción…»; el desplegable «Programa»; el desplegable «Severidad»; y la casilla «Solo sin asignar».
- «Programa» ofrece «Todos los programas» y, después, un valor por programa con su código y su nombre, como «PRG-002 · Radar de vigilancia costera RVC-2». «Severidad» ofrece «Todas las severidades», «Menor», «Mayor» y «Crítica».
- La búsqueda encuentra el texto dentro del código o de la descripción, sin distinguir mayúsculas de minúsculas. Los controles se combinan con «y».
- El tablero muestra solo las tarjetas que cumplen todos los filtros, en sus columnas. El recuento de la lista dice «N de 12 no conformidades».
- El botón «Limpiar filtros» aparece mientras hay algún filtro. Al pulsarlo, la búsqueda queda vacía, «Programa» vuelve a «Todos los programas», «Severidad» a «Todas las severidades», y la casilla se desmarca.
- Si ninguna no conformidad cumple los filtros, el tablero no muestra tarjetas y aparece el aviso «Ninguna no conformidad coincide con los filtros aplicados.» con el botón «Limpiar filtros». Una columna sin tarjetas que cumplan los filtros muestra el texto «Sin tarjetas».
- Los filtros no se guardan en la dirección de la página: al recargar /nc vuelven a estar vacíos.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga. Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, `gestor@sigpro.test` inicia sesión con `Gestor1234!` y se abre /nc.

## Criterios de aceptación
```gherkin
Característica: Filtros del tablero de no conformidades en la web

  Esquema del escenario: Cada filtro deja solo las no conformidades que cumplen con él y dice cuántas son
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /nc
    Cuando <accion>
    Entonces el recuento de la lista dice <recuento>
    Y las tarjetas que se ven son <codigos>

    Ejemplos:
      | accion | recuento | codigos |
      | escribe 012 en «Buscar no conformidades» | «1 de 12 no conformidades» | NC-012 |
      | escribe nc-01 en «Buscar no conformidades» | «3 de 12 no conformidades» | NC-010, NC-011 y NC-012 |
      | elige PRG-002 en «Programa» | «4 de 12 no conformidades» | NC-005, NC-006, NC-007 y NC-008 |
      | elige «Crítica» en «Severidad» | «4 de 12 no conformidades» | NC-003, NC-006, NC-009 y NC-012 |
      | marca «Solo sin asignar» | «2 de 12 no conformidades» | NC-005 y NC-010 |
      | elige PRG-003 en «Programa» y «Crítica» en «Severidad» | «2 de 12 no conformidades» | NC-009 y NC-012 |

  Esquema del escenario: Una columna sin tarjetas que cumplen los filtros muestra «Sin tarjetas»
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /nc
    Cuando <accion>
    Entonces la columna «<columna>» muestra el contador 0 y el texto «Sin tarjetas»

    Ejemplos:
      | accion | columna |
      | elige «Crítica» en «Severidad» | Rechazada |
      | elige «Crítica» en «Severidad» | Cerrada |
      | marca «Solo sin asignar» | En análisis |

  Esquema del escenario: Un texto que no coincide con ninguna no conformidad muestra el aviso de filtro vacío
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /nc
    Cuando escribe <texto> en «Buscar no conformidades»
    Entonces ve el aviso «Ninguna no conformidad coincide con los filtros aplicados.» con el botón «Limpiar filtros»
    Y el recuento de la lista dice <recuento>

    Ejemplos:
      | texto | recuento |
      | zzzz-no-existe | «0 de 12 no conformidades» |

  Esquema del escenario: «Limpiar filtros» vuelve a mostrar las doce no conformidades
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /nc y ha <filtro_previo>
    Cuando pulsa «Limpiar filtros»
    Entonces el recuento de la lista dice «12 no conformidades · 8 abiertas»
    Y ve las doce tarjetas y no ve el botón «Limpiar filtros»

    Ejemplos:
      | filtro_previo |
      | escrito zzzz-no-existe en «Buscar no conformidades» |
      | elegido PRG-002 en «Programa» y «Crítica» en «Severidad» |
```

## Decisiones pendientes
- Ninguna.

## Fuera de alcance
- El tablero, sus columnas y sus avisos de carga y de error: US-NC-TABLERO-006.
- Los mismos filtros en la app móvil: US-NC-TABLERO-010 para la búsqueda y la severidad, y US-NC-TABLERO-012 para el programa y las no asignadas.
- La lista de la API y sus filtros: US-NC-TABLERO-001.
