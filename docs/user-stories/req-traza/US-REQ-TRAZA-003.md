---
id: US-REQ-TRAZA-003
tipo: historia
epica: EP-REQ-TRAZA
titulo: "[API] Rechazar un enlace que no puede crearse"
etiquetas: [api]
relacionadas: [US-REQ-TRAZA-002, US-REQ-TRAZA-004]
verificacion: codigo
cubre: ["PUT /api/requirements/:code/tests/:testCaseCode"]
---

## Historia
Como cliente de la API que pide un enlace entre un requisito y un caso de prueba, quiero recibir un error con su motivo cuando el requisito o el caso no existen en mi tenant, o cuando el caso es de otro programa,
para corregir la petición sin que quede ningún enlace a medias.

## Reglas
- Una petición rechazada no crea ningún enlace y no cambia la lista `links` del programa.
- Las comprobaciones se hacen en este orden: primero el rol (un rol sin `requirement.edit` recibe 403 aunque el requisito no exista), después el requisito, después el caso y, por último, que el caso sea del mismo programa que el requisito. Si faltan el requisito y el caso a la vez, la respuesta es el 404 del requisito.
- Un requisito que no existe en el tenant del token responde 404 con `code` y `message` iguales a `requirement_not_found`, sin ningún dato del requisito.
- Un caso que no existe en el tenant del token responde 404 con `code` y `message` iguales a `test_case_not_found`, sin ningún dato del caso.
- Un caso de otro programa que el del requisito responde 422 con `code` `validation_failed` y `errors` con `testCaseCode` igual a `differentProgram`.
- Los casos de prueba tienen los mismos códigos en todos los tenants, así que un caso de otro tenant no se distingue de uno propio. El aislamiento se comprueba con un requisito que existe solo en otro tenant.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` (`Gestor1234!`, rol `program_manager`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken` como `Authorization: Bearer`.
- Tras un reinicio, `REQ-028` (de `PRG-002`) y `REQ-040` (de `PRG-003`) no tienen casos enlazados. `TC-009` es de `PRG-001`; `TC-010` y `TC-018` son de `PRG-002`; `TC-019` y `TC-025` son de `PRG-003`. `TC-000`, `TC-026` y `TC-999` no existen en ningún tenant.
- Preparación de las filas de aislamiento: se reinician `alumno01` (con el token de `alumno01@sigpro.lab`) y `alumno02` (con el token de `alumno02@sigpro.lab`, contraseña `Alumno1234!`). Después `alumno02@sigpro.lab` inicia sesión con la cabecera `x-tenant: alumno02` y crea con `POST /api/requirements` un requisito de `PRG-001` con el título «Requisito de aislamiento»; recibe el código `REQ-041`. En `alumno01`, `REQ-041` no existe.

## Criterios de aceptación
```gherkin
Característica: Rechazos del enlace entre un requisito y un caso de prueba por la API

  Esquema del escenario: Un caso solo se enlaza con requisitos de su mismo programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido y el requisito <requisito> no tiene enlazado el caso <caso>
    Cuando envía PUT /api/requirements/<requisito>/tests/<caso> con ese accessToken como Bearer
    Entonces la respuesta es <respuesta>
    Y el par de <requisito> con <caso> <enlace> en links

    Ejemplos:
      | requisito | caso | respuesta | enlace |
      | REQ-028 | TC-009 | 422 con el código validation_failed y el motivo differentProgram en testCaseCode | no aparece |
      | REQ-028 | TC-010 | 204 sin cuerpo | aparece |
      | REQ-028 | TC-018 | 204 sin cuerpo | aparece |
      | REQ-028 | TC-019 | 422 con el código validation_failed y el motivo differentProgram en testCaseCode | no aparece |
      | REQ-040 | TC-018 | 422 con el código validation_failed y el motivo differentProgram en testCaseCode | no aparece |
      | REQ-040 | TC-025 | 204 sin cuerpo | aparece |

  Esquema del escenario: Un caso que no existe en el tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía PUT /api/requirements/REQ-028/tests/<caso> con ese accessToken como Bearer
    Entonces la respuesta es 404 con el código test_case_not_found
    Y el cuerpo no trae ningún dato del caso

    Ejemplos:
      | caso |
      | TC-000 |
      | TC-026 |
      | TC-999 |

  Esquema del escenario: Un requisito que no existe en el tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía PUT /api/requirements/<requisito>/tests/TC-010 con ese accessToken como Bearer
    Entonces la respuesta es 404 con el código requirement_not_found
    Y el cuerpo no trae ningún dato del requisito

    Ejemplos:
      | requisito |
      | REQ-000 |
      | REQ-041 |
      | PRG-002 |

  Esquema del escenario: Un requisito de otro tenant responde igual que uno que no existe
    Dado que en el tenant alumno01 y en el tenant alumno02, recién reiniciados, alumno02@sigpro.lab ha creado el requisito REQ-041 en PRG-001
    Cuando <cuenta> envía PUT /api/requirements/REQ-041/tests/TC-002 con su accessToken como Bearer y la cabecera x-tenant <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | cabecera | respuesta |
      | gestor@sigpro.test de alumno01 | alumno01 | 404 con el código requirement_not_found |
      | gestor@sigpro.test de alumno01 | alumno02 | 404 con el código requirement_not_found |
      | alumno02@sigpro.lab | alumno02 | 204 sin cuerpo |
```

## Fuera de alcance
- El enlace válido y su idempotencia: esta misma épica, en la historia de enlazar la API.
- Quién puede enlazar, con los 403 de cada rol: esta misma épica, en la historia de enlazar la API.
- Desenlazar un caso: esta misma épica, en la historia de desenlace de la API.
- Los permisos de alta, edición y borrado de requisitos: EP-REQ-EDICION.
