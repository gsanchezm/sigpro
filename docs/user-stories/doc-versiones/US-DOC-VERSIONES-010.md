---
id: US-DOC-VERSIONES-010
tipo: historia
epica: EP-DOC-VERSIONES
titulo: "[Móvil] Comparar dos versiones con las líneas apiladas"
etiquetas: [movil]
relacionadas: [US-DOC-VERSIONES-004, US-DOC-VERSIONES-007, US-DOC-VERSIONES-009]
verificacion: codigo
cubre: ["/documents/:id"]
---

## Historia
Como persona que revisa los cambios de un documento desde el móvil, quiero comparar dos de sus versiones y leer cada cambio con la línea antigua encima de la nueva,
para revisar un cambio en una pantalla estrecha sin tener que girar el teléfono.

## Reglas
- La sección «Comparar versiones» tiene los selectores «Desde» y «Hasta», con las versiones como opciones «Versión N». Al abrir la ficha, «Desde» es la versión anterior a la última y «Hasta» es la última.
- Con una sola versión, la sección dice «Este documento solo tiene una versión: no hay nada que comparar.» y no muestra selectores.
- Con dos versiones iguales elegidas, la sección dice «Elige dos versiones distintas para compararlas.» y no pide ninguna comparación.
- Con dos versiones distintas, sobre la tabla se lee el resumen «N añadidas · N eliminadas · N modificadas» y la cabecera tiene «Versión» seguida del número de la versión de «Desde» y «Versión» seguida del número de la versión de «Hasta».
- Cada cambio ocupa una fila, con su tipo escrito: «Modificada», «Añadida» o «Eliminada». Las líneas no van en dos columnas, sino una debajo de otra. Una línea modificada muestra primero la línea antigua tachada, con «−» delante de su número, y debajo la nueva, con «+» delante de su número. Una línea añadida muestra solo la nueva, con «+»; una eliminada, solo la antigua, tachada, con «−».
- Las filas sin cambios no llevan tipo ni signo: muestran su número y su texto en gris.
- Si la comparación elegida todavía no tiene resultado, se lee «Calculando diferencias…». Mientras llega el resultado de una elección nueva, el resultado anterior sigue visible.
- Tras publicar una versión nueva, «Desde» pasa a la versión anterior a la nueva y «Hasta» a la nueva.
- En los ejemplos, `(ninguna)` es una línea que no existe en ese lado del cambio.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y `gestor@sigpro.test` inicia sesión con `Gestor1234!`.
- Estado del seed, sin pasos previos, en el tenant `alumno01`: `DOC-001` («Plan de verificación PRG-001», público, versiones 1 a 3) y `DOC-002` («Especificación técnica PRG-001», público, versión 1). En la versión 2, la línea 9 pasa a ser «Se excluyen los equipos de apoyo en tierra y los simuladores.» (antes, «Se excluyen los equipos de apoyo en tierra.») y aparece la línea 15, «El director técnico supervisa la ejecución.»; en la versión 3, esa línea 9 desaparece.

## Criterios de aceptación
```gherkin
Característica: Comparación de versiones en la app móvil

  Esquema del escenario: La comparación inicial es la versión anterior contra la última
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo»
    Cuando abre /documents/<documento>
    Entonces «Desde» muestra <desde>, «Hasta» muestra <hasta> y el resumen es <resumen>

    Ejemplos:
      | documento | desde | hasta | resumen |
      | DOC-001 | «Versión 2» | «Versión 3» | «3 añadidas · 1 eliminadas · 1 modificadas» |

  Esquema del escenario: Cada cambio se lee en su fila, con la línea antigua encima de la nueva
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y está en /documents/DOC-001
    Cuando elige <desde> en «Desde» y <hasta> en «Hasta»
    Entonces hay una fila <tipo> con <lineas>

    Ejemplos:
      | desde | hasta | tipo | lineas |
      | «Versión 1» | «Versión 2» | «Modificada» | −9 «Se excluyen los equipos de apoyo en tierra.» tachada, y debajo +9 «Se excluyen los equipos de apoyo en tierra y los simuladores.» |
      | «Versión 1» | «Versión 2» | «Añadida» | solo +15 «El director técnico supervisa la ejecución.» |
      | «Versión 2» | «Versión 3» | «Eliminada» | solo −9 «Se excluyen los equipos de apoyo en tierra y los simuladores.» tachada |

  Esquema del escenario: Sin dos versiones distintas no hay comparación
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y está en /documents/<documento>
    Cuando <accion>
    Entonces la sección dice <aviso>

    Ejemplos:
      | documento | accion | aviso |
      | DOC-002 | mira la sección «Comparar versiones» | «Este documento solo tiene una versión: no hay nada que comparar.» |
      | DOC-001 | elige «Versión 3» en «Desde» | «Elige dos versiones distintas para compararlas.» |
```

## Fuera de alcance
- La comparación desde la web y su tabla de dos columnas: EP-DOC-VERSIONES, otra historia de esta épica.
- Los parámetros, las estadísticas y los errores de la API de comparación: EP-DOC-VERSIONES, otra historia de esta épica.
- La publicación de la versión nueva desde la ficha móvil: EP-DOC-VERSIONES, otra historia de esta épica.
- La lista de documentos y la descarga del PDF: EP-DOC-LISTA.
