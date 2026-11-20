---
id: US-DOC-RESTRINGIDOS-001
tipo: historia
epica: EP-DOC-RESTRINGIDOS
titulo: "[API] Lista de documentos sin los restringidos para quien no tiene el permiso"
etiquetas: [api]
relacionadas: [US-DOC-RESTRINGIDOS-004, US-DOC-RESTRINGIDOS-005, US-DOC-RESTRINGIDOS-007, US-DOC-LISTA-001, US-LOGIN-001, US-MFA-001]
verificacion: ejecutada
cubre: ["GET /api/documents"]
permisos: [document.viewRestricted]
---

## Historia
Como cliente de la API que pide la lista de documentos de su tenant, quiero recibir solo los documentos que mi rol puede ver y saber cuántos restringidos se han quedado fuera,
para no recibir un documento restringido si mi rol no puede verlo y poder avisar de que hay más.

## Reglas
- Un documento `public` aparece en la lista de cualquier rol con sesión.
- Un documento `restricted` aparece solo si el rol tiene el permiso `document.viewRestricted`, que lo tienen admin, gestor de programa (`program_manager`) y auditor. El consultor (`consultant`) no lo recibe.
- La visibilidad la decide la clasificación de cada documento y el rol de quien pide. Ningún otro dato del programa al que pertenece el documento cambia qué documentos ve un rol.
- La respuesta trae `items` con los documentos visibles y `hiddenCount` con el número de documentos restringidos del tenant que el rol no puede ver. Para quien tiene el permiso, `hiddenCount` vale 0.
- Los filtros `program` (código de programa), `classification` (`public` o `restricted`) y `q` (código o título, sin distinguir mayúsculas) se aplican solo a los documentos visibles: un restringido no sale con ningún filtro para quien no lo puede ver.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la fila obtiene el `accessToken` de la cuenta de su ejemplo con `POST /api/auth/login`, con la cabecera `x-tenant: alumno01`. La cuenta `admin@sigpro.test` (`Admin1234!`) completa además el segundo factor con el código `123456` (`POST /api/auth/mfa`) y usa el `accessToken` que recibe; `gestor@sigpro.test` (`Gestor1234!`), `auditor@sigpro.test` (`Audit1234!`) y `consultor@sigpro.test` (`Consul1234!`) entran sin segundo factor. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Datos del seed (`apps/api/src/seed/data.ts`): hay 12 documentos, de `DOC-001` a `DOC-012`, repartidos entre `PRG-001` y `PRG-006`. Los restringidos son `DOC-003`, `DOC-006`, `DOC-009` y `DOC-012`. Entre los programas que tienen documentos, `PRG-001` y `PRG-005` son los marcados como clasificados.

## Criterios de aceptación
```gherkin
Característica: Visibilidad de documentos restringidos en la lista de la API

  Esquema del escenario: Cada rol recibe los documentos que su permiso permite y el número de los omitidos
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene su accessToken
    Cuando pide GET /api/documents
    Entonces la lista trae <total> documentos
    Y hiddenCount vale <oculto>
    Y los restringidos que trae son <restringidos>

    Ejemplos:
      | cuenta | total | oculto | restringidos |
      | admin@sigpro.test | 12 | 0 | DOC-003, DOC-006, DOC-009 y DOC-012 |
      | gestor@sigpro.test | 12 | 0 | DOC-003, DOC-006, DOC-009 y DOC-012 |
      | auditor@sigpro.test | 12 | 0 | DOC-003, DOC-006, DOC-009 y DOC-012 |
      | consultor@sigpro.test | 8 | 4 | (ninguno) |

  Esquema del escenario: Un filtro no devuelve un restringido a quien no puede verlo
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene su accessToken
    Cuando pide GET /api/documents<filtro>
    Entonces la lista trae <codigos>

    Ejemplos:
      | cuenta | filtro | codigos |
      | consultor@sigpro.test | ?classification=restricted | (ninguno) |
      | admin@sigpro.test | ?classification=restricted | DOC-003, DOC-006, DOC-009 y DOC-012 |
      | consultor@sigpro.test | ?q=DOC-003 | (ninguno) |
      | admin@sigpro.test | ?q=DOC-003 | DOC-003 |
      | consultor@sigpro.test | ?program=PRG-002 | DOC-004 |
      | admin@sigpro.test | ?program=PRG-002 | DOC-003 y DOC-004 |

  Esquema del escenario: La clasificación del programa no cambia qué documentos ve el consultor
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test tiene su accessToken y el programa <programa> está marcado como clasificado
    Cuando pide GET /api/documents?program=<programa>
    Entonces la lista trae <codigos>

    Ejemplos:
      | programa | codigos |
      | PRG-001 | DOC-001 y DOC-002 |
      | PRG-005 | DOC-010 |
```

## Fuera de alcance
- La ficha, el contenido, la comparación y la descarga de un restringido, y el código 403 que reciben quienes no tienen el permiso: EP-DOC-RESTRINGIDOS, historia 002.
- El orden de la lista, la paginación y los filtros que se muestran en la pantalla web: EP-DOC-LISTA.
- Las pantallas de la lista en la web y en la app móvil: EP-DOC-RESTRINGIDOS, historias 005 y 007.

## Decisiones pendientes
- Si `hiddenCount` debe contar solo los restringidos ocultos que cumplen los filtros de la petición. Hoy cuenta todos los restringidos del tenant que el rol no puede ver, con independencia de `program`, `classification` y `q`: con `?program=PRG-002`, el consultor recibe `hiddenCount` 4 aunque en ese programa solo esté oculto `DOC-003`.
- Qué efecto debe tener el indicador «Programa clasificado» del programa, si alguno. Hoy no cambia la lista de documentos de ningún rol, y el plan no define ese indicador. Esta historia solo afirma que la visibilidad la decide la clasificación de cada documento.
