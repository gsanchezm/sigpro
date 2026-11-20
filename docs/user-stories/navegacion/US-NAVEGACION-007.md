---
id: US-NAVEGACION-007
tipo: historia
epica: EP-NAVEGACION
titulo: "[Web] Buscar en la cabecera: resultados agrupados, teclado y pantalla completa en responsive"
etiquetas: [web]
relacionadas: [US-NAVEGACION-001, US-NAVEGACION-002, US-NAVEGACION-012, US-PROG-LISTA-004]
verificacion: ejecutada
---

## Historia
Como persona que busca algo en SIGPRO sin saber en qué sección está, quiero escribir en la cabecera y ver los resultados agrupados por tipo mientras escribo, cada uno con su enlace,
para abrir lo que busco con el teclado o con el ratón desde cualquier pantalla.

## Reglas
- En escritorio, el cuadro «Búsqueda global» está en la cabecera de todas las pantallas autenticadas. Mientras está vacío muestra el texto de ayuda «Buscar código o nombre…».
- En Programas (`/programs`), el mismo cuadro filtra la tabla de programas por código o nombre y no muestra ninguna lista de resultados; la dirección cambia a `/programs?q=<texto>`.
- Con menos de dos caracteres (sin contar los espacios del principio y del final), el aviso es «Escribe al menos 2 caracteres» y no se pide ningún resultado.
- Desde dos caracteres, la búsqueda se pide cuando el texto lleva 250 ms sin cambiar, para no pedir una respuesta por cada letra. Mientras la respuesta no llega, el aviso dice «Buscando…».
- Los resultados aparecen en una lista bajo el cuadro, con un grupo por tipo en el orden de la API. Cada grupo tiene su título (Programas, Requisitos, Casos de prueba, No conformidades, Documentos) y su total: «5 / 40» cuando hay más coincidencias que las que se muestran, o solo el total cuando se muestran todas. Cada resultado muestra su código, su título y su subtítulo.
- El aviso bajo la lista dice «N resultados en M grupos», o «1 resultado» si hay uno solo. Si no hay coincidencias, dice «Sin resultados para «<texto>»». Si la petición falla, dice «No se pudo buscar».
- Con el teclado, la flecha de abajo y la de arriba recorren los resultados y marcan el activo. Al llegar la respuesta, el primer resultado queda activo. Intro abre el resultado activo. Esc cierra la lista y deja el texto escrito.
- Pulsar un resultado con el ratón lo abre. Al abrir un resultado, el cuadro se vacía y la lista se cierra.
- Al salir del cuadro, la lista se cierra y el texto se conserva; al volver al cuadro, la lista reaparece si hay resultados.
- Cada resultado lleva a su página: programa, a `/programs/<código>`; requisito, a los requisitos de su programa con ese requisito seleccionado; caso de prueba, a `/verification/<código>`; no conformidad, a `/nc/<código>`; documento, a `/documents/<identificador>`.
- En el diseño responsive la cabecera no tiene el cuadro, sino un icono «Búsqueda global» (en todas las pantallas salvo Programas). El icono abre una pantalla completa con el campo «Búsqueda global», el mismo aviso inicial y los mismos resultados. El botón «Cerrar» y la tecla Esc cierran la pantalla. Al elegir un resultado, la pantalla se cierra y se llega a su página.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); después se inicia sesión con `gestor@sigpro.test` y `Gestor1234!` en `/login?tenant=alumno01`, en un navegador sin ninguna sesión de SIGPRO guardada. Las filas de escritorio usan una ventana de 1440 px y las de responsive, una de 390 px.

## Criterios de aceptación
```gherkin
Característica: Búsqueda global en la web

  Esquema del escenario: Escribir en el cuadro de escritorio muestra los resultados agrupados o el aviso que corresponde
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /nc en la web de escritorio
    Cuando escribe <texto> en «Búsqueda global»
    Entonces ve <resultado>

    Ejemplos:
      | texto | resultado |
      | a | el aviso «Escribe al menos 2 caracteres» y ningún grupo |
      | PRG-001 | el grupo «Programas» con total 1 y el grupo «Documentos» con total 2, en ese orden, y el aviso «3 resultados en 2 grupos» |
      | subsistema | el grupo «Requisitos» con el total «5 / 40» y, dentro, los resultados REQ-001 a REQ-005 |
      | zz | el aviso «Sin resultados para «zz»» y ningún grupo |

  Esquema del escenario: El teclado recorre los resultados, abre el activo y cierra la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /nc en la web de escritorio y ha escrito PRG-001 en «Búsqueda global» con los resultados a la vista
    Cuando pulsa <tecla>
    Entonces <resultado>

    Ejemplos:
      | tecla | resultado |
      | la flecha de abajo | queda marcado como activo el segundo resultado, DOC-001 |
      | la flecha de abajo y después la de arriba | queda marcado como activo el primer resultado, PRG-001 |
      | Intro | se abre /programs/PRG-001 y el cuadro «Búsqueda global» queda vacío |
      | Esc | la lista se cierra, el cuadro conserva PRG-001 y la página sigue en /nc |

  Esquema del escenario: Pulsar un resultado lleva a su página y vacía el cuadro
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /nc en la web de escritorio
    Cuando escribe <texto> en «Búsqueda global» y pulsa el resultado <codigo>
    Entonces llega a <destino>
    Y el cuadro «Búsqueda global» está vacío

    Ejemplos:
      | texto | codigo | destino |
      | subsistema | REQ-001 | /programs/PRG-001/requirements, con REQ-001 seleccionado |
      | verificar | TC-001 | /verification/TC-001 |
      | criterio | NC-001 | /nc/NC-001 |
      | PRG-001 | DOC-001 | /documents/DOC-001 |

  Esquema del escenario: Mientras la búsqueda espera la respuesta o falla, el aviso lo dice
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /nc en la web de escritorio
    Y la prueba <condicion> la respuesta de GET /api/search
    Cuando escribe PRG-001 en «Búsqueda global»
    Entonces ve el aviso <aviso>
    Y <despues>

    Ejemplos:
      | condicion | aviso | despues |
      | retrasa 3 segundos | «Buscando…» | cuando llega la respuesta ve los grupos «Programas» y «Documentos» |
      | hace fallar | «No se pudo buscar» | no ve ningún grupo |

  Esquema del escenario: En responsive la búsqueda se abre a pantalla completa, con el campo y los mismos resultados
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada con una ventana de 390 px y está en <ruta>
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | ruta | accion | resultado |
      | /nc | pulsa el icono «Búsqueda global» de la cabecera | ve la pantalla de búsqueda con el campo «Búsqueda global» y el aviso «Escribe al menos 2 caracteres» |
      | /nc | pulsa el icono «Búsqueda global», escribe PRG-001 y pulsa el resultado PRG-001 | llega a /programs/PRG-001 y la pantalla de búsqueda se ha cerrado |
      | /nc | pulsa el icono «Búsqueda global» y después «Cerrar» | vuelve a ver el icono «Búsqueda global» en la cabecera y sigue en /nc |
      | /programs | mira la cabecera | no ve el icono «Búsqueda global», porque la página trae su propio buscador |

  Esquema del escenario: En Programas el cuadro «Búsqueda global» filtra la tabla y no abre resultados
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs en la web de escritorio
    Cuando escribe <texto> en «Búsqueda global»
    Entonces no ve ninguna lista de resultados y la dirección pasa a ser <direccion>

    Ejemplos:
      | texto | direccion |
      | PRG-001 | /programs?q=PRG-001 |
```

## Fuera de alcance
- Qué grupos, campos y enlaces devuelve la API, y el mínimo de caracteres: US-NAVEGACION-001 y US-NAVEGACION-002.
- El filtrado de la tabla de Programas y su paginación: EP-PROG-LISTA.
- Lo que muestra cada pantalla a la que lleva un resultado: las épicas de cada módulo.
- La búsqueda del móvil: US-NAVEGACION-012 y US-NAVEGACION-013.

## Decisiones pendientes
- Si la tecla «/» enfoca el cuadro en cualquier pantalla. Hoy solo lo hace en Programas y en Requisitos, pero la pista «/» se ve en el cuadro de todas las pantallas.
- Si el resumen de un solo grupo debe decir «1 grupo». Hoy, con un solo grupo, el aviso dice «en 1 grupos».
- Si Intro, sin ningún resultado activo, debe hacer algo. Hoy no hace nada.
