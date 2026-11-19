---
id: US-DOC-LISTA-002
tipo: historia
epica: EP-DOC-LISTA
titulo: "[API] Filtrar la lista de documentos por programa, clasificación y texto"
etiquetas: [api]
relacionadas: [US-DOC-LISTA-001, US-DOC-LISTA-007, US-DOC-LISTA-013]
verificacion: ejecutada
cubre: ["GET /api/documents"]
---

## Historia
Como cliente de la API con una sesión iniciada, quiero acotar la lista de documentos por programa, por clasificación o por un texto del código o del título,
para encontrar un documento sin recorrer todos los del tenant.

## Reglas
- Los tres parámetros son opcionales y se combinan: un documento sale en la lista solo si cumple todos los que se envían.
- `program` se compara con el código del programa tal cual (`PRG-002`). Sin valor (`program=`) no filtra. Un código que no existe en el tenant, o que existe sin documentos, responde 200 con una lista vacía, no 404.
- `classification` se compara con la clasificación del documento: `public` o `restricted`.
- `q` busca el texto dentro del código del documento y dentro de su título, sin distinguir mayúsculas y sin contar los espacios del principio y del final; si no queda texto, no filtra. No busca en el nombre del programa.
- Con filtros, la respuesta tiene la misma forma que la lista completa: `items` con los mismos campos y `hiddenCount`.
- En los ejemplos, `(vacío)` en la columna `programa` es el parámetro sin valor (`program=`), `(ninguno)` es una lista sin documentos y `(tres espacios)` es un texto formado por tres espacios.
- Datos del seed que citan los ejemplos: en cada tenant hay doce documentos, `DOC-001` a `DOC-012`, dos por programa de `PRG-001` a `PRG-006`. Son restringidos `DOC-003`, `DOC-006`, `DOC-009` y `DOC-012`; el resto son públicos. Los títulos son «Plan de verificación» (impares) y «Especificación técnica» (pares), seguidos del código del programa.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); el reinicio se aplica al tenant de ese token. Después `gestor@sigpro.test` (contraseña `Gestor1234!`, rol `program_manager`) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y su `accessToken` va en `Authorization: Bearer`.

## Criterios de aceptación
```gherkin
Característica: Filtros de la lista de documentos por la API

  Esquema del escenario: El filtro por programa acota la lista a los documentos de ese programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents?program=<programa> con ese accessToken como Bearer
    Entonces la respuesta es 200 con <cuantos> documentos
    Y los documentos son <codigos>

    Ejemplos:
      | programa | cuantos | codigos |
      | PRG-002 | 2 | DOC-003 y DOC-004 |
      | PRG-024 | 0 | (ninguno) |
      | PRG-099 | 0 | (ninguno) |
      | (vacío) | 12 | DOC-001 a DOC-012 |

  Esquema del escenario: El filtro por clasificación acota la lista a los documentos de esa clasificación
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents?classification=<clasificacion> con ese accessToken como Bearer
    Entonces la respuesta es 200 con <cuantos> documentos, todos con la clasificación <clasificacion>
    Y el primero es <primero> y el último es <ultimo>

    Ejemplos:
      | clasificacion | cuantos | primero | ultimo |
      | restricted | 4 | DOC-003 | DOC-012 |
      | public | 8 | DOC-001 | DOC-011 |

  Esquema del escenario: El texto busca en el código y en el título, sin distinguir mayúsculas ni espacios sobrantes
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents?q=<texto> con ese accessToken como Bearer
    Entonces la respuesta es 200 con <cuantos> documentos
    Y los documentos son <codigos>

    Ejemplos:
      | texto | cuantos | codigos |
      | plan | 6 | DOC-001, DOC-003, DOC-005, DOC-007, DOC-009 y DOC-011 |
      | PLAN | 6 | DOC-001, DOC-003, DOC-005, DOC-007, DOC-009 y DOC-011 |
      | doc-004 | 1 | DOC-004 |
      | PRG-004 | 2 | DOC-007 y DOC-008 |
      | (tres espacios) | 12 | DOC-001 a DOC-012 |
      | Ártemis | 0 | (ninguno) |
      | zzz-no-existe | 0 | (ninguno) |

  Esquema del escenario: Los filtros se combinan: el documento debe cumplir todos los que se envían
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/documents?<filtros> con ese accessToken como Bearer
    Entonces la respuesta es 200 con <cuantos> documentos
    Y los documentos son <codigos>

    Ejemplos:
      | filtros | cuantos | codigos |
      | program=PRG-002&classification=restricted | 1 | DOC-003 |
      | program=PRG-001&classification=restricted | 0 | (ninguno) |
      | program=PRG-002&q=técnica | 1 | DOC-004 |
```

## Decisiones pendientes
- Qué responde la lista cuando `classification` tiene un valor distinto de `public` y `restricted` (por ejemplo, `confidencial`). Hoy responde 200 con una lista vacía, sin validar el valor; no está decidido si debe responder con un error de validación.
- Si el texto debe ignorar los acentos. Hoy no los ignora: `especificacion` no encuentra los títulos con «Especificación».

## Fuera de alcance
- Filtros por tipo de documento o por estado: el documento no tiene ni tipo ni estado. El texto de búsqueda alcanza el tipo cuando aparece en el título.
- La pantalla de filtros de la web y de la app móvil: historias de web y de móvil de esta épica.
- Los documentos restringidos que cada rol puede ver: EP-DOC-RESTRINGIDOS.
