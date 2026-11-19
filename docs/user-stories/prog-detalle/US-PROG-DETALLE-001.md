---
id: US-PROG-DETALLE-001
tipo: historia
epica: EP-PROG-DETALLE
titulo: "[API] Consultar el detalle de un programa del tenant"
etiquetas: [api]
relacionadas: [US-PROG-DETALLE-002, US-PROG-DETALLE-005, US-SESION-005]
verificacion: codigo
cubre: ["GET /api/programs/:code"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con una sesión de acceso, quiero pedir un programa por su código,
para mostrar a quien consulta sus datos tal como están guardados en su tenant, o recibir un error claro si ese programa no pertenece a su tenant.

## Reglas
- `GET /api/programs/:code` exige un `accessToken` válido en `Authorization: Bearer`. Sin cabecera `Authorization` responde 401 con `code` `missing_token`. Con un token que no es un `accessToken` válido (un texto que no es un JWT, un `refreshToken` o un `mfaToken`) responde 401 con `code` `invalid_token`. Ninguna de estas respuestas trae datos de programa.
- Con un `accessToken` válido responde 200 con el programa directamente en el cuerpo, sin envolverlo en otro objeto.
- El programa trae exactamente estos campos: `code`, `name`, `description`, `status`, `priority`, `classified`, `ownerId`, `ownerName`, `startDate`, `endDate`, `budgetEur`, `progress`, `milestonesDone` y `milestonesTotal`.
- `status` vale `draft`, `active`, `on_hold`, `closed` o `cancelled`; `priority` vale `low`, `medium` o `high`; `classified` es un booleano.
- `startDate` y `endDate` van como `YYYY-MM-DD`; `budgetEur` es un número entero de euros.
- `ownerId` es el identificador de la cuenta responsable y `ownerName` su nombre, tal como figura en esa cuenta del mismo tenant.
- `milestonesTotal` es el número de hitos del programa y `milestonesDone` el de los hitos cumplidos. `progress` es el porcentaje de hitos cumplidos sobre el total, redondeado al entero más cercano; sin hitos vale 0.
- Cualquier rol del tenant recibe la misma respuesta: ningún permiso restringe la lectura del detalle.
- Un código que no corresponde a ningún programa del tenant del token responde 404 con `code` y `message` iguales a `program_not_found`, sin datos de programa. Esto incluye un código de otro tipo de elemento, como `REQ-001`.
- Un programa que existe en otro tenant responde igual que un código que no existe en ninguno: la respuesta no revela si el código existe en otra organización. La cabecera `x-tenant` no cambia el tenant de la petición de detalle, que es el del token.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la cuenta de la fila inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`: `gestor@sigpro.test` (`Gestor1234!`, rol `program_manager`), `consultor@sigpro.test` (`Consul1234!`, rol `consultant`), `auditor@sigpro.test` (`Audit1234!`, rol `auditor`) o `alumno01@sigpro.lab` (`Alumno1234!`, rol `admin`, sin segundo factor). Su `accessToken` se envía como `Authorization: Bearer`. La cuenta `admin@sigpro.test` (`Admin1234!`) recibe solo un `mfaToken` con esa misma cabecera, porque su cuenta exige segundo factor.
- Preparación de las filas de aislamiento: se reinicia `alumno01` (con el token de `alumno01@sigpro.lab`) y `alumno02` (con el token de `alumno02@sigpro.lab`, contraseña `Alumno1234!`). Después `alumno02@sigpro.lab` inicia sesión con `x-tenant: alumno02` y crea con `POST /api/programs` un programa con el nombre `Programa de aislamiento`, responsable `u1`, inicio `2025-01-01`, fin `2025-12-31` y presupuesto `100000`. El programa recibe el código `PRG-025`, el siguiente a los 24 del seed. `gestor@sigpro.test` inicia sesión en `alumno01` con `x-tenant: alumno01`. Cada fila usa el `accessToken` de la cuenta que indica.
- `PRG-001` es el primer programa del seed de cada tenant y, tras un reinicio, tiene los datos de los ejemplos. `PRG-024` es el último.

## Criterios de aceptación
```gherkin
Característica: Detalle de un programa por la API

  Esquema del escenario: El detalle de PRG-001 trae los datos del seed
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-001 con ese accessToken como Bearer
    Entonces la respuesta es 200
    Y el campo <campo> vale <valor>

    Ejemplos:
      | campo | valor |
      | code | PRG-001 |
      | name | Sistema de mando táctico Ártemis |
      | description | Programa «Sistema de mando táctico Ártemis»: alcance, hitos, requisitos y verificación del sistema. |
      | status | active |
      | priority | medium |
      | classified | true |
      | ownerId | u1 |
      | ownerName | Marta Ruiz |
      | startDate | 2023-01-01 |
      | endDate | 2024-07-01 |
      | budgetEur | 450000 |
      | progress | 11 |
      | milestonesDone | 1 |
      | milestonesTotal | 9 |

  Esquema del escenario: Cualquier rol del tenant recibe el mismo detalle
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> con el rol <rol> tiene un accessToken válido
    Cuando envía GET /api/programs/PRG-001 con ese accessToken como Bearer
    Entonces la respuesta es 200 con el código PRG-001 y el responsable Marta Ruiz

    Ejemplos:
      | cuenta | rol |
      | gestor@sigpro.test | program_manager |
      | consultor@sigpro.test | consultant |
      | auditor@sigpro.test | auditor |
      | alumno01@sigpro.lab | admin |

  Esquema del escenario: Un código que no es un programa del tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/<codigo> con ese accessToken como Bearer
    Entonces la respuesta es 404 con el código program_not_found
    Y el cuerpo no trae ningún dato de programa

    Ejemplos:
      | codigo |
      | PRG-000 |
      | PRG-025 |
      | REQ-001 |

  Esquema del escenario: El último programa del seed se devuelve
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía GET /api/programs/<codigo> con ese accessToken como Bearer
    Entonces la respuesta es 200 con el nombre <nombre>

    Ejemplos:
      | codigo | nombre |
      | PRG-024 | Protección balística personal |

  Esquema del escenario: Un programa de otro tenant responde igual que un código que no existe
    Dado que en el tenant alumno01 y en el tenant alumno02, recién reiniciados, alumno02 tiene el programa Programa de aislamiento con el código PRG-025
    Cuando <cuenta> envía GET /api/programs/PRG-025 con su accessToken como Bearer y <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | cabecera | respuesta |
      | gestor@sigpro.test del tenant alumno01 | sin cabecera x-tenant | 404 program_not_found |
      | gestor@sigpro.test del tenant alumno01 | con la cabecera x-tenant: alumno02 | 404 program_not_found |
      | alumno02@sigpro.lab del tenant alumno02 | sin cabecera x-tenant | 200 con el nombre Programa de aislamiento |

  Esquema del escenario: Sin una sesión de acceso válida no se devuelve el programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y un refreshToken, y admin@sigpro.test tiene un mfaToken
    Cuando envía GET /api/programs/PRG-001 con <credencial>
    Entonces la respuesta es <respuesta>
    Y el cuerpo no trae ningún dato del programa

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera Authorization) | 401 missing_token |
      | una cabecera Bearer con un texto que no es JWT | 401 invalid_token |
      | una cabecera Bearer con el refreshToken de gestor@sigpro.test | 401 invalid_token |
      | una cabecera Bearer con el mfaToken de admin@sigpro.test | 401 invalid_token |
```

## Fuera de alcance
- La ficha que muestra estos datos en la web y en la app móvil: EP-PROG-DETALLE, en sus historias de Web y de Móvil.
- Los hitos que cuentan `milestonesDone` y `milestonesTotal`, con su alta, su edición y su borrado: EP-HITOS.
- El alta y la edición que cambian estos datos: EP-PROG-ALTA.
- La lista paginada de programas, `GET /api/programs`: EP-PROG-LISTA.
- Cómo se obtienen los tokens, el segundo factor y la renovación de la sesión: EP-LOGIN, EP-MFA y EP-SESION.
