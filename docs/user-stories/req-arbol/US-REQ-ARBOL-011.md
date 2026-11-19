---
id: US-REQ-ARBOL-011
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Móvil] Ver las cifras del programa y leer el documento de requisitos"
etiquetas: [movil]
relacionadas: [US-REQ-ARBOL-007, US-REQ-ARBOL-009, US-REQ-ARBOL-010]
verificacion: ejecutada
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero ver las cifras de los requisitos de un programa y leerlos como un documento numerado,
para saber en qué estado está el programa y leer sus requisitos de corrido, igual que en la web.

## Reglas
- Debajo de la tarjeta del programa aparecen cuatro cifras, con los mismos nombres y textos auxiliares que en la web: «Requisitos» (el total, con «validados: N»), «Cobertura de verificación» (el porcentaje de requisitos con al menos un caso enlazado, redondeado y seguido de «%», con «N de M con pruebas»), «Pendientes de aprobación» (los requisitos en borrador, con «en borrador») y «NC abiertas» (el número de no conformidades abiertas distintas, con «requisitos afectados: N»).
- Las cifras salen de la lista del programa completa: no cambian con la búsqueda. Mientras la lista carga, muestran «…».
- La pestaña «Documento» muestra los requisitos que cumplen la búsqueda como un texto continuo, en el orden del árbol y con todas las ramas visibles. Cada requisito muestra su número (1, 1.1, 1.2.1 y así, según su lugar en el árbol que se muestra), su código, su título precedido de su número (por ejemplo, «1.2 Disponibilidad del subsistema 017»), su descripción en texto plano y su etiqueta de estado.
- Pulsar el título de un requisito del documento abre su hoja de detalle, como en la pestaña «Árbol».
- Los números del documento se calculan sobre los requisitos que se muestran: si la búsqueda oculta un padre o un hermano, los números de los demás cambian.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app está en /login, sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo»; se escriben el correo y la contraseña de `gestor@sigpro.test` (`Gestor1234!`), se pulsa «Entrar» y se llega a Programas. Cada fila parte de un contexto nuevo.
- Tras un reinicio, `PRG-001` tiene 14 requisitos, con 3 validados, 3 en borrador y 13 con casos enlazados. `PRG-002` tiene 14 requisitos, con 4 validados, 5 en borrador y 13 con casos enlazados.

## Criterios de aceptación
```gherkin
Característica: Cifras y documento de requisitos en la app móvil

  Esquema del escenario: Las cifras del programa muestran sus valores y sus textos auxiliares
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre <programa>/requirements
    Cuando mira las cifras del programa
    Entonces la cifra <cifra> muestra <valor> con el texto <texto>

    Ejemplos:
      | programa | cifra | valor | texto |
      | /programs/PRG-001 | «Requisitos» | 14 | «validados: 3» |
      | /programs/PRG-001 | «Cobertura de verificación» | «93 %» | «13 de 14 con pruebas» |
      | /programs/PRG-001 | «Pendientes de aprobación» | 3 | «en borrador» |
      | /programs/PRG-002 | «Pendientes de aprobación» | 5 | «en borrador» |

  Esquema del escenario: La pestaña Documento numera los requisitos según su lugar en el árbol
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil, abre /programs/PRG-002/requirements y elige la pestaña «Documento»
    Cuando mira el requisito <codigo>
    Entonces ve el título <titulo> precedido del número <numero>

    Ejemplos:
      | codigo | numero | titulo |
      | REQ-015 | «1» | «Registro de eventos del subsistema 015» |
      | REQ-017 | «1.2» | «Disponibilidad del subsistema 017» |
      | REQ-018 | «1.2.1» | «Latencia del subsistema 018» |

  Esquema del escenario: Con una búsqueda activa el documento recalcula los números
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil, abre /programs/PRG-002/requirements y elige la pestaña «Documento»
    Cuando escribe 017 en «Buscar requisitos»
    Entonces ve el requisito REQ-015 con el número «1» y el requisito REQ-017 con el número «1.1»

    Ejemplos:
      | programa |
      | PRG-002 |

  Esquema del escenario: Pulsar el título de un requisito del documento abre su hoja de detalle
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil, abre /programs/PRG-002/requirements y elige la pestaña «Documento»
    Cuando pulsa el título del requisito <codigo>
    Entonces la hoja «Detalle del requisito» muestra el código <codigo>

    Ejemplos:
      | codigo |
      | REQ-017 |
```

## Decisiones pendientes
- Qué cifras muestra la app cuando la lista del programa no llega: hoy, en la app móvil, la tarjeta de cifras no aparece mientras dura el error, y en la web se queda con «…». No está decidido, y ninguna fila lo afirma.

## Fuera de alcance
- La pestaña «Matriz de trazabilidad» y su casilla de enlace: EP-REQ-TRAZA.
- Las cifras de cobertura cuando cambian los casos enlazados desde la matriz: EP-REQ-TRAZA.
- Los estados de los requisitos que cuentan las cifras de validados y de pendientes, y sus transiciones: EP-REQ-FLUJO.
- La hoja de detalle que se abre desde el documento: esta misma épica (EP-REQ-ARBOL), en la historia de la app sobre el detalle.
- Las cifras y el documento de la web: esta misma épica, en la historia de la web sobre cifras, documento y CSV.
