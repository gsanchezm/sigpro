---
id: US-VER-EJECUCION-005
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[Web] Registrar una ejecución desde el detalle del caso"
etiquetas: [web]
relacionadas: [US-VER-EJECUCION-001, US-VER-EJECUCION-002, US-VER-EJECUCION-003, US-VER-EJECUCION-006, US-VER-EJECUCION-007, US-VER-EJECUCION-008]
verificacion: ejecutada
cubre: ["/verification/:code"]
permisos: [testrun.execute]
---

## Historia
Como persona con permiso para ejecutar pruebas en SIGPRO, quiero registrar en la página del caso el resultado de una ejecución con sus notas, y ver el aviso de lo que el servidor no acepta,
para que la ejecución quede en el historial del caso y, si algo no vale, saber qué corregir sin perder lo que había escrito.

## Reglas
- Solo quien tiene el permiso de ejecutar pruebas (`admin` y `consultant`) puede enviar el formulario. `program_manager` y `auditor` ven el formulario con sus controles deshabilitados y el motivo a la vista (ver el Esquema de permisos).
- El formulario «Registrar ejecución» tiene el «Resultado» (una opción entre «Superado», «Fallido» y «Bloqueado»), las «Notas» y la zona «Evidencias», donde se adjuntan los archivos.
- Sin resultado elegido, «Registrar ejecución» no envía nada y, bajo las opciones, aparece «Selecciona un resultado».
- Las notas admiten hasta 1000 caracteres. Con más, bajo el campo «Notas» aparece «Las notas admiten hasta 1000 caracteres» y no se envía nada.
- Al registrar con éxito aparece el aviso «Ejecución registrada», con el texto del caso, el resultado y el identificador de la ejecución (por ejemplo, «TC-001: Superado · RUN-051»). Si la ejecución lleva evidencias, el texto añade «con N archivo(s) de evidencia». El formulario queda vacío (resultado, notas y archivos). El historial muestra la ejecución nueva como primera fila, y la cabecera de la página muestra el nuevo último resultado del caso.
- Mientras se envía, «Registrar ejecución» muestra el indicador de carga, no se puede volver a pulsar y el formulario queda ocupado.
- Si el servidor rechaza la ejecución, no aparece el aviso de éxito ni cambia el historial. El formulario conserva el resultado, las notas y los archivos elegidos, y aparece un aviso de error con el texto del motivo. Para un archivo que no es PNG, JPEG ni PDF, ese texto es «Solo se admiten archivos PNG, JPEG o PDF».
- Para el Esquema del rechazo del servidor, `falso.png` es un texto plano de 1.024 bytes con nombre de PNG, y `mal.png` es un JPEG válido de 1.024 bytes con nombre de PNG. El navegador los acepta por su extensión y el servidor los rechaza por su contenido.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La persona abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada y entra con la cuenta de la fila (`consultor@sigpro.test`, contraseña `Consul1234!`, salvo en el Esquema de permisos). Después abre `/verification/TC-001`.
- En el seed, `TC-001` tiene 2 ejecuciones y su último resultado es «Bloqueado» (`RUN-002`).

## Criterios de aceptación
```gherkin
Característica: Registro de una ejecución desde la página del caso

  Esquema del escenario: Una ejecución con resultado y notas aparece en el historial
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto /verification/TC-001
    Cuando elige el resultado <resultado>, escribe en «Notas» Prueba de humo y pulsa «Registrar ejecución»
    Entonces ve el aviso «Ejecución registrada» con el texto «<aviso>»
    Y el historial de ejecuciones muestra primero RUN-051 con el resultado <resultado> y las notas Prueba de humo
    Y la cabecera de la página muestra como último resultado <ultimo>

    Ejemplos:
      | resultado | aviso | ultimo |
      | «Superado» | TC-001: Superado · RUN-051 | «Superado» |
      | «Fallido» | TC-001: Fallido · RUN-051 | «Fallido» |
      | «Bloqueado» | TC-001: Bloqueado · RUN-051 | «Bloqueado» |

  Esquema del escenario: Sin resultado elegido no se envía la ejecución
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto /verification/TC-001
    Cuando escribe en «Notas» <notas>, no elige ningún resultado y pulsa «Registrar ejecución»
    Entonces ve bajo las opciones de resultado el aviso «Selecciona un resultado»
    Y no ve el aviso «Ejecución registrada» y el historial sigue con 2 ejecuciones

    Ejemplos:
      | notas |
      | (vacío) |
      | Prueba sin resultado |

  Esquema del escenario: Las notas admiten hasta 1000 caracteres
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto /verification/TC-001
    Cuando elige el resultado «Fallido», escribe en «Notas» un texto de <caracteres> caracteres y pulsa «Registrar ejecución»
    Entonces <respuesta>

    Ejemplos:
      | caracteres | respuesta |
      | 999 | ve el aviso «Ejecución registrada» con el texto «TC-001: Fallido · RUN-051» |
      | 1000 | ve el aviso «Ejecución registrada» con el texto «TC-001: Fallido · RUN-051» |
      | 1001 | ve bajo el campo «Notas» el aviso «Las notas admiten hasta 1000 caracteres», y el historial sigue con 2 ejecuciones |

  Esquema del escenario: El servidor rechaza un archivo que el navegador había aceptado
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto /verification/TC-001
    Cuando elige el resultado «Bloqueado», escribe en «Notas» Prueba con evidencia no válida, añade el archivo <archivo> y pulsa «Registrar ejecución»
    Entonces ve el aviso de error «<aviso>»
    Y no ve el aviso «Ejecución registrada» y el historial sigue con 2 ejecuciones
    Y el formulario conserva el resultado «Bloqueado», las notas y el archivo <archivo> en «Archivos seleccionados»

    Ejemplos:
      | archivo | aviso |
      | falso.png | Solo se admiten archivos PNG, JPEG o PDF |
      | mal.png | Solo se admiten archivos PNG, JPEG o PDF |

  Esquema del escenario: Sin el permiso el formulario se ve, pero no se puede enviar
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en /login?tenant=alumno01 y tiene abierto /verification/TC-001
    Cuando mira el formulario «Registrar ejecución»
    Entonces ve el aviso «Tu rol no permite registrar ejecuciones»
    Y las opciones de resultado, «Notas» y los controles para adjuntar evidencias están deshabilitados
    Y «Registrar ejecución» está deshabilitado y, al pasar el puntero por encima, muestra el mismo motivo

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | auditor@sigpro.test |
```

## Fuera de alcance
- La elección de archivos antes de enviar, con sus avisos de tipo, tamaño y cantidad: historia 006 de esta épica.
- El historial, las miniaturas y la descarga de las evidencias guardadas: historia 007.
- Las reglas de la API en las que se apoya este formulario: historias 001 a 003.
- La versión móvil de esta pantalla: historia 008.
- El informe PDF del caso: EP-VER-INFORME.
- La lista de casos, y la cabecera y los pasos del detalle del caso: EP-VER-CASOS.

## Decisiones pendientes
- Si el aviso de error muestra además el código HTTP de la respuesta y la traza de la petición, como ocurre hoy, y en qué forma. No está decidido. Ningún ejemplo de esta historia lo afirma: los Esquemas comprueban solo el texto del motivo.
