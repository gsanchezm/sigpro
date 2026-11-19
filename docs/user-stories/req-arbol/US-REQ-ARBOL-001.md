---
id: US-REQ-ARBOL-001
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[API] Listar los requisitos de un programa del tenant con su padre y su posición"
etiquetas: [api]
relacionadas: [US-REQ-ARBOL-002, US-PROG-DETALLE-002]
verificacion: ejecutada
cubre: ["GET /api/programs/:code/requirements"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con una sesión de acceso, quiero pedir los requisitos de un programa por su código,
para armar el árbol de ese programa con el padre y la posición de cada requisito, o recibir un error claro si el programa no pertenece a mi tenant.

## Reglas
- `GET /api/programs/:code/requirements` exige un `accessToken` válido en `Authorization: Bearer`. Sin cabecera `Authorization` responde 401 con `code` `missing_token`. Con un token que no es un `accessToken` válido (un texto que no es un JWT, un `refreshToken` o un `mfaToken`) responde 401 con `code` `invalid_token`. Ninguna de estas respuestas trae requisitos.
- Cualquier rol del tenant recibe la misma respuesta: ningún permiso restringe la lectura de los requisitos.
- Con un `accessToken` válido y un programa del tenant responde 200 con un objeto de dos claves: `program`, con el `code` y el `name` del programa, e `items`, con todos sus requisitos. La respuesta no tiene paginación.
- Cada elemento de `items` trae exactamente estos campos: `code`, `programCode`, `parentCode`, `title`, `description`, `priority`, `state`, `tags`, `position`, `testCaseCodes`, `tests` y `ncs`.
- `parentCode` es el código del requisito padre, o `null` si el requisito es raíz. El padre siempre es un requisito del mismo programa.
- `position` ordena a los hermanos, es decir, a los requisitos que tienen el mismo `parentCode` dentro del programa: un hermano con `position` menor va antes que otro con `position` mayor. El primer hermano de cada grupo tiene `position` 0.
- Los elementos de `items` vienen ordenados por `code` de menor a mayor, como texto: `REQ-001` antes que `REQ-002`, y `REQ-009` antes que `REQ-010`.
- `title` es el título del requisito y `description` es su descripción guardada, en HTML (por ejemplo, un párrafo `<p>` con el texto, y las partes en negrita dentro de `<strong>`).
- `state` vale `draft`, `approved`, `verified` o `validated`. `priority` vale `low`, `medium` o `high`. `tags` es una lista de claves de etiqueta (`safety`, `security`, `performance`, `interface`, `regulatory`, `maintainability`, `availability` o `usability`); es una lista vacía si el requisito no tiene etiquetas.
- `testCaseCodes` lista los códigos de sus casos de prueba enlazados, ordenados por código; vacía si no tiene ninguno. `tests` trae, de cada caso enlazado, su `code` y su `lastResult`, que vale `pass`, `fail` o `blocked` según su última ejecución, o `null` si nunca se ha ejecutado.
- `ncs` lista las no conformidades de las ejecuciones de sus casos enlazados, sin repetir una misma no conformidad aunque cuelgue de varias ejecuciones, ordenadas por `code`. Cada una trae su `code`, su `severity` (`minor`, `major` o `critical`) y su `state`.
- Un programa que no existe en el tenant del token responde 404 con `code` y `message` iguales a `program_not_found`, sin requisitos. Esto incluye un código de otro tipo de elemento, como `REQ-001`, y un programa que existe en otro tenant: la respuesta no revela si el código existe en otra organización.
- Un programa del tenant que no tiene requisitos responde 200 con `items` vacío y con su `program`.
- La cabecera `x-tenant` no cambia el tenant de la petición, que es el del token.
- Tras un reinicio del tenant, `PRG-001` tiene 14 requisitos (de `REQ-001` a `REQ-014`), `PRG-002` tiene 14 (de `REQ-015` a `REQ-028`) y `PRG-003` tiene 12 (de `REQ-029` a `REQ-040`). `PRG-004` es un programa del seed sin requisitos.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la cuenta de la fila inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`: `gestor@sigpro.test` (`Gestor1234!`, rol `program_manager`), `consultor@sigpro.test` (`Consul1234!`, rol `consultant`), `auditor@sigpro.test` (`Audit1234!`, rol `auditor`) o `alumno01@sigpro.lab` (`Alumno1234!`, rol `admin`, sin segundo factor). Su `accessToken` se envía como `Authorization: Bearer`. La cuenta `admin@sigpro.test` (`Admin1234!`) recibe solo un `mfaToken` con esa misma cabecera, porque su cuenta exige segundo factor.
- Preparación de las filas de aislamiento: se reinicia `alumno01` (con el token de `alumno01@sigpro.lab`) y `alumno02` (con el token de `alumno02@sigpro.lab`, contraseña `Alumno1234!`). Después `alumno02@sigpro.lab` inicia sesión con `x-tenant: alumno02` y crea con `POST /api/programs` un programa con el nombre `Programa de aislamiento`, responsable `u1`, inicio `2025-01-01`, fin `2025-12-31` y presupuesto `100000`. El programa recibe el código `PRG-025`, el siguiente a los 24 del seed. `gestor@sigpro.test` inicia sesión en `alumno01` con `x-tenant: alumno01`. Cada fila usa el `accessToken` de la cuenta que indica.

## Criterios de aceptación
```gherkin
Característica: Listado de los requisitos de un programa por la API

  Esquema del escenario: El listado de PRG-001 trae el programa y sus requisitos del seed
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-001/requirements con ese accessToken como Bearer
    Entonces la respuesta es 200
    Y el campo <campo> vale <valor>

    Ejemplos:
      | campo | valor |
      | program.code | PRG-001 |
      | program.name | Sistema de mando táctico Ártemis |
      | items.length | 14 |
      | items[0].code | REQ-001 |
      | items[9].code | REQ-010 |
      | items[13].code | REQ-014 |

  Esquema del escenario: Cada requisito trae su padre y su posición entre hermanos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-001/requirements con ese accessToken como Bearer
    Entonces el requisito <codigo> tiene parentCode <padre> y position <posicion>

    Ejemplos:
      | codigo | padre | posicion |
      | REQ-001 | null | 0 |
      | REQ-003 | REQ-001 | 1 |
      | REQ-004 | REQ-003 | 0 |
      | REQ-006 | null | 1 |
      | REQ-011 | null | 2 |
      | REQ-013 | REQ-011 | 1 |

  Esquema del escenario: Cada requisito trae su estado, su prioridad y sus etiquetas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-001/requirements con ese accessToken como Bearer
    Entonces el requisito <codigo> tiene state <estado>, priority <prioridad> y tags <etiquetas>

    Ejemplos:
      | codigo | estado | prioridad | etiquetas |
      | REQ-001 | approved | high | security |
      | REQ-003 | validated | medium | (vacío) |
      | REQ-004 | draft | high | regulatory |
      | REQ-005 | approved | low | maintainability, safety |

  Esquema del escenario: Los casos de prueba enlazados de cada requisito se listan por código
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-001/requirements con ese accessToken como Bearer
    Entonces el requisito <codigo> tiene testCaseCodes <casos>

    Ejemplos:
      | codigo | casos |
      | REQ-001 | TC-001 |
      | REQ-008 | TC-001 y TC-008 |
      | REQ-014 | (vacío) |

  Esquema del escenario: Los casos enlazados de un requisito aparecen en testCaseCodes y en tests
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-002/requirements con ese accessToken como Bearer
    Entonces el requisito <codigo> tiene testCaseCodes <casos> y en tests solo los códigos <codigos>

    Ejemplos:
      | codigo | casos | codigos |
      | REQ-028 | (vacío) | (ninguno) |
      | REQ-017 | TC-012 | TC-012 |

  Esquema del escenario: Los elementos del listado vienen en orden de código
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-002/requirements con ese accessToken como Bearer
    Entonces el elemento número <posicion> de items tiene el código <codigo>

    Ejemplos:
      | posicion | codigo |
      | 1 | REQ-015 |
      | 2 | REQ-016 |
      | 14 | REQ-028 |

  Esquema del escenario: Un programa sin requisitos responde con la lista vacía
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/<codigo>/requirements con ese accessToken como Bearer
    Entonces la respuesta es 200 con items vacío y el programa <codigo> con el nombre <nombre>

    Ejemplos:
      | codigo | nombre |
      | PRG-004 | Plataforma UAV Cóndor |

  Esquema del escenario: Cualquier rol del tenant recibe el mismo listado
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> con el rol <rol> tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-002/requirements con ese accessToken como Bearer
    Entonces la respuesta es 200 con 14 requisitos en items, el primero REQ-015

    Ejemplos:
      | cuenta | rol |
      | gestor@sigpro.test | program_manager |
      | consultor@sigpro.test | consultant |
      | auditor@sigpro.test | auditor |
      | alumno01@sigpro.lab | admin |

  Esquema del escenario: Un programa que no es del tenant responde 404
    Dado que en el tenant alumno01 y en el tenant alumno02, recién reiniciados, alumno02 tiene el programa Programa de aislamiento con el código PRG-025
    Cuando <cuenta> envía GET /api/programs/<codigo>/requirements con su accessToken como Bearer y <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | codigo | cabecera | respuesta |
      | gestor@sigpro.test del tenant alumno01 | PRG-025 | sin cabecera x-tenant | 404 program_not_found |
      | gestor@sigpro.test del tenant alumno01 | PRG-000 | sin cabecera x-tenant | 404 program_not_found |
      | gestor@sigpro.test del tenant alumno01 | REQ-001 | sin cabecera x-tenant | 404 program_not_found |
      | gestor@sigpro.test del tenant alumno01 | PRG-025 | con la cabecera x-tenant: alumno02 | 404 program_not_found |
      | alumno02@sigpro.lab del tenant alumno02 | PRG-025 | sin cabecera x-tenant | 200 con items vacío |

  Esquema del escenario: Sin una sesión de acceso válida no se devuelve ningún requisito
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y un refreshToken, y admin@sigpro.test tiene un mfaToken
    Cuando envía GET /api/programs/PRG-001/requirements con <credencial>
    Entonces la respuesta es <respuesta>
    Y el cuerpo no trae ningún requisito

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera Authorization) | 401 missing_token |
      | una cabecera Bearer con un texto que no es JWT | 401 invalid_token |
      | una cabecera Bearer con el refreshToken de gestor@sigpro.test | 401 invalid_token |
      | una cabecera Bearer con el mfaToken de admin@sigpro.test | 401 invalid_token |
```

## Fuera de alcance
- El detalle de un requisito, `GET /api/requirements/:code`, con sus campos y su 404: esta misma épica (EP-REQ-ARBOL), en su historia de la API.
- Crear, editar, borrar y reordenar requisitos: EP-REQ-EDICION.
- Los estados del requisito, sus transiciones y sus permisos: EP-REQ-FLUJO.
- Enlazar casos de prueba y la matriz `GET /api/programs/:code/traceability`: EP-REQ-TRAZA.
- Cómo se obtienen los tokens, el segundo factor y la renovación de la sesión: EP-LOGIN, EP-MFA y EP-SESION.
- La lista paginada de programas y la ficha del programa: EP-PROG-LISTA y EP-PROG-DETALLE.
