---
id: US-PROG-LISTA-005
tipo: historia
epica: EP-PROG-LISTA
titulo: "[Web] Ver la lista de programas en tabla o en tarjetas y ordenarla por columna"
etiquetas: [web]
relacionadas: [US-PROG-LISTA-001, US-PROG-LISTA-003, US-PROG-LISTA-004, US-PROG-LISTA-006, US-LOGIN-007]
verificacion: ejecutada
cubre: ["/programs"]
---

## Historia
Como responsable de programas, quiero ver los programas en una tabla con sus columnas y ordenarla pulsando la cabecera de una columna,
para comparar los programas por el dato que me importa en cada momento.

## Reglas
- En escritorio la lista es una tabla con las columnas «Código», «Nombre», «Estado», «Responsable», «Fechas», «Presupuesto» y «Avance».
- Cada fila muestra el código (que es un enlace al detalle del programa), el nombre, el estado con su etiqueta, el responsable, las fechas como inicio → fin en formato dd/mm/aaaa, el presupuesto en euros y el avance con una barra y su porcentaje.
- El avance es el porcentaje de hitos cumplidos sobre el total de hitos del programa, redondeado al entero; un programa sin hitos muestra 0%. La cabecera «Avance» tiene un botón «i» que muestra «Hitos completados sobre el total planificado» al pasar el ratón por él o al recibir el foco.
- «Avance» no ordena la lista.
- Pulsar la cabecera de una columna que no es la ordenada la ordena de forma ascendente. Pulsar la cabecera de la columna que ya está ordenada de forma ascendente la ordena de forma descendente, y pulsarla estando descendente vuelve a ordenarla de forma ascendente. Por eso, con el orden por defecto (código ascendente), pulsar «Código» una vez la ordena de forma descendente y pulsarlo dos veces la deja ascendente. La columna ordenada muestra una flecha que indica el sentido, y cada cambio de orden vuelve a la primera página.
- «Fechas» ordena por la fecha de inicio del programa. «Responsable» ordena por el nombre de la persona.
- Sin orden elegido, la lista va por código ascendente y la flecha de «Código» indica ese sentido.
- En el diseño responsive (menos de 1024 px) no hay tabla: cada programa es una tarjeta con su código, su estado, su nombre, su responsable, su fecha de inicio en formato dd/mm/aaaa y su avance con una barra. Las tarjetas no tienen cabeceras para ordenar, y la lista sigue el orden por código.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe `gestor@sigpro.test` con `Gestor1234!` y se llega a `/programs`.

## Criterios de aceptación
```gherkin
Característica: Tabla y tarjetas de la lista de programas en la web

  Esquema del escenario: La fila de un programa muestra sus datos en cada columna
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en escritorio
    Cuando mira la fila de PRG-001
    Entonces la columna <columna> muestra <valor>

    Ejemplos:
      | columna | valor |
      | «Estado» | «Activo» |
      | «Fechas» | 01/01/2023 → 01/07/2024 |
      | «Avance» | 11% |

  Esquema del escenario: Pulsar una cabecera ordena la tabla y marca el sentido
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en escritorio
    Cuando pulsa la cabecera <columna> <veces> veces
    Entonces la primera fila es <primera> y la flecha de la columna marca el sentido <sentido>

    Ejemplos:
      | columna | veces | primera | sentido |
      | «Código» | 1 | PRG-024 | descendente |
      | «Código» | 2 | PRG-001 | ascendente |
      | «Presupuesto» | 1 | PRG-001 | ascendente |
      | «Presupuesto» | 2 | PRG-014 | descendente |
      | «Responsable» | 1 | PRG-004 | ascendente |

  Esquema del escenario: La lista entra ordenada por código ascendente
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su sesión iniciada en escritorio
    Cuando abre /programs sin filtros
    Entonces la primera fila es <primera>, la flecha de «Código» marca ascendente y el recuento dice <recuento>

    Ejemplos:
      | primera | recuento |
      | PRG-001 | «1–10 de 24» |

  Esquema del escenario: En el diseño responsive cada programa es una tarjeta con sus datos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en un diseño responsive
    Cuando mira la tarjeta de PRG-001
    Entonces la tarjeta muestra <dato> como <valor>

    Ejemplos:
      | dato | valor |
      | el estado | «Activo» |
      | la fecha de inicio | 01/01/2023 |
```

## Decisiones pendientes
- Ordenar por estado sigue el orden en que el estado está declarado en la base de datos (Borrador, Activo, En pausa, Cerrado, Cancelado) y no el alfabético por etiqueta. No está decidido si debe ser ese el orden.
- Si el diseño responsive debe ofrecer un orden elegido por el usuario. Hoy sus tarjetas solo siguen el orden por código.

## Fuera de alcance
- La selección múltiple y las acciones de cada fila (archivar, duplicar, eliminar): EP-PROG-GESTION.
- El panel lateral que se abre al pulsar una fila y la ficha completa del programa: EP-PROG-DETALLE.
- Las tarjetas de métricas de la cabecera: EP-PROG-METRICAS.
- El número de página y los controles de paginación: EP-PROG-LISTA, en la historia de paginación de la web.
