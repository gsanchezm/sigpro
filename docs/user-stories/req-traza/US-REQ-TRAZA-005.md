---
id: US-REQ-TRAZA-005
tipo: historia
epica: EP-REQ-TRAZA
titulo: "[Web] Leer la matriz de trazabilidad del programa"
etiquetas: [web]
relacionadas: [US-REQ-TRAZA-001, US-REQ-TRAZA-006, US-REQ-TRAZA-007]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero abrir la pestaña «Matriz de trazabilidad» de los requisitos de un programa y leer qué casos de prueba verifican cada requisito y con qué resultado,
para ver de un vistazo qué requisitos todavía no tienen ningún caso de prueba.

## Reglas
- La pestaña «Matriz de trazabilidad» está en `/programs/:code/requirements`, junto a «Árbol» y «Documento». La pantalla se abre en «Árbol» y la matriz aparece al pulsar su pestaña. La ven todos los roles.
- Mientras llegan los datos de la matriz, la pestaña muestra un indicador de carga en lugar de la tabla.
- La matriz es una tabla con una fila por requisito del programa, con su código y su título, y una columna por caso de prueba del programa, con su código. Filas y columnas van en orden de código.
- El código de cada caso de la cabecera es un enlace a su ficha en `/verification/<código>`.
- Un cruce entre un requisito y un caso enlazados muestra el símbolo del resultado de la última ejecución del caso: ✓ si el resultado es «Superado», ✕ si es «Fallido» y ! si es «Bloqueado». Un caso que nunca se ha ejecutado se muestra con · y «Sin ejecutar». Un cruce sin enlace queda sin marcar y sin ningún símbolo.
- Sobre la tabla aparece el texto «Marca qué casos de prueba verifican cada requisito.», la leyenda de los cuatro símbolos (✓ Superado, ✕ Fallido, ! Bloqueado, · Sin ejecutar) y la cifra «N de M requisitos con cobertura». N es el número de requisitos con al menos un caso enlazado, y M el de todos los requisitos del programa.
- Un requisito sin ningún caso enlazado muestra junto a su código y su título la etiqueta «Sin cobertura». Los requisitos con casos enlazados no la muestran.
- Un programa sin requisitos ni casos de prueba no muestra tabla: aparece el título «Matriz de trazabilidad» y el texto «Este programa no tiene requisitos o casos de prueba que cruzar.».
- Si la carga falla, aparece un aviso de error y el botón «Reintentar». El aviso muestra el motivo que devuelve la API o, si no hay respuesta, el texto «No se pudo contactar con el servidor». Al pulsar «Reintentar», con la respuesta ya correcta, la matriz se vuelve a pedir y se muestra.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, la cuenta de la fila inicia sesión con su contraseña y llega a /programs. Las contraseñas son `Gestor1234!` para `gestor@sigpro.test`, `Consul1234!` para `consultor@sigpro.test` y `Audit1234!` para `auditor@sigpro.test`.
- Tras un reinicio, `PRG-002` tiene 14 requisitos (de `REQ-015` a `REQ-028`), 9 casos (de `TC-010` a `TC-018`) y 13 requisitos con cobertura; `REQ-028` es el único sin cobertura. `PRG-001` tiene 14 requisitos y 13 con cobertura; `REQ-014` es el único sin cobertura. `PRG-003` tiene 12 requisitos y 11 con cobertura; `REQ-040` es el único sin cobertura.

## Criterios de aceptación
```gherkin
Característica: Matriz de trazabilidad en la web

  Esquema del escenario: La cifra de cobertura y el requisito sin caso de cada programa
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión y llega a /programs
    Cuando abre /programs/<programa>/requirements y pulsa «Matriz de trazabilidad»
    Entonces ve el texto «<cobertura>»
    Y la fila de <sin_cobertura> muestra la etiqueta «Sin cobertura»

    Ejemplos:
      | programa | cobertura | sin_cobertura |
      | PRG-001 | 13 de 14 requisitos con cobertura | REQ-014 |
      | PRG-002 | 13 de 14 requisitos con cobertura | REQ-028 |
      | PRG-003 | 11 de 12 requisitos con cobertura | REQ-040 |

  Esquema del escenario: Cada cruce enlazado muestra el símbolo de la última ejecución del caso
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión y llega a /programs
    Cuando abre /programs/PRG-002/requirements y pulsa «Matriz de trazabilidad»
    Entonces el cruce de <requisito> con <caso> muestra <simbolo>, que en la leyenda significa «<resultado>»

    Ejemplos:
      | requisito | caso | simbolo | resultado |
      | REQ-017 | TC-012 | ✓ | Superado |
      | REQ-018 | TC-013 | ✕ | Fallido |
      | REQ-021 | TC-016 | ! | Bloqueado |
      | REQ-022 | TC-010 | ✓ | Superado |
      | REQ-022 | TC-017 | ✕ | Fallido |

  Esquema del escenario: Un cruce sin enlace queda sin marcar
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión y llega a /programs
    Cuando abre /programs/<programa>/requirements y pulsa «Matriz de trazabilidad»
    Entonces el cruce de <requisito> con <caso> está sin marcar y no muestra ningún símbolo

    Ejemplos:
      | programa | requisito | caso |
      | PRG-002 | REQ-028 | TC-010 |
      | PRG-001 | REQ-001 | TC-002 |

  Esquema del escenario: La cabecera de cada caso lleva a su ficha de verificación
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión y llega a /programs
    Cuando abre /programs/PRG-002/requirements, pulsa «Matriz de trazabilidad» y pulsa el código <caso> de la cabecera de la matriz
    Entonces llega a <ruta>

    Ejemplos:
      | caso | ruta |
      | TC-012 | /verification/TC-012 |
      | TC-016 | /verification/TC-016 |

  Esquema del escenario: Un programa sin requisitos ni casos muestra el estado vacío
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión y llega a /programs
    Cuando abre /programs/<programa>/requirements y pulsa «Matriz de trazabilidad»
    Entonces ve el título «Matriz de trazabilidad» y el texto «Este programa no tiene requisitos o casos de prueba que cruzar.»
    Y no ve ninguna tabla de la matriz

    Ejemplos:
      | programa |
      | PRG-004 |
      | PRG-024 |

  Esquema del escenario: Mientras llegan los datos se ve un indicador de carga
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión y llega a /programs, y la prueba retrasa <espera> la respuesta de GET /api/programs/PRG-002/traceability en el navegador
    Cuando abre /programs/PRG-002/requirements y pulsa «Matriz de trazabilidad»
    Entonces ve un indicador de carga y no ve la tabla de la matriz
    Y al llegar la respuesta ve el texto «13 de 14 requisitos con cobertura»

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Un fallo al pedir la matriz muestra el error y permite reintentar
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión y llega a /programs, y la prueba hace que GET /api/programs/PRG-002/traceability <fallo>
    Cuando abre /programs/PRG-002/requirements y pulsa «Matriz de trazabilidad»
    Entonces ve un aviso de error con <aviso> y el botón «Reintentar»
    Y al pulsar «Reintentar», con la respuesta ya correcta, ve el texto «13 de 14 requisitos con cobertura»

    Ejemplos:
      | fallo | aviso |
      | responda 500 | el motivo que devuelve la API |
      | no obtenga respuesta | el texto «No se pudo contactar con el servidor» |
```

## Fuera de alcance
- Marcar y desmarcar cruces desde la matriz: esta misma épica, en la historia de la web sobre cambios.
- El árbol de requisitos, el detalle de un requisito y las cifras del programa: EP-REQ-ARBOL.
- La ficha del caso de prueba al que llega la cabecera, y sus ejecuciones: las épicas de Verificación, todavía sin escribir.
