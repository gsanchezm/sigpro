---
id: US-PROG-DETALLE-004
tipo: historia
epica: EP-PROG-DETALLE
titulo: "[Web] Ver el panel lateral de un programa desde la lista y pasar a su ficha completa"
etiquetas: [web]
relacionadas: [US-PROG-DETALLE-002, US-PROG-DETALLE-003]
verificacion: codigo
cubre: ["/programs/:code"]
---

## Historia
Como persona que revisa la lista de programas desde el escritorio, quiero abrir un panel con los datos principales de un programa sin salir de la lista, y pasar a su ficha completa desde ese panel,
para comparar programas sin perder mi lugar en la lista.

## Reglas
- Con una ventana de 1024 px o más, pulsar la fila de un programa en la lista abre a su lado un panel con los datos de ese programa. El panel no hace ninguna petición: muestra los datos que ya tiene la fila.
- El panel muestra el código, el nombre como título, la etiqueta de estado y los campos «Responsable», «Fechas», «Presupuesto» y «Avance». El responsable aparece con su nombre; las fechas, como `dd/mm/aaaa → dd/mm/aaaa`; el presupuesto, como `450.000 €`; y el avance, como porcentaje sin decimales pegado al signo, con su barra, como `11%`.
- El panel se cierra con el botón «×» o con la tecla Escape.
- El enlace «Abrir ficha completa» del panel lleva a `/programs/:code`, la ficha de la historia web de la ficha.
- Con una ventana de menos de 1024 px no hay panel lateral. Cada programa aparece como tarjeta, y su menú de acciones tiene la opción «Ver detalle», que lleva a `/programs/:code`.
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, `gestor@sigpro.test` (contraseña `Gestor1234!`) inicia sesión y llega a Programas con la lista. Cada fila parte de un contexto nuevo.

## Criterios de aceptación
```gherkin
Característica: Panel lateral de un programa en la lista

  Esquema del escenario: El panel muestra los datos del programa de la fila
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con una ventana de 1440 px y ve la lista de programas
    Cuando pulsa la fila del programa PRG-001
    Entonces ve <dato> con el valor <valor>

    Ejemplos:
      | dato | valor |
      | el código | PRG-001 |
      | el nombre | Sistema de mando táctico Ártemis |
      | el estado | «Activo» |
      | el campo «Responsable» | Marta Ruiz |
      | el campo «Fechas» | 01/01/2023 → 01/07/2024 |
      | el campo «Presupuesto» | 450.000 € |
      | el campo «Avance» | 11% |

  Esquema del escenario: El panel se cierra con el botón o con la tecla Escape
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con una ventana de 1440 px y ha abierto el panel del programa PRG-001
    Cuando <accion>
    Entonces el panel deja de verse

    Ejemplos:
      | accion |
      | pulsa el botón «×» |
      | pulsa la tecla Escape |

  Esquema del escenario: Abrir ficha completa lleva a la ficha del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con una ventana de 1440 px y ha abierto el panel del programa <codigo>
    Cuando pulsa «Abrir ficha completa»
    Entonces llega a /programs/<codigo>

    Ejemplos:
      | codigo |
      | PRG-001 |

  Esquema del escenario: Con una ventana estrecha no hay panel y la tarjeta lleva a la ficha
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con una ventana de 390 px y ve la lista de programas
    Cuando abre el menú de acciones de la tarjeta de <codigo> y elige «Ver detalle»
    Entonces no ve ningún panel lateral
    Y llega a /programs/<codigo>

    Ejemplos:
      | codigo |
      | PRG-001 |
```

## Fuera de alcance
- La lista de programas, sus filtros, su selección y su paginación: EP-PROG-LISTA.
- La ficha completa a la que lleva el panel, con sus pestañas y su botón «Editar programa»: EP-PROG-DETALLE, en su historia web de la ficha.
- Archivar, duplicar y eliminar un programa desde la lista: EP-PROG-GESTION.
