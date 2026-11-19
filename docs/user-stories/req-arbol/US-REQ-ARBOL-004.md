---
id: US-REQ-ARBOL-004
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Web] Buscar en el árbol por código o título y filtrar por estado"
etiquetas: [web]
relacionadas: [US-REQ-ARBOL-003, US-REQ-ARBOL-009]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero buscar un requisito por su código o por una palabra de su título, y filtrar el árbol por su estado,
para encontrar un requisito concreto en un programa grande o revisar todos los que están en un mismo paso de aprobación.

## Reglas
- El campo «Buscar requisitos», con el texto de ayuda «Filtrar por código o título…», filtra por código o por título, sin distinguir mayúsculas de minúsculas. No busca en la descripción ni en las etiquetas.
- El filtro «Estado» ofrece cuatro opciones: «Borrador», «Aprobado», «Verificado» y «Validado». Al elegir una, el árbol muestra solo los requisitos en ese estado, y el filtro muestra la opción elegida con un control «Quitar «<estado>»» para quitarla.
- La búsqueda y el filtro de estado se combinan: un requisito aparece solo si cumple los dos.
- Se muestran los requisitos que cumplen los filtros y también sus ancestros (su padre, el padre de su padre, y así), para que cada coincidencia quede dentro de su rama. Un ancestro que no cumple los filtros aparece solo para mostrar el camino, y cuenta en el contador.
- Mientras hay texto en la búsqueda o un estado elegido, el árbol aparece completamente desplegado, aunque antes se hubiera plegado alguna rama.
- El contador «N de M requisitos» cuenta los requisitos que se muestran, incluidos los ancestros que aparecen por el camino.
- El control «Limpiar filtros» aparece solo cuando hay texto en la búsqueda o un estado elegido. Al pulsarlo, vacía la búsqueda, quita el estado y vuelve a mostrar todo el árbol, con el contador en M de M.
- Si ningún requisito cumple los filtros, el área del árbol muestra «Sin coincidencias» con el texto «Ningún requisito coincide con la búsqueda.», y el contador dice «0 de M requisitos».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se inicia sesión con `gestor@sigpro.test` (`Gestor1234!`) y se llega a Programas. Cada fila parte de un contexto nuevo.
- Tras un reinicio, `PRG-001` tiene 14 requisitos, de `REQ-001` a `REQ-014`, y `PRG-002` tiene 14, de `REQ-015` a `REQ-028`.

## Criterios de aceptación
```gherkin
Característica: Búsqueda y filtro por estado en el árbol de requisitos

  Esquema del escenario: La búsqueda por código o título muestra las coincidencias con su camino
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001/requirements con una ventana de 1440 px
    Cuando escribe <texto> en «Buscar requisitos»
    Entonces ve <visibles>
    Y el contador dice <contador>

    Ejemplos:
      | texto | visibles | contador |
      | 005 | REQ-001 y REQ-005 | «2 de 14 requisitos» |
      | req-012 | REQ-011 y REQ-012 | «2 de 14 requisitos» |
      | disponibilidad | REQ-001, REQ-006, REQ-008 y REQ-009 | «4 de 14 requisitos» |

  Esquema del escenario: Una búsqueda sin coincidencias muestra el aviso de sin coincidencias
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001/requirements con una ventana de 1440 px
    Cuando escribe <texto> en «Buscar requisitos»
    Entonces ve el aviso «Sin coincidencias» con el texto «Ningún requisito coincide con la búsqueda.»
    Y el contador dice «0 de 14 requisitos»

    Ejemplos:
      | texto |
      | nominales |
      | REQ-099 |

  Esquema del escenario: El filtro por estado muestra solo los requisitos de ese estado y sus ancestros
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001/requirements con una ventana de 1440 px
    Cuando elige <estado> en el filtro «Estado»
    Entonces ve <visibles>
    Y el contador dice <contador>

    Ejemplos:
      | estado | visibles | contador |
      | «Validado» | REQ-001, REQ-003, REQ-006, REQ-007 y REQ-011 | «5 de 14 requisitos» |
      | «Borrador» | REQ-001, REQ-003, REQ-004, REQ-006, REQ-008, REQ-011 y REQ-012 | «7 de 14 requisitos» |

  Esquema del escenario: La búsqueda y el filtro de estado se combinan
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-002/requirements con una ventana de 1440 px
    Cuando escribe «017» en «Buscar requisitos» y elige <estado> en el filtro «Estado»
    Entonces <resultado>

    Ejemplos:
      | estado | resultado |
      | «Borrador» | ve REQ-015 y REQ-017, y el contador dice «2 de 14 requisitos» |
      | «Validado» | ve el aviso «Sin coincidencias» |

  Esquema del escenario: Con un filtro activo el árbol se muestra desplegado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001/requirements con una ventana de 1440 px y ha pulsado «Contraer REQ-001»
    Cuando escribe 005 en «Buscar requisitos»
    Entonces ve REQ-001 y REQ-005 con todas sus ramas desplegadas

    Ejemplos:
      | programa |
      | PRG-001 |

  Esquema del escenario: Limpiar filtros vacía la búsqueda y el estado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-002/requirements con una ventana de 1440 px, ha escrito <texto> en «Buscar requisitos» y ha elegido <estado> en el filtro «Estado»
    Cuando pulsa «Limpiar filtros»
    Entonces el campo «Buscar requisitos» está vacío
    Y el filtro «Estado» no tiene ninguna opción elegida
    Y el contador dice «14 de 14 requisitos»
    Y el control «Limpiar filtros» ya no aparece

    Ejemplos:
      | texto | estado |
      | 017 | «Borrador» |
```

## Fuera de alcance
- El árbol sin filtros, con sus ramas y su orden: esta misma épica (EP-REQ-ARBOL), en su historia de la web sobre el árbol.
- El detalle de un requisito que se abre desde una coincidencia: esta misma épica, en su historia de la web sobre el detalle.
- Crear o editar un requisito desde la pantalla de búsqueda, y la tecla que abre el alta: EP-REQ-EDICION.
- Cambiar el estado de un requisito desde el filtro o desde el detalle: EP-REQ-FLUJO.
