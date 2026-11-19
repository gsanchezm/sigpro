---
id: US-NAVEGACION-003
tipo: historia
epica: EP-NAVEGACION
titulo: "[API] Exigir un acceso válido y buscar solo en el tenant del acceso"
etiquetas: [api]
relacionadas: [US-NAVEGACION-001, US-NAVEGACION-002, US-LOGIN-001]
verificacion: codigo
cubre: ["GET /api/search"]
---

## Historia
Como cliente de la API, quiero que la búsqueda global solo responda a quien tiene un acceso vigente y que solo muestre los datos de su tenant,
para que ningún tenant vea los datos de otro.

## Reglas
- `GET /api/search` exige la cabecera `Authorization` con `Bearer` y un acceso de sesión. Sin cabecera, la respuesta es 401 con `code: "missing_token"`. Con una cabecera que no contiene un acceso válido, o con un acceso caducado o alterado, la respuesta es 401 con `code: "invalid_token"`. El token de renovación no sirve como acceso y responde igual que un acceso no válido.
- Cualquier rol con sesión puede buscar. La búsqueda no exige ningún permiso propio.
- Los datos que se buscan son los del tenant del acceso. La cabecera `x-tenant` no cambia el tenant de la búsqueda.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y el tenant `alumno02` con el token de `alumno02@sigpro.lab`, también `Alumno1234!`. Cada cuenta obtiene su acceso con `POST /api/auth/login` y la cabecera `x-tenant` de su propio tenant. En las filas de aislamiento, `alumno01@sigpro.lab` crea con `POST /api/programs` un programa de nombre `aislamiento-` seguido de una marca de tiempo, con responsable `u1`, inicio `2027-01-10`, fin `2027-12-31` y presupuesto `500000`. Cada fila usa una marca nueva.

## Criterios de aceptación
```gherkin
Característica: Acceso y aislamiento de la búsqueda global

  Esquema del escenario: Sin un acceso válido la búsqueda no responde
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un acceso válido
    Cuando pide GET /api/search con q PRG-001 y con <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cabecera | respuesta |
      | (sin cabecera) | 401 missing_token |
      | Authorization con el valor Bearer abc | 401 invalid_token |
      | Authorization con el token de renovación de gestor@sigpro.test | 401 invalid_token |

  Esquema del escenario: La búsqueda devuelve solo los datos del tenant del acceso
    Dado que en los tenants alumno01 y alumno02, recién reiniciados, alumno01@sigpro.lab ha creado el programa de nombre aislamiento- seguido de una marca de tiempo
    Cuando <cuenta> pide GET /api/search con q aislamiento- seguido de esa misma marca y la cabecera x-tenant <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | cabecera | respuesta |
      | alumno01@sigpro.lab | alumno01 | 200 con un grupo de programas de total 1, el programa creado |
      | alumno01@sigpro.lab | alumno02 | 200 con un grupo de programas de total 1, el programa creado |
      | alumno02@sigpro.lab | alumno01 | 200 sin grupos |
      | alumno02@sigpro.lab | alumno02 | 200 sin grupos |
```

## Fuera de alcance
- Cómo se obtiene el acceso, el bloqueo de la cuenta y el cierre de sesión: EP-LOGIN (US-LOGIN-001 y siguientes).
- La renovación del acceso cuando caduca: EP-SESION.
- Los documentos restringidos dentro de la búsqueda: US-DOC-RESTRINGIDOS-004.
- El aislamiento de las listas y pantallas que no son la búsqueda global: las épicas de cada módulo.
