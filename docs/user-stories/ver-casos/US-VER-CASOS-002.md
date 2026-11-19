---
id: US-VER-CASOS-002
tipo: historia
epica: EP-VER-CASOS
titulo: "[API] Filtrar y ordenar la lista de casos de prueba"
etiquetas: [api]
relacionadas: [US-VER-CASOS-001, US-VER-CASOS-005, US-VER-CASOS-008]
verificacion: codigo
cubre: ["GET /api/test-cases"]
---

## Historia
Como cliente de la API con una sesión iniciada en un tenant, quiero filtrar la lista de casos por texto, por programa y por último resultado, y ordenarla por columna,
para encontrar un caso concreto o ver solo los que fallan sin recorrer todos los casos.

## Reglas
- Además de la página y el tamaño de página de la lista, `GET /api/test-cases` acepta `q` (texto), `program` (código de programa), `result` (`pass`, `fail`, `blocked` o `none`), `sort` (`code`, `title`, `program`, `result` o `runs`) y `dir` (`asc` o `desc`).
- `q` se recorta de los espacios del principio y del final; si no queda nada, no filtra. Busca el texto en el código y en el título, sin distinguir mayúsculas y minúsculas: basta con que aparezca en uno de los dos.
- `program` deja solo los casos de ese programa. Un código de programa que no tiene casos responde 200 con `total` 0 y sin casos.
- `result` deja solo los casos cuyo último resultado es ese. `none` deja los casos que nunca se han ejecutado.
- Los filtros se combinan: un caso debe cumplirlos todos.
- Un valor no válido en `result`, `sort` o `dir` no da error: se ignora y la lista se calcula sin ese parámetro. Un `dir` válido sigue aplicándose aunque `sort` no lo sea. Sin `sort` la lista se ordena por código.
- Criterio de cada orden: `code`, por código; `title`, por título en orden alfabético en español; `program`, por código de programa; `result`, con los fallidos primero, después los bloqueados, después los superados y al final los casos sin ejecutar; `runs`, por número de ejecuciones.
- Con `dir=desc` se invierte el criterio de la columna. Los empates se ordenan siempre por código ascendente, también con `dir=desc`.
- `total`, `totalRuns` y `pages` se calculan sobre la lista ya filtrada, y la página se cuenta sobre ella. `totalAll` no cambia con los filtros.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` (`Gestor1234!`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken`. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Filtros y orden de la lista de casos de prueba por la API

  Esquema del escenario: El texto busca en el código y en el título sin distinguir mayúsculas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/test-cases?q=<texto>
    Entonces la respuesta es 200 con total <total> y los códigos <codigos>

    Ejemplos:
      | texto | total | codigos |
      | cifrado | 3 | TC-003, TC-011, TC-019 |
      | tc-025 | 1 | TC-025 |
      | Autenticación | 3 | TC-008, TC-016, TC-024 |
      | zzz | 0 | (ninguno) |

  Esquema del escenario: El programa y el último resultado filtran la lista y se combinan
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/test-cases?<filtro>
    Entonces la respuesta es 200 con total <total>, totalRuns <ejecuciones> y los códigos <codigos>

    Ejemplos:
      | filtro | total | ejecuciones | codigos |
      | program=PRG-003 | 7 | 14 | TC-019, TC-020, TC-021, TC-022, TC-023, TC-024, TC-025 |
      | program=PRG-999 | 0 | 0 | (ninguno) |
      | result=fail | 5 | 10 | TC-002, TC-006, TC-013, TC-017, TC-021 |
      | result=blocked | 6 | 12 | TC-001, TC-005, TC-009, TC-016, TC-020, TC-024 |
      | result=pass | 14 | 28 | TC-003, TC-004, TC-007, TC-008, TC-010, TC-011, TC-012, TC-014, TC-015, TC-018 |
      | result=none | 0 | 0 | (ninguno) |
      | program=PRG-001&result=blocked | 3 | 6 | TC-001, TC-005, TC-009 |

  Esquema del escenario: Un valor no válido en el filtro o en el orden se ignora
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/test-cases?<parametro>
    Entonces la respuesta es 200 con total 25 y el primer caso es <primero>

    Ejemplos:
      | parametro | primero |
      | result=superado | TC-001 |
      | sort=fecha | TC-001 |
      | dir=arriba | TC-001 |
      | sort=fecha&dir=desc | TC-025 |

  Esquema del escenario: Cada orden coloca sus primeros casos en el orden que le corresponde
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/test-cases?<orden>
    Entonces los diez primeros códigos son <codigos>

    Ejemplos:
      | orden | codigos |
      | dir=desc | TC-025, TC-024, TC-023, TC-022, TC-021, TC-020, TC-019, TC-018, TC-017, TC-016 |
      | sort=program&dir=desc | TC-019, TC-020, TC-021, TC-022, TC-023, TC-024, TC-025, TC-010, TC-011, TC-012 |
      | sort=title | TC-008, TC-016, TC-024, TC-003, TC-011, TC-019, TC-001, TC-009, TC-017, TC-025 |
      | sort=result | TC-002, TC-006, TC-013, TC-017, TC-021, TC-001, TC-005, TC-009, TC-016, TC-020 |
      | sort=result&dir=desc | TC-003, TC-004, TC-007, TC-008, TC-010, TC-011, TC-012, TC-014, TC-015, TC-018 |
      | sort=runs&dir=desc | TC-002, TC-005, TC-008, TC-011, TC-014, TC-017, TC-020, TC-023, TC-001, TC-004 |

  Esquema del escenario: El orden se mantiene al pasar de página
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide <peticion>
    Entonces la respuesta es 200 con page 2 y los casos de la página son <codigos>

    Ejemplos:
      | peticion | codigos |
      | GET /api/test-cases?sort=result&page=2 | TC-024, TC-003, TC-004, TC-007, TC-008, TC-010, TC-011, TC-012, TC-014, TC-015 |
      | GET /api/test-cases?sort=runs&dir=desc&page=2 | TC-007, TC-010, TC-013, TC-016, TC-019, TC-022, TC-025, TC-003, TC-006, TC-009 |
```

## Fuera de alcance
- La forma de la respuesta, el tamaño de página y el acceso con sesión: primera historia de la API de EP-VER-CASOS.
- El detalle de un caso y su 404: la historia de detalle de la API de EP-VER-CASOS.
- Los filtros y el orden en la pantalla web y en la app móvil: las historias de lista de EP-VER-CASOS.

## Decisiones pendientes
- Si la búsqueda debe ignorar las tildes. Hoy el texto se compara sin distinguir mayúsculas, pero con las tildes, así que `q=autenticacion` no encuentra «Autenticación».
- Si un código de programa que no existe debe tratarse como un valor no válido, es decir, ignorarse como `result`, `sort` o `dir`, en lugar de dar un total de 0. Hoy da 0.
