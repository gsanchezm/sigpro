---
id: US-REQ-TRAZA-002
tipo: historia
epica: EP-REQ-TRAZA
titulo: "[API] Enlazar un caso de prueba con un requisito del mismo programa"
etiquetas: [api]
relacionadas: [US-REQ-TRAZA-001, US-REQ-TRAZA-003, US-REQ-TRAZA-006]
verificacion: codigo
cubre: ["PUT /api/requirements/:code/tests/:testCaseCode"]
permisos: [requirement.edit]
---

## Historia
Como cliente de la API con un rol que edita requisitos, quiero enlazar un caso de prueba con un requisito de su mismo programa,
para que la matriz de trazabilidad muestre que ese caso verifica ese requisito.

## Reglas
- `PUT /api/requirements/:code/tests/:testCaseCode` no lleva cuerpo. `:code` es el código del requisito y `:testCaseCode` el del caso de prueba.
- Solo pueden enlazar los roles con el permiso `requirement.edit`: `admin`, `program_manager` y `consultant`. Un `auditor` recibe 403 con `code` `forbidden`, y el enlace no se crea; esa comprobación va antes que la de que el requisito o el caso existan.
- Un enlace nuevo responde 204 sin cuerpo. Desde entonces `GET /api/programs/:code/traceability` lo lista en `links`.
- Enlazar un par que ya está enlazado responde 204 sin cuerpo y no crea un segundo enlace: el par aparece una sola vez en `links`.
- El requisito y el caso deben ser del mismo programa. Un caso de otro programa no se enlaza: responde 422 con `code` `validation_failed` y `errors` con `testCaseCode` igual a `differentProgram`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la cuenta de la fila inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken` como `Authorization: Bearer`. Las cuentas son `consultor@sigpro.test` (`Consul1234!`, rol `consultant`), `gestor@sigpro.test` (`Gestor1234!`, rol `program_manager`), `auditor@sigpro.test` (`Audit1234!`, rol `auditor`) y `alumno01@sigpro.lab` (`Alumno1234!`, rol `admin`, sin segundo factor).
- Tras un reinicio, `REQ-028` (de `PRG-002`) no tiene casos enlazados; `REQ-017` (de `PRG-002`) tiene solo `TC-012`; `REQ-022` (de `PRG-002`) tiene `TC-010` y `TC-017`; `REQ-001` (de `PRG-001`) no tiene `TC-002`, que es de `PRG-001`; `REQ-028` no tiene `TC-011`, que es de `PRG-002`.

## Criterios de aceptación
```gherkin
Característica: Enlace entre un requisito y un caso de prueba por la API

  Esquema del escenario: Un enlace nuevo responde 204 y aparece en la matriz
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene un accessToken válido y el requisito <requisito> no tiene enlazado el caso <caso>
    Cuando envía PUT /api/requirements/<requisito>/tests/<caso> con ese accessToken como Bearer
    Entonces la respuesta es 204 sin cuerpo
    Y links de GET /api/programs/<programa>/traceability contiene el enlace de <requisito> con <caso>

    Ejemplos:
      | cuenta | requisito | caso | programa |
      | consultor@sigpro.test | REQ-028 | TC-010 | PRG-002 |
      | gestor@sigpro.test | REQ-001 | TC-002 | PRG-001 |
      | alumno01@sigpro.lab | REQ-028 | TC-011 | PRG-002 |

  Esquema del escenario: Enlazar un par ya enlazado responde 204 y no lo duplica
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene un accessToken válido y el requisito <requisito> ya tiene enlazado el caso <caso>
    Cuando envía dos veces PUT /api/requirements/<requisito>/tests/<caso> con ese accessToken como Bearer
    Entonces las dos respuestas son 204 sin cuerpo
    Y links de GET /api/programs/<programa>/traceability contiene el enlace de <requisito> con <caso> una sola vez

    Ejemplos:
      | cuenta | requisito | caso | programa |
      | consultor@sigpro.test | REQ-017 | TC-012 | PRG-002 |
      | gestor@sigpro.test | REQ-022 | TC-010 | PRG-002 |
      | alumno01@sigpro.lab | REQ-022 | TC-017 | PRG-002 |

  Esquema del escenario: Un rol sin permiso de edición recibe 403 aunque el requisito no exista
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken válido
    Cuando envía PUT /api/requirements/<requisito>/tests/<caso> con ese accessToken como Bearer
    Entonces la respuesta es 403 con el código forbidden
    Y links de GET /api/programs/PRG-002/traceability no contiene el enlace de <requisito> con <caso>

    Ejemplos:
      | requisito | caso |
      | REQ-028 | TC-010 |
      | REQ-022 | TC-011 |
      | REQ-999 | TC-010 |

  Esquema del escenario: Sin una sesión de acceso válida no se enlaza
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y un refreshToken válidos
    Cuando envía PUT /api/requirements/REQ-028/tests/TC-010 con <credencial>
    Entonces la respuesta es <respuesta>
    Y links de GET /api/programs/PRG-002/traceability no contiene el enlace de REQ-028 con TC-010

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera Authorization) | 401 con el código missing_token |
      | una cabecera Bearer con un texto que no es JWT | 401 con el código invalid_token |
      | una cabecera Bearer con el refreshToken de gestor@sigpro.test | 401 con el código invalid_token |
```

## Fuera de alcance
- Los rechazos del enlace (requisito o caso inexistentes, caso de otro programa): esta misma épica, en la historia de rechazos de la API.
- Desenlazar un caso: esta misma épica, en la historia de desenlace de la API.
- La matriz donde se marcan los cruces, en la web y en la app móvil: esta misma épica, en sus historias de la pantalla.
- Los permisos de alta, edición y borrado de requisitos: EP-REQ-EDICION.
