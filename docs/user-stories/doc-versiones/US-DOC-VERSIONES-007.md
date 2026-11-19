---
id: US-DOC-VERSIONES-007
tipo: historia
epica: EP-DOC-VERSIONES
titulo: "[Web] Comparar dos versiones en la ficha"
etiquetas: [web]
relacionadas: [US-DOC-VERSIONES-004, US-DOC-VERSIONES-005, US-DOC-VERSIONES-010]
verificacion: ejecutada
cubre: ["/documents/:id"]
---

## Historia
Como persona que revisa los cambios de un documento en la web, quiero comparar dos de sus versiones desde la ficha y ver qué líneas se han añadido, eliminado o modificado,
para revisar un cambio sin abrir las dos versiones por separado.

## Reglas
- La sección «Comparar versiones» tiene los selectores «Desde» y «Hasta», con todas las versiones del documento como opciones «Versión N».
- Al abrir la ficha, «Desde» es la versión anterior a la última y «Hasta» es la última.
- Con una sola versión, la sección no muestra selectores y dice «Este documento solo tiene una versión: no hay nada que comparar.».
- Con dos versiones distintas elegidas, la sección muestra el resumen «N añadidas · N eliminadas · N modificadas», con los números de esa comparación, y una tabla de dos columnas con las cabeceras «Versión» seguida del número de la versión de «Desde» y «Versión» seguida del número de la versión de «Hasta».
- En la tabla, cada línea muestra su número. Una línea eliminada aparece tachada en la columna de la versión «Desde». Una línea añadida aparece resaltada en la columna de la versión «Hasta». Una línea modificada aparece en las dos columnas: la antigua tachada y la nueva resaltada. Las líneas sin cambios aparecen en las dos columnas sin resaltar.
- Si «Desde» y «Hasta» son la misma versión, la sección dice «Elige dos versiones distintas para compararlas.» y no muestra la tabla.
- Si la comparación elegida todavía no tiene resultado, la sección dice «Calculando diferencias…». Mientras llega el resultado de una elección nueva, el resultado anterior sigue visible.
- Tras publicar una versión nueva, «Desde» pasa a la versión anterior a la nueva y «Hasta» a la nueva.
- En los ejemplos, `(ninguna)` es una columna sin línea.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, se abre `/login?tenant=alumno01` en un navegador sin sesiones de SIGPRO guardadas, y `gestor@sigpro.test` inicia sesión con `Gestor1234!`.
- Estado del seed, sin pasos previos, en el tenant `alumno01`: `DOC-001` («Plan de verificación PRG-001», público, versiones 1 a 3), `DOC-002` («Especificación técnica PRG-001», público, versión 1) y `DOC-003` («Plan de verificación PRG-002», restringido, versiones 1 y 2). El texto de `DOC-001` cambia de una versión a otra solo en unas pocas líneas: en la versión 2, la línea 9 pasa a ser «Se excluyen los equipos de apoyo en tierra y los simuladores.» (antes, «Se excluyen los equipos de apoyo en tierra.») y aparece la línea 15, «El director técnico supervisa la ejecución.»; en la versión 3, la línea 9 desaparece y cambia el primer criterio de aceptación.

## Criterios de aceptación
```gherkin
Característica: Comparación de versiones en la web

  Esquema del escenario: La comparación inicial es la versión anterior contra la última
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01
    Cuando abre /documents/<documento>
    Entonces «Desde» muestra <desde>, «Hasta» muestra <hasta> y el resumen de la comparación es <resumen>

    Ejemplos:
      | documento | desde | hasta | resumen |
      | DOC-001 | «Versión 2» | «Versión 3» | «3 añadidas · 1 eliminadas · 1 modificadas» |
      | DOC-003 | «Versión 1» | «Versión 2» | «1 añadidas · 0 eliminadas · 1 modificadas» |

  Esquema del escenario: Cada tipo de cambio aparece en su columna
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /documents/DOC-001
    Cuando elige <desde> en «Desde» y <hasta> en «Hasta»
    Entonces la línea <linea> aparece <aparece>

    Ejemplos:
      | desde | hasta | linea | aparece |
      | «Versión 1» | «Versión 2» | 9 | tachada en la columna «Versión 1» con el texto «Se excluyen los equipos de apoyo en tierra.», y resaltada en la columna «Versión 2» con el texto «Se excluyen los equipos de apoyo en tierra y los simuladores.» |
      | «Versión 1» | «Versión 2» | 15 | solo en la columna «Versión 2», resaltada, con el texto «El director técnico supervisa la ejecución.» |
      | «Versión 2» | «Versión 3» | 9 | solo en la columna «Versión 2», tachada, con el texto «Se excluyen los equipos de apoyo en tierra y los simuladores.» |

  Esquema del escenario: Sin dos versiones distintas no hay tabla de diferencias
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /documents/<documento>
    Cuando <accion>
    Entonces la sección dice <aviso> y no muestra la tabla de diferencias

    Ejemplos:
      | documento | accion | aviso |
      | DOC-001 | elige «Versión 3» en «Desde» | «Elige dos versiones distintas para compararlas.» |
      | DOC-002 | mira la sección «Comparar versiones» | «Este documento solo tiene una versión: no hay nada que comparar.» |

  Esquema del escenario: Tras publicar una versión sin cambiar el contenido, la comparación pasa a la anterior contra la nueva
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha publicado desde la ficha de <documento> una versión <version_nueva> con el contenido precargado sin cambios, y tiene abierta su ficha
    Cuando mira la sección «Comparar versiones»
    Entonces «Desde» muestra <desde>, «Hasta» muestra <hasta> y el resumen es <resumen>

    Ejemplos:
      | documento | version_nueva | desde | hasta | resumen |
      | DOC-001 | 4 | «Versión 3» | «Versión 4» | «0 añadidas · 0 eliminadas · 0 modificadas» |
      | DOC-002 | 2 | «Versión 1» | «Versión 2» | «0 añadidas · 0 eliminadas · 0 modificadas» |
```

## Fuera de alcance
- La comparación desde la app móvil: EP-DOC-VERSIONES, otra historia de esta épica.
- Los parámetros, las estadísticas y los errores de la API de comparación: EP-DOC-VERSIONES, otra historia de esta épica.
- La publicación de la versión nueva: EP-DOC-VERSIONES, otra historia de esta épica.
- El visor de cada versión y la descarga del PDF: EP-DOC-LISTA.
