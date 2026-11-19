---
id: US-REQ-FLUJO-004
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[API] Responder 401, 422 o 404 sin cambiar el estado, en el orden de las comprobaciones"
etiquetas: [api]
relacionadas: [US-REQ-FLUJO-001, US-REQ-FLUJO-002, US-REQ-FLUJO-003]
verificacion: codigo
cubre: ["POST /api/requirements/:code/transition"]
---

## Historia
Como cliente de la API, quiero que una petición mal formada, sin sesión o sobre un requisito que no existe reciba la respuesta de su motivo,
para distinguir un error de mi petición de un paso que el flujo no permite o de un permiso que mi rol no tiene.

## Reglas
- El orden de las primeras comprobaciones de `POST /api/requirements/:code/transition` es este: 1.º la sesión (401), 2.º el cuerpo (422) y 3.º que el requisito exista en el tenant de la sesión (404). La primera comprobación que falla responde, y las siguientes no se miran. El orden entre el paso inexistente (409) y el permiso del rol (403) cuando ambos fallan no está decidido: ver «Decisiones pendientes».
- Sin cabecera `Authorization` la respuesta es 401 con el código `missing_token`. Con una cabecera `Authorization` de tipo `Bearer` cuyo token no es un token de acceso válido, la respuesta es 401 con el código `invalid_token`.
- El cuerpo debe traer `to` con uno de los cuatro estados. Si `to` falta, está vacío, no es texto o no es uno de los cuatro estados (por ejemplo `done`, o `Approved` con mayúscula), la respuesta es 422 con el código `validation_failed` y el motivo `badState` en el campo `to`. Un cuerpo vacío se trata como un `to` que falta.
- Un código que no es un requisito del tenant responde 404 con el código `requirement_not_found`. El seed trae `REQ-001` a `REQ-040`, así que `REQ-041` no existe en ningún tenant.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la cuenta de la fila inicia sesión en `alumno01` con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken`. Las cuentas son las del seed: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y `alumno01@sigpro.lab`. Tras el reinicio, `REQ-017` está en `draft`, `REQ-002` en `verified` y `REQ-041` no existe.

## Criterios de aceptación
```gherkin
Característica: Errores de la petición de transición por la API

  Esquema del escenario: Un cuerpo sin un estado válido responde 422 y no cambia el estado
    Dado que en el tenant alumno01, recién reiniciado, REQ-017 está en estado draft y alumno01@sigpro.lab ha iniciado sesión en ese tenant
    Cuando envía POST /api/requirements/REQ-017/transition con el cuerpo <cuerpo>
    Entonces la respuesta es 422 con el código validation_failed y el motivo badState en el campo to
    Y una lectura posterior de REQ-017 devuelve el estado draft

    Ejemplos:
      | cuerpo |
      | {"to": "done"} |
      | {"to": "Approved"} |
      | {"to": ""} |
      | {"to": 5} |
      | {} |
      | (vacío) |

  Esquema del escenario: Un código que no es un requisito del tenant responde 404 o 422
    Dado que en el tenant alumno01, recién reiniciado, <requisito> no existe y <cuenta> ha iniciado sesión en ese tenant
    Cuando envía POST /api/requirements/<requisito>/transition con el cuerpo <cuerpo>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | requisito | cuenta | cuerpo | respuesta |
      | REQ-041 | alumno01@sigpro.lab | {"to": "approved"} | 404 con el código requirement_not_found |
      | REQ-041 | gestor@sigpro.test | {"to": "done"} | 422 con el código validation_failed y el motivo badState en el campo to |

  Esquema del escenario: Sin una sesión válida la petición responde 401 y no cambia el estado
    Dado que en el tenant alumno01, recién reiniciado, REQ-017 está en estado draft y alumno01@sigpro.lab ha iniciado sesión en ese tenant
    Cuando envía POST /api/requirements/REQ-017/transition con la cabecera <cabecera> y el cuerpo {"to": "approved"}
    Entonces la respuesta es <respuesta>
    Y una lectura posterior de REQ-017 devuelve el estado draft

    Ejemplos:
      | cabecera | respuesta |
      | (sin cabecera Authorization) | 401 con el código missing_token |
      | Authorization con Bearer seguido de (texto que no es un token) | 401 con el código invalid_token |
```

## Fuera de alcance
- Los pasos válidos y su permiso, con sus efectos: en esta misma épica, en sus historias de la API.
- La validación de los formularios de alta y de edición de un requisito: EP-REQ-EDICION.
- El inicio de sesión que da el token de acceso: EP-LOGIN, y la renovación del token: EP-SESION.

## Decisiones pendientes
- Qué responde la API cuando fallan a la vez el paso (409 `invalid_transition`) y el permiso del rol (403 `forbidden`) o cuando falla el permiso sobre un requisito que no existe. `docs/DECISIONS.md` fija 403 antes que 409 para las no conformidades «como en Requisitos»; el código de requisitos comprueba hoy el paso antes que el permiso y busca el requisito antes que el permiso. No está decidido cuál es el orden correcto, así que ninguna fila lo afirma.
