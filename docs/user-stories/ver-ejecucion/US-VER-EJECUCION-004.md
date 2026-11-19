---
id: US-VER-EJECUCION-004
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[API] Descargar una evidencia por su identificador, dentro de su tenant"
etiquetas: [api]
relacionadas: [US-VER-EJECUCION-001, US-VER-EJECUCION-002, US-VER-EJECUCION-003, US-VER-EJECUCION-007, US-VER-EJECUCION-010]
verificacion: codigo
cubre: ["GET /api/evidence/:id"]
---

## Historia
Como cliente de la API con una sesión de SIGPRO (la web, la app móvil o una suite de pruebas), quiero descargar una evidencia de una ejecución por su identificador,
para ver la captura o el PDF que se adjuntó, sin poder ver nunca las evidencias de otra organización.

## Reglas
- `GET /api/evidence/:id` exige una sesión de acceso. Sin cabecera `Authorization` responde 401 con `code: "missing_token"`; con un `Bearer` cuyo texto no es un token válido, 401 con `code: "invalid_token"`.
- No tiene permiso propio: cualquier rol autenticado (`admin`, `program_manager`, `consultant` y `auditor`) la puede descargar.
- Con una evidencia del tenant del token, responde 200 con el mismo contenido que se guardó al adjuntarla y estas cabeceras: `Content-Type`, con el tipo de la evidencia (`image/png`, `image/jpeg` o `application/pdf`); `Content-Disposition: inline`, con el nombre de la evidencia en `filename` y en `filename*` (UTF-8); y `Cache-Control: private, max-age=300`.
- Un identificador que no existe en el tenant del token responde 404 con `code: "evidence_not_found"`. Eso incluye una evidencia que existe en otro tenant: el tenant sale del token, y la cabecera `x-tenant` no lo cambia.
- Las evidencias del seed son `EV-001` a `EV-013`, todas PNG, y la misma serie existe en cada tenant `alumnoNN`. `EV-001` es la captura `TC-001-001.png`, de la ejecución `RUN-001` del caso `TC-001`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las cuentas de la fila inician sesión con `POST /api/auth/login` y la cabecera `x-tenant` de su tenant, y usan su `accessToken` como `Authorization: Bearer`. Las contraseñas son las del seed: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y `alumno01@sigpro.lab` (`Alumno1234!`).
- Las filas que necesitan una evidencia recién subida la crean en la propia fila, con `POST /api/test-cases/TC-001/runs` y el token de `alumno01@sigpro.lab` (el rol `program_manager` no puede registrar ejecuciones). `(captura recién subida)` es la evidencia `EV-014` de esa ejecución, con el campo `result` con el valor `pass` y un PNG válido de 1.024 bytes llamado `captura.png`. `(PDF recién subido)` es la evidencia `EV-014` de una ejecución registrada del mismo modo, con un PDF válido de 1.024 bytes llamado `informe.pdf`.
- Las filas de aislamiento reinician también `alumno02` con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`). En `alumno02` no se sube ninguna evidencia, así que `EV-014` no existe allí.

## Criterios de aceptación
```gherkin
Característica: Descarga de una evidencia por la API

  Esquema del escenario: Cualquier rol autenticado descarga la evidencia del seed
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la API con x-tenant alumno01
    Cuando pide GET /api/evidence/EV-001
    Entonces la respuesta es 200 con Content-Type image/png, Content-Disposition inline con el nombre TC-001-001.png y Cache-Control private, max-age=300
    Y el cuerpo es un PNG válido

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | auditor@sigpro.test |

  Esquema del escenario: Una evidencia recién subida conserva su tipo y su nombre
    Dado que en el tenant alumno01, recién reiniciado, <evidencia> está guardada en TC-001 y gestor@sigpro.test ha iniciado sesión en la API con x-tenant alumno01
    Cuando pide GET /api/evidence/EV-014
    Entonces la respuesta es 200 con Content-Type <tipo> y Content-Disposition inline con el nombre <nombre>
    Y el cuerpo es el mismo archivo que se adjuntó

    Ejemplos:
      | evidencia | tipo | nombre |
      | (captura recién subida) | image/png | captura.png |
      | (PDF recién subido) | application/pdf | informe.pdf |

  Esquema del escenario: Sin una sesión válida la evidencia no se entrega
    Dado que en el tenant alumno01, recién reiniciado, la evidencia EV-001 existe y alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando pide GET /api/evidence/EV-001 con la cabecera Authorization <cabecera_authorization>
    Entonces la respuesta es <respuesta>
    Y el cuerpo de la respuesta no es el archivo de la evidencia

    Ejemplos:
      | cabecera_authorization | respuesta |
      | (sin cabecera) | 401 missing_token |
      | (Bearer con un texto que no es un token) | 401 invalid_token |

  Esquema del escenario: Una evidencia solo es visible dentro de su tenant
    Dado que en los tenants alumno01 y alumno02, recién reiniciados, la fila registra (captura recién subida) en alumno01, y alumno01@sigpro.lab y alumno02@sigpro.lab han iniciado sesión en la API en su propio tenant
    Cuando <cuenta> pide GET /api/evidence/<id> con la cabecera x-tenant <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | id | cabecera | respuesta |
      | alumno01@sigpro.lab | EV-014 | alumno01 | 200 con Content-Type image/png y el nombre captura.png |
      | alumno02@sigpro.lab | EV-014 | alumno02 | 404 evidence_not_found |
      | alumno02@sigpro.lab | EV-014 | alumno01 | 404 evidence_not_found |
```

## Fuera de alcance
- Subir una evidencia y sus reglas de tipo, tamaño y cantidad: historia 003 de esta épica.
- La ejecución a la que pertenece la evidencia y su resultado: historia 002.
- Las miniaturas, los nombres y el botón de descarga de la web y del móvil: historias 007 y 010 de esta épica.
- El inicio de sesión con el que se obtiene el `accessToken`: EP-LOGIN.
