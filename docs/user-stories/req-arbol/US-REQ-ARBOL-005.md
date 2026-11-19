---
id: US-REQ-ARBOL-005
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Web] Ver el detalle de un requisito: panel junto al árbol o pantalla completa"
etiquetas: [web]
relacionadas: [US-REQ-ARBOL-002, US-REQ-ARBOL-003, US-REQ-ARBOL-010]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
permisos: [requirement.edit]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero abrir el detalle de un requisito desde el árbol y leer sus datos, sus casos de prueba enlazados y sus no conformidades, y copiar su código,
para entender qué exige el requisito y qué lo verifica sin salir de la pantalla de requisitos.

## Reglas
- Pulsar el título de un requisito en el árbol abre su detalle. Pulsar en la fila, fuera de sus botones, también lo abre.
- En una ventana de 1024 px o más, el detalle aparece en un panel a la derecha del árbol. El panel tiene el código del requisito, su etiqueta de estado, el botón «⧉ Copiar código» y un botón de cierre cuyo nombre es «Cerrar detalle de» seguido del código del requisito (por ejemplo, «Cerrar detalle de REQ-017»).
- En una ventana de menos de 1024 px, el detalle ocupa toda la pantalla y tiene un botón «Volver», arriba a la izquierda, que lo cierra y devuelve al árbol.
- El detalle muestra estos campos: «Título» (el título del requisito), «Prioridad» (con su valor «Baja», «Media» o «Alta»), «Etiquetas» (cada etiqueta con su nombre, o «Sin etiquetas» si no tiene) y «Descripción» (el texto del requisito, con sus partes en negrita).
- Quien no puede editar requisitos, como el rol auditor, ve esos mismos campos en solo lectura: no puede escribir en «Título», ni cambiar «Prioridad», ni quitar o añadir etiquetas, ni cambiar la «Descripción». Pasar el puntero por un campo deshabilitado muestra el motivo «Tu rol no permite editar requisitos».
- Después de los campos, la sección «Trazabilidad» muestra dos listas. «Casos de prueba enlazados» lista cada caso con su código, que es un enlace a la ficha del caso (`/verification/TC-001`), y con el resultado de su última ejecución: «Superado», «Fallido», «Bloqueado» o «Sin ejecutar». Si no hay casos enlazados, muestra «Sin casos de prueba enlazados». «No conformidades» lista cada no conformidad con su código, que es un enlace a su ficha, y con su severidad; las que están abiertas se ven en color de peligro, y las cerradas llevan el texto «resuelta». Si no hay ninguna, muestra «Sin no conformidades».
- El botón «⧉ Copiar código» copia el código del requisito al portapapeles y muestra el aviso emergente «Código copiado» con el texto «REQ-017 está en el portapapeles». Si el navegador no permite copiar, muestra el aviso «No se pudo copiar el código».
- Pulsar otro requisito del árbol sustituye el detalle abierto por el de ese requisito.
- Abrir `/programs/:code/requirements?select=REQ-001` deja abierto el detalle de `REQ-001` una vez cargada la lista del programa.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se inicia sesión con la cuenta de la fila y se llega a Programas. Las cuentas son `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y `alumno01@sigpro.lab` (`Alumno1234!`, rol admin, sin segundo factor). Cada fila parte de un contexto nuevo.
- Tras un reinicio, `REQ-017` (en `PRG-002`, hijo de `REQ-015`) está en borrador, con prioridad baja, con la etiqueta Ciberseguridad y enlazado con `TC-012`. `REQ-008` está enlazado con `TC-001` y `TC-008`. `REQ-014` (en `PRG-001`) no tiene casos enlazados.

## Criterios de aceptación
```gherkin
Característica: Detalle de un requisito en la web

  Esquema del escenario: El detalle muestra los datos del requisito abierto
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-002/requirements con una ventana de 1440 px
    Cuando pulsa el título «Disponibilidad del subsistema 017» de la fila de REQ-017
    Entonces ve <dato> con el valor <valor>

    Ejemplos:
      | dato | valor |
      | el código | REQ-017 |
      | el estado | «Borrador» |
      | el campo «Título» | Disponibilidad del subsistema 017 |
      | el campo «Prioridad» | «Baja» |
      | el campo «Etiquetas» | «Ciberseguridad» |
      | la descripción | El sistema debe cumplir el requisito 017 de disponibilidad en condiciones nominales. |
      | los casos de prueba enlazados | TC-012 |

  Esquema del escenario: Los casos enlazados se muestran con su enlace y su resultado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001/requirements con una ventana de 1440 px
    Cuando pulsa el título de la fila de <codigo>
    Entonces ve en «Casos de prueba enlazados» los códigos <casos>, cada uno con su resultado de la última ejecución
    Y el código TC-001 es un enlace a /verification/TC-001

    Ejemplos:
      | codigo | casos |
      | REQ-008 | TC-001 y TC-008 |

  Esquema del escenario: Un requisito sin casos enlazados ni no conformidades lo indica en el detalle
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001/requirements con una ventana de 1440 px
    Cuando pulsa el título de la fila de <codigo>
    Entonces ve el texto «Sin casos de prueba enlazados» y el texto «Sin no conformidades»

    Ejemplos:
      | codigo |
      | REQ-014 |

  Esquema del escenario: Copiar el código muestra un aviso emergente
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-002/requirements con una ventana de 1440 px y tiene abierto el detalle de <codigo>
    Cuando pulsa «⧉ Copiar código» en el detalle
    Entonces ve el aviso emergente «Código copiado» con el texto <aviso>

    Ejemplos:
      | codigo | aviso |
      | REQ-017 | «REQ-017 está en el portapapeles» |

  Esquema del escenario: Quien no puede editar ve los campos del detalle en solo lectura
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-002/requirements?select=REQ-017 con una ventana de 1440 px
    Cuando mira el campo «Prioridad» del detalle de REQ-017
    Entonces el campo no se puede cambiar y muestra «Baja»
    Y al pasar el puntero por el campo aparece el motivo «Tu rol no permite editar requisitos»

    Ejemplos:
      | cuenta |
      | auditor@sigpro.test |

  Esquema del escenario: El enlace de la dirección abre el detalle del requisito indicado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre /programs/PRG-001/requirements?select=<codigo> con una ventana de 1440 px
    Entonces ve abierto el detalle de <codigo> con el título <titulo>

    Ejemplos:
      | codigo | titulo |
      | REQ-001 | Disponibilidad del subsistema 001 |

  Esquema del escenario: Cerrar el detalle lo quita de la pantalla y deja el árbol como estaba
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-002/requirements con una ventana de <ancho> y tiene abierto el detalle de REQ-017
    Cuando pulsa <control>
    Entonces ya no hay ningún detalle abierto
    Y la fila de REQ-017 sigue en el árbol

    Ejemplos:
      | ancho | control |
      | 1440 px | «Cerrar detalle de REQ-017» |
      | 390 px | «Volver» |
```

## Decisiones pendientes
- Qué se muestra cuando una no conformidad está rechazada: hoy se marca «resuelta» igual que una cerrada, aunque la rechazada no esté cerrada. No está decidido, y ninguna fila lo afirma.

## Fuera de alcance
- Cambiar el título, la prioridad, las etiquetas o la descripción, y guardar esos cambios: EP-REQ-EDICION.
- El flujo de aprobación del detalle y sus botones de transición: EP-REQ-FLUJO.
- Enlazar o desenlazar casos de prueba desde el detalle y la matriz de trazabilidad: EP-REQ-TRAZA.
- Los casos de prueba, sus ejecuciones y sus evidencias, y las no conformidades en su propia pantalla: las épicas de Verificación y de No conformidades, todavía sin escribir.
- El árbol, su búsqueda y su orden desde los que se abre el detalle: esta misma épica (EP-REQ-ARBOL), en las historias de la web sobre el árbol y la búsqueda.
