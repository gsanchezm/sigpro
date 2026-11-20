---
id: US-DOC-RESTRINGIDOS-003
tipo: historia
epica: EP-DOC-RESTRINGIDOS
titulo: "[API] Publicar una versión de un restringido no cambia su clasificación ni su visibilidad"
etiquetas: [api]
relacionadas: [US-DOC-RESTRINGIDOS-001, US-DOC-RESTRINGIDOS-002, US-DOC-RESTRINGIDOS-006, US-DOC-RESTRINGIDOS-007, US-MFA-001, US-DOC-VERSIONES-003]
verificacion: ejecutada
cubre: ["POST /api/documents/:id/versions"]
permisos: [document.publish, document.viewRestricted]
---

## Historia
Como admin que publica una versión nueva de un documento restringido, quiero que el documento conserve su clasificación y quien no lo podía ver siga sin poderlo ver,
para que publicar una versión no abra el restringido a quien no tiene el permiso ni lo cambie de clase.

## Reglas
- Tras una publicación con admin o gestor de programa sobre `DOC-003`, la versión nueva es la última (`version` 3) y el documento sigue siendo `restricted`.
- Quien tenía el permiso `document.viewRestricted` sigue viendo `DOC-003` con su versión nueva: admin, gestor de programa y auditor reciben la ficha con `classification` `restricted` y `version` 3.
- El consultor sigue sin verlo: su ficha responde 403 `forbidden` y su lista no incluye `DOC-003`.
- Quién puede publicar, y el orden de las comprobaciones de la publicación, no son parte de esta historia: lo describe EP-DOC-VERSIONES.
- La petición de publicación lleva el cuerpo `lines` con una sola línea («Contenido de prueba») y `note` «Prueba». Responde 201, como cualquier publicación.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la fila obtiene el `accessToken` de la cuenta de su ejemplo con `POST /api/auth/login`, con la cabecera `x-tenant: alumno01`. La cuenta `admin@sigpro.test` (`Admin1234!`) completa además el segundo factor con el código `123456` (`POST /api/auth/mfa`) y usa el `accessToken` que recibe. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Datos del seed (`docs/GUIA-ALUMNO.md`): `DOC-003` es el «Plan de verificación PRG-002», restringido, con dos versiones. Cada fila empieza con el reinicio, que devuelve el documento a la versión 2.

## Criterios de aceptación
```gherkin
Característica: Publicar una versión de un documento restringido

  Esquema del escenario: La ficha del restringido sigue igual de restringida tras publicar
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test ha publicado una versión nueva de DOC-003 con el cuerpo lines de una línea «Contenido de prueba» y note «Prueba»
    Cuando <cuenta> pide GET /api/documents/DOC-003
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | respuesta |
      | admin@sigpro.test | 200 con classification restricted y version 3 |
      | gestor@sigpro.test | 200 con classification restricted y version 3 |
      | auditor@sigpro.test | 200 con classification restricted y version 3 |
      | consultor@sigpro.test | 403 forbidden, sin datos del documento |

  Esquema del escenario: La lista del consultor no incluye el restringido publicado
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test ha publicado una versión nueva de DOC-003 con el cuerpo lines de una línea «Contenido de prueba» y note «Prueba»
    Cuando consultor@sigpro.test pide GET /api/documents<filtro>
    Entonces <resultado>

    Ejemplos:
      | filtro | resultado |
      | ?classification=public | la lista trae 8 documentos y no incluye DOC-003 |
      | ?q=DOC-003 | la lista no trae ningún documento |
      | ?program=PRG-002 | la lista trae solo DOC-004 |
```

## Fuera de alcance
- Quién puede publicar, las validaciones del contenido y de la nota, el orden de las comprobaciones (403, 422 y 404) y el diálogo «Publicar nueva versión»: EP-DOC-VERSIONES.
- El historial de versiones y la comparación entre versiones: EP-DOC-VERSIONES.
- La ficha de un restringido en la web y en la app móvil, con el botón de publicar: EP-DOC-RESTRINGIDOS, historias 006 y 007.

## Decisiones pendientes
- Quién cambia la clasificación de un documento (de público a restringido o al revés). Hoy ningún endpoint lo hace y el plan no lo define; esta historia no lo afirma.
