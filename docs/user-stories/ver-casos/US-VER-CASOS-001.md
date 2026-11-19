---
id: US-VER-CASOS-001
tipo: historia
epica: EP-VER-CASOS
titulo: "[API] Listar los casos de prueba en páginas de 10 con sus totales y su forma"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-VER-CASOS-002, US-VER-CASOS-003, US-VER-CASOS-004, US-PROG-LISTA-001]
verificacion: codigo
cubre: ["GET /api/test-cases"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con una sesión iniciada en un tenant, quiero pedir la lista de casos de prueba por páginas de 10,
para mostrar cada página sin traer todos los casos de una vez, saber cuántas páginas hay y ver el último resultado y el número de ejecuciones de cada caso.

## Reglas
- `GET /api/test-cases` exige sesión: el `accessToken` va en la cabecera `Authorization` como Bearer. Sin esa cabecera responde 401 `missing_token`; con un texto que no es un token válido responde 401 `invalid_token`.
- Cualquier rol con sesión (admin, program_manager, consultant y auditor) recibe la misma lista: la petición no exige ningún permiso de rol.
- La lista contiene solo los casos del tenant de la sesión. Un caso con el mismo código en otro tenant no cuenta, y las ejecuciones de otro tenant tampoco (se comprueba en el último Esquema).
- La respuesta 200 trae `items`, `total`, `totalRuns`, `totalAll`, `page`, `pageSize` y `pages`:
  - `total` es el número de casos que cumplen los filtros; `totalRuns`, el de ejecuciones de esos casos; `totalAll`, el de casos del tenant sin filtrar.
  - `pages` es el número de páginas y vale 1 aunque no haya casos.
- Cada elemento de `items` trae `code`, `programCode`, `programName`, `title`, `steps` (lista de pasos en texto), `expected`, `requirementCodes` (códigos de los requisitos enlazados, por orden de código), `runCount` (número de ejecuciones), `lastResult` (`pass`, `fail` o `blocked`, o `null` si nunca se ejecutó) y `lastRunAt` (fecha y hora ISO de la última ejecución, o `null`).
- La última ejecución de un caso es la de fecha más reciente; si dos tienen la misma fecha, la de id mayor.
- Sin parámetros, la respuesta es la página 1, con 10 casos ordenados por código ascendente.
- `pageSize` se acota a un valor entre 1 y 100; sin el parámetro vale 10.
- Una `page` que no es un número, o que es menor que 1, se trata como la página 1. Una `page` mayor que el número de páginas devuelve la última página, y el campo `page` de la respuesta indica esa última página.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` (`Gestor1234!`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken`. Para los otros roles se hace lo mismo con `consultor@sigpro.test` (`Consul1234!`) y `auditor@sigpro.test` (`Audit1234!`); para el rol admin, `admin@sigpro.test` (`Admin1234!`) completa el segundo factor con el código `123456` y usa el `accessToken` que recibe. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Preparación del Esquema de aislamiento: además, se reinicia el tenant `alumno02` con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`), y en `alumno01`, con el token de `alumno01@sigpro.lab`, se quita el enlace entre REQ-001 y TC-001 con `DELETE /api/requirements/REQ-001/tests/TC-001`. Esa petición solo prepara el estado; lo que se prueba es la lista de cada tenant.

## Criterios de aceptación
```gherkin
Característica: Lista paginada de casos de prueba por la API

  Esquema del escenario: Cada página trae sus casos en orden de código
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/test-cases?page=<pagina>
    Entonces la respuesta es 200 con <cuantos> casos, desde <primero> hasta <ultimo>
    Y trae total 25, totalAll 25, totalRuns 50, pageSize 10, pages 3 y page <page>

    Ejemplos:
      | pagina | cuantos | primero | ultimo | page |
      | 1 | 10 | TC-001 | TC-010 | 1 |
      | 2 | 10 | TC-011 | TC-020 | 2 |
      | 3 | 5 | TC-021 | TC-025 | 3 |

  Esquema del escenario: El tamaño de página se acota entre 1 y 100
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide <peticion>
    Entonces la respuesta es 200 con <cuantos> casos, pageSize <tamano_respuesta> y pages <paginas>

    Ejemplos:
      | peticion | cuantos | tamano_respuesta | paginas |
      | GET /api/test-cases | 10 | 10 | 3 |
      | GET /api/test-cases?pageSize=0 | 1 | 1 | 25 |
      | GET /api/test-cases?pageSize=100 | 25 | 100 | 1 |
      | GET /api/test-cases?pageSize=101 | 25 | 100 | 1 |
      | GET /api/test-cases?pageSize=1000 | 25 | 100 | 1 |

  Esquema del escenario: Una página no válida o fuera de rango no da error
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide <peticion>
    Entonces la respuesta es 200 con page <page> y el primer caso es <primero>

    Ejemplos:
      | peticion | page | primero |
      | GET /api/test-cases?page=0 | 1 | TC-001 |
      | GET /api/test-cases?page=abc | 1 | TC-001 |
      | GET /api/test-cases?page=4 | 3 | TC-021 |

  Esquema del escenario: Solo entrega la lista quien tiene una sesión válida
    Dado que en el tenant alumno01, recién reiniciado, la petición de la fila se hace con la credencial indicada
    Cuando pide GET /api/test-cases con <credencial>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera Authorization) | 401 missing_token |
      | (un texto que no es un token) | 401 invalid_token |
      | el accessToken de gestor@sigpro.test | 200 con total 25 |
      | el accessToken de consultor@sigpro.test | 200 con total 25 |
      | el accessToken de auditor@sigpro.test | 200 con total 25 |
      | el accessToken de admin@sigpro.test | 200 con total 25 |

  Esquema del escenario: Cada caso trae sus datos y el resumen de sus ejecuciones
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/test-cases?page=<pagina>
    Entonces el caso <codigo> de items trae programCode <programa>, title <titulo>, requirementCodes <requisitos>, runCount <ejecuciones>, lastResult <ultimo> y lastRunAt <ultima_fecha>

    Ejemplos:
      | pagina | codigo | programa | titulo | requisitos | ejecuciones | ultimo | ultima_fecha |
      | 1 | TC-001 | PRG-001 | Verificar disponibilidad (caso 001) | REQ-001, REQ-008 | 2 | blocked | 2026-02-05T09:00:00.000Z |
      | 1 | TC-002 | PRG-001 | Verificar latencia (caso 002) | REQ-002, REQ-009 | 3 | fail | 2026-02-08T09:00:00.000Z |
      | 1 | TC-009 | PRG-001 | Verificar disponibilidad (caso 009) | REQ-009 | 1 | blocked | 2026-02-21T09:00:00.000Z |
      | 3 | TC-024 | PRG-003 | Verificar autenticación (caso 024) | REQ-034 | 1 | blocked | 2026-03-23T09:00:00.000Z |

  Esquema del escenario: La lista solo trae los casos del tenant de la sesión
    Dado que en los tenants alumno01 y alumno02, recién reiniciados, en alumno01 se ha quitado el enlace entre REQ-001 y TC-001
    Cuando pide GET /api/test-cases con el accessToken de <cuenta> en el tenant <tenant>
    Entonces el caso TC-001 trae requirementCodes <requisitos> y la respuesta trae total 25

    Ejemplos:
      | tenant | cuenta | requisitos |
      | alumno01 | gestor@sigpro.test | REQ-008 |
      | alumno02 | alumno02@sigpro.lab | REQ-001, REQ-008 |
```

## Fuera de alcance
- Los filtros por código o título, programa y último resultado, y el orden por columna: la historia de filtros y orden de la API de EP-VER-CASOS.
- El detalle de un caso con sus pasos, sus requisitos y sus ejecuciones: la historia de detalle de la API de EP-VER-CASOS.
- Registrar una ejecución y las evidencias: EP-VER-EJECUCION.
- El informe PDF del plan de verificación: EP-VER-INFORME.
- Cómo se obtiene la sesión y el segundo factor: EP-LOGIN y EP-MFA.
