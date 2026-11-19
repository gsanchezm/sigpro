---
id: US-DOC-VERSIONES-001
tipo: historia
epica: EP-DOC-VERSIONES
titulo: "[API] Publicar una versión nueva: queda la última, con su nota y su autor"
etiquetas: [api]
relacionadas: [US-DOC-VERSIONES-002, US-DOC-VERSIONES-003, US-DOC-VERSIONES-005, US-DOC-VERSIONES-009]
verificacion: ejecutada
cubre: ["POST /api/documents/:id/versions"]
permisos: [document.publish]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con un token de administrador o de gestor de programa, quiero enviar el contenido de una versión nueva de un documento,
para que esa versión pase a ser la última del documento, con su nota de cambios y con la persona que la publica como autora.

## Reglas
- `POST /api/documents/:id/versions` lo pueden llamar los tokens de los roles `admin` y `program_manager`. Un token de cualquier otro rol no publica nada.
- El cuerpo es JSON con `lines` (lista de textos: cada texto es una línea del contenido) y `note` (texto opcional con la nota de cambios). Un cuerpo que no cumple los límites de `lines` y de `note` no publica nada.
- Si el documento está en la versión N, la publicación responde 201 y el documento queda en la versión N + 1, que pasa a ser la última. Las versiones anteriores no cambian ni se borran.
- La respuesta es la ficha del documento: `id`, `programCode`, `programName`, `title`, `classification`, `version` (N + 1), `updatedAt` (el momento de la versión nueva) y `versions`, con una entrada por versión.
- La entrada nueva de `versions` tiene `version` N + 1, la `note` guardada, `authorName` (el nombre de quien publica) y `createdAt` (el momento de la publicación).
- La nota se guarda sin los espacios del principio y del final. Si el cuerpo no trae `note`, la versión queda con la nota vacía.
- Cada publicación queda registrada en la auditoría con la acción `document.version_published`, sobre el documento y con el número de la versión nueva.
- En los ejemplos, `(N letras a)` es un texto de N letras «a» seguidas, y `(dos espacios delante y dos detrás de X)` es el texto X con dos espacios en cada extremo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la cuenta de la fila obtiene su token con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, con su contraseña del seed (`alumno01@sigpro.lab` con `Alumno1234!`, `gestor@sigpro.test` con `Gestor1234!`). Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Estado del seed, sin pasos previos, en el tenant `alumno01`: `DOC-001` («Plan de verificación PRG-001», público, versiones 1 a 3), `DOC-002` («Especificación técnica PRG-001», público, versión 1), `DOC-003` («Plan de verificación PRG-002», restringido, versiones 1 y 2) y `DOC-004` («Especificación técnica PRG-002», público, versiones 1 a 3). Las versiones del seed tienen las notas «Versión inicial» (versión 1), «Ajuste de alcance y responsabilidades» (versión 2) y «Nuevos criterios de aceptación y anexos» (versión 3), y las publicó «Javier Ortega».

## Criterios de aceptación
```gherkin
Característica: Publicar una versión nueva por la API

  Esquema del escenario: La versión nueva pasa a ser la última del documento
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene su token y <documento> está en la versión <version_actual>
    Cuando envía POST /api/documents/<documento>/versions con x-tenant alumno01, un cuerpo con una línea de texto y la nota <nota_enviada>
    Entonces la respuesta es 201 con version <version_nueva>
    Y la última versión de <documento> es la <version_nueva>, con la nota <nota_guardada> y el autor <autor>

    Ejemplos:
      | cuenta | documento | version_actual | version_nueva | nota_enviada | nota_guardada | autor |
      | alumno01@sigpro.lab | DOC-001 | 3 | 4 | Ajuste de alcance | Ajuste de alcance | Alumno 01 |
      | gestor@sigpro.test | DOC-002 | 1 | 2 | Primera revisión | Primera revisión | Javier Ortega |
      | gestor@sigpro.test | DOC-003 | 2 | 3 | Revisión de criterios | Revisión de criterios | Javier Ortega |

  Esquema del escenario: La nota se guarda sin espacios de los extremos y vacía si no se envía
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su token y DOC-004 está en la versión 3
    Cuando envía POST /api/documents/DOC-004/versions con x-tenant alumno01, un cuerpo con una línea de texto y la nota <nota_enviada>
    Entonces la respuesta es 201 con version 4
    Y la nota de la versión 4 es <nota_guardada>

    Ejemplos:
      | nota_enviada | nota_guardada |
      | (sin el campo) | (vacía) |
      | (vacía) | (vacía) |
      | (dos espacios delante y dos detrás de Revisión final) | Revisión final |
      | (200 letras a) | (200 letras a) |

  Esquema del escenario: Las versiones anteriores conservan sus notas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su token y <documento> está en la versión <version_actual>
    Cuando envía POST /api/documents/<documento>/versions con x-tenant alumno01, un cuerpo con una línea de texto y la nota Revisión de alcance
    Entonces la respuesta es 201 con version <version_nueva>
    Y las versiones anteriores de <documento> conservan las notas <notas_anteriores>

    Ejemplos:
      | documento | version_actual | version_nueva | notas_anteriores |
      | DOC-001 | 3 | 4 | «Versión inicial», «Ajuste de alcance y responsabilidades» y «Nuevos criterios de aceptación y anexos» |
```

## Fuera de alcance
- El rechazo por rol, el orden de las comprobaciones y el 404 de un documento que no existe: EP-DOC-VERSIONES, otra historia de esta épica.
- Los límites del contenido y de la nota, y sus motivos de 422: EP-DOC-VERSIONES, otra historia de esta épica.
- La ficha, la lista, el visor y la descarga de las versiones: EP-DOC-LISTA.
- La subida de un archivo como versión: EP-DOC-VERSIONES, otra historia de esta épica (no implementada).
