---
id: US-REQ-TRAZA-004
tipo: historia
epica: EP-REQ-TRAZA
titulo: "[API] Desenlazar un caso de prueba de un requisito"
etiquetas: [api]
relacionadas: [US-REQ-TRAZA-002, US-REQ-TRAZA-003]
verificacion: codigo
cubre: ["DELETE /api/requirements/:code/tests/:testCaseCode"]
permisos: [requirement.edit]
---

## Historia
Como cliente de la API con un rol que edita requisitos, quiero quitar el enlace entre un requisito y un caso de prueba,
para que la matriz deje de contar ese caso como verificación de ese requisito, sin borrar ni el requisito ni el caso.

## Reglas
- `DELETE /api/requirements/:code/tests/:testCaseCode` no lleva cuerpo y responde 204 sin cuerpo.
- Quitar un enlace existente borra solo ese enlace: el requisito y el caso siguen existiendo, el caso sigue en `testCases` del programa y el resto de casos enlazados con el requisito se mantienen.
- Quitar un enlace que no existe (porque ya se quitó o nunca se creó) responde 204 sin cuerpo y no cambia nada.
- Solo pueden quitar enlaces los roles con el permiso `requirement.edit`: `admin`, `program_manager` y `consultant`. Un `auditor` recibe 403 con `code` `forbidden` y el enlace se mantiene; esa comprobación va antes que la de que el requisito exista.
- Un requisito que no existe en el tenant del token responde 404 con `code` y `message` iguales a `requirement_not_found`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la cuenta de la fila inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken` como `Authorization: Bearer`. Las cuentas son `consultor@sigpro.test` (`Consul1234!`, rol `consultant`), `gestor@sigpro.test` (`Gestor1234!`, rol `program_manager`), `auditor@sigpro.test` (`Audit1234!`, rol `auditor`) y `alumno01@sigpro.lab` (`Alumno1234!`, rol `admin`, sin segundo factor).
- Tras un reinicio, `REQ-017` (de `PRG-002`) tiene solo el caso `TC-012`; `REQ-022` tiene `TC-010` y `TC-017`; `REQ-023` tiene `TC-011` y `TC-018`; `REQ-028` no tiene casos; `REQ-001` (de `PRG-001`) no tiene `TC-009`, y `REQ-017` no tiene `TC-013`.

## Criterios de aceptación
```gherkin
Característica: Desenlace entre un requisito y un caso de prueba por la API

  Esquema del escenario: Quitar un enlace existente responde 204 y lo borra
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene un accessToken válido y el requisito <requisito> tiene enlazado el caso <caso>
    Cuando envía DELETE /api/requirements/<requisito>/tests/<caso> con ese accessToken como Bearer
    Entonces la respuesta es 204 sin cuerpo
    Y el par de <requisito> con <caso> no aparece en links de GET /api/programs/PRG-002/traceability
    Y los casos enlazados de <requisito> son <conserva>
    Y el caso <caso> sigue en testCases

    Ejemplos:
      | cuenta | requisito | caso | conserva |
      | consultor@sigpro.test | REQ-017 | TC-012 | (ninguno) |
      | gestor@sigpro.test | REQ-022 | TC-017 | TC-010 |
      | alumno01@sigpro.lab | REQ-023 | TC-018 | TC-011 |

  Esquema del escenario: Quitar un enlace que no existe responde 204 y no cambia nada
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene un accessToken válido
    Cuando envía DELETE /api/requirements/<requisito>/tests/<caso> con ese accessToken como Bearer
    Entonces la respuesta es 204 sin cuerpo
    Y los enlaces de <programa> quedan igual que tras el reinicio

    Ejemplos:
      | cuenta | requisito | caso | programa |
      | consultor@sigpro.test | REQ-028 | TC-010 | PRG-002 |
      | gestor@sigpro.test | REQ-001 | TC-009 | PRG-001 |
      | alumno01@sigpro.lab | REQ-017 | TC-013 | PRG-002 |

  Esquema del escenario: Un rol sin permiso de edición recibe 403 y el enlace se mantiene
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken válido
    Cuando envía DELETE /api/requirements/<requisito>/tests/<caso> con ese accessToken como Bearer
    Entonces la respuesta es 403 con el código forbidden
    Y el par de <requisito> con <caso> <situacion> en links de GET /api/programs/PRG-002/traceability

    Ejemplos:
      | requisito | caso | situacion |
      | REQ-017 | TC-012 | sigue apareciendo |
      | REQ-999 | TC-010 | no aparece |

  Esquema del escenario: Un requisito que no existe en el tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken válido
    Cuando envía DELETE /api/requirements/<requisito>/tests/TC-012 con ese accessToken como Bearer
    Entonces la respuesta es 404 con el código requirement_not_found
    Y el cuerpo no trae ningún dato del requisito

    Ejemplos:
      | requisito |
      | REQ-000 |
      | REQ-041 |
      | REQ-999 |
```

## Fuera de alcance
- Enlazar un caso y las respuestas de rechazo de ese enlace: esta misma épica, en las historias de enlazar la API.
- Quién puede enlazar, con los 403 de cada rol: esta misma épica, en la historia de enlazar la API.
- La matriz donde se desmarca un cruce, en la web y en la app móvil: esta misma épica, en sus historias de la pantalla.
- Borrar un requisito, que quita también sus enlaces: EP-REQ-EDICION.

## Decisiones pendientes
- Desenlazar un caso que no existe en el tenant (por ejemplo `TC-999`) responde hoy 204 y no cambia nada, mientras que enlazarlo responde 404 `test_case_not_found`. No está decidido si desenlazar debe responder 404 en ese caso. Ninguna fila de esta historia lo afirma.
