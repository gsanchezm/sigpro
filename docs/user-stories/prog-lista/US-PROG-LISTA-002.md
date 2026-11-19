---
id: US-PROG-LISTA-002
tipo: historia
epica: EP-PROG-LISTA
titulo: "[API] Filtrar la lista por estado, fechas, responsable y texto"
etiquetas: [api]
relacionadas: [US-PROG-LISTA-001, US-PROG-LISTA-003, US-PROG-LISTA-004, US-PROG-LISTA-008]
verificacion: codigo
cubre: ["GET /api/programs"]
---

## Historia
Como cliente de la API con una sesión iniciada en un tenant, quiero filtrar la lista de programas por estado, por fechas, por responsable y por texto,
para encontrar un programa concreto sin recorrer todas las páginas.

## Reglas
- Los filtros se combinan: un programa aparece solo si cumple todos los que se envían.
- `status` admite `draft`, `active`, `on_hold`, `closed` y `cancelled`. Cualquier otro valor se ignora: la lista sale sin filtro de estado.
- `from` filtra por la fecha de inicio: el programa cumple si su fecha de inicio es igual o posterior a `from`. `to` filtra por la fecha de fin: el programa cumple si su fecha de fin es igual o anterior a `to`. Los dos límites son inclusivos: el día indicado cuenta. Cada límite se compara solo con su fecha: `from` no mira la fecha de fin y `to` no mira la de inicio.
- `from` y `to` deben tener la forma YYYY-MM-DD. Una fecha con otra forma se ignora. Una fecha con esa forma pero que no existe (por ejemplo, con el mes 13) no tiene una regla escrita: ver «Decisiones pendientes».
- `owner` es el identificador de la persona responsable (por ejemplo `u1`). Un identificador que no existe no da error: la lista sale vacía.
- `q` busca en el código y en el nombre del programa, por parte del texto y sin distinguir mayúsculas de minúsculas. Los espacios del principio y del final no cuentan, y un `q` vacío no filtra.
- Una consulta sin coincidencias responde 200 con `items` vacío, `total` 0, `pages` 1 y `page` 1.
- `total` cuenta los programas que cumplen los filtros. `totalAll` no cambia con los filtros.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` (`Gestor1234!`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken`. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Filtros de la lista de programas por la API

  Esquema del escenario: El filtro de estado devuelve solo los programas de ese estado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?status=<estado>&pageSize=20
    Entonces la respuesta es 200 con total <total> y los programas <codigos>

    Ejemplos:
      | estado | total | codigos |
      | draft | 3 | PRG-003, PRG-011, PRG-019 |
      | closed | 3 | PRG-006, PRG-014, PRG-022 |

  Esquema del escenario: «Inicio desde» incluye el día indicado y mira solo la fecha de inicio
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?q=<texto>&from=<desde>
    Entonces la respuesta es 200 con total <total>

    Ejemplos:
      | texto | desde | total |
      | PRG-023 | 2025-03-20 | 1 |
      | PRG-023 | 2025-03-21 | 0 |
      | PRG-001 | 2024-01-01 | 0 |

  Esquema del escenario: «Fin hasta» incluye el día indicado y mira solo la fecha de fin
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?q=PRG-001&to=<hasta>
    Entonces la respuesta es 200 con total <total>

    Ejemplos:
      | hasta | total |
      | 2024-06-30 | 0 |
      | 2024-07-01 | 1 |

  Esquema del escenario: El filtro de responsable devuelve los programas de esa persona
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?owner=<responsable>
    Entonces la respuesta es 200 con total <total> y los programas <codigos>

    Ejemplos:
      | responsable | total | codigos |
      | u1 | 4 | PRG-001, PRG-007, PRG-013, PRG-019 |
      | u7 | 0 | (ninguno) |

  Esquema del escenario: La búsqueda compara código y nombre sin distinguir mayúsculas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?q=<texto>
    Entonces la respuesta es 200 con total <total> y los programas <codigos>

    Ejemplos:
      | texto | total | codigos |
      | radar | 1 | PRG-002 |
      | RADAR | 1 | PRG-002 |
      | control | 2 | PRG-005, PRG-015 |
      | PRG-01 | 10 | PRG-010 a PRG-019 |
      | zzzz-no-existe | 0 | (ninguno) |

  Esquema del escenario: Un valor no válido se descarta sin error
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?<parametro>
    Entonces la respuesta es 200 con total 24

    Ejemplos:
      | parametro |
      | status=activo |
      | to=2024/07/01 |

  Esquema del escenario: Los filtros se combinan entre sí
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs?status=<estado>&owner=<responsable>
    Entonces la respuesta es 200 con total <total> y los programas <codigos>

    Ejemplos:
      | estado | responsable | total | codigos |
      | active | u1 | 3 | PRG-001, PRG-007, PRG-013 |```

## Decisiones pendientes
- Si la búsqueda debe ignorar las tildes: hoy «movil» no encuentra «Torre de control móvil TCM».
- Si un `from` posterior a `to` debe responder un error o una lista vacía: hoy responde 200 con la lista vacía.
- Si una fecha con la forma correcta pero que no existe (por ejemplo, con el mes 13) debe ignorarse o responder un error: hoy el filtro la acepta sin una regla escrita.
- Si el contador de programas activos debe contar solo los que cumplen también el filtro de estado, como dice su descripción en el contrato. Hoy cuenta los activos que cumplen los demás filtros e ignora el de estado, y la cifra de activos de la cabecera de la lista depende de ese cálculo.

## Fuera de alcance
- El orden por columna y su sentido: EP-PROG-LISTA, en la historia de orden de la API.
- La paginación y el número de páginas: EP-PROG-LISTA, en la historia de listado paginado de la API.
- La exportación a CSV con los mismos filtros: EP-PROG-GESTION.
- Las tarjetas de métricas de la cabecera: EP-PROG-METRICAS.
