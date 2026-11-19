---
id: US-PROG-LISTA-001
tipo: historia
epica: EP-PROG-LISTA
titulo: "[API] Listar los programas en páginas de 10 con su total y su forma"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-PROG-LISTA-002, US-PROG-LISTA-003, US-PROG-LISTA-008]
verificacion: codigo
cubre: ["GET /api/programs"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con una sesión iniciada en un tenant, quiero pedir la lista de programas por páginas de 10,
para mostrar cada página sin traer todos los programas de una vez y saber cuántas páginas hay.

## Reglas
- `GET /api/programs` exige sesión: el `accessToken` va en la cabecera `Authorization` como Bearer. Sin esa cabecera responde 401 `missing_token`; con un texto que no es un token válido responde 401 `invalid_token`.
- Cualquier rol con sesión (admin, program_manager, consultant y auditor) recibe la lista: la petición no exige ningún permiso de rol.
- La lista contiene solo los programas del tenant de la sesión.
- La respuesta 200 trae `items`, `total`, `totalAll`, `activeCount`, `page`, `pageSize` y `pages`. Cada elemento de `items` trae `code`, `name`, `description`, `status`, `priority`, `classified`, `ownerId`, `ownerName`, `startDate` y `endDate` (en formato YYYY-MM-DD), `budgetEur`, `progress`, `milestonesDone` y `milestonesTotal`.
- `progress` es el porcentaje entero de hitos cumplidos sobre el total de hitos del programa; sin hitos vale 0.
- Sin parámetros, la respuesta es la página 1, con 10 programas ordenados por código ascendente.
- `pageSize` se acota a un valor entre 1 y 100; sin el parámetro vale 10.
- Una `page` que no es un número, o que es menor que 1, se trata como la página 1. Una `page` mayor que el número de páginas devuelve la última página, y el campo `page` de la respuesta indica esa última página.
- Un valor no válido en cualquier parámetro de la lista (un estado que no existe, una fecha con otra forma, una columna de orden que no existe) no da error: se descarta y la lista se calcula sin ese parámetro.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` (`Gestor1234!`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken`. Para los otros roles se hace lo mismo con `consultor@sigpro.test` (`Consul1234!`) y `auditor@sigpro.test` (`Audit1234!`); para el rol admin, `admin@sigpro.test` (`Admin1234!`) completa el segundo factor con el código `123456` y usa el `accessToken` que recibe. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Lista paginada de programas por la API

  Esquema del escenario: Cada página trae sus programas en orden de código
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?page=<pagina>
    Entonces la respuesta es 200 con <cuantos> programas, desde <primero> hasta <ultimo>
    Y trae total 24, totalAll 24, activeCount 12, pageSize 10, pages 3 y page <page>

    Ejemplos:
      | pagina | cuantos | primero | ultimo | page |
      | 1 | 10 | PRG-001 | PRG-010 | 1 |
      | 2 | 10 | PRG-011 | PRG-020 | 2 |
      | 3 | 4 | PRG-021 | PRG-024 | 3 |

  Esquema del escenario: El tamaño de página se acota entre 1 y 100
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?pageSize=<tamano>
    Entonces la respuesta es 200 con <cuantos> programas, pageSize <tamano_respuesta> y pages <paginas>

    Ejemplos:
      | tamano | cuantos | tamano_respuesta | paginas |
      | 1000 | 24 | 100 | 1 |

  Esquema del escenario: Una página no válida o fuera de rango no da error
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?page=<pagina>
    Entonces la respuesta es 200 con page <page> y el primer programa es <primero>

    Ejemplos:
      | pagina | page | primero |
      | 0 | 1 | PRG-001 |
      | 99 | 3 | PRG-021 |

  Esquema del escenario: Solo entrega la lista quien tiene una sesión válida
    Dado que en el tenant alumno01, recién reiniciado, la petición de la fila se hace con la credencial indicada
    Cuando pide GET /api/programs con <credencial>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera Authorization) | 401 missing_token |
      | (un texto que no es un token) | 401 invalid_token |
      | el accessToken de gestor@sigpro.test | 200 con total 24 |
      | el accessToken de consultor@sigpro.test | 200 con total 24 |
      | el accessToken de auditor@sigpro.test | 200 con total 24 |
      | el accessToken de admin@sigpro.test | 200 con total 24 |

  Esquema del escenario: El primer programa trae sus datos completos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs
    Entonces el primer elemento de items tiene code <codigo>, name <nombre>, status <estado>, ownerName <responsable>, startDate <inicio>, endDate <fin>, budgetEur <presupuesto> y progress <avance>, con milestonesDone <hechos> y milestonesTotal <hitos>

    Ejemplos:
      | codigo | nombre | estado | responsable | inicio | fin | presupuesto | avance | hechos | hitos |
      | PRG-001 | Sistema de mando táctico Ártemis | active | Marta Ruiz | 2023-01-01 | 2024-07-01 | 450000 | 11 | 1 | 9 |
```

## Fuera de alcance
- Los filtros por estado, fechas, responsable y texto: EP-PROG-LISTA, en la historia de filtros de la API.
- El orden por columna y su sentido: EP-PROG-LISTA, en la historia de orden de la API.
- La exportación a CSV con los mismos parámetros: EP-PROG-GESTION.
- El detalle de un programa: EP-PROG-DETALLE.
