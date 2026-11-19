---
id: US-VER-EJECUCION-007
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[Web] Ver el historial de ejecuciones con sus evidencias y descargarlas"
etiquetas: [web]
relacionadas: [US-VER-EJECUCION-004, US-VER-EJECUCION-005, US-VER-EJECUCION-006, US-VER-EJECUCION-010]
verificacion: codigo
cubre: ["/verification/:code"]
---

## Historia
Como persona que revisa un caso de prueba desde la web, quiero ver cada ejecución con su resultado, sus notas, quién la registró y sus evidencias, y descargar cada evidencia,
para comprobar qué se verificó y con qué captura o documento, sin salir de la página del caso.

## Reglas
- El «Historial de ejecuciones» es una tabla con las columnas «Fecha», «Resultado», «Notas», «Evidencias» y «Ejecutado por». Las ejecuciones aparecen de la más reciente a la más antigua, por fecha de ejecución.
- Cada fila muestra el identificador de la ejecución (`RUN-` seguido de tres dígitos), su fecha y su hora, su resultado con el mismo texto que el selector («Superado», «Fallido» o «Bloqueado»), sus notas (o «—» si están vacías) y el nombre de quien la registró.
- Una ejecución sin evidencias muestra «Sin evidencias».
- Una evidencia de imagen (PNG o JPEG) se muestra con una miniatura identificada como «Evidencia» seguido del código del caso (por ejemplo, «Evidencia TC-001»), con su nombre completo, su tamaño y el botón «Descargar». Mientras la miniatura carga, es un marco gris. Si no puede cargarse, muestra una cruz y, al pasar el puntero por encima, el aviso «No se pudo cargar la evidencia».
- Una evidencia PDF se muestra con un icono que lleva el distintivo «PDF», identificado como «Documento PDF» seguido de su nombre, y con su nombre, su tamaño y el botón «Descargar».
- «Descargar» guarda el archivo en el navegador con su nombre. Si la descarga falla, aparece el aviso «No se pudo cargar la evidencia».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La persona abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, entra como `consultor@sigpro.test` (contraseña `Consul1234!`) y abre `/verification/TC-001`.
- Datos del seed de `TC-001`: `RUN-001` (resultado «Superado», notas «Resultado conforme con el criterio de aceptación.», con la evidencia `TC-001-001.png`) y `RUN-002` (resultado «Bloqueado», notas «Ejecución bloqueada: el entorno de pruebas no estaba disponible.», sin evidencias). Ambas las registró Lucía Fernández.

## Criterios de aceptación
```gherkin
Característica: Historial de ejecuciones con evidencias en la web

  Esquema del escenario: Cada ejecución muestra su resultado, sus notas, sus evidencias y quién la registró
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto /verification/TC-001
    Cuando mira la fila de la ejecución <ejecucion> en «Historial de ejecuciones»
    Entonces la fila muestra el resultado <resultado>, las notas <notas> y, en la columna de evidencias, <evidencias>
    Y la fila indica que la ejecución la registró Lucía Fernández

    Ejemplos:
      | ejecucion | resultado | notas | evidencias |
      | RUN-002 | «Bloqueado» | Ejecución bloqueada: el entorno de pruebas no estaba disponible. | «Sin evidencias» |
      | RUN-001 | «Superado» | Resultado conforme con el criterio de aceptación. | la captura TC-001-001.png |

  Esquema del escenario: Las ejecuciones van de la más reciente a la más antigua
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto /verification/TC-001
    Cuando mira el orden de las filas de «Historial de ejecuciones»
    Entonces <primera> aparece encima de <segunda>

    Ejemplos:
      | primera | segunda |
      | RUN-002 | RUN-001 |

  Esquema del escenario: Una evidencia de imagen se identifica, se ve y se descarga con su nombre
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto /verification/TC-001
    Cuando pulsa «Descargar» en la evidencia de la ejecución <ejecucion>
    Entonces el navegador guarda el archivo <nombre>
    Y la miniatura de esa evidencia está identificada como «Evidencia TC-001»

    Ejemplos:
      | ejecucion | nombre |
      | RUN-001 | TC-001-001.png |

  Esquema del escenario: Una evidencia PDF se muestra con su distintivo y se descarga con su nombre
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha registrado con la API, en TC-001, la ejecución RUN-051 con el resultado «Fallido», las notas Adjunto informe y la evidencia informe.pdf, que es un PDF válido de 1.024 bytes; y consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto /verification/TC-001
    Cuando pulsa «Descargar» en la evidencia <evidencia>
    Entonces el navegador guarda el archivo <evidencia>
    Y la evidencia de la ejecución RUN-051 aparece con el distintivo «PDF» y el nombre informe.pdf

    Ejemplos:
      | evidencia |
      | informe.pdf |
```

## Fuera de alcance
- Registrar la ejecución y el aviso de «Ejecución registrada»: historia 005 de esta épica.
- Elegir las evidencias antes de enviar: historia 006.
- La descarga por la API, con sus cabeceras y su 404: historia 004.
- La versión móvil del historial, con la ampliación de las imágenes: historia 010.
- La lista de casos y la cabecera y los pasos del detalle del caso: EP-VER-CASOS.
