---
id: US-REQ-TRAZA-007
tipo: historia
epica: EP-REQ-TRAZA
titulo: "[Móvil] Leer, marcar y desmarcar cruces en la matriz de trazabilidad"
etiquetas: [movil]
relacionadas: [US-REQ-TRAZA-005, US-REQ-TRAZA-006]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
permisos: [requirement.edit]
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero ver la matriz de trazabilidad de los requisitos de un programa y tocar un cruce para enlazar o desenlazar un caso de prueba,
para mantener los enlaces desde la app igual que desde la web.

## Reglas
- La matriz es la tercera vista de la pantalla de Requisitos de la app, en `/programs/:code/requirements`, con el nombre «Matriz de trazabilidad» en el conmutador de vistas, junto a «Árbol» y «Documento». La ven todos los roles.
- Tiene el mismo contenido que la matriz de la web: el texto «Marca qué casos de prueba verifican cada requisito.», la cifra «N de M requisitos con cobertura» (N, los requisitos con al menos un caso enlazado; M, todos los del programa), la leyenda de símbolos (✓ Superado, ✕ Fallido, ! Bloqueado, · Sin ejecutar), una fila por requisito con su código, su título y, si no tiene casos enlazados, la etiqueta «Sin cobertura», y una columna por caso de prueba con su código. Un cruce enlazado muestra el símbolo del resultado de la última ejecución del caso; un cruce sin enlace queda sin marcar.
- Bajo la leyenda aparece siempre el texto «Desliza a los lados para ver todos los casos de prueba.». La tabla se desplaza a los lados para ver todas las columnas.
- Tocar un cruce lo marca o lo desmarca, con las mismas peticiones que en la web. El cambio se ve en la casilla antes de que responda el servidor. Cuando el servidor lo confirma aparece el aviso «Enlace creado» si se marcó, o «Enlace eliminado» si se desmarcó, con el texto «<requisito> ↔ <caso>» debajo, y la cifra de cobertura se actualiza.
- Si el servidor rechaza el cambio, el cruce vuelve a su estado anterior y aparece el aviso de error «Ha ocurrido un error inesperado».
- Un `auditor` ve la matriz, pero sus cruces no responden a los toques, y aparece el texto visible «Tu rol no permite editar requisitos».
- Un programa sin requisitos ni casos de prueba no muestra tabla: aparece el título «Matriz de trazabilidad» y el texto «Este programa no tiene requisitos o casos de prueba que cruzar.».
- Mientras llegan los datos, la matriz muestra un indicador de carga. Si la carga falla, aparece el título «No se pudieron cargar los requisitos», una línea con el motivo que devuelve la API o, si no hay respuesta, el texto «No se pudo contactar con el servidor», y el botón «Reintentar». Al pulsarlo, con la respuesta ya correcta, la matriz se vuelve a pedir y se muestra.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app móvil se abre en /login sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo»; la cuenta de la fila inicia sesión con su contraseña (`Gestor1234!` para `gestor@sigpro.test`, `Consul1234!` para `consultor@sigpro.test`, `Audit1234!` para `auditor@sigpro.test`) y llega a /programs.
- Tras un reinicio, `PRG-002` tiene 13 requisitos con cobertura de 14: `REQ-028` no tiene casos, y `REQ-017` tiene solo `TC-012`, que está marcado. `PRG-001` tiene 13 requisitos con cobertura de 14, y `REQ-014` no tiene casos. `PRG-004` y `PRG-024` no tienen requisitos ni casos.

## Criterios de aceptación
```gherkin
Característica: Matriz de trazabilidad en la app móvil

  Esquema del escenario: La cifra de cobertura y el requisito sin caso del programa
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil y llega a /programs
    Cuando abre /programs/<programa>/requirements y elige «Matriz de trazabilidad»
    Entonces ve el texto «<cobertura>»
    Y ve el texto «Desliza a los lados para ver todos los casos de prueba.»
    Y la fila de <sin_cobertura> muestra la etiqueta «Sin cobertura»

    Ejemplos:
      | programa | cobertura | sin_cobertura |
      | PRG-002 | 13 de 14 requisitos con cobertura | REQ-028 |
      | PRG-001 | 13 de 14 requisitos con cobertura | REQ-014 |

  Esquema del escenario: Tocar un cruce lo enlaza o lo desenlaza
    Dado que el tenant alumno01 está recién reiniciado, <cuenta> ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», tiene abierta la matriz de trazabilidad de PRG-002 y el cruce de <requisito> con <caso> está <estado_inicial>
    Cuando toca la casilla del cruce de <requisito> con <caso>
    Entonces ve el aviso <aviso> con el texto «<requisito> ↔ <caso>»
    Y ve el texto <cobertura>
    Y el cruce queda <estado_final>

    Ejemplos:
      | cuenta | requisito | caso | estado_inicial | aviso | cobertura | estado_final |
      | gestor@sigpro.test | REQ-028 | TC-010 | sin marcar | «Enlace creado» | «14 de 14 requisitos con cobertura» | marcado |
      | consultor@sigpro.test | REQ-017 | TC-012 | marcado | «Enlace eliminado» | «12 de 14 requisitos con cobertura» | sin marcar |

  Esquema del escenario: El auditor no puede cambiar los cruces
    Dado que el tenant alumno01 está recién reiniciado, auditor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», tiene abierta la matriz de trazabilidad de PRG-002 y el cruce de <requisito> con <caso> está <estado>
    Cuando toca la casilla de ese cruce
    Entonces el cruce sigue <estado>
    Y ve el texto «Tu rol no permite editar requisitos»

    Ejemplos:
      | requisito | caso | estado |
      | REQ-028 | TC-010 | sin marcar |
      | REQ-017 | TC-012 | marcado |

  Esquema del escenario: Un programa sin requisitos ni casos muestra el estado vacío
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil y llega a /programs
    Cuando abre /programs/<programa>/requirements y elige «Matriz de trazabilidad»
    Entonces ve el título «Matriz de trazabilidad» y el texto «Este programa no tiene requisitos o casos de prueba que cruzar.»

    Ejemplos:
      | programa |
      | PRG-004 |
      | PRG-024 |

  Esquema del escenario: Un fallo al pedir la matriz muestra el error y permite reintentar
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil y llega a /programs, y la prueba hace que GET /api/programs/PRG-002/traceability <fallo>
    Cuando abre /programs/PRG-002/requirements y elige «Matriz de trazabilidad»
    Entonces ve el título «No se pudieron cargar los requisitos» y <linea>
    Y al pulsar «Reintentar», con la respuesta ya correcta, ve el texto «13 de 14 requisitos con cobertura»

    Ejemplos:
      | fallo | linea |
      | responda 500 | el motivo que devuelve la API |
      | no obtenga respuesta | el texto «No se pudo contactar con el servidor» |

  Esquema del escenario: Un cambio rechazado por el servidor deja el cruce como estaba
    Dado que el tenant alumno01 está recién reiniciado, consultor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», tiene abierta la matriz de trazabilidad de PRG-002, y después gestor@sigpro.test ha eliminado por la API el requisito <requisito>, y el cruce de <requisito> con <caso> está <estado>
    Cuando toca la casilla del cruce de <requisito> con <caso>
    Entonces ve el aviso de error «Ha ocurrido un error inesperado»
    Y el cruce vuelve a estar <estado>

    Ejemplos:
      | requisito | caso | estado |
      | REQ-028 | TC-010 | sin marcar |
      | REQ-022 | TC-010 | marcado |
```

## Fuera de alcance
- Las mismas acciones desde la web: US-REQ-TRAZA-005 y US-REQ-TRAZA-006 de esta misma épica.
- El árbol de requisitos, el detalle de un requisito y las cifras del programa: EP-REQ-ARBOL.
- La ficha del caso de prueba y sus ejecuciones: EP-VER-CASOS y EP-VER-EJECUCION.
- Las peticiones de enlace y desenlace de la API: esta misma épica, en sus historias de la API.
