---
id: US-DOC-RESTRINGIDOS-002
tipo: historia
epica: EP-DOC-RESTRINGIDOS
titulo: "[API] Ficha, contenido y descarga de un restringido según el permiso"
etiquetas: [api]
relacionadas: [US-DOC-RESTRINGIDOS-001, US-DOC-RESTRINGIDOS-003, US-DOC-RESTRINGIDOS-006, US-DOC-RESTRINGIDOS-007, US-LOGIN-001]
verificacion: codigo
cubre: ["GET /api/documents/:id", "GET /api/documents/:id/content", "GET /api/documents/:id/download"]
permisos: [document.viewRestricted]
---

## Historia
Como cliente de la API que pide un documento por su código, quiero recibir su ficha, el contenido de una versión o su PDF solo si mi rol puede ver ese documento restringido,
para que quien no tiene el permiso no reciba ningún dato de un documento clasificado y quien sí lo tiene trabaje con él como con uno público.

## Reglas
- Un documento `restricted` se entrega (ficha, contenido de una versión y PDF) a los roles con `document.viewRestricted`: admin, gestor de programa y auditor. Para ellos la respuesta es la misma que la de un documento público.
- Para el consultor (`consultant`), cada uno de los tres endpoints responde 403 `forbidden` ante un documento restringido existente. Esa respuesta no trae datos del documento: ni su título, ni sus versiones, ni su contenido, ni el PDF.
- La comprobación del permiso ocurre sobre el documento pedido. Un código que no existe en el tenant responde 404 `document_not_found` a cualquier rol, también al consultor.
- Un documento `public` responde igual a todos los roles.
- Con admin, `GET /api/documents/DOC-003` trae `classification` `restricted`, `version` 2 y dos versiones (la 1 y la 2).
- La descarga de un documento es un PDF de la versión pedida, con el nombre `<código>-v<versión>.pdf`. La línea de cabecera del PDF, la que lleva el código, el programa, la versión y la clasificación, dice «RESTRINGIDO» en un restringido y «PÚBLICO» en un público.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la fila obtiene el `accessToken` de la cuenta de su ejemplo con `POST /api/auth/login`, con la cabecera `x-tenant: alumno01`. La cuenta `admin@sigpro.test` (`Admin1234!`) completa además el segundo factor con el código `123456` (`POST /api/auth/mfa`) y usa el `accessToken` que recibe. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Datos del seed (`docs/GUIA-ALUMNO.md`): `DOC-003` es el «Plan de verificación PRG-002», restringido, en su versión 2; `DOC-004` es la «Especificación técnica PRG-002», pública; `DOC-001` es el «Plan de verificación PRG-001», público, en su versión 3.

## Criterios de aceptación
```gherkin
Característica: Acceso a un documento restringido por la API

  Esquema del escenario: La ficha, el contenido y la descarga siguen el permiso del rol
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene su accessToken
    Cuando pide <peticion>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | peticion | respuesta |
      | admin@sigpro.test | GET /api/documents/DOC-003 | 200 con classification restricted, version 2 y dos versiones |
      | admin@sigpro.test | GET /api/documents/DOC-003/content | 200 con la versión 2 y sus páginas |
      | admin@sigpro.test | GET /api/documents/DOC-003/download | 200 con un PDF llamado DOC-003-v2.pdf |
      | gestor@sigpro.test | GET /api/documents/DOC-003 | 200 con classification restricted |
      | auditor@sigpro.test | GET /api/documents/DOC-003 | 200 con classification restricted |
      | consultor@sigpro.test | GET /api/documents/DOC-003 | 403 forbidden, sin datos del documento |
      | consultor@sigpro.test | GET /api/documents/DOC-003/content | 403 forbidden, sin datos del documento |
      | consultor@sigpro.test | GET /api/documents/DOC-003/download | 403 forbidden, sin PDF |
      | consultor@sigpro.test | GET /api/documents/DOC-004 | 200 con classification public |

  Esquema del escenario: La cabecera del PDF marca la clasificación del documento
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test tiene su accessToken
    Cuando descarga GET /api/documents/<documento>/download
    Entonces el archivo se llama <nombre>
    Y su línea de cabecera dice <marca>

    Ejemplos:
      | documento | nombre | marca |
      | DOC-003 | DOC-003-v2.pdf | «RESTRINGIDO» |
      | DOC-001 | DOC-001-v3.pdf | «PÚBLICO» |

  Esquema del escenario: Un código que no existe responde 404 a cualquier rol
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene su accessToken
    Cuando pide GET /api/documents/DOC-999
    Entonces la respuesta es 404 document_not_found

    Ejemplos:
      | cuenta |
      | consultor@sigpro.test |
      | admin@sigpro.test |
```

## Fuera de alcance
- La lista de documentos y el aviso con el número de ocultos: EP-DOC-RESTRINGIDOS, historia 001.
- La comparación entre versiones, también la de un restringido (el permiso que exige y su respuesta 403 o 200): EP-DOC-VERSIONES, historia 004.
- El historial de versiones y el diálogo de nueva versión: EP-DOC-VERSIONES.
- La ficha, el contenido y la descarga de los documentos públicos en la web y en la app móvil: EP-DOC-LISTA.

## Decisiones pendientes
- Si un restringido que existe debe responder 404 `document_not_found` a quien no tiene el permiso, igual que un código que no existe, para no revelar que el código existe. Hoy responde 403, que es lo que describen las filas: el consultor distingue `DOC-003` (403) de `DOC-999` (404).
