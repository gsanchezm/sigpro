---
id: US-DOC-LISTA-009
tipo: historia
epica: EP-DOC-LISTA
titulo: "[Web] Ver la ficha de un documento con su historial y sus acciones"
etiquetas: [web]
relacionadas: [US-DOC-LISTA-003, US-DOC-LISTA-006, US-DOC-LISTA-010, US-DOC-LISTA-012]
verificacion: codigo
cubre: ["/documents/:id"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero abrir la ficha de un documento y ver su programa, su clasificación, su versión vigente y el historial de sus versiones,
para saber qué versión es la correcta, quién la publicó y qué cambió, y poder ver, abrir o descargar la versión que me interesa.

## Reglas
- La cabecera de la ficha muestra el código del documento, su etiqueta de clasificación («Público» o «Restringido»), el código del programa como enlace a la ficha de ese programa, y el título como encabezado de la página.
- El selector «Versión» lista todas las versiones, de la más nueva a la más antigua. La última aparece como «Versión N (última)» y viene elegida al abrir la ficha. Las demás aparecen como «Versión N».
- Elegir una versión en el selector cambia tres cosas: el visor de la ficha muestra esa versión, el enlace «Abrir en nueva pestaña» apunta a esa misma versión, y «Descargar PDF» descarga esa versión.
- El historial «Historial de versiones» tiene una fila por versión, de la más nueva a la más antigua. Cada fila muestra la versión, la nota de cambios (o «—» si no tiene nota), y «por» el nombre del autor seguido de la fecha de creación en dd/mm/aaaa.
- «Descargar PDF» descarga la versión elegida con su nombre (`<código>-v<versión>.pdf`) y muestra el aviso «Descarga iniciada» con ese nombre. Si la descarga falla, muestra el aviso «No se pudo descargar el documento» con la traza de la petición.
- «Abrir en nueva pestaña» abre el visor de la versión elegida en una pestaña nueva.
- Un código que no existe en el tenant muestra el aviso «No se encontró el documento» con la traza de la petición y el enlace «Volver a Documentos». Cualquier otro fallo de la petición muestra el aviso «Ha ocurrido un error inesperado» con la traza y el mismo enlace.
- El enlace «Volver a Documentos» lleva a /documents.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada; `gestor@sigpro.test` (contraseña `Gestor1234!`) entra y llega a `/programs`.
- Datos del seed que citan los ejemplos: `DOC-001` tiene tres versiones, `DOC-002` una y `DOC-003` dos. Todas las versiones del seed las publicó «Javier Ortega». Las notas son «Versión inicial» (versión 1), «Ajuste de alcance y responsabilidades» (versión 2) y «Nuevos criterios de aceptación y anexos» (versión 3), y las fechas son 22/01/2026, 29/01/2026 y 05/02/2026.

## Criterios de aceptación
```gherkin
Característica: Ficha de un documento en la web

  Esquema del escenario: La ficha muestra el documento y su última versión, elegida por defecto
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /documents
    Cuando abre la ficha de <codigo>
    Entonces ve el título <titulo>, el programa <programa>, la clasificación <clasificacion> y el selector «Versión» con «Versión <version> (última)» elegida
    Y el historial tiene <filas> filas

    Ejemplos:
      | codigo | titulo | programa | clasificacion | version | filas |
      | DOC-001 | Plan de verificación PRG-001 | PRG-001 | «Público» | 3 | 3 |
      | DOC-002 | Especificación técnica PRG-001 | PRG-001 | «Público» | 1 | 1 |
      | DOC-003 | Plan de verificación PRG-002 | PRG-002 | «Restringido» | 2 | 2 |

  Esquema del escenario: Cada fila del historial dice la versión, su nota, su autor y su fecha
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto la ficha de DOC-001
    Cuando mira la fila de la versión <version> del historial
    Entonces ve v<version>, la nota <nota> y el texto «por Javier Ortega · <fecha>»

    Ejemplos:
      | version | nota | fecha |
      | 3 | Nuevos criterios de aceptación y anexos | 05/02/2026 |
      | 2 | Ajuste de alcance y responsabilidades | 29/01/2026 |
      | 1 | Versión inicial | 22/01/2026 |

  Esquema del escenario: Elegir una versión cambia el visor y el enlace de la nueva pestaña
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto la ficha de DOC-001
    Cuando elige «Versión <version>» en el selector «Versión»
    Entonces el visor de la ficha muestra la versión <version> del documento
    Y el enlace «Abrir en nueva pestaña» lleva a <direccion>

    Ejemplos:
      | version | direccion |
      | 2 | /documents/DOC-001/view?version=2 |
      | 1 | /documents/DOC-001/view?version=1 |

  Esquema del escenario: «Descargar PDF» baja la versión elegida con su nombre
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto la ficha de DOC-001 y ha elegido la versión <version> en el selector «Versión»
    Cuando pulsa «Descargar PDF»
    Entonces ve el aviso «Descarga iniciada» con el nombre <archivo> y el archivo descargado se llama <archivo>

    Ejemplos:
      | version | archivo |
      | 3 | DOC-001-v3.pdf |
      | 2 | DOC-001-v2.pdf |

  Esquema del escenario: Un código que no existe muestra el aviso de documento no encontrado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /documents
    Cuando abre /documents/<codigo>
    Entonces ve el aviso «No se encontró el documento» con la traza de la petición y el enlace «Volver a Documentos»

    Ejemplos:
      | codigo |
      | DOC-013 |
      | doc-001 |
```

## Decisiones pendientes
- La línea de detalle técnico que aparece bajo los avisos de error de la ficha (la traza de la petición fallida). Hoy la muestra; no está decidido si forma parte del producto ni qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.

## Fuera de alcance
- Publicar una nueva versión desde la ficha (botón y diálogo) y la comparación de versiones de la ficha: EP-DOC-VERSIONES.
- El aviso de acceso denegado de un documento restringido para un rol que no puede verlo: EP-DOC-RESTRINGIDOS.
- La ficha del programa al que enlaza el documento: EP-PROG-DETALLE.
- El visor en sí, que se abre desde la ficha o desde la lista: historia del visor de la web de esta épica.
