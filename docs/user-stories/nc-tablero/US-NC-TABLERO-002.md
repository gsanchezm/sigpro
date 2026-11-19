---
id: US-NC-TABLERO-002
tipo: historia
epica: EP-NC-TABLERO
titulo: "[API] Consultar el detalle de una no conformidad y los pasos que admite"
etiquetas: [api]
relacionadas: [US-NC-TABLERO-001, US-NC-TABLERO-003, US-NC-TABLERO-009]
verificacion: ejecutada
cubre: ["GET /api/nc/:code"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero pedir una no conformidad por su código y ver a qué estados puede pasar desde el suyo,
para mostrar su detalle y ofrecer solo los pasos que la máquina de estados admite.

## Reglas
- `GET /api/nc/:code` lo pueden pedir los cuatro roles, con el mismo `accessToken` que la lista de no conformidades.
- Con un código que existe en el tenant, la respuesta es 200 con los campos de un elemento de la lista (`code`, `programCode`, `programName`, `severity`, `description`, `state`, `assigneeId`, `assigneeName`, `commentCount` y `createdAt`), más `comments` y `transitions`.
- `comments` lista los comentarios de la no conformidad del más antiguo al más reciente. Su número es `commentCount`.
- `transitions` lista los estados a los que la máquina de estados permite pasar desde el estado actual, en el orden de la máquina.
- La máquina de estados admite estos pasos: `open` a `in_analysis`; `in_analysis` a `corrective_action`, `rejected` u `open`; `corrective_action` a `closed` o `in_analysis`; `rejected` a `open`. `closed` no admite ningún paso.
- Un código que no existe en el tenant responde 404 `nc_not_found`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token del administrador del tenant. Después, `gestor@sigpro.test` (`Gestor1234!`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa el `accessToken` que recibe.

## Criterios de aceptación
```gherkin
Característica: Detalle de una no conformidad por la API

  Esquema del escenario: El detalle trae los pasos que la máquina admite desde el estado actual
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía GET /api/nc/<codigo> con x-tenant alumno01 y ese accessToken
    Entonces la respuesta es 200 con state <estado> y transitions <pasos>

    Ejemplos:
      | codigo | estado | pasos |
      | NC-001 | open | in_analysis |
      | NC-002 | in_analysis | corrective_action, rejected, open |
      | NC-003 | corrective_action | closed, in_analysis |
      | NC-004 | closed | (ninguno) |
      | NC-005 | rejected | open |

  Esquema del escenario: Un código que no existe en el tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía GET /api/nc/<codigo> con x-tenant alumno01 y ese accessToken
    Entonces la respuesta es 404 nc_not_found

    Ejemplos:
      | codigo |
      | NC-013 |
      | NC-000 |

  Esquema del escenario: El detalle lista los comentarios y su número coincide con commentCount
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía GET /api/nc/<codigo> con x-tenant alumno01 y ese accessToken
    Entonces la respuesta es 200 con commentCount <comentarios> y comments con <comentarios> elementos
    Y los comentarios van del más antiguo al más reciente

    Ejemplos:
      | codigo | comentarios |
      | NC-003 | 3 |
      | NC-008 | 0 |
```

## Decisiones pendientes
- Hoy `transitions` lista los pasos de la máquina sin mirar el rol de quien pide el detalle: un auditor recibe los mismos destinos que un gestor. No está decidido si el detalle debe listar solo los pasos que el rol puede dar; la respuesta de esta historia no lo afirma.

## Fuera de alcance
- La lista de no conformidades y sus filtros: US-NC-TABLERO-001.
- El paso de una no conformidad a otro estado: US-NC-TABLERO-003 a US-NC-TABLERO-005.
- La creación de comentarios y la edición de la no conformidad: EP-NC-GESTION.
