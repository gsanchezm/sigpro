---
id: US-VER-EJECUCION-008
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[Móvil] Registrar una ejecución desde el detalle del caso"
etiquetas: [movil]
relacionadas: [US-VER-EJECUCION-001, US-VER-EJECUCION-002, US-VER-EJECUCION-005, US-VER-EJECUCION-009, US-VER-EJECUCION-010]
verificacion: codigo
cubre: ["/verification/:code"]
permisos: [testrun.execute]
---

## Historia
Como persona con permiso para ejecutar pruebas que trabaja desde el móvil, quiero registrar el resultado de un caso con sus notas desde su pantalla de detalle, y ver qué me impide enviarlo,
para dejar la ejecución en el historial del caso sin tener que usar el ordenador.

## Reglas
- Solo `admin` y `consultant` pueden enviar el formulario. Para `program_manager` y `auditor`, la sección «Registrar ejecución» muestra el aviso «Tu rol no permite registrar ejecuciones», y sus controles y el botón no se pueden usar.
- Las opciones de resultado son «Superado», «Fallido» y «Bloqueado», y solo se puede elegir una. Sin ninguna elegida, «Registrar ejecución» no envía nada y bajo las opciones aparece «Selecciona un resultado».
- «Notas» admite hasta 1000 caracteres. Con más, bajo el campo aparece «Las notas admiten hasta 1000 caracteres» y no se envía nada.
- Al registrar con éxito aparece el aviso «Ejecución registrada», con el texto del caso, el resultado y el identificador de la ejecución (por ejemplo, «TC-001: Superado · RUN-051»). Si la ejecución lleva evidencias, el texto añade «con N archivo(s) de evidencia». El formulario queda vacío (resultado, notas y archivos). La ejecución nueva aparece como primera en el historial de la misma pantalla, sin salir de ella y sin mover el desplazamiento.
- Mientras se envía, «Registrar ejecución» está ocupado y no se puede volver a pulsar.
- Si el servidor rechaza la ejecución, no aparece el aviso de éxito. Bajo el formulario aparece un aviso de error con el texto del motivo; para un archivo que no es PNG, JPEG ni PDF, «Solo se admiten archivos PNG, JPEG o PDF». El formulario conserva el resultado, las notas y los archivos elegidos.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo». La persona entra con la cuenta de la fila (`consultor@sigpro.test`, contraseña `Consul1234!`, salvo en el Esquema de permisos) y abre `/verification/TC-001`.
- En el seed, `TC-001` tiene 2 ejecuciones y su último resultado es «Bloqueado» (`RUN-002`).

## Criterios de aceptación
```gherkin
Característica: Registro de una ejecución desde el móvil

  Esquema del escenario: Una ejecución con resultado y notas aparece en el historial
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierto /verification/TC-001
    Cuando elige el resultado <resultado>, escribe en «Notas» Prueba de humo y pulsa «Registrar ejecución»
    Entonces ve el aviso «Ejecución registrada» con el texto «<aviso>»
    Y el historial de ejecuciones muestra primero RUN-051 con el resultado <resultado>
    Y el formulario queda sin resultado y con «Notas» vacío

    Ejemplos:
      | resultado | aviso |
      | «Superado» | TC-001: Superado · RUN-051 |
      | «Fallido» | TC-001: Fallido · RUN-051 |
      | «Bloqueado» | TC-001: Bloqueado · RUN-051 |

  Esquema del escenario: Sin resultado elegido no se envía la ejecución
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierto /verification/TC-001
    Cuando escribe en «Notas» <notas>, no elige ningún resultado y pulsa «Registrar ejecución»
    Entonces ve bajo las opciones de resultado el aviso «Selecciona un resultado»
    Y no ve el aviso «Ejecución registrada» y el historial sigue con 2 ejecuciones

    Ejemplos:
      | notas |
      | (vacío) |
      | Prueba sin resultado |

  Esquema del escenario: Las notas admiten hasta 1000 caracteres
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierto /verification/TC-001
    Cuando elige el resultado «Fallido», escribe en «Notas» un texto de <caracteres> caracteres y pulsa «Registrar ejecución»
    Entonces <respuesta>

    Ejemplos:
      | caracteres | respuesta |
      | 999 | ve el aviso «Ejecución registrada» con el texto «TC-001: Fallido · RUN-051» |
      | 1000 | ve el aviso «Ejecución registrada» con el texto «TC-001: Fallido · RUN-051» |
      | 1001 | ve bajo el campo «Notas» el aviso «Las notas admiten hasta 1000 caracteres», y el historial sigue con 2 ejecuciones |

  Esquema del escenario: El servidor rechaza un archivo que la app había aceptado
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierto /verification/TC-001
    Cuando elige el resultado «Bloqueado», escribe en «Notas» Prueba con evidencia no válida, añade con «Adjuntar un archivo» el archivo <archivo> y pulsa «Registrar ejecución»
    Entonces ve el aviso de error «Solo se admiten archivos PNG, JPEG o PDF»
    Y no ve el aviso «Ejecución registrada» y el historial sigue con 2 ejecuciones
    Y el formulario conserva el resultado «Bloqueado», las notas y el archivo <archivo> en «Archivos seleccionados»

    Ejemplos:
      | archivo |
      | falso.png |

  Esquema del escenario: Sin el permiso el formulario se ve, pero no se puede enviar
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierto /verification/TC-001
    Cuando mira la sección «Registrar ejecución»
    Entonces ve el aviso «Tu rol no permite registrar ejecuciones»
    Y las opciones de resultado, «Notas», los controles para adjuntar evidencias y «Registrar ejecución» no se pueden usar

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | auditor@sigpro.test |
```

## Fuera de alcance
- La elección de las evidencias con los botones de imagen y de PDF, con sus avisos: historia 009 de esta épica.
- El historial con la ampliación de las imágenes y la descarga de las evidencias: historia 010.
- La elección de archivos con el selector de iOS y el de Android: historias 011 y 012.
- Las reglas de la API en las que se apoya este formulario: historias 001 a 003.
- La versión web de esta pantalla: historia 005.
- La lista de casos y la cabecera y los pasos del detalle del caso: EP-VER-CASOS.

## Decisiones pendientes
- Si el aviso de error muestra además el código HTTP de la respuesta y la traza de la petición, como ocurre hoy, y en qué forma. No está decidido. Ningún ejemplo de esta historia lo afirma: los Esquemas comprueban solo el texto del motivo.
