---
id: US-DOC-LISTA-012
tipo: historia
epica: EP-DOC-LISTA
titulo: "[Móvil] Ver la ficha de un documento con sus versiones y su contenido en páginas"
etiquetas: [movil]
relacionadas: [US-DOC-LISTA-003, US-DOC-LISTA-004, US-DOC-LISTA-009, US-DOC-LISTA-010]
verificacion: codigo
cubre: ["/documents/:id"]
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero abrir la ficha de un documento, ver su versión vigente y el historial de sus versiones, y leer su contenido página a página,
para saber qué versión es la correcta, quién la publicó, qué cambió y lo que dice el documento, sin salir de la app.

## Reglas
- La cabecera de la ficha muestra el título, el código, la etiqueta de clasificación («Público» o «Restringido»), el programa como enlace a su ficha con el texto `PRG-001 · Sistema de mando táctico Ártemis`, y «Actualizado: dd/mm/aaaa» con la fecha de la última versión.
- El selector de versiones muestra una opción por versión, de la más nueva a la más antigua, con el texto «Versión N». La última aparece como «Versión N · última». Al abrir la ficha queda marcada la última versión.
- Al tocar otra versión, queda marcada esa y cambian lo que muestran el autor, la fecha, la nota, el contenido y la descarga.
- Bajo el selector, de la versión marcada, aparece «por» el nombre del autor seguido de la fecha de creación, separados por « · ». Si la versión tiene nota, aparece la etiqueta «Nota de cambios» con el texto de la nota debajo. La app muestra así el historial: cada versión se consulta al tocarla, y no se listan todas a la vez con su nota y su autor.
- El contenido de la versión marcada se lee en páginas. Al abrir la ficha se ve solo la primera página, titulada «Página 1 de T», donde T es el total de páginas, y el botón «Cargar más». Cada «Cargar más» añade la página siguiente, y en la última página el botón desaparece. Al tocar otra versión, el contenido vuelve a la primera página.
- Los apartados numerados se leen en negrita y las líneas vacías dejan un hueco.
- «Descargar PDF» entrega la versión marcada con su nombre (`<código>-v<versión>.pdf`) y muestra el aviso «Descarga iniciada» con ese nombre. Cómo se entrega el archivo en iOS y en Android no forma parte de esta historia.
- La ficha no ofrece «Abrir en nueva pestaña», porque la app no tiene pestañas del navegador.
- «Volver a Documentos» lleva a /documents.
- Un código que no existe muestra el aviso «No se encontró el documento» con la traza de la petición y el enlace «Volver a Documentos». Cualquier otro fallo muestra «Ha ocurrido un error inesperado» con la traza y el botón «Reintentar».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo»; `gestor@sigpro.test` (contraseña `Gestor1234!`) entra y llega a `/programs`.
- Datos del seed que citan los ejemplos: `DOC-001` tiene tres versiones y `DOC-002` una. Todas las versiones del seed las publicó «Javier Ortega». Las fechas son 05/02/2026 (versión 3), 29/01/2026 (versión 2) y 22/01/2026 (versión 1). La página 1 de la versión 3 de `DOC-001` acaba en «El consultor ejecuta las pruebas.», y la página 2 empieza por «El auditor valida los resultados.».

## Criterios de aceptación
```gherkin
Característica: Ficha de un documento en la app móvil

  Esquema del escenario: La ficha abre en la última versión con su autor y su fecha
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha abierto la ficha de <codigo> desde /documents
    Cuando mira la ficha
    Entonces ve el título <titulo>, la clasificación <clasificacion>, el texto «Actualizado: <actualizado>» y el selector de versiones con «Versión <version> · última» marcada
    Y ve debajo el texto «por Javier Ortega · <fecha>»

    Ejemplos:
      | codigo | titulo | clasificacion | version | actualizado | fecha |
      | DOC-001 | Plan de verificación PRG-001 | «Público» | 3 | 05/02/2026 | 05/02/2026 |
      | DOC-002 | Especificación técnica PRG-001 | «Público» | 1 | 22/01/2026 | 22/01/2026 |

  Esquema del escenario: Tocar una versión muestra su autor, su fecha y su nota
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha abierto la ficha de DOC-001
    Cuando toca la versión <version> en el selector de versiones
    Entonces queda marcada «Versión <version>», ve el texto «por Javier Ortega · <fecha>» y la etiqueta «Nota de cambios» con la nota <nota>

    Ejemplos:
      | version | fecha | nota |
      | 2 | 29/01/2026 | Ajuste de alcance y responsabilidades |
      | 1 | 22/01/2026 | Versión inicial |

  Esquema del escenario: El contenido abre con la primera página y «Cargar más» añade la siguiente
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha abierto la ficha de <codigo>
    Cuando mira el contenido
    Entonces ve «Página 1 de 2» con las líneas hasta <ultima_pagina_1> y no ve la página 2
    Cuando pulsa «Cargar más»
    Entonces ve «Página 2 de 2» con la línea <primera_pagina_2> al principio y ya no ve «Cargar más»

    Ejemplos:
      | codigo | ultima_pagina_1 | primera_pagina_2 |
      | DOC-001 | El consultor ejecuta las pruebas. | El auditor valida los resultados. |
      | DOC-002 | El gestor del programa aprueba el plan. | El consultor ejecuta las pruebas. |

  Esquema del escenario: «Descargar PDF» entrega la versión elegida con su nombre
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha abierto la ficha de DOC-001
    Cuando toca la versión <version> en el selector de versiones y pulsa «Descargar PDF»
    Entonces ve el aviso «Descarga iniciada» con el nombre <archivo>

    Ejemplos:
      | version | archivo |
      | 2 | DOC-001-v2.pdf |
      | 3 | DOC-001-v3.pdf |

  Esquema del escenario: Un código que no existe muestra el aviso de documento no encontrado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil
    Cuando abre /documents/<codigo>
    Entonces ve el aviso «No se encontró el documento» con la traza de la petición y el enlace «Volver a Documentos»

    Ejemplos:
      | codigo |
      | DOC-013 |
      | doc-001 |
```

## Fuera de alcance
- Publicar una versión nueva y comparar versiones desde la ficha: EP-DOC-VERSIONES.
- El acceso denegado de un documento restringido para un rol que no puede verlo: EP-DOC-RESTRINGIDOS.
- La ficha del programa al que enlaza el documento: EP-PROG-DETALLE.
- Cómo se entrega el PDF en iOS y en Android (hoja de compartir del sistema): historias de iOS y de Android de esta épica.
- La lista de documentos desde la que se llega a la ficha: historia de la lista móvil de esta épica.
