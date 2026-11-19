---
id: US-REQ-ARBOL-010
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Móvil] Ver el detalle de un requisito en una hoja: campos, casos de prueba y no conformidades"
etiquetas: [movil]
relacionadas: [US-REQ-ARBOL-005, US-REQ-ARBOL-009, US-REQ-ARBOL-015]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero abrir un requisito y leer sus datos, sus casos de prueba enlazados y sus no conformidades en una hoja,
para entender qué exige el requisito y qué lo verifica sin salir de la pantalla de requisitos.

## Reglas
- Pulsar la fila de un requisito abre una hoja inferior con el título «Detalle del requisito». La hoja se cierra con el botón «Cerrar» o tocando fuera de ella.
- La hoja muestra, arriba, el código del requisito y su etiqueta de estado.
- Después muestra el título del requisito y tres campos con su nombre visible: «Prioridad», con su valor («Baja», «Media» o «Alta»); «Etiquetas», con los nombres de sus etiquetas separados por « · », o «Sin etiquetas» si no tiene ninguna; y «Descripción», con el texto del requisito en texto plano, un párrafo por línea, o «Sin descripción» si no tiene.
- A continuación aparecen los botones de edición y de movimiento del requisito, el bloque del flujo de aprobación y la sección «Trazabilidad». Esos botones y el flujo se describen en sus propias épicas.
- La sección «Trazabilidad» tiene el título «Trazabilidad» y dos grupos. «Casos de prueba enlazados» lista cada caso con su código y con el resultado de su última ejecución: «Superado», «Fallido», «Bloqueado» o «Sin ejecutar». Si no hay casos enlazados, muestra «Sin casos de prueba enlazados». «No conformidades» lista cada no conformidad con su código, su severidad y, si no está abierta, el texto «resuelta»; las abiertas se ven en color de peligro. Si no hay ninguna, muestra «Sin no conformidades».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app está en /login, sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo»; se escriben el correo y la contraseña de `gestor@sigpro.test` (`Gestor1234!`), se pulsa «Entrar» y se llega a Programas. Cada fila parte de un contexto nuevo.
- Tras un reinicio, `REQ-017` (en `PRG-002`, hijo de `REQ-015`) tiene prioridad baja, la etiqueta Ciberseguridad y el caso `TC-012` enlazado. `REQ-008` (en `PRG-001`) tiene enlazados `TC-001` y `TC-008`. `REQ-014` (en `PRG-001`) no tiene casos enlazados. `REQ-015` (en `PRG-002`) no tiene etiquetas.

## Criterios de aceptación
```gherkin
Característica: Detalle de un requisito en una hoja de la app móvil

  Esquema del escenario: La hoja muestra los datos del requisito de la fila pulsada
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/PRG-002/requirements
    Cuando pulsa la fila de REQ-017
    Entonces la hoja «Detalle del requisito» muestra <dato> con el valor <valor>

    Ejemplos:
      | dato | valor |
      | el código | REQ-017 |
      | el estado | «Borrador» |
      | el título | Disponibilidad del subsistema 017 |
      | el campo «Prioridad» | «Baja» |
      | el campo «Etiquetas» | «Ciberseguridad» |
      | el campo «Descripción» | El sistema debe cumplir el requisito 017 de disponibilidad en condiciones nominales. |

  Esquema del escenario: Un requisito sin etiquetas lo indica en el campo Etiquetas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/PRG-002/requirements
    Cuando pulsa la fila de <codigo>
    Entonces el campo «Etiquetas» dice «Sin etiquetas»

    Ejemplos:
      | codigo |
      | REQ-015 |

  Esquema del escenario: Los casos de prueba enlazados se listan con su código y su resultado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/PRG-001/requirements
    Cuando pulsa la fila de <codigo>
    Entonces en «Casos de prueba enlazados» ve los códigos <casos>, cada uno con uno de los resultados «Superado», «Fallido», «Bloqueado» o «Sin ejecutar»

    Ejemplos:
      | codigo | casos |
      | REQ-008 | TC-001 y TC-008 |

  Esquema del escenario: Un requisito sin casos enlazados ni no conformidades lo indica en Trazabilidad
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/PRG-001/requirements
    Cuando pulsa la fila de <codigo>
    Entonces en «Casos de prueba enlazados» ve el texto «Sin casos de prueba enlazados»
    Y en «No conformidades» ve el texto «Sin no conformidades»

    Ejemplos:
      | codigo |
      | REQ-014 |

  Esquema del escenario: Abrir el enlace de un requisito muestra su hoja al cargar la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil
    Cuando abre /programs/PRG-002/requirements?select=REQ-017
    Entonces la hoja «Detalle del requisito» muestra el código REQ-017

    Ejemplos:
      | codigo |
      | REQ-017 |

  Esquema del escenario: Cerrar la hoja devuelve al árbol
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil, abre /programs/PRG-002/requirements y tiene abierta la hoja de REQ-017
    Cuando pulsa «Cerrar»
    Entonces ya no se ve la hoja «Detalle del requisito»
    Y la fila de REQ-017 sigue en el árbol

    Ejemplos:
      | programa |
      | PRG-002 |
```

## Decisiones pendientes
- Qué se muestra cuando una no conformidad está rechazada: hoy, en la app móvil y en la web, se marca «resuelta» igual que una cerrada, aunque la rechazada no esté cerrada. No está decidido, y ninguna fila lo afirma.

## Fuera de alcance
- Editar el requisito, «Mover a…» y borrarlo, con sus permisos y sus motivos cuando están deshabilitados: EP-REQ-EDICION.
- El flujo de aprobación de la hoja y sus botones de transición: EP-REQ-FLUJO.
- Abrir un caso de prueba o una no conformidad desde la hoja: EP-REQ-ARBOL, en la historia de la app sobre la navegación desde el requisito.
- El detalle de escritorio de la web, que es la historia de la web: esta misma épica (EP-REQ-ARBOL).
- La pestaña «Matriz de trazabilidad» y el enlazado de casos: EP-REQ-TRAZA.
