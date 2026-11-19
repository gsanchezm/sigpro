---
id: US-AUDITORIA-003
tipo: historia
epica: EP-AUDITORIA
titulo: "[API] Leer el registro solo con el permiso de auditoría y solo del tenant del token"
etiquetas: [api]
relacionadas: [US-AUDITORIA-001, US-AUDITORIA-002, US-AUDITORIA-006, US-AUDITORIA-008]
verificacion: codigo
cubre: ["GET /api/audit"]
permisos: [audit.view]
---

## Historia
Como responsable de un tenant, quiero que solo los administradores y los auditores puedan leer el registro, y que cada cuenta vea únicamente los eventos de su propio tenant,
para que nadie pueda consultar la actividad de otra organización ni la de un rol que no debe verla.

## Reglas
- `GET /api/audit` exige el permiso `audit.view`, que tienen `admin` y `auditor`. Un token válido de `program_manager` o de `consultant` recibe 403 `forbidden`, sin eventos.
- Sin cabecera `Authorization` la respuesta es 401 `missing_token`. Con un token que no es un `accessToken` válido (un texto cualquiera, un `refreshToken` o un `mfaToken`) la respuesta es 401 `invalid_token`.
- El orden de las comprobaciones es: token (401), permiso (403) y cursor (422). Un usuario sin permiso que envía un cursor mal formado recibe 403, no 422.
- El tenant lo fija el token. La cabecera `x-tenant` no cambia qué eventos se leen en una petición con token.
- Preparación de cada fila: antes de cada fila se comprueba que el caos de `alumno01` y de `alumno02` está apagado (`GET /api/config` con la cabecera `x-tenant` de cada tenant devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token del administrador de ese tenant). Después se reinicia cada tenant con `POST /api/admin/reset` y el token de su administrador: `alumno01@sigpro.lab` (contraseña `Alumno1234!`) con la cabecera `x-tenant: alumno01`, y `alumno02@sigpro.lab` (contraseña `Alumno1234!`) con la cabecera `x-tenant: alumno02`. Las cuentas de la fila inician sesión con `POST /api/auth/login` y la cabecera de su tenant; iniciar sesión no deja ningún evento.
- En los ejemplos, «un accessToken de auditor@sigpro.test obtenido en alumno02» es el `accessToken` que devuelve `POST /api/auth/login` con ese correo, la contraseña `Audit1234!` y la cabecera `x-tenant: alumno02`.

## Criterios de aceptación
```gherkin
Característica: Permiso de auditoría y aislamiento por tenant en la API

  Esquema del escenario: Solo admin y auditor leen el registro
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> inicia sesión con la contraseña <contraseña>
    Cuando envía GET /api/audit con su accessToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | contraseña | respuesta |
      | alumno01@sigpro.lab | Alumno1234! | 200 con items |
      | auditor@sigpro.test | Audit1234! | 200 con items |
      | gestor@sigpro.test | Gestor1234! | 403 forbidden |
      | consultor@sigpro.test | Consul1234! | 403 forbidden |

  Esquema del escenario: Sin un accessToken válido no se lee el registro
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test ha iniciado sesión
    Cuando envía GET /api/audit con <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cabecera | respuesta |
      | (sin cabecera Authorization) | 401 missing_token |
      | Authorization: Bearer (un texto que no es un token) | 401 invalid_token |
      | Authorization: Bearer el refreshToken de auditor@sigpro.test | 401 invalid_token |

  Esquema del escenario: El permiso se comprueba antes que el cursor
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> inicia sesión con la contraseña <contraseña>
    Cuando envía GET /api/audit con cursor=xyz
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | contraseña | respuesta |
      | gestor@sigpro.test | Gestor1234! | 403 forbidden |
      | auditor@sigpro.test | Audit1234! | 422 validation_failed con errors.cursor igual a badCursor |

  Esquema del escenario: Cada token lee los eventos de su propio tenant
    Dado que en los tenants alumno01 y alumno02, recién reiniciados, gestor@sigpro.test ha creado en alumno01 el programa «Programa de aislamiento» con POST /api/programs, responsable u2, inicio 2026-03-01, fin 2026-12-31 y presupuesto 150000
    Cuando envía GET /api/audit con un accessToken de auditor@sigpro.test obtenido en <tenant_del_token> y la cabecera <cabecera>
    Entonces total vale <total>
    Y el primer evento es <primero>

    Ejemplos:
      | tenant_del_token | cabecera | total | primero |
      | alumno01 | x-tenant: alumno02 | 131 | program.created |
      | alumno02 | x-tenant: alumno01 | 130 | AL-130 |
      | alumno01 | (sin cabecera x-tenant) | 131 | program.created |
```

## Fuera de alcance
- Qué eventos y en qué orden se listan una vez concedido el acceso, y los filtros del listado: los cubre EP-AUDITORIA en la API.
- Qué ve admin o auditor en la pantalla `/audit` de la web y de la app móvil, y el aviso de quien no tiene el permiso: los cubre EP-AUDITORIA en sus pantallas.
