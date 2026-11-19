---
id: US-NC-GESTION-002
tipo: historia
epica: EP-NC-GESTION
titulo: "[API] Rechazar el alta de una no conformidad con motivos de validación"
etiquetas: [api]
relacionadas: [US-NC-GESTION-001, US-NC-GESTION-006, US-NC-GESTION-010]
verificacion: codigo
cubre: ["POST /api/nc"]
---

## Historia
Como cliente de la API que abre una no conformidad, quiero que una petición no válida se rechace con el motivo de cada campo,
para corregir los datos sin que se cree una no conformidad a medias ni se gaste un código.

## Reglas
- Una petición no válida responde 422 `validation_failed` con un objeto `errors` que tiene un motivo por campo. Los motivos son las claves del catálogo de la no conformidad: `programRequired`, `severityRequired`, `descShort`, `badAssignee`.
- `programCode` es obligatorio. Vacío, o un código que no es un programa del tenant, da `programRequired` en `programCode`.
- `severity` es obligatoria y debe ser `minor`, `major` o `critical`. Vacía, sin el campo o con otro valor da `severityRequired` en `severity`.
- `description` cuenta sus caracteres como texto sin formato, sin las etiquetas del formato y sin los espacios del principio y del final. Debe tener al menos 10 caracteres; si tiene menos, o está vacía, da `descShort` en `description`. Con 10 caracteres o más, se acepta.
- `assigneeId`, si se envía, debe ser el id de una persona del tenant. Si no existe, da `badAssignee` en `assigneeId` (422).
- Una petición rechazada no gasta código: la siguiente alta válida obtiene el código que le habría tocado.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `gestor@sigpro.test` (`Gestor1234!`) obtiene su token con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`. Todas las peticiones llevan `x-tenant: alumno01`.
- En los ejemplos, `(N letras a)` es un texto de N letras `a` seguidas, sin espacios, y `(N espacios)` son N espacios seguidos.

## Criterios de aceptación
```gherkin
Característica: Validación del alta de una no conformidad por la API

  Esquema del escenario: El programa y la severidad se validan antes de abrir la no conformidad
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc con x-tenant alumno01, ese token, el programa <programa>, la severidad <severidad> y la descripción (10 letras a)
    Entonces la respuesta es 422 validation_failed
    Y el motivo de <campo> es <motivo>

    Ejemplos:
      | programa | severidad | campo | motivo |
      | (vacío) | major | programCode | programRequired |
      | PRG-999 | major | programCode | programRequired |
      | PRG-001 | (vacío) | severity | severityRequired |
      | PRG-001 | enorme | severity | severityRequired |
      | PRG-001 | (sin el campo) | severity | severityRequired |

  Esquema del escenario: La descripción debe tener al menos 10 caracteres
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc con x-tenant alumno01, ese token, el programa PRG-001, la severidad major y la descripción <descripcion>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | descripcion | respuesta |
      | (vacío) | 422 validation_failed con el motivo descShort en description |
      | (9 letras a) | 422 validation_failed con el motivo descShort en description |
      | (12 espacios) | 422 validation_failed con el motivo descShort en description |
      | (10 letras a) | 201 con el código NC-013 |
      | (11 letras a) | 201 con el código NC-013 |

  Esquema del escenario: La persona responsable debe existir en el tenant
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc con x-tenant alumno01, ese token, el programa PRG-001, la severidad major, la descripción (10 letras a) y la persona <asignado>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | asignado | respuesta |
      | u99 | 422 validation_failed con el motivo badAssignee en assigneeId |
      | u3 | 201 con el código NC-013 y assigneeName Lucía Fernández |

  Esquema del escenario: Una petición rechazada no gasta código
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc con x-tenant alumno01, ese token y un cuerpo válido salvo por <rechazo>
    Y después envía POST /api/nc con x-tenant alumno01, ese token, el programa PRG-001, la severidad minor y la descripción (10 letras a)
    Entonces la respuesta a la primera petición es 422 validation_failed
    Y la respuesta a la segunda es 201 con el código NC-013

    Ejemplos:
      | rechazo |
      | la severidad enorme |
      | la descripción de 9 letras a |
      | el programa PRG-999 |
```

## Fuera de alcance
- Las pantallas de alta de la web y de la app móvil, con sus propios mensajes bajo cada campo: US-NC-GESTION-006 y US-NC-GESTION-010.
- Los mismos motivos al editar una no conformidad: US-NC-GESTION-003.
- El permiso para abrir la no conformidad y el alta correcta: US-NC-GESTION-001.

## Decisiones pendientes
- Qué motivo se devuelve cuando falta el campo `programCode` o el campo `description`. Hoy el esquema devuelve el mensaje por defecto de la validación, que no es una de las claves del catálogo, y por eso esta historia no lo afirma.
- Qué motivo se devuelve cuando `assigneeId` llega como cadena vacía. Hoy tampoco es una clave del catálogo.
