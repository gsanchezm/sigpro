---
id: US-REQ-ARBOL-002
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[API] Consultar el detalle de un requisito del tenant"
etiquetas: [api]
relacionadas: [US-REQ-ARBOL-001]
verificacion: codigo
cubre: ["GET /api/requirements/:code"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con una sesión de acceso, quiero pedir un requisito por su código,
para mostrar a quien consulta sus datos, sus casos de prueba enlazados y sus no conformidades tal como están guardados en su tenant, o recibir un error claro si ese código no es un requisito de su tenant.

## Reglas
- `GET /api/requirements/:code` exige un `accessToken` válido en `Authorization: Bearer`. Sin cabecera `Authorization` responde 401 con `code` `missing_token`. Con un token que no es un `accessToken` válido (un texto que no es un JWT, un `refreshToken` o un `mfaToken`) responde 401 con `code` `invalid_token`. Ninguna de estas respuestas trae datos del requisito.
- Cualquier rol del tenant recibe la misma respuesta: ningún permiso restringe la lectura del detalle.
- Con un `accessToken` válido y un requisito del tenant responde 200 con el requisito directamente en el cuerpo, sin envolverlo en otro objeto.
- El requisito trae exactamente estos campos: `code`, `programCode`, `parentCode`, `title`, `description`, `priority`, `state`, `tags`, `position`, `testCaseCodes`, `tests` y `ncs`.
- `programCode` es el programa al que pertenece el requisito. `parentCode` es el código del requisito padre, o `null` si el requisito es raíz. `position` ordena a los hermanos (los requisitos con el mismo `parentCode` dentro del programa): un hermano con `position` menor va antes que otro con `position` mayor.
- `title` es el título del requisito y `description` es su descripción tal como se guardó, en HTML. En el seed, la descripción es un párrafo `<p>` con el texto y las partes en negrita dentro de `<strong>`: al quitar las etiquetas, el texto de `REQ-001` es «El sistema debe cumplir el requisito 001 de disponibilidad en condiciones nominales.».
- `state` vale `draft`, `approved`, `verified` o `validated`. `priority` vale `low`, `medium` o `high`. `tags` es una lista de claves de etiqueta (`safety`, `security`, `performance`, `interface`, `regulatory`, `maintainability`, `availability` o `usability`), en el orden en que se guardaron; es una lista vacía si el requisito no tiene etiquetas.
- `testCaseCodes` lista los códigos de sus casos de prueba enlazados, ordenados por código; vacía si no tiene ninguno.
- `tests` trae, de cada caso enlazado, su `code` y su `lastResult`, que vale `pass`, `fail` o `blocked` según la última ejecución de ese caso, o `null` si nunca se ha ejecutado. Va en el mismo orden que `testCaseCodes`.
- `ncs` lista las no conformidades de las ejecuciones de sus casos enlazados. Una misma no conformidad aparece una sola vez aunque cuelgue de varias ejecuciones o de varios casos, y la lista va ordenada por `code`. Cada una trae su `code`, su `severity` (`minor`, `major` o `critical`) y su `state`. Un requisito sin casos enlazados tiene `ncs` vacía, porque no hay ejecuciones de las que colgar una no conformidad.
- Un código que no es un requisito del tenant del token responde 404 con `code` y `message` iguales a `requirement_not_found`, sin ningún dato del requisito. Esto incluye un código de otro tipo de elemento, como `PRG-001`, y un requisito que existe en otro tenant: la respuesta no revela si el código existe en otra organización.
- La cabecera `x-tenant` no cambia el tenant de la petición, que es el del token.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la cuenta de la fila inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`: `gestor@sigpro.test` (`Gestor1234!`, rol `program_manager`), `consultor@sigpro.test` (`Consul1234!`, rol `consultant`), `auditor@sigpro.test` (`Audit1234!`, rol `auditor`) o `alumno01@sigpro.lab` (`Alumno1234!`, rol `admin`, sin segundo factor). Su `accessToken` se envía como `Authorization: Bearer`. La cuenta `admin@sigpro.test` (`Admin1234!`) recibe solo un `mfaToken` con esa misma cabecera, porque su cuenta exige segundo factor.
- Preparación de las filas de aislamiento: se reinicia `alumno01` (con el token de `alumno01@sigpro.lab`) y `alumno02` (con el token de `alumno02@sigpro.lab`, contraseña `Alumno1234!`). Después `alumno02@sigpro.lab` inicia sesión con `x-tenant: alumno02` y crea con `POST /api/requirements` un requisito del programa `PRG-001` con el título `Requisito de aislamiento`. Recibe el código `REQ-041`, el siguiente a los 40 del seed. `gestor@sigpro.test` inicia sesión en `alumno01` con `x-tenant: alumno01`. Cada fila usa el `accessToken` de la cuenta que indica.
- Tras un reinicio, `REQ-001` pertenece a `PRG-001` con el título «Disponibilidad del subsistema 001», `REQ-017` es hijo de `REQ-015` en `PRG-002` y `REQ-041` no existe en `alumno01`.

## Criterios de aceptación
```gherkin
Característica: Detalle de un requisito por la API

  Esquema del escenario: El detalle de un requisito trae sus campos del seed
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/requirements/<codigo> con ese accessToken como Bearer
    Entonces la respuesta es 200
    Y el campo <campo> vale <valor>

    Ejemplos:
      | codigo | campo | valor |
      | REQ-001 | code | REQ-001 |
      | REQ-001 | programCode | PRG-001 |
      | REQ-001 | parentCode | null |
      | REQ-001 | title | Disponibilidad del subsistema 001 |
      | REQ-001 | priority | high |
      | REQ-001 | state | approved |
      | REQ-001 | position | 0 |
      | REQ-001 | testCaseCodes | TC-001 |

  Esquema del escenario: La posición del requisito y su padre se leen en el detalle
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/requirements/<codigo> con ese accessToken como Bearer
    Entonces el requisito <codigo> tiene programCode <programa>, parentCode <padre>, state <estado>, priority <prioridad>, position <posicion> y testCaseCodes <casos>

    Ejemplos:
      | codigo | programa | padre | estado | prioridad | posicion | casos |
      | REQ-008 | PRG-001 | REQ-006 | draft | low | 1 | TC-001 y TC-008 |
      | REQ-014 | PRG-001 | REQ-013 | verified | low | 0 | (vacío) |
      | REQ-017 | PRG-002 | REQ-015 | draft | low | 1 | TC-012 |
      | REQ-028 | PRG-002 | REQ-027 | draft | high | 0 | (vacío) |

  Esquema del escenario: La descripción del requisito se guarda como texto con formato
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/requirements/<codigo> con ese accessToken como Bearer
    Entonces el texto de description, sin las etiquetas HTML, es <texto>

    Ejemplos:
      | codigo | texto |
      | REQ-001 | «El sistema debe cumplir el requisito 001 de disponibilidad en condiciones nominales.» |
      | REQ-017 | «El sistema debe cumplir el requisito 017 de disponibilidad en condiciones nominales.» |

  Esquema del escenario: Las etiquetas del requisito son las que se guardaron, en su orden
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/requirements/<codigo> con ese accessToken como Bearer
    Entonces el requisito <codigo> tiene tags <etiquetas>

    Ejemplos:
      | codigo | etiquetas |
      | REQ-003 | (vacío) |
      | REQ-005 | maintainability, safety |
      | REQ-010 | performance, maintainability |

  Esquema del escenario: Los casos enlazados aparecen en tests con su código
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/requirements/<codigo> con ese accessToken como Bearer
    Entonces en tests aparecen solo los códigos <casos>

    Ejemplos:
      | codigo | casos |
      | REQ-008 | TC-001 y TC-008 |
      | REQ-014 | (ninguno) |

  Esquema del escenario: Un requisito sin casos enlazados no tiene ni tests ni no conformidades
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/requirements/<codigo> con ese accessToken como Bearer
    Entonces el campo tests es una lista vacía
    Y el campo ncs es una lista vacía

    Ejemplos:
      | codigo |
      | REQ-014 |
      | REQ-028 |

  Esquema del escenario: Un código que no es un requisito del tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/requirements/<codigo> con ese accessToken como Bearer
    Entonces la respuesta es 404 con el código requirement_not_found
    Y el cuerpo no trae ningún dato del requisito

    Ejemplos:
      | codigo |
      | REQ-000 |
      | REQ-041 |
      | PRG-001 |

  Esquema del escenario: Un requisito de otro tenant responde igual que un código que no existe
    Dado que en el tenant alumno01 y en el tenant alumno02, recién reiniciados, alumno02 tiene el requisito Requisito de aislamiento con el código REQ-041
    Cuando <cuenta> envía GET /api/requirements/REQ-041 con su accessToken como Bearer y <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | cabecera | respuesta |
      | gestor@sigpro.test del tenant alumno01 | sin cabecera x-tenant | 404 requirement_not_found |
      | gestor@sigpro.test del tenant alumno01 | con la cabecera x-tenant: alumno02 | 404 requirement_not_found |
      | alumno02@sigpro.lab del tenant alumno02 | sin cabecera x-tenant | 200 con el título Requisito de aislamiento |

  Esquema del escenario: Sin una sesión de acceso válida no se devuelve ningún dato del requisito
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y un refreshToken, y admin@sigpro.test tiene un mfaToken
    Cuando envía GET /api/requirements/REQ-001 con <credencial>
    Entonces la respuesta es <respuesta>
    Y el cuerpo no trae ningún dato del requisito

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera Authorization) | 401 missing_token |
      | una cabecera Bearer con un texto que no es JWT | 401 invalid_token |
      | una cabecera Bearer con el refreshToken de gestor@sigpro.test | 401 invalid_token |
      | una cabecera Bearer con el mfaToken de admin@sigpro.test | 401 invalid_token |
```

## Fuera de alcance
- El listado de los requisitos de un programa, `GET /api/programs/:code/requirements`: esta misma épica (EP-REQ-ARBOL), en su historia de la API.
- Crear, editar, borrar y reordenar requisitos: EP-REQ-EDICION.
- Los estados del requisito, sus transiciones y sus permisos: EP-REQ-FLUJO.
- Enlazar y desenlazar casos de prueba, y la matriz `GET /api/programs/:code/traceability`: EP-REQ-TRAZA.
- Los casos de prueba y sus ejecuciones, y las no conformidades como entidades: las épicas de Verificación y de No conformidades, todavía sin escribir.
- Cómo se obtienen los tokens, el segundo factor y la renovación de la sesión: EP-LOGIN, EP-MFA y EP-SESION.
