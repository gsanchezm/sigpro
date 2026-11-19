---
id: US-REQ-ARBOL-009
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Móvil] Ver el árbol de requisitos: sangría, plegado, búsqueda y contador"
etiquetas: [movil]
relacionadas: [US-REQ-ARBOL-003, US-REQ-ARBOL-004, US-PROG-DETALLE-005]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero ver los requisitos de un programa como una lista con sangría, plegar las ramas y buscar por código o por título,
para entender la estructura del programa y encontrar un requisito desde la app, igual que en la web.

## Reglas
- La pantalla de Requisitos de un programa muestra, arriba, una tarjeta con el código del programa, su nombre y el enlace «Volver al detalle», que lleva a la ficha del programa (`/programs/<código>`).
- La pantalla tiene tres pestañas: «Árbol», «Documento» y «Matriz de trazabilidad». Al abrirla, la pestaña «Árbol» está seleccionada.
- El árbol es una lista en la que cada requisito es una fila. Los hijos de un requisito van justo debajo de él, sangrados un nivel más que su padre, y los hermanos siguen el orden de su posición. Al abrir la pantalla, todo el árbol aparece desplegado.
- Cada fila muestra el código del requisito, su etiqueta de estado («Borrador», «Aprobado», «Verificado» o «Validado») y su título. Debajo muestra «Pruebas» con los casos que pasan de los enlazados, por ejemplo «1/2», o «—» si no tiene casos enlazados; «NC» con el código de la primera no conformidad abierta, con «+n» si hay más, o «—» si no tiene ninguna abierta; y la línea «Prioridad» seguida de su valor («Baja», «Media» o «Alta»). Si el requisito tiene etiquetas, aparece una línea con sus nombres separados por « · »; si no tiene, esa línea no aparece.
- Un requisito que tiene hijos muestra un control de plegado con el nombre «Contraer» seguido del código, cuando está desplegado, o «Expandir» seguido del código, cuando está plegado. Pulsarlo pliega o despliega solo esa rama, y al plegar dejan de verse todos sus descendientes.
- Pulsar la fila de un requisito abre su detalle en una hoja, como se describe en la historia de la app sobre el detalle.
- Debajo de la pestaña «Árbol» está el campo «Buscar requisitos», con el texto de ayuda «Filtrar por código o título…». La búsqueda filtra por código o por título, sin distinguir mayúsculas, y muestra también los ancestros de cada coincidencia. No busca en la descripción. Mientras hay texto, todo el árbol aparece desplegado.
- Debajo del campo de búsqueda, el contador «N de M requisitos» indica cuántos requisitos se muestran (N) y cuántos tiene el programa (M).
- Si ningún requisito cumple la búsqueda, la lista muestra «Sin coincidencias» con el texto «Ningún requisito coincide con la búsqueda.».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app está en /login, sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo»; se escriben el correo y la contraseña de la cuenta de la fila (`gestor@sigpro.test` y `Gestor1234!`) y se pulsa «Entrar», y se llega a Programas. Cada fila parte de un contexto nuevo.
- Tras un reinicio, `PRG-001` tiene 14 requisitos, de `REQ-001` a `REQ-014`.

## Criterios de aceptación
```gherkin
Característica: Árbol de requisitos en la app móvil

  Esquema del escenario: La fila de un requisito muestra su estado, su prioridad y sus etiquetas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/PRG-001/requirements
    Cuando mira la fila de <codigo>
    Entonces ve el estado <estado> y la línea <prioridad>
    Y la línea de etiquetas es <etiquetas>

    Ejemplos:
      | codigo | estado | prioridad | etiquetas |
      | REQ-001 | «Aprobado» | «Prioridad: Alta» | «Ciberseguridad» |
      | REQ-003 | «Validado» | «Prioridad: Media» | (sin línea de etiquetas) |
      | REQ-004 | «Borrador» | «Prioridad: Alta» | «Normativo» |
      | REQ-005 | «Aprobado» | «Prioridad: Baja» | «Mantenibilidad · Seguridad operacional» |

  Esquema del escenario: Cada requisito aparece bajo su padre, sangrado un nivel más que él
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/PRG-001/requirements
    Cuando mira la lista del árbol
    Entonces ve el requisito <codigo> <lugar>

    Ejemplos:
      | codigo | lugar |
      | REQ-004 | justo debajo de REQ-003, sangrado un nivel más que REQ-003 |
      | REQ-005 | justo debajo de REQ-004, al mismo nivel que REQ-003 |
      | REQ-014 | justo debajo de REQ-013, sangrado un nivel más que REQ-013 |

  Esquema del escenario: Plegar una rama oculta sus descendientes y desplegarla los devuelve
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/PRG-001/requirements
    Cuando pulsa <contraer>
    Entonces deja de ver <ocultos>
    Y sigue viendo <visibles>
    Cuando pulsa <expandir>
    Entonces vuelve a ver <ocultos>

    Ejemplos:
      | contraer | expandir | ocultos | visibles |
      | «Contraer REQ-003» | «Expandir REQ-003» | REQ-004 | REQ-005 |
      | «Contraer REQ-001» | «Expandir REQ-001» | REQ-002, REQ-003, REQ-004 y REQ-005 | REQ-006 |

  Esquema del escenario: La búsqueda por código o título muestra las coincidencias con su camino
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/PRG-001/requirements
    Cuando escribe <texto> en «Buscar requisitos»
    Entonces ve <visibles>
    Y el contador dice <contador>

    Ejemplos:
      | texto | visibles | contador |
      | 005 | REQ-001 y REQ-005 | «2 de 14 requisitos» |
      | disponibilidad | REQ-001, REQ-006, REQ-008 y REQ-009 | «4 de 14 requisitos» |

  Esquema del escenario: Una búsqueda sin coincidencias muestra el aviso correspondiente
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/PRG-001/requirements
    Cuando escribe <texto> en «Buscar requisitos»
    Entonces ve el aviso «Sin coincidencias» con el texto «Ningún requisito coincide con la búsqueda.»

    Ejemplos:
      | texto |
      | nominales |
      | REQ-099 |

  Esquema del escenario: El enlace de la cabecera lleva de vuelta a la ficha del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/<programa>/requirements
    Cuando pulsa «Volver al detalle»
    Entonces llega a /programs/<programa>

    Ejemplos:
      | programa |
      | PRG-001 |
      | PRG-002 |
```

## Fuera de alcance
- El detalle de un requisito que se abre desde la fila: esta misma épica (EP-REQ-ARBOL), en la historia de la app sobre el detalle.
- Los filtros por estado y los controles de expandir y contraer todo, que la web tiene: esta misma épica, en la historia de la app sobre el filtro y el plegado completo.
- La pestaña «Matriz de trazabilidad»: EP-REQ-TRAZA.
- La pestaña «Documento» y las cifras del programa: esta misma épica, en la historia de la app sobre esas vistas.
- Crear, editar, borrar y reordenar requisitos: EP-REQ-EDICION.
- La ficha del programa a la que lleva el enlace de la cabecera: EP-PROG-DETALLE.
- La lista de programas: EP-PROG-LISTA.
