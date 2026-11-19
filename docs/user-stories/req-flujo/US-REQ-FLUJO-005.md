---
id: US-REQ-FLUJO-005
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[API] Registrar cada paso aceptado en la auditoría y dejar intacto el resto del requisito"
etiquetas: [api]
relacionadas: [US-REQ-FLUJO-001, US-REQ-FLUJO-004]
verificacion: codigo
cubre: ["POST /api/requirements/:code/transition"]
---

## Historia
Como persona que responde de la trazabilidad del proceso, quiero que cada cambio de estado quede registrado con quién lo hizo y cuándo, y que nada más del requisito cambie,
para poder reconstruir cómo llegó a su estado actual sin que el paso altere su contenido.

## Reglas
- Cada paso aceptado escribe en la auditoría del tenant un evento con la acción `requirement.state_changed`, la entidad `requirement`, el código del requisito como identificador y el cambio `from` → `to`. El autor del evento es la cuenta que dio el paso, con su nombre: `Javier Ortega` para `gestor@sigpro.test`, `Andrés Molina` para `auditor@sigpro.test` y `Alumno 01` para `alumno01@sigpro.lab`. La hora del paso queda en el evento; el requisito no guarda ninguna fecha de cambio.
- El evento se escribe en la misma operación que el cambio. Si el paso se rechaza (401, 403, 404, 409 o 422), no se añade ningún evento a la auditoría.
- La auditoría la leen las cuentas con rol `admin` y `auditor`. En esta historia la lee `alumno01@sigpro.lab`, con `GET /api/audit`, que devuelve primero el evento más reciente y un `total` con los eventos del tenant.
- Un paso cambia solo el estado. El título, la descripción, la prioridad, las etiquetas, la posición entre hermanos y los casos de prueba enlazados quedan como estaban. Un paso a `draft` tampoco cambia el texto del requisito: a diferencia de editar el título o la descripción, no altera nada más.
- El paso se aplica solo en el tenant del token que lo envía: el requisito con el mismo código en otro tenant no cambia.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la cuenta de la fila y `alumno01@sigpro.lab` inician sesión en `alumno01` con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`. Si la fila usa `alumno02`, el tenant también se reinicia, con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`). Las cuentas `gestor@sigpro.test` (`Gestor1234!`) y `consultor@sigpro.test` (`Consul1234!`) son las del seed; `auditor@sigpro.test` tiene la contraseña `Audit1234!`. Tras el reinicio, `REQ-001` está en `approved`, `REQ-002` en `verified` y `REQ-017` en `draft`.

## Criterios de aceptación
```gherkin
Característica: Efectos de un paso de estado por la API

  Esquema del escenario: Un paso aceptado deja en la auditoría el cambio y su autor
    Dado que en el tenant alumno01, recién reiniciado, <requisito> está en estado <desde> y <cuenta> y alumno01@sigpro.lab han iniciado sesión en ese tenant
    Cuando envía POST /api/requirements/<requisito>/transition con el cuerpo {"to": "<hasta>"}
    Entonces la respuesta es 200
    Y el evento más reciente de la auditoría sobre <requisito> tiene la acción requirement.state_changed, el cambio de <desde> a <hasta> y como autor a <autor>

    Ejemplos:
      | requisito | desde | cuenta | hasta | autor |
      | REQ-017 | draft | gestor@sigpro.test | approved | Javier Ortega |
      | REQ-002 | verified | auditor@sigpro.test | validated | Andrés Molina |
      | REQ-001 | approved | alumno01@sigpro.lab | draft | Alumno 01 |

  Esquema del escenario: Un paso rechazado no añade ningún evento a la auditoría
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> y alumno01@sigpro.lab han iniciado sesión en ese tenant, y alumno01@sigpro.lab anota el total de eventos de la auditoría del tenant
    Cuando <cuenta> envía POST /api/requirements/<requisito>/transition con el cuerpo <cuerpo>
    Entonces la respuesta es <respuesta>
    Y el total de eventos de la auditoría del tenant sigue igual

    Ejemplos:
      | cuenta | requisito | cuerpo | respuesta |
      | alumno01@sigpro.lab | REQ-001 | {"to": "approved"} | 409 con el código invalid_transition |
      | consultor@sigpro.test | REQ-017 | {"to": "approved"} | 403 con el código forbidden |
      | alumno01@sigpro.lab | REQ-017 | {"to": "done"} | 422 con el código validation_failed |
      | alumno01@sigpro.lab | REQ-041 | {"to": "approved"} | 404 con el código requirement_not_found |

  Esquema del escenario: Un paso cambia solo el estado del requisito
    Dado que en el tenant alumno01, recién reiniciado, <requisito> está en estado <desde>, y <cuenta> ha iniciado sesión en ese tenant y lee el requisito antes del paso
    Cuando envía POST /api/requirements/<requisito>/transition con el cuerpo {"to": "<hasta>"}
    Entonces la respuesta es 200 y todos los campos del requisito son iguales a los de la lectura anterior, salvo state
    Y el estado pasa de <desde> a <hasta>

    Ejemplos:
      | requisito | desde | cuenta | hasta |
      | REQ-017 | draft | gestor@sigpro.test | approved |
      | REQ-002 | verified | gestor@sigpro.test | draft |

  Esquema del escenario: El paso solo afecta al tenant del token que lo envía
    Dado que los tenants alumno01 y alumno02 están recién reiniciados y gestor@sigpro.test ha iniciado sesión en los dos
    Cuando envía POST /api/requirements/REQ-017/transition con el token de su sesión en <tenant> y el cuerpo {"to": "approved"}
    Entonces la respuesta es 200 y REQ-017 queda en estado approved en <tenant>
    Y con el token de su sesión en <otro> REQ-017 sigue en estado draft

    Ejemplos:
      | tenant | otro |
      | alumno02 | alumno01 |
      | alumno01 | alumno02 |
```

## Fuera de alcance
- La pantalla del registro de auditoría (filtros, búsqueda, paginación por cursor): la épica de Auditoría, todavía sin redactar.
- El aislamiento de datos entre tenants más allá de este flujo: la épica transversal de multi-tenant.
- La lectura del requisito en el árbol y en el detalle: EP-REQ-ARBOL.
- Editar el texto de un requisito y su vuelta a borrador: EP-REQ-EDICION.
