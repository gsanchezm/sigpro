---
id: US-PROG-LISTA-003
tipo: historia
epica: EP-PROG-LISTA
titulo: "[API] Ordenar la lista por columna y mantener el orden entre páginas"
etiquetas: [api]
relacionadas: [US-PROG-LISTA-001, US-PROG-LISTA-002, US-PROG-LISTA-005]
verificacion: ejecutada
cubre: ["GET /api/programs"]
---

## Historia
Como cliente de la API, quiero pedir la lista ordenada por una columna y en un sentido,
para comparar programas por fecha, por responsable o por presupuesto, y que cada página siga ese mismo orden.

## Reglas
- `sort` admite `code`, `name`, `status`, `owner`, `dates` y `budget`; `dir` admite `asc` y `desc`. Sin `sort`, o con un valor que no existe, la columna es `code`. Sin `dir`, o con un valor que no existe, el sentido es ascendente.
- `dates` ordena por la fecha de inicio. `owner` ordena por el nombre de la persona responsable. `budget` ordena por `budgetEur`.
- Cuando dos programas empatan en la columna pedida, van por código ascendente, también con `dir=desc`.
- El orden pedido se mantiene en todas las páginas: la página 2 continúa el orden de la página 1 y no vuelve al orden por código.
- En el seed de demostración, PRG-001 y PRG-024 tienen el mismo presupuesto (450 000 €), así que con `sort=budget&dir=desc` va antes PRG-001 por tener el código menor.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` (`Gestor1234!`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken`. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Orden de la lista de programas por la API

  Esquema del escenario: Ordenar por presupuesto descendente se mantiene en cada página
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?sort=budget&dir=desc&page=<pagina>
    Entonces la respuesta es 200 con los programas de la página <codigos>

    Ejemplos:
      | pagina | codigos |
      | 1 | PRG-014, PRG-004, PRG-017, PRG-007, PRG-020, PRG-010, PRG-023, PRG-013, PRG-003, PRG-016 |
      | 2 | PRG-006, PRG-019, PRG-009, PRG-022, PRG-012, PRG-002, PRG-015, PRG-005, PRG-018, PRG-008 |
      | 3 | PRG-021, PRG-011, PRG-001, PRG-024 |

  Esquema del escenario: Ordenar por código descendente se mantiene en las páginas siguientes
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?sort=code&dir=desc&page=<pagina>
    Entonces la respuesta es 200 con los programas de la página <codigos>

    Ejemplos:
      | pagina | codigos |
      | 2 | PRG-014, PRG-013, PRG-012, PRG-011, PRG-010, PRG-009, PRG-008, PRG-007, PRG-006, PRG-005 |
      | 3 | PRG-004, PRG-003, PRG-002, PRG-001 |

  Esquema del escenario: Ordenar por fecha usa la fecha de inicio
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?sort=dates&dir=asc&page=<pagina>
    Entonces la respuesta es 200 con los programas de la página <codigos>

    Ejemplos:
      | pagina | codigos |
      | 1 | PRG-001, PRG-006, PRG-004, PRG-009, PRG-002, PRG-007, PRG-005, PRG-003, PRG-008, PRG-013 |

  Esquema del escenario: Ordenar por responsable en sentido descendente agrupa por persona y desempata por código
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?sort=owner&dir=desc
    Entonces la respuesta es 200 con los programas de la primera página <codigos>

    Ejemplos:
      | codigos |
      | PRG-006, PRG-012, PRG-018, PRG-024, PRG-001, PRG-007, PRG-013, PRG-019, PRG-003, PRG-009 |

  Esquema del escenario: Una columna o un sentido que no existen usan el orden por defecto
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?<consulta>
    Entonces la respuesta es 200 y los tres primeros programas son <primeros>

    Ejemplos:
      | consulta | primeros |
      | sort=inventado | PRG-001, PRG-002, PRG-003 |
      | sort=budget&dir=lateral | PRG-001, PRG-024, PRG-011 |
```

## Decisiones pendientes
- Ordenar por estado sigue el orden en que el estado está declarado en la base de datos (Borrador, Activo, En pausa, Cerrado, Cancelado) y no el alfabético por etiqueta. No está decidido si debe ser ese el orden.

## Fuera de alcance
- La cabecera de columnas de la tabla de la web y su flecha de sentido: EP-PROG-LISTA, en la historia de la tabla de la web.
- Los filtros que se aplican antes de ordenar: EP-PROG-LISTA, en la historia de filtros de la API.
- El número de página y el total de páginas: EP-PROG-LISTA, en la historia de listado paginado de la API.
