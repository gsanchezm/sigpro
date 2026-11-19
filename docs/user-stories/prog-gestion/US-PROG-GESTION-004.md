---
id: US-PROG-GESTION-004
tipo: historia
epica: EP-PROG-GESTION
titulo: "[API] Exportar los programas a CSV con los filtros y el orden de la lista"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-PROG-LISTA-001, US-PROG-LISTA-002, US-PROG-LISTA-003, US-PROG-GESTION-009]
verificacion: ejecutada
cubre: ["GET /api/programs/export"]
permisos: [program.export]
---

## Historia
Como cliente de la API o persona que prepara un informe de programas con una sesión iniciada en un tenant, quiero descargar en CSV los programas con los mismos filtros y el mismo orden que la lista,
para trabajar con ellos en una hoja de cálculo sin tener que paginar.

## Reglas
- `GET /api/programs/export` exige sesión: sin cabecera `Authorization` responde 401 `missing_token`; con un texto que no es un token válido, 401 `invalid_token`.
- El permiso `program.export` lo tienen los cuatro roles: administrador, gestor, consultor y auditor reciben el archivo.
- La respuesta 200 es de tipo `text/csv`, codificada en UTF-8, con `Content-Disposition: attachment; filename="sigpro-programas.csv"`.
- El separador es `;`. La primera línea es la cabecera `code;name;status;owner;start;end;budget;progress`. Cada programa ocupa una línea, separadas por un salto de línea, y el archivo no termina con una línea vacía.
- `name` y `owner` van siempre entre comillas dobles; las comillas dobles dentro del nombre se escriben duplicadas. `code`, `status`, `start`, `end`, `budget` y `progress` van sin comillas.
- `status` es el código del estado (`draft`, `active`, `on_hold`, `closed` o `cancelled`), no su texto. `owner` es el nombre del responsable. `start` y `end` van en formato AAAA-MM-DD. `budget` son los euros como número, sin separadores ni símbolo. `progress` es el porcentaje entero, sin el signo %.
- El archivo contiene los programas que cumplen los parámetros de la lista (`q`, `status`, `from`, `to` y `owner`), con las mismas reglas: un valor no válido se ignora, y las fechas `from` y `to` incluyen sus dos límites.
- El archivo trae todos los programas que cumplen, sin paginar: `page` y `pageSize` no cambian su contenido.
- Las líneas siguen el orden de `sort` y `dir`; sin ellos, el orden es por código ascendente.
- Si ningún programa cumple los parámetros, el archivo tiene solo la cabecera.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la fila obtiene el `accessToken` de la cuenta de su ejemplo con `POST /api/auth/login`: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o, para el rol admin, `admin@sigpro.test` (`Admin1234!`), que completa el segundo factor con el código `123456` (`POST /api/auth/mfa`) y usa el `accessToken` que recibe. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Exportar los programas a CSV por la API

  Esquema del escenario: El archivo tiene una cabecera y una línea por programa con sus campos
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene un accessToken
    Cuando pide GET /api/programs/export
    Entonces la respuesta es 200 de tipo text/csv en UTF-8 con el nombre de archivo sigpro-programas.csv
    Y el archivo tiene 25 líneas
    Y la primera línea es code;name;status;owner;start;end;budget;progress
    Y la línea de PRG-001 es PRG-001;"Sistema de mando táctico Ártemis";active;"Marta Ruiz";2023-01-01;2024-07-01;450000;11

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |

  Esquema del escenario: El archivo contiene solo los programas que cumplen los parámetros
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs/export?<parametros>
    Entonces el archivo tiene <lineas> líneas
    Y la primera línea de programas es <primero>

    Ejemplos:
      | parametros | lineas | primero |
      | status=on_hold | 4 | PRG-004 |
      | q=PRG-001&to=2024-07-01 | 2 | PRG-001 |
      | q=PRG-001&to=2024-06-30 | 1 | (ninguno) |
      | sort=code&dir=desc | 25 | PRG-024 |
      | page=3&pageSize=10 | 25 | PRG-001 |
      | status=inventado | 25 | PRG-001 |

  Esquema del escenario: Cualquier rol con sesión descarga el archivo y sin sesión no hay archivo
    Dado que en el tenant alumno01, recién reiniciado, la petición de la fila se hace con la credencial indicada
    Cuando pide GET /api/programs/export con <credencial>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | respuesta |
      | el accessToken de gestor@sigpro.test | 200 con 25 líneas |
      | el accessToken de consultor@sigpro.test | 200 con 25 líneas |
      | el accessToken de auditor@sigpro.test | 200 con 25 líneas |
      | (sin cabecera Authorization) | 401 missing_token |
      | (un texto que no es un token) | 401 invalid_token |

  Esquema del escenario: Un nombre con comillas dobles se escribe con las comillas duplicadas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha creado con POST /api/programs el programa Radar "RVC" de prueba, con responsable Marta Ruiz (u1), estado draft, del 2030-01-01 al 2030-12-31, presupuesto 100000, prioridad low y sin clasificar
    Cuando pide GET /api/programs/export?<parametros>
    Entonces la línea del programa es <linea>

    Ejemplos:
      | parametros | linea |
      | q=PRG-025 | PRG-025;"Radar ""RVC"" de prueba";draft;"Marta Ruiz";2030-01-01;2030-12-31;100000;0 |
```

## Fuera de alcance
- Descargar el CSV desde la lista de la web y desde la de la app móvil, y la selección exportada: historias web y móvil de EP-PROG-GESTION.
- Los filtros y el orden de la lista en sí: EP-PROG-LISTA.
- Importar programas desde un CSV: no forma parte de esta épica.
- Cómo se llega a la lista con una sesión iniciada: EP-LOGIN.
