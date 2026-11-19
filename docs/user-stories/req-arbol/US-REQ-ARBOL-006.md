---
id: US-REQ-ARBOL-006
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Web] Recorrer el árbol y las pestañas con el teclado"
etiquetas: [web]
relacionadas: [US-REQ-ARBOL-003, US-REQ-ARBOL-004, US-REQ-ARBOL-005]
verificacion: ejecutada
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona que trabaja sin ratón, quiero moverme por las filas del árbol con las flechas, plegar y desplegar ramas, abrir un requisito y cerrar su detalle con el teclado, y cambiar de pestaña,
para revisar un programa completo sin tocar la pantalla con el puntero.

## Reglas
- Las flechas, Inicio, Fin e Intro actúan cuando el foco está en una fila del árbol. La tecla Esc, la tecla «/» y las flechas de las pestañas siguen las reglas que se indican más abajo.
- La flecha abajo pasa el foco a la fila visible siguiente, y la flecha arriba, a la anterior. En la última fila visible, la flecha abajo no mueve el foco; en la primera, la flecha arriba tampoco.
- La tecla Inicio pasa el foco a la primera fila visible, y la tecla Fin, a la última.
- La flecha derecha, en una fila con hijos que está plegada, la despliega y el foco se queda en esa fila. En una fila con hijos que está desplegada, pasa el foco a su primer hijo. En una fila sin hijos no hace nada.
- La flecha izquierda, en una fila con hijos que está desplegada, la pliega y el foco se queda en esa fila. En las demás filas pasa el foco a su padre; en un requisito raíz que está plegado, o sin hijos, no hace nada.
- La tecla Intro abre el detalle del requisito de la fila con el foco, y el foco pasa al detalle.
- La tecla Esc, con el foco dentro de un campo de texto, quita el foco de ese campo y el detalle sigue abierto. Con el foco fuera de los campos de texto, cierra el detalle abierto. Si no hay ningún detalle abierto, no hace nada.
- Con el foco fuera de los campos de texto, la tecla «/» pasa el foco al campo «Buscar requisitos» para escribir en él.
- Con el foco en una pestaña de la pantalla (Árbol, Documento o Matriz de trazabilidad), la flecha derecha pasa a la pestaña siguiente, y la flecha izquierda a la anterior. Desde la última, la flecha derecha vuelve a la primera; desde la primera, la flecha izquierda va a la última.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se inicia sesión con `gestor@sigpro.test` (`Gestor1234!`) y se llega a Programas. Cada fila parte de un contexto nuevo.
- Tras un reinicio, `PRG-001` tiene 14 requisitos, de `REQ-001` a `REQ-014`, con los hijos de `REQ-001` (`REQ-002`, `REQ-003` y `REQ-005`) y los de `REQ-003` (`REQ-004`).

## Criterios de aceptación
```gherkin
Característica: Teclado en el árbol de requisitos y en las pestañas

  Esquema del escenario: Las flechas arriba y abajo y las teclas de inicio y fin recorren las filas visibles
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001/requirements con una ventana de 1440 px y tiene el foco en la fila de <desde>
    Cuando pulsa <tecla>
    Entonces el foco está en la fila de <hasta>

    Ejemplos:
      | desde | tecla | hasta |
      | REQ-001 | flecha abajo | REQ-002 |
      | REQ-004 | flecha abajo | REQ-005 |
      | REQ-005 | flecha arriba | REQ-004 |
      | REQ-014 | flecha abajo | REQ-014 |
      | REQ-001 | Fin | REQ-014 |
      | REQ-014 | Inicio | REQ-001 |

  Esquema del escenario: Las flechas derecha e izquierda plegan, despliegan o llevan el foco al padre o al primer hijo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001/requirements con una ventana de 1440 px y tiene el foco en la fila de <fila>, que está <estado>
    Cuando pulsa <tecla>
    Entonces <resultado>

    Ejemplos:
      | fila | estado | tecla | resultado |
      | REQ-003 | desplegada | flecha izquierda | REQ-003 se pliega, deja de verse REQ-004 y el foco sigue en REQ-003 |
      | REQ-003 | plegada | flecha derecha | REQ-003 se despliega, vuelve a verse REQ-004 y el foco sigue en REQ-003 |
      | REQ-003 | desplegada | flecha derecha | el foco pasa a REQ-004 |
      | REQ-004 | sin hijos | flecha izquierda | el foco pasa a REQ-003 |
      | REQ-002 | sin hijos | flecha derecha | no pasa nada y el foco sigue en REQ-002 |
      | REQ-001 | plegada | flecha izquierda | no pasa nada y el foco sigue en REQ-001 |

  Esquema del escenario: La tecla Intro abre el detalle del requisito de la fila con el foco
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-002/requirements con una ventana de 1440 px y tiene el foco en la fila de <fila>
    Cuando pulsa Intro
    Entonces ve el detalle de <fila> y el foco está en ese detalle

    Ejemplos:
      | fila |
      | REQ-017 |

  Esquema del escenario: La tecla Esc quita el foco de un campo o cierra el detalle
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-002/requirements?select=REQ-017 con una ventana de 1440 px y <situacion>
    Cuando pulsa Esc
    Entonces <primera>
    Cuando vuelve a pulsar Esc
    Entonces <segunda>

    Ejemplos:
      | situacion | primera | segunda |
      | el foco está en el campo «Título» del detalle | el foco sale del campo y el detalle de REQ-017 sigue abierto | el detalle de REQ-017 se cierra |
      | el foco está fuera de los campos de texto | el detalle de REQ-017 se cierra | no pasa nada y no hay ningún detalle abierto |

  Esquema del escenario: La tecla barra pasa el foco al campo de búsqueda
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001/requirements con una ventana de 1440 px y tiene el foco en la fila de REQ-001
    Cuando pulsa /
    Entonces el foco está en el campo «Buscar requisitos» y puede escribir en él

    Ejemplos:
      | programa |
      | PRG-001 |

  Esquema del escenario: Las flechas izquierda y derecha cambian de pestaña y dan la vuelta en los extremos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001/requirements con una ventana de 1440 px y tiene el foco en la pestaña <desde>
    Cuando pulsa <tecla>
    Entonces la pestaña seleccionada es <hasta>

    Ejemplos:
      | desde | tecla | hasta |
      | «Árbol» | flecha derecha | «Documento» |
      | «Árbol» | flecha izquierda | «Matriz de trazabilidad» |
      | «Documento» | flecha derecha | «Matriz de trazabilidad» |
      | «Matriz de trazabilidad» | flecha derecha | «Árbol» |
```

## Fuera de alcance
- Las teclas que crean un requisito, que abren la edición en línea del título, que mueven una fila con Alt y flechas, y que abren el menú contextual de una fila: EP-REQ-EDICION.
- Arrastrar una fila para reordenarla: EP-REQ-EDICION.
- El contenido de la pestaña «Matriz de trazabilidad» y la forma de marcar casos en ella: EP-REQ-TRAZA.
- La búsqueda y el filtro por estado que se activan con la tecla barra: esta misma épica (EP-REQ-ARBOL), en su historia de la web sobre búsqueda.
- El inicio de sesión con el que se llega a la pantalla: EP-LOGIN.
