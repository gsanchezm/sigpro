---
id: US-VER-INFORME-001
tipo: historia
epica: EP-VER-INFORME
titulo: "[API] Descargar el informe solo con sesión y con los datos del tenant del token"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-VER-INFORME-002, US-VER-INFORME-003]
verificacion: ejecutada
cubre: ["GET /api/verification/report"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero pedir el informe PDF del plan de verificación con el `accessToken` de una cuenta,
para obtener los casos de prueba de la organización de esa cuenta y no los de otro tenant.

## Reglas
- `GET /api/verification/report` exige un `accessToken` válido en la cabecera `Authorization: Bearer`. Sin esa cabecera, la respuesta es 401 `missing_token`. Con un token que la API no ha emitido, o con un `refreshToken`, que no es un token de acceso, la respuesta es 401 `invalid_token`.
- Con un `accessToken` válido, la respuesta es 200 y el cuerpo es un PDF, no JSON.
- El endpoint no exige ningún permiso: cualquier cuenta con sesión (`program_manager`, `consultant`, `auditor` o `admin`) recibe la misma respuesta.
- El informe es el del tenant del `accessToken`. La cabecera `x-tenant` no cambia nada en este endpoint: con el token de una cuenta de `alumno02`, el informe es el de `alumno02` aunque la cabecera diga `alumno01`.
- Tras reiniciar el tenant, sus 25 casos de prueba (`TC-001` a `TC-025`) tienen su último resultado: 14 superados, 5 fallidos y 6 bloqueados. Ninguno está sin ejecutar.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Cada cuenta de la fila obtiene su `accessToken` con `POST /api/auth/login` y la cabecera `x-tenant` de su tenant. En la fila que usa `alumno02`, también se reinicia ese tenant con el token de `alumno02@sigpro.lab` y, después, `alumno02@sigpro.lab` registra en `alumno02` una ejecución nueva de `TC-001` con `POST /api/test-cases/TC-001/runs`, como formulario multiparte con el campo `result` igual a `fail` y sin archivos. Esa ejecución no existe en `alumno01`.

## Criterios de aceptación
```gherkin
Característica: Descarga del informe de verificación por la API

  Esquema del escenario: Sin un accessToken válido no hay informe
    Dado que en el tenant alumno01, recién reiniciado, existen los 25 casos de prueba del seed
    Cuando envía GET /api/verification/report con <cabecera>
    Entonces la respuesta es <respuesta>
    Y no trae ningún PDF

    Ejemplos:
      | cabecera | respuesta |
      | (sin cabecera Authorization) | 401 missing_token |
      | Bearer con un token inventado | 401 invalid_token |
      | Bearer con el refreshToken de gestor@sigpro.test | 401 invalid_token |

  Esquema del escenario: El informe es el del tenant del accessToken
    Dado que en los tenants alumno01 y alumno02, recién reiniciados, alumno02@sigpro.lab ha registrado en alumno02 una ejecución nueva de TC-001 con resultado fallido
    Cuando <cuenta> pide GET /api/verification/report con su accessToken y la cabecera x-tenant <cabecera>
    Entonces la respuesta es 200 con un PDF
    Y su resumen dice «Último resultado - Superados: <superados> · Fallidos: <fallidos> · Bloqueados: <bloqueados>»

    Ejemplos:
      | cuenta | cabecera | superados | fallidos | bloqueados |
      | alumno01@sigpro.lab | alumno01 | 14 | 5 | 6 |
      | alumno01@sigpro.lab | alumno02 | 14 | 5 | 6 |
      | alumno02@sigpro.lab | alumno02 | 14 | 6 | 5 |
      | alumno02@sigpro.lab | alumno01 | 14 | 6 | 5 |

  Esquema del escenario: Cualquier cuenta con sesión recibe el mismo informe
    Dado que en el tenant alumno01, recién reiniciado, existen los 25 casos de prueba del seed
    Cuando <cuenta> inicia sesión con la contraseña <contraseña> y pide GET /api/verification/report con su accessToken
    Entonces la respuesta es 200 con un PDF
    Y su resumen dice «Último resultado - Superados: 14 · Fallidos: 5 · Bloqueados: 6»

    Ejemplos:
      | cuenta | contraseña |
      | gestor@sigpro.test | Gestor1234! |
      | consultor@sigpro.test | Consul1234! |
      | auditor@sigpro.test | Audit1234! |
      | alumno01@sigpro.lab | Alumno1234! |
```

## Fuera de alcance
- El alcance del informe, el nombre del archivo y el contenido del PDF: EP-VER-INFORME, en sus otras historias de la API.
- El inicio de sesión que entrega el `accessToken` y su caducidad: EP-LOGIN.

## Decisiones pendientes
- Si el informe debe restringirse a algunos roles. Hoy lo reciben las cuatro clases de cuenta, porque la matriz de permisos no tiene un permiso propio para el informe. No está decidido si debe seguir así; la regla describe lo que existe hoy.
