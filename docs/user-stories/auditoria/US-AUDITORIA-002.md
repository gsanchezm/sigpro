---
id: US-AUDITORIA-002
tipo: historia
epica: EP-AUDITORIA
titulo: "[API] Filtrar el registro por entidad, por rango de días y por texto"
etiquetas: [api]
relacionadas: [US-AUDITORIA-001, US-AUDITORIA-003, US-AUDITORIA-007, US-AUDITORIA-009]
verificacion: codigo
cubre: ["GET /api/audit"]
---

## Historia
Como admin o auditor que consulta la API, quiero reducir el registro a los eventos de una entidad, de un rango de días o que contengan un texto,
para encontrar un cambio concreto sin recorrer toda la lista.

## Reglas
- `entity` deja solo los eventos de esa entidad. Los valores válidos son `program`, `requirement`, `testrun`, `document`, `tenant`, `nc`, `milestone` y `user`. Sin `entity` no se filtra por entidad.
- `from` y `to` son días `AAAA-MM-DD` en UTC y los dos son inclusivos: `from` empieza a las 00:00:00.000 de su día y `to` termina a las 23:59:59.999 de su día. Sin el parámetro, ese lado no tiene límite. Un `from` posterior a `to` no devuelve ningún evento.
- Una fecha que no tiene la forma `AAAA-MM-DD` se ignora, como si no se hubiera enviado. Una fecha con esa forma que no existe en el calendario (`2026-13-01`, `2026-02-30`) también se ignora: la respuesta es la misma que sin ese parámetro.
- `q` busca el texto, sin distinguir mayúsculas, dentro de `action` y de `entityId`. No busca en el nombre del actor, en la entidad ni en el `diff`. Los espacios del principio y del final se recortan, y un `q` vacío no filtra.
- Los filtros se combinan: un evento tiene que cumplir todos los que se envían. `total` cuenta solo los eventos que cumplen los filtros, y `items` sale de ellos en el mismo orden (del más reciente al más antiguo).
- Preparación de cada fila, en el tenant `alumno01`: antes de cada fila se comprueba que el caos del tenant está apagado: `GET /api/config` con la cabecera `x-tenant: alumno01` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Solo después se reinicia el tenant con `POST /api/admin/reset`, ese mismo token y la cabecera `x-tenant: alumno01`. Después, `auditor@sigpro.test` (contraseña `Audit1234!`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken` como `Authorization: Bearer`. Iniciar sesión no deja ningún evento.
- Referencia de la semilla para los ejemplos: 130 eventos, desde `AL-001` (2026-01-06T11:30:00.000Z) hasta `AL-130` (2026-01-19T22:00:00.000Z). Por entidad: programa 39 eventos (creación, edición y archivo), requisito 65 (creación, edición, cambio de estado, reordenación y enlace), ejecución 13 y documento 13. No hay eventos de `tenant`, `nc`, `milestone` ni `user`.

## Criterios de aceptación
```gherkin
Característica: Filtros del registro de auditoría por la API

  Esquema del escenario: El filtro de entidad deja solo los eventos de esa entidad
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando envía GET /api/audit con <consulta>
    Entonces la respuesta es 200 con <eventos> eventos en items
    Y total vale <total>

    Ejemplos:
      | consulta | eventos | total |
      | entity=program | 20 | 39 |
      | entity=requirement | 20 | 65 |
      | entity=nc | 0 | 0 |

  Esquema del escenario: El límite de la página y el cursor respetan el total del filtro
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando envía GET /api/audit con entity=testrun y limit <limite>
    Entonces la respuesta trae <eventos> eventos en items
    Y nextCursor es <nextCursor>
    Y total vale 13

    Ejemplos:
      | limite | eventos | nextCursor |
      | 12 | 12 | un texto no vacío |
      | 13 | 13 | null |
      | 14 | 13 | null |

  Esquema del escenario: El rango de días incluye los dos extremos del día
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando envía GET /api/audit con <consulta>
    Entonces total vale <total>
    Y el último evento de items es <ultimo>

    Ejemplos:
      | consulta | total | ultimo |
      | from=2026-01-19&to=2026-01-19 | 9 | AL-122 |
      | from=2026-01-07&to=2026-01-07 | 10 | AL-006 |
      | to=2026-01-06 | 5 | AL-001 |
      | from=2026-01-19&to=2026-01-06 | 0 | (ninguno) |

  Esquema del escenario: Una fecha que no tiene la forma AAAA-MM-DD o no existe se ignora
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando envía GET /api/audit con <consulta>
    Entonces la respuesta es 200
    Y total vale 130

    Ejemplos:
      | consulta |
      | from=2026-1-5 |
      | from=2026-13-01 |
      | from=2026-02-30 |

  Esquema del escenario: El texto busca en la acción y en el código de la entidad, sin distinguir mayúsculas
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando envía GET /api/audit con <consulta>
    Entonces total vale <total>

    Ejemplos:
      | consulta | total |
      | q=STATE_CHANGED | 13 |
      | q=REQ-011 | 4 |
      | q=Javier | 0 |

  Esquema del escenario: Los filtros se combinan
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test tiene un accessToken
    Cuando envía GET /api/audit con <consulta>
    Entonces total vale <total>
    Y el primer evento es <primero>
    Y el último evento de items es <ultimo>

    Ejemplos:
      | consulta | total | primero | ultimo |
      | entity=requirement&from=2026-01-19&to=2026-01-19 | 5 | AL-130 | AL-122 |
```

## Fuera de alcance
- La lista sin filtros, el formato de los eventos y el primer evento de la semilla: los cubre EP-AUDITORIA en la API.
- El permiso `audit.view` y el aislamiento por tenant: los cubre EP-AUDITORIA en la API.
- Los mismos filtros vistos en pantalla, en la web y en la app móvil: los cubre EP-AUDITORIA en sus pantallas.

## Decisiones pendientes
- Qué responde la API ante un `entity` que no es una de las ocho entidades. Hoy responde 200 con la lista vacía, sin validar el valor; no está decidido si debe ser un error de validación. Ninguna fila lo afirma.
