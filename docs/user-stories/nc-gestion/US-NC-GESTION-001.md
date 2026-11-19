---
id: US-NC-GESTION-001
tipo: historia
epica: EP-NC-GESTION
titulo: "[API] Dar de alta una no conformidad con código NC-NNN"
etiquetas: [api]
relacionadas: [US-NC-GESTION-002, US-NC-GESTION-006, US-NC-GESTION-010]
verificacion: codigo
cubre: ["POST /api/nc"]
permisos: [nc.create]
---

## Historia
Como cliente de la API con una sesión en un tenant, quiero abrir una no conformidad de un programa indicando su severidad y su descripción,
para que quede registrada en estado «Abierta» con un código correlativo y pueda seguirse, editarse y cerrarse.

## Reglas
- `POST /api/nc` lo puede usar cualquier rol del tenant: `admin`, `program_manager`, `consultant` y `auditor` tienen el permiso `nc.create`. Ningún rol recibe 403 al abrir una no conformidad.
- Sin cabecera `Authorization` responde 401 `missing_token`; con un token que no se puede verificar, 401 `invalid_token`.
- El cuerpo lleva `programCode` (código de un programa del tenant), `severity` (`minor`, `major` o `critical`), `description` (texto; su longitud mínima está en la historia US-NC-GESTION-002) y, opcionalmente, `assigneeId` (id de una persona del tenant). Sin `assigneeId`, la no conformidad queda sin asignar.
- La no conformidad nace en estado `open`, sin comentarios (`commentCount` 0), sin ejecución de prueba vinculada (`testRunId` null) y con el nombre de su programa (`programName`).
- El código es `NC-` seguido de tres dígitos: el siguiente al mayor que ya existe en el tenant. Tras el reinicio, que deja NC-001 a NC-012, la primera alta devuelve `NC-013` y la siguiente `NC-014`. Los códigos no se reutilizan.
- La respuesta es 201 con la no conformidad: `code`, `programCode`, `programName`, `severity`, `description`, `state`, `assigneeId`, `assigneeName`, `testRunId`, `commentCount` y `createdAt`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, cada cuenta obtiene su token con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`) y `auditor@sigpro.test` (`Audit1234!`). Las altas previas de una fila se hacen con `POST /api/nc` antes de la petición que se examina, con el token de `gestor@sigpro.test`.
- En los ejemplos, `(10 letras a)` es un texto de diez letras `a` seguidas, sin espacios.

## Criterios de aceptación
```gherkin
Característica: Alta de una no conformidad por la API

  Esquema del escenario: Cada rol del tenant abre una no conformidad
    Dado que en el tenant alumno01, recién reiniciado, <correo> con el rol <rol> inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc con x-tenant alumno01, su token, el programa PRG-001, la severidad major y la descripción (10 letras a)
    Entonces la respuesta es 201
    Y el código de la no conformidad es NC-013 y su estado es open
    Y su programa es PRG-001

    Ejemplos:
      | correo | rol |
      | alumno01@sigpro.lab | admin |
      | gestor@sigpro.test | program_manager |
      | consultor@sigpro.test | consultant |
      | auditor@sigpro.test | auditor |

  Esquema del escenario: La severidad y la persona responsable iniciales se guardan como se envían
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc con x-tenant alumno01, ese token, el programa PRG-001, la severidad <severidad>, la descripción (10 letras a) y la persona <asignado>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | severidad | asignado | respuesta |
      | minor | (sin el campo) | 201 con assigneeId null y assigneeName null |
      | major | u3 | 201 con assigneeId u3 y assigneeName Lucía Fernández |
      | critical | u4 | 201 con assigneeId u4 y assigneeName Andrés Molina |

  Esquema del escenario: Cada alta toma el código siguiente al último del tenant
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto <altas_previas> no conformidades con POST /api/nc
    Cuando envía POST /api/nc con x-tenant alumno01, su token, el programa PRG-001, la severidad minor y la descripción (10 letras a)
    Entonces la respuesta es 201 con el código <codigo>

    Ejemplos:
      | altas_previas | codigo |
      | 0 | NC-013 |
      | 1 | NC-014 |
      | 2 | NC-015 |

  Esquema del escenario: Sin un token válido no se abre ninguna no conformidad
    Dado que en el tenant alumno01, recién reiniciado, la petición no lleva un token válido
    Cuando envía POST /api/nc con x-tenant alumno01, <autorizacion>, el programa PRG-001, la severidad minor y la descripción (10 letras a)
    Entonces la respuesta es <respuesta>
    Y GET /api/nc de ese tenant sigue devolviendo 12 no conformidades

    Ejemplos:
      | autorizacion | respuesta |
      | (sin cabecera Authorization) | 401 missing_token |
      | Bearer token-inventado | 401 invalid_token |
```

## Fuera de alcance
- Los motivos de rechazo del alta (programa, severidad, descripción y persona): US-NC-GESTION-002.
- La edición de los datos después del alta: US-NC-GESTION-003.
- La pantalla de alta de la web y de la app móvil: US-NC-GESTION-006 y US-NC-GESTION-010.
- La lista de no conformidades y el tablero por estado: EP-NC-TABLERO.
- Los registros de auditoría y el indicador en vivo del panel de misión: EP-AUDITORIA y EP-MISION-FEED.
