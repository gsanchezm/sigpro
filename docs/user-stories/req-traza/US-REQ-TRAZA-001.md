---
id: US-REQ-TRAZA-001
tipo: historia
epica: EP-REQ-TRAZA
titulo: "[API] Consultar la matriz de trazabilidad de un programa"
etiquetas: [api]
relacionadas: [US-REQ-TRAZA-005]
verificacion: ejecutada
cubre: ["GET /api/programs/:code/traceability"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con una sesión de acceso, quiero pedir la matriz de trazabilidad de un programa,
para ver de una vez qué requisitos y qué casos de prueba tiene el programa, qué casos verifican cada requisito y qué resultado tuvo la última ejecución de cada caso.

## Reglas
- `GET /api/programs/:code/traceability` exige un `accessToken` válido en `Authorization: Bearer`. Sin cabecera `Authorization` responde 401 con `code` `missing_token`. Con un token que no es un `accessToken` (un texto que no es un JWT, un `refreshToken` o un `mfaToken`) responde 401 con `code` `invalid_token`. Ninguna de estas respuestas trae datos del programa.
- Ningún permiso restringe la lectura: `admin`, `program_manager`, `consultant` y `auditor` reciben la misma respuesta.
- Con un `accessToken` válido y un programa del tenant responde 200 con tres listas, y solo con estas: `requirements`, `testCases` y `links`.
- `requirements` lista todos los requisitos del programa, en cualquier estado, ordenados por `code`. Cada elemento trae `code`, `title` y `state`.
- `testCases` lista todos los casos de prueba del programa, estén enlazados o no, ordenados por `code`. Cada elemento trae `code`, `title` y `lastResult`.
- `lastResult` es el resultado de la ejecución más reciente del caso (la de fecha de ejecución más tardía): `pass`, `fail` o `blocked`. Vale `null` si el caso nunca se ha ejecutado. En el seed todos los casos tienen al menos una ejecución y la API no ofrece ninguna forma de crear un caso, así que en un tenant recién reiniciado no aparece `null`.
- `links` lista los enlaces entre un requisito y un caso del programa, ordenados por `requirementCode` y, dentro de cada requisito, por `testCaseCode`. Cada elemento trae `requirementCode` y `testCaseCode`. Un requisito sin casos enlazados no aparece en `links`.
- Un programa sin requisitos ni casos de prueba responde 200 con las tres listas vacías.
- Un programa que no existe en el tenant del token responde 404 con `code` y `message` iguales a `program_not_found`, y sin ninguna lista.
- La cabecera `x-tenant` no cambia el tenant de la petición, que es el del token.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la cuenta de la fila inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken` como `Authorization: Bearer`. Las cuentas son `gestor@sigpro.test` (`Gestor1234!`, rol `program_manager`), `consultor@sigpro.test` (`Consul1234!`, rol `consultant`), `auditor@sigpro.test` (`Audit1234!`, rol `auditor`) y `alumno01@sigpro.lab` (`Alumno1234!`, rol `admin`, sin segundo factor).
- Preparación de las filas de aislamiento: se reinicia también el tenant `alumno02` con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`). Después `alumno02@sigpro.lab` inicia sesión con la cabecera `x-tenant: alumno02` y crea con `POST /api/requirements` un requisito de `PRG-001` con el título «Requisito de aislamiento»; recibe el código `REQ-041`, el siguiente a los 40 del seed. En `alumno01`, `REQ-041` no existe. En la fila de enlaces, `gestor@sigpro.test` envía además `PUT /api/requirements/REQ-028/tests/TC-010` en `alumno01` (respuesta 204) antes de la consulta.
- Tras un reinicio, `PRG-002` tiene 14 requisitos (de `REQ-015` a `REQ-028`) y 9 casos (de `TC-010` a `TC-018`). Sus 15 enlaces son: `REQ-015` con `TC-010`; `REQ-016` con `TC-011`; `REQ-017` con `TC-012`; `REQ-018` con `TC-013`; `REQ-019` con `TC-014`; `REQ-020` con `TC-015`; `REQ-021` con `TC-016`; `REQ-022` con `TC-010` y con `TC-017`; `REQ-023` con `TC-011` y con `TC-018`; `REQ-024` con `TC-012`; `REQ-025` con `TC-013`; `REQ-026` con `TC-014`; `REQ-027` con `TC-015`. `REQ-028` no tiene ningún caso enlazado.
- Tras un reinicio, el último resultado de los casos de `PRG-002` es: `TC-010`, `TC-011`, `TC-012`, `TC-014`, `TC-015` y `TC-018` en `pass`; `TC-013` y `TC-017` en `fail`; `TC-016` en `blocked`.
- Tras un reinicio, `PRG-001` tiene 14 requisitos (de `REQ-001` a `REQ-014`) y 9 casos (de `TC-001` a `TC-009`); `PRG-003` tiene 12 requisitos (de `REQ-029` a `REQ-040`) y 7 casos (de `TC-019` a `TC-025`).

## Criterios de aceptación
```gherkin
Característica: Matriz de trazabilidad de un programa por la API

  Esquema del escenario: La matriz trae los requisitos y los casos del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/<programa>/traceability con ese accessToken como Bearer
    Entonces la respuesta es 200
    Y requirements contiene <requisitos>
    Y testCases contiene <casos>

    Ejemplos:
      | programa | requisitos | casos |
      | PRG-001 | 14 elementos, de REQ-001 a REQ-014 | 9 elementos, de TC-001 a TC-009 |
      | PRG-002 | 14 elementos, de REQ-015 a REQ-028 | 9 elementos, de TC-010 a TC-018 |
      | PRG-003 | 12 elementos, de REQ-029 a REQ-040 | 7 elementos, de TC-019 a TC-025 |
      | PRG-004 | (ninguno) | (ninguno) |
      | PRG-024 | (ninguno) | (ninguno) |

  Esquema del escenario: Cada elemento de la matriz trae solo sus campos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-002/traceability con ese accessToken como Bearer
    Entonces cada elemento de <lista> trae exactamente los campos <campos>

    Ejemplos:
      | lista | campos |
      | requirements | code, title y state |
      | testCases | code, title y lastResult |
      | links | requirementCode y testCaseCode |

  Esquema del escenario: El último resultado de un caso es el de su ejecución más reciente
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-002/traceability con ese accessToken como Bearer
    Entonces el caso <caso> tiene lastResult <resultado>

    Ejemplos:
      | caso | resultado |
      | TC-010 | pass |
      | TC-012 | pass |
      | TC-013 | fail |
      | TC-016 | blocked |
      | TC-017 | fail |
      | TC-018 | pass |

  Esquema del escenario: Los enlaces salen ordenados por requisito y por caso
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-002/traceability con ese accessToken como Bearer
    Entonces en links, el requisito <requisito> aparece con <casos>, en ese orden
    Y ningún enlace relaciona un requisito o un caso de otro programa

    Ejemplos:
      | requisito | casos |
      | REQ-017 | TC-012 |
      | REQ-022 | TC-010 y después TC-017 |
      | REQ-023 | TC-011 y después TC-018 |
      | REQ-028 | (ninguno) |

  Esquema del escenario: Un programa que no existe en el tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/<codigo>/traceability con ese accessToken como Bearer
    Entonces la respuesta es 404 con el código program_not_found
    Y el cuerpo no trae requirements, testCases ni links

    Ejemplos:
      | codigo |
      | PRG-025 |
      | PRG-999 |

  Esquema del escenario: Cualquier rol del tenant lee la matriz
    Dado que en el tenant alumno01, recién reiniciado, tiene un accessToken válido de rol <rol>
    Cuando envía GET /api/programs/PRG-002/traceability con ese accessToken como Bearer
    Entonces la respuesta es 200 con 14 elementos en requirements y 9 en testCases

    Ejemplos:
      | rol |
      | program_manager |
      | consultant |
      | auditor |
      | admin |

  Esquema del escenario: Sin una sesión de acceso válida no se devuelve ningún dato
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y un refreshToken
    Cuando envía GET /api/programs/PRG-002/traceability con <credencial>
    Entonces la respuesta es <respuesta>
    Y el cuerpo no trae requirements, testCases ni links

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera Authorization) | 401 con el código missing_token |
      | una cabecera Bearer con un texto que no es JWT | 401 con el código invalid_token |
      | una cabecera Bearer con el refreshToken de gestor@sigpro.test | 401 con el código invalid_token |

  Esquema del escenario: Cada tenant ve solo sus requisitos en la matriz
    Dado que en el tenant alumno01 y en el tenant alumno02, recién reiniciados, alumno02@sigpro.lab ha creado el requisito REQ-041 en PRG-001 con el título «Requisito de aislamiento»
    Cuando <cuenta> envía GET /api/programs/PRG-001/traceability con su accessToken como Bearer y la cabecera x-tenant <cabecera>
    Entonces requirements contiene <requisitos>

    Ejemplos:
      | cuenta | cabecera | requisitos |
      | gestor@sigpro.test | alumno01 | 14 elementos, de REQ-001 a REQ-014 |
      | alumno02@sigpro.lab | alumno02 | 15 elementos, de REQ-001 a REQ-014 y REQ-041 |
      | gestor@sigpro.test | alumno02 | 14 elementos, de REQ-001 a REQ-014 |

  Esquema del escenario: Un enlace de un tenant no aparece en la matriz de otro
    Dado que en el tenant alumno01 y en el tenant alumno02, recién reiniciados, gestor@sigpro.test ha enlazado en alumno01 el requisito REQ-028 con el caso TC-010
    Cuando <cuenta> envía GET /api/programs/PRG-002/traceability con su accessToken como Bearer y la cabecera x-tenant <cabecera>
    Entonces links <enlace>

    Ejemplos:
      | cuenta | cabecera | enlace |
      | alumno02@sigpro.lab | alumno02 | no contiene el enlace de REQ-028 con TC-010 |
      | gestor@sigpro.test | alumno02 | contiene el enlace de REQ-028 con TC-010 |
```

## Fuera de alcance
- El listado de requisitos en forma de árbol, `GET /api/programs/:code/requirements`: EP-REQ-ARBOL.
- Enlazar y desenlazar casos (`PUT` y `DELETE` sobre `/api/requirements/:code/tests/:testCaseCode`): esta misma épica, en sus historias de la API de enlace.
- La pantalla de la matriz en la web y en la app móvil: esta misma épica, en sus historias de la pantalla.
- La ficha del caso de prueba y sus ejecuciones: EP-VER-CASOS y EP-VER-EJECUCION.
