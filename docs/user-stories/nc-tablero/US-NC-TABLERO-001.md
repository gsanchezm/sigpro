---
id: US-NC-TABLERO-001
tipo: historia
epica: EP-NC-TABLERO
titulo: "[API] Listar las no conformidades del tenant con sus campos, su orden y sus filtros"
etiquetas: [api]
relacionadas: [US-NC-TABLERO-002, US-NC-TABLERO-006, US-NC-TABLERO-007, US-NC-TABLERO-010]
verificacion: ejecutada
cubre: ["GET /api/nc"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero pedir las no conformidades de mi tenant con sus campos y con los filtros que necesite,
para pintar el tablero por estado y encontrar una no conformidad concreta sin recorrerlas todas.

## Reglas
- `GET /api/nc` exige un `accessToken` en la cabecera `Authorization: Bearer`. Sin cabecera responde 401 `missing_token`; con un texto que no es un token válido, 401 `invalid_token`. Lo pueden pedir los cuatro roles (`admin`, `program_manager`, `consultant` y `auditor`).
- Con un token válido la respuesta es 200 con tres campos: `items`, `total` y `totalAll`.
- `items` trae todas las no conformidades que cumplen los filtros, sin paginar, ordenadas por código de menor a mayor: `NC-002` va después de `NC-001` y `NC-010` después de `NC-009`.
- `total` cuenta las que cumplen los filtros. `totalAll` cuenta todas las no conformidades del tenant, con o sin filtros.
- Cada elemento de `items` trae `code`, `programCode`, `programName`, `severity` (`minor`, `major` o `critical`), `description`, `state` (`open`, `in_analysis`, `corrective_action`, `closed` o `rejected`), `assigneeId` y `assigneeName` (los dos `null` si no tiene responsable), `commentCount` (número de comentarios de la no conformidad) y `createdAt` (fecha y hora en ISO 8601).
- Los filtros van en la consulta de la URL y se combinan con «y». `q` busca el texto en el código o en la descripción, sin distinguir mayúsculas de minúsculas. `program` acepta un código de programa. `severity` acepta `minor`, `major` o `critical`. `assignee` acepta el id de una persona o `none` para las no conformidades sin responsable. Un filtro que no se envía no filtra.
- Un `program` o un `assignee` que no corresponden a nada del tenant responden 200 con `items` vacío y `total` 0.
- La lista es la del tenant del `accessToken`. La cabecera `x-tenant` no cambia el tenant de esta petición.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token del administrador del tenant. Después, cada cuenta de la fila inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa el `accessToken` que recibe: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o `alumno01@sigpro.lab` (`Alumno1234!`, rol admin, sin segundo factor).

## Criterios de aceptación
```gherkin
Característica: Lista de no conformidades por la API

  Esquema del escenario: Cada no conformidad del seed trae su programa, su severidad, su estado, su responsable y sus comentarios
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía GET /api/nc con x-tenant alumno01 y ese accessToken
    Entonces la respuesta es 200 y en items la no conformidad <codigo> trae programCode <programa>, severity <severidad>, state <estado>, assigneeName <responsable> y commentCount <comentarios>

    Ejemplos:
      | codigo | programa | severidad | estado | responsable | comentarios |
      | NC-001 | PRG-001 | minor | open | Javier Ortega | 1 |
      | NC-003 | PRG-001 | critical | corrective_action | Andrés Molina | 3 |
      | NC-004 | PRG-001 | minor | closed | Marta Ruiz | 1 |
      | NC-005 | PRG-002 | major | rejected | (ninguno) | 1 |
      | NC-010 | PRG-003 | minor | closed | (ninguno) | 3 |

  Esquema del escenario: Sin filtros la lista trae las doce no conformidades ordenadas por código
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía GET /api/nc con x-tenant alumno01, ese accessToken y la consulta <consulta>
    Entonces la respuesta es 200 con items <codigos>, total <total> y totalAll 12

    Ejemplos:
      | consulta | codigos | total |
      | (sin consulta) | NC-001, NC-002, NC-003, NC-004, NC-005, NC-006, NC-007, NC-008, NC-009, NC-010, NC-011 y NC-012, en ese orden | 12 |

  Esquema del escenario: Cada filtro deja solo las no conformidades que cumplen con él
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía GET /api/nc con x-tenant alumno01, ese accessToken y la consulta <consulta>
    Entonces la respuesta es 200 con items <codigos>, total <total> y totalAll 12

    Ejemplos:
      | consulta | codigos | total |
      | q=012 | NC-012 | 1 |
      | q=nc-01 | NC-010, NC-011, NC-012 | 3 |
      | q=ejecución 007 | NC-007 | 1 |
      | program=PRG-002 | NC-005, NC-006, NC-007, NC-008 | 4 |
      | severity=critical | NC-003, NC-006, NC-009, NC-012 | 4 |
      | severity=critical y program=PRG-003 | NC-009, NC-012 | 2 |
      | assignee=none | NC-005, NC-010 | 2 |
      | assignee=u4 (Andrés Molina) | NC-003, NC-007, NC-011 | 3 |
      | q=zzzz-no-existe | (ninguno) | 0 |

  Esquema del escenario: Una petición sin un token válido no recibe la lista
    Dado que en el tenant alumno01, recién reiniciado, existen las no conformidades del seed
    Cuando envía GET /api/nc con la cabecera Authorization <cabecera_autorizacion>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cabecera_autorizacion | respuesta |
      | (sin cabecera) | 401 missing_token |
      | Bearer un texto que no es un token | 401 invalid_token |

  Esquema del escenario: Cada petición ve las no conformidades del tenant de su token, no el de la cabecera x-tenant
    Dado que los tenants alumno01 y alumno02 están recién reiniciados y, en alumno02, NC-001 ha pasado a in_analysis con POST /api/nc/NC-001/transition y el accessToken de alumno02@sigpro.lab
    Cuando envía GET /api/nc con el accessToken de <cuenta> y la cabecera x-tenant <cabecera>
    Entonces en items, la no conformidad NC-001 trae state <estado>

    Ejemplos:
      | cuenta | cabecera | estado |
      | alumno01@sigpro.lab | alumno02 | open |
      | alumno02@sigpro.lab | alumno01 | in_analysis |
```

## Decisiones pendientes
- Hoy, un `severity` con un valor que no existe (por ejemplo, `enorme`) no filtra: la respuesta es 200 con la lista completa. No está decidido si debe responder 422 o ignorar el filtro, y ningún ejemplo de esta historia lo afirma.

## Fuera de alcance
- El detalle de una no conformidad y los pasos que admite: US-NC-TABLERO-002.
- La alta, la edición, la asignación y los comentarios: EP-NC-GESTION.
- El KPI «NC abiertas» del panel de misión, que se actualiza en vivo: EP-MISION-FEED.
- La búsqueda global de la cabecera: EP-NAVEGACION.
