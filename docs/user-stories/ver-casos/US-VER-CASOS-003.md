---
id: US-VER-CASOS-003
tipo: historia
epica: EP-VER-CASOS
titulo: "[API] Consultar el detalle de un caso de prueba y su 404"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-VER-CASOS-001, US-VER-CASOS-002, US-VER-CASOS-006, US-VER-CASOS-009]
verificacion: ejecutada
cubre: ["GET /api/test-cases/:code"]
---

## Historia
Como cliente de la API con una sesión iniciada en un tenant, quiero pedir un caso de prueba por su código y recibir sus pasos, su resultado esperado, sus requisitos enlazados y todas sus ejecuciones,
para mostrar la ficha de un caso sin recorrer la lista y saber con certeza cuándo un código no existe en mi tenant.

## Reglas
- `GET /api/test-cases/:code` exige sesión igual que la lista: sin cabecera `Authorization` responde 401 `missing_token`; con un texto que no es un token válido, 401 `invalid_token`. No exige ningún permiso de rol.
- La respuesta 200 trae los campos del caso de la lista (`code`, `programCode`, `programName`, `title`, `steps`, `expected`, `requirementCodes`, `runCount`, `lastResult` y `lastRunAt`) y, además:
  - `requirements`: los requisitos enlazados, cada uno con `code` y `title`, por orden de código.
  - `runs`: todas las ejecuciones del caso, de la más reciente a la más antigua; si dos tienen la misma fecha, primero la de id mayor.
- Los pasos se devuelven en el orden en que están guardados.
- Cada ejecución trae `id`, `testCaseCode`, `executedAt` (fecha y hora ISO), `result`, `notes`, `executedById`, `executedByName` (nombre de quien la registró, o `null` si esa cuenta ya no existe) y `evidences`: una lista, vacía si no hay evidencias, con `id`, `filename`, `mimeType`, `size` y `url` de cada evidencia. Descargar una evidencia es de EP-VER-EJECUCION.
- Un código que no existe en el tenant de la sesión responde 404 con `code` `test_case_not_found`. Los códigos se comparan tal cual: `tc-001` en minúsculas no existe.
- El detalle usa solo el tenant de la sesión: el mismo código en otro tenant no muestra sus datos.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` (`Gestor1234!`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken`. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Preparación del Esquema de aislamiento: se reinicia también `alumno02` con el token de `alumno02@sigpro.lab`, y en `alumno01`, con el token de `alumno01@sigpro.lab`, se quita el enlace entre REQ-001 y TC-001 con `DELETE /api/requirements/REQ-001/tests/TC-001`. Esa petición solo prepara el estado.

## Criterios de aceptación
```gherkin
Característica: Detalle de un caso de prueba por la API

  Esquema del escenario: El detalle trae los datos del caso y sus requisitos enlazados
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/test-cases/<codigo>
    Entonces la respuesta es 200 con programCode <programa>, title <titulo>, requirementCodes <requisitos> y runs con <ejecuciones> elementos
    Y steps son «Preparar el entorno de pruebas», «Ejecutar el escenario nominal» y «Registrar las mediciones», en ese orden, y expected es «Los valores medidos cumplen el umbral definido en el requisito.»

    Ejemplos:
      | codigo | programa | titulo | requisitos | ejecuciones |
      | TC-001 | PRG-001 | Verificar disponibilidad (caso 001) | REQ-001, REQ-008 | 2 |
      | TC-010 | PRG-002 | Verificar latencia (caso 010) | REQ-015, REQ-022 | 2 |
      | TC-024 | PRG-003 | Verificar autenticación (caso 024) | REQ-034 | 1 |

  Esquema del escenario: Cada ejecución trae su fecha, su resultado, sus notas, su evidencia y quién la registró
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/test-cases/TC-001
    Entonces la ejecución en la posición <posicion> es <ejecucion>, con result <resultado>, executedAt <fecha>, notes <notas> y <evidencias>
    Y executedByName es «Lucía Fernández»

    Ejemplos:
      | posicion | ejecucion | resultado | fecha | notas | evidencias |
      | 1 | RUN-002 | blocked | 2026-02-05T09:00:00.000Z | «Ejecución bloqueada: el entorno de pruebas no estaba disponible.» | evidences vacío |
      | 2 | RUN-001 | pass | 2026-02-04T09:00:00.000Z | «Resultado conforme con el criterio de aceptación.» | una evidencia EV-001, de nombre TC-001-001.png y tipo image/png |

  Esquema del escenario: Un código que no existe en el tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/test-cases/<codigo>
    Entonces la respuesta es 404 con code test_case_not_found y no trae ningún caso

    Ejemplos:
      | codigo |
      | TC-000 |
      | TC-026 |
      | tc-001 |

  Esquema del escenario: Sin una sesión válida no hay detalle
    Dado que en el tenant alumno01, recién reiniciado, la petición de la fila se hace con la credencial indicada
    Cuando pide GET /api/test-cases/TC-001 con <credencial>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera Authorization) | 401 missing_token |
      | (un texto que no es un token) | 401 invalid_token |

  Esquema del escenario: El detalle solo muestra los requisitos del tenant de la sesión
    Dado que en los tenants alumno01 y alumno02, recién reiniciados, en alumno01 se ha quitado el enlace entre REQ-001 y TC-001
    Cuando pide GET /api/test-cases/TC-001 con el accessToken de <cuenta> en el tenant <tenant>
    Entonces el caso trae requirements con los códigos <requisitos>

    Ejemplos:
      | tenant | cuenta | requisitos |
      | alumno01 | gestor@sigpro.test | REQ-008 |
      | alumno02 | alumno02@sigpro.lab | REQ-001, REQ-008 |
```

## Fuera de alcance
- La lista de casos, sus totales y su paginación: la primera historia de la API de EP-VER-CASOS.
- Los filtros y el orden de la lista: la segunda historia de la API de EP-VER-CASOS.
- Descargar una evidencia (`GET /api/evidence/:id`) y registrar una ejecución (`POST /api/test-cases/:code/runs`): EP-VER-EJECUCION.
- El informe PDF de verificación (`GET /api/verification/report`): EP-VER-INFORME.
- Enlazar o quitar un caso desde un requisito (`PUT` y `DELETE` de `/api/requirements/:code/tests/:testCaseCode`): EP-REQ-TRAZA. En esta historia solo se usa `DELETE` para preparar el estado.
