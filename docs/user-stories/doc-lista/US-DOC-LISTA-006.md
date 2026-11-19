---
id: US-DOC-LISTA-006
tipo: historia
epica: EP-DOC-LISTA
titulo: "[Web] Ver la tabla de documentos y el menú de acciones de cada fila"
etiquetas: [web]
relacionadas: [US-DOC-LISTA-001, US-DOC-LISTA-005, US-DOC-LISTA-007, US-DOC-LISTA-008, US-DOC-LISTA-011]
verificacion: codigo
cubre: ["/documents"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero ver en /documents todos los documentos con su programa, su clasificación y su versión vigente, y poder abrir, ver o descargar cada uno desde su fila,
para encontrar el documento que busco y llegar a él en un paso.

## Reglas
- Desde 1024 px de ancho (escritorio) la lista es una tabla con las columnas «Código», «Título», «Programa», «Clasificación», «Versión» y «Actualizado», y una columna de acciones al final. Por debajo de 1024 px (diseño responsive) la lista son tarjetas con el código, la clasificación, el título, el código del programa y la versión, sin la columna de fecha.
- El código de cada documento es un enlace a su ficha. La clasificación se muestra con su etiqueta, «Público» o «Restringido». La versión se muestra como `v` seguido del número de la última versión, y la fecha de actualización como dd/mm/aaaa.
- La lista va en orden de código ascendente, tal como la entrega la API, y encima de ella aparece el recuento «N documentos».
- El menú de acciones de cada fila (solo en la tabla) ofrece:
  - «Ver documento»: lleva a la ficha del documento.
  - «Abrir en nueva pestaña»: abre el visor del documento en una pestaña nueva, con su última versión.
  - «Descargar PDF»: descarga la última versión con su nombre (`<código>-v<versión>.pdf`) y muestra el aviso «Descarga iniciada» con ese nombre. Si la descarga falla, muestra el aviso «No se pudo descargar el documento» con la traza de la petición.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada; `gestor@sigpro.test` (contraseña `Gestor1234!`) entra y llega a `/programs`. Desde ahí se abre `/documents` con el diseño que indique cada fila.
- Datos del seed que citan los ejemplos: en cada tenant hay doce documentos, `DOC-001` a `DOC-012`, dos por programa de `PRG-001` a `PRG-006`. Son restringidos `DOC-003`, `DOC-006`, `DOC-009` y `DOC-012`. Las fechas de actualización son 22/01/2026 para la versión 1, 29/01/2026 para la 2 y 05/02/2026 para la 3.

## Criterios de aceptación
```gherkin
Característica: Tabla de documentos en la web

  Esquema del escenario: Cada fila de la tabla muestra los datos del documento
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la web y está en /documents con un diseño de escritorio
    Cuando mira la fila de <codigo>
    Entonces ve el título <titulo>, el programa <programa>, la clasificación <clasificacion>, la versión <version> y la fecha <fecha>

    Ejemplos:
      | codigo | titulo | programa | clasificacion | version | fecha |
      | DOC-001 | Plan de verificación PRG-001 | PRG-001 | «Público» | v3 | 05/02/2026 |
      | DOC-002 | Especificación técnica PRG-001 | PRG-001 | «Público» | v1 | 22/01/2026 |
      | DOC-003 | Plan de verificación PRG-002 | PRG-002 | «Restringido» | v2 | 29/01/2026 |

  Esquema del escenario: La lista sale en orden de código y con el recuento de documentos en cualquier diseño
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la web y está en /documents con un diseño <diseno>
    Cuando mira la lista
    Entonces el primer documento es DOC-001, el último es DOC-012 y el recuento dice «12 documentos»

    Ejemplos:
      | diseno |
      | de escritorio |
      | responsive (menos de 1024 px) |

  Esquema del escenario: El menú de la fila ofrece ver el documento, abrirlo en una pestaña nueva y descargarlo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la web y está en /documents con un diseño de escritorio
    Cuando abre el menú de acciones de la fila de <codigo> y elige <opcion>
    Entonces <resultado>

    Ejemplos:
      | codigo | opcion | resultado |
      | DOC-001 | «Ver documento» | llega a /documents/DOC-001 y ve el título Plan de verificación PRG-001 |
      | DOC-001 | «Abrir en nueva pestaña» | se abre una pestaña nueva con /documents/DOC-001/view y ve la versión 3 del documento |
      | DOC-002 | «Descargar PDF» | ve el aviso «Descarga iniciada» con el nombre DOC-002-v1.pdf y el archivo descargado se llama DOC-002-v1.pdf |
```

## Decisiones pendientes
- En el diseño responsive las tarjetas no tienen menú de acciones, así que en ese diseño la lista no permite descargar un documento. No está decidido si las tarjetas deben tener el mismo menú que la tabla.

## Fuera de alcance
- El buscador y los desplegables de filtro de la lista: historia de filtros de la web de esta épica.
- Los estados de carga, vacío y error de la lista: historia de estados de esta épica.
- La ficha del documento y el visor: historias de ficha y de visor de la web de esta épica.
- Publicar una nueva versión desde la ficha, y los documentos restringidos para un rol que no puede verlos: EP-DOC-VERSIONES y EP-DOC-RESTRINGIDOS.
