---
id: US-REQ-TRAZA-006
tipo: historia
epica: EP-REQ-TRAZA
titulo: "[Web] Marcar y desmarcar un cruce en la matriz de trazabilidad"
etiquetas: [web]
relacionadas: [US-REQ-TRAZA-002, US-REQ-TRAZA-004, US-REQ-TRAZA-005, US-REQ-TRAZA-007]
verificacion: ejecutada
cubre: ["/programs/:code/requirements"]
permisos: [requirement.edit]
---

## Historia
Como persona que gestiona los requisitos de un programa desde la web, quiero marcar o desmarcar un caso de prueba en su cruce con un requisito de la matriz de trazabilidad,
para dejar enlazado el caso con el requisito que verifica, o quitarlo, sin salir de la pantalla.

## Reglas
- Pueden marcar y desmarcar los roles con el permiso `requirement.edit`: `admin`, `program_manager` y `consultant`. Un `auditor` ve la matriz con las casillas deshabilitadas: no puede cambiarlas, y al pasar el puntero sobre una aparece la explicación «Tu rol no permite editar requisitos».
- Marcar un cruce enlaza el requisito con el caso, y desmarcarlo los desenlaza.
- El cambio se ve en la casilla antes de que responda el servidor. Cuando el servidor lo confirma aparece el aviso emergente «Enlace creado» si se marcó, o «Enlace eliminado» si se desmarcó, con el texto «<requisito> ↔ <caso>» debajo.
- Tras la confirmación, la cifra «N de M requisitos con cobertura» refleja el cambio: sube cuando un requisito pasa a tener su primer caso, baja cuando pierde su último caso, y no cambia cuando el requisito conserva otro caso enlazado.
- Si el servidor rechaza el cambio, el cruce vuelve a su estado anterior, la cifra vuelve a su valor anterior y aparece el aviso emergente de error «Ha ocurrido un error inesperado».
- Un cruce marcado conserva el símbolo del resultado de la última ejecución del caso, como en la matriz de solo lectura: marcarlo no cambia ese resultado.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, la cuenta de la fila inicia sesión con su contraseña (`Consul1234!` para `consultor@sigpro.test`, `Gestor1234!` para `gestor@sigpro.test`, `Audit1234!` para `auditor@sigpro.test`) y llega a /programs. Después la pantalla de Requisitos del programa se abre y se pulsa «Matriz de trazabilidad».
- Tras un reinicio, `PRG-002` tiene 13 requisitos con cobertura de 14; `REQ-017` tiene solo `TC-012` y `REQ-022` tiene `TC-010` y `TC-017`; `REQ-028` no tiene casos. `PRG-001` tiene 13 requisitos con cobertura de 14, y `REQ-014` no tiene ningún caso.

## Criterios de aceptación
```gherkin
Característica: Marcar y desmarcar cruces en la matriz de trazabilidad de la web

  Esquema del escenario: Marcar un cruce lo enlaza y actualiza la cobertura
    Dado que el tenant alumno01 está recién reiniciado, <cuenta> ha iniciado sesión en /login?tenant=alumno01 y tiene abierta la matriz de trazabilidad de <programa> en /programs/<programa>/requirements, y el cruce de <requisito> con <caso> está sin marcar
    Cuando marca la casilla del cruce de <requisito> con <caso>
    Entonces ve el aviso «Enlace creado» con el texto «<requisito> ↔ <caso>»
    Y el cruce queda marcado
    Y ve el texto «<cobertura>»

    Ejemplos:
      | cuenta | programa | requisito | caso | cobertura |
      | consultor@sigpro.test | PRG-002 | REQ-028 | TC-010 | 14 de 14 requisitos con cobertura |
      | gestor@sigpro.test | PRG-001 | REQ-014 | TC-009 | 14 de 14 requisitos con cobertura |

  Esquema del escenario: Desmarcar un cruce lo desenlaza y actualiza la cobertura
    Dado que el tenant alumno01 está recién reiniciado, <cuenta> ha iniciado sesión en /login?tenant=alumno01 y tiene abierta la matriz de trazabilidad de <programa> en /programs/<programa>/requirements, y el cruce de <requisito> con <caso> está marcado
    Cuando desmarca la casilla del cruce de <requisito> con <caso>
    Entonces ve el aviso «Enlace eliminado» con el texto «<requisito> ↔ <caso>»
    Y el cruce queda sin marcar
    Y ve el texto «<cobertura>»
    Y la fila de <requisito> <etiqueta>

    Ejemplos:
      | cuenta | programa | requisito | caso | cobertura | etiqueta |
      | consultor@sigpro.test | PRG-002 | REQ-017 | TC-012 | 12 de 14 requisitos con cobertura | muestra la etiqueta «Sin cobertura» |
      | gestor@sigpro.test | PRG-002 | REQ-022 | TC-010 | 13 de 14 requisitos con cobertura | no muestra la etiqueta «Sin cobertura» |

  Esquema del escenario: El auditor no puede cambiar los cruces
    Dado que el tenant alumno01 está recién reiniciado, auditor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierta la matriz de trazabilidad de PRG-002, y el cruce de <requisito> con <caso> está <estado>
    Cuando intenta <intento> la casilla de ese cruce
    Entonces la casilla está deshabilitada y el cruce sigue <estado>
    Y al pasar el puntero sobre ella aparece la explicación «Tu rol no permite editar requisitos»

    Ejemplos:
      | requisito | caso | estado | intento |
      | REQ-028 | TC-010 | sin marcar | marcarla |
      | REQ-017 | TC-012 | marcado | desmarcarla |

  Esquema del escenario: Un rechazo del servidor devuelve el cruce y la cifra a su estado anterior
    Dado que el tenant alumno01 está recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierta la matriz de trazabilidad de PRG-002, y después gestor@sigpro.test ha eliminado por la API el requisito <requisito>
    Cuando <operacion> la casilla del cruce de <requisito> con <caso>
    Entonces ve el aviso de error «Ha ocurrido un error inesperado»
    Y el cruce vuelve a estar <estado_anterior>
    Y ve el texto «<cobertura>»

    Ejemplos:
      | operacion | requisito | caso | estado_anterior | cobertura |
      | marca | REQ-028 | TC-010 | sin marcar | 13 de 14 requisitos con cobertura |
      | desmarca | REQ-022 | TC-010 | marcado | 13 de 14 requisitos con cobertura |
```

## Fuera de alcance
- La lectura de la matriz, sus símbolos, su cifra y sus estados de carga, vacío y error: esta misma épica, en la historia de lectura de la web.
- La eliminación de un requisito, que quita también sus enlaces: EP-REQ-EDICION.
- El enlace y el desenlace de la API a los que llama la casilla: esta misma épica, en las historias de la API.
