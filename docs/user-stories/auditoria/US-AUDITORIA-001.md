---
id: US-AUDITORIA-001
tipo: historia
epica: EP-AUDITORIA
titulo: "[API] Listar el registro de auditoría del más reciente al más antiguo, en páginas por cursor"
etiquetas: [api]
relacionadas: [US-AUDITORIA-002, US-AUDITORIA-003, US-AUDITORIA-006, US-AUDITORIA-008]
verificacion: ejecutada
cubre: ["GET /api/audit"]
---

## Historia
Como admin o auditor que consulta la API (la web, la app móvil o una suite de pruebas), quiero pedir el registro de auditoría de mi tenant por páginas,
para leer quién hizo cada cambio, qué cambió y cuándo, empezando por lo más reciente.

## Reglas
- `GET /api/audit` solo lee: no modifica nada y no deja ningún evento. Responde 200 con `items` (los eventos de la página), `nextCursor` y `total`.
- Cada evento trae `id`, `at` (instante en ISO 8601 y en UTC), `actorId`, `actorName`, `action`, `entity`, `entityId` y `diff`. `diff` es un objeto con el detalle del cambio, o `null` si el evento no lleva detalle. `actorId` y `actorName` son `null` cuando ninguna cuenta hizo el cambio (la solicitud de acceso).
- Los eventos van del más reciente al más antiguo según `at`: un evento escrito después aparece antes en la lista.
- Sin `limit`, cada página trae 20 eventos. `limit` admite de 1 a 100: un valor menor que 1 se trata como 1 y uno mayor que 100 como 100.
- `total` cuenta todos los eventos del tenant que cumplen los filtros, no solo los de la página, y es el mismo en todas las páginas.
- `nextCursor` es el valor que se pasa como `cursor` para pedir la página siguiente, y es `null` cuando no quedan eventos. Cada página empieza justo después del último evento de la anterior: no repite ni salta eventos.
- `cursor=` vacío equivale a no pedir cursor. Un cursor que la API no ha devuelto (por ejemplo `xyz`) responde 422 `validation_failed` con `errors.cursor` igual a `badCursor` y no devuelve eventos.
- «El primer evento» es el primero de `items` en la primera página sin filtros. En un tenant recién reiniciado es el evento `AL-130` de la semilla: `requirement.created` sobre `REQ-011`, hecho por Lucía Fernández, con `at` 2026-01-19T22:00:00.000Z y `diff.title` «Cifrado del subsistema 011». La semilla tiene 130 eventos, desde `AL-001` (2026-01-06T11:30:00.000Z) hasta `AL-130`.
- Preparación de cada fila, en el tenant `alumno01`: antes de cada fila se comprueba que el caos del tenant está apagado: `GET /api/config` con la cabecera `x-tenant: alumno01` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Solo después se reinicia el tenant con `POST /api/admin/reset`, ese mismo token y la cabecera `x-tenant: alumno01`: así el evento que deja el propio apagado desaparece con el reinicio. Después, `auditor@sigpro.test` (contraseña `Audit1234!`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken` como `Authorization: Bearer`. Iniciar sesión no deja ningún evento.

## Criterios de aceptación
```gherkin
Característica: Registro de auditoría por la API: listado, orden y paginación

  Esquema del escenario: La página trae los eventos que pide el límite, del más reciente al más antiguo
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando envía GET /api/audit con <consulta>
    Entonces la respuesta es 200 con <eventos> eventos en items
    Y el último evento de items es <ultimo>
    Y total vale 130
    Y nextCursor es <nextCursor>

    Ejemplos:
      | consulta | eventos | ultimo | nextCursor |
      | (sin parámetros) | 20 | AL-111 | un texto no vacío |
      | limit=5 | 5 | AL-126 | un texto no vacío |
      | limit=0 | 1 | AL-130 | un texto no vacío |
      | limit=500 | 100 | AL-031 | un texto no vacío |

  Esquema del escenario: Recorrer las páginas con el cursor entrega cada evento una sola vez
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando pide GET /api/audit con <consulta> y después cada página con el cursor de la respuesta anterior, hasta que nextCursor es null
    Entonces ha recibido <paginas> páginas y <eventos> eventos distintos
    Y el último evento recibido es AL-001
    Y total vale 130 en cada página

    Ejemplos:
      | consulta | paginas | eventos |
      | limit=20 | 7 | 130 |
      | limit=50 | 3 | 130 |
      | limit=100 | 2 | 130 |

  Esquema del escenario: Un cursor que la API no ha devuelto no lista eventos
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando envía GET /api/audit con <consulta>
    Entonces la respuesta es <respuesta>
    Y el motivo del cursor es <motivo>

    Ejemplos:
      | consulta | respuesta | motivo |
      | cursor=xyz | 422 validation_failed | badCursor |
      | cursor= | 200 con 20 eventos en items | (ninguno) |

  Esquema del escenario: El primer evento trae sus datos
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando envía GET /api/audit sin parámetros
    Entonces el primer evento tiene <campo> igual a <valor>

    Ejemplos:
      | campo | valor |
      | actorName | Lucía Fernández |
      | action | requirement.created |
      | entityId | REQ-011 |
      | diff.title | Cifrado del subsistema 011 |
```

## Fuera de alcance
- Los filtros por entidad, por rango de días y por texto: los cubre EP-AUDITORIA en la API.
- El permiso `audit.view` y el aislamiento por tenant: los cubre EP-AUDITORIA en la API.
- La pantalla `/audit` de la web y de la app móvil: la cubre EP-AUDITORIA en sus pantallas.
