---
id: US-MULTITENANT-PERMISOS-002
tipo: historia
epica: EP-MULTITENANT-PERMISOS
titulo: "[API] Un token lee solo los datos de su tenant"
etiquetas: [api]
relacionadas: [US-PROG-DETALLE-001, US-REQ-ARBOL-001, US-NC-TABLERO-001, US-DOC-LISTA-005, US-HITOS-006, US-PROVEEDORES-001, US-AUDITORIA-003, US-DOC-VERSIONES-003]
verificacion: codigo
cubre: ["GET /api/programs", "GET /api/programs/:code", "GET /api/programs/:code/requirements", "GET /api/programs/:code/milestones", "GET /api/requirements/:code", "GET /api/nc", "GET /api/nc/:code", "GET /api/test-cases/:code", "GET /api/documents/:id", "GET /api/suppliers", "GET /api/audit"]
---

## Historia
Como alumno que trabaja en su tenant, quiero que cada lectura de la API devuelva solo lo que hay en mi tenant, aunque otro alumno tenga los mismos códigos,
para no confundir mis programas, requisitos, no conformidades, documentos y auditoría con los de otro.

## Reglas
- Los códigos del seed (`PRG-001`, `REQ-001`, `NC-001`, `TC-001`, `DOC-001`, `PRG-001-M01`, los proveedores `s1` a `s6`) existen en cada tenant, con los mismos códigos. Lo que se lee es lo del tenant del token: `PRG-001` de `alumno01` y `PRG-001` de `alumno02` son filas distintas.
- Un recurso que solo existe en otro tenant responde 404 con el código de su módulo: `program_not_found`, `requirement_not_found`, `nc_not_found`, `document_not_found`, `test_case_not_found`. En una lista, el total y los elementos cuentan solo el tenant del token.
- Preparación de cada fila: se reinician `alumno01` y `alumno02` con `POST /api/admin/reset`, cada uno con el token de su administrador (`alumno01@sigpro.lab` y `alumno02@sigpro.lab`, contraseña `Alumno1234!`) y la cabecera `x-tenant` de su tenant, con el caos apagado. Cada administrador inicia sesión con `POST /api/auth/login`, su cabecera `x-tenant` y su contraseña, y usa el `accessToken` que recibe. Después `alumno02@sigpro.lab`, con su token, crea lo que solo existe en `alumno02`: renombra `PRG-001` a «Programa de aislamiento»; crea el programa `PRG-025` «Programa de aislamiento nuevo» (responsable `u1`, inicio `2026-03-01`, fin `2026-12-31`, presupuesto `150000`); crea el requisito `REQ-041` en `PRG-001` con el título «Requisito solo de alumno02»; crea la no conformidad `NC-013` en `PRG-025` (gravedad `minor`, descripción «Desviación solo de alumno02»); crea el hito `PRG-025-M01` en `PRG-025` (nombre «Hito solo de alumno02», fecha `2026-06-30`); registra una ejecución de `TC-001` con resultado `pass` (la llamamos «ejecución de alumno02», y su código lo devuelve la propia respuesta); y publica la versión 4 de `DOC-001` con la línea «Versión solo de alumno02». `alumno01` no recibe ninguna de estas operaciones.

## Criterios de aceptación
```gherkin
Característica: Lectura de datos dentro del tenant del token

  Esquema del escenario: Cada tenant lee sus propios recursos y no los de otro
    Dado que en los tenants alumno01 y alumno02, recién reiniciados y con la preparación de la regla, la cuenta de administración de <tenant> tiene su accessToken
    Cuando envía GET <ruta> con ese accessToken y la cabecera x-tenant <tenant>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | tenant | ruta | respuesta |
      | alumno01 | /api/programs/PRG-001 | 200 con el nombre «Sistema de mando táctico Ártemis» |
      | alumno02 | /api/programs/PRG-001 | 200 con el nombre «Programa de aislamiento» |
      | alumno01 | /api/programs/PRG-025 | 404 program_not_found |
      | alumno02 | /api/programs/PRG-025 | 200 con el nombre «Programa de aislamiento nuevo» |
      | alumno01 | /api/requirements/REQ-041 | 404 requirement_not_found |
      | alumno02 | /api/requirements/REQ-041 | 200 con el título «Requisito solo de alumno02» |
      | alumno01 | /api/nc/NC-013 | 404 nc_not_found |
      | alumno02 | /api/nc/NC-013 | 200 con el código NC-013 |
      | alumno01 | /api/programs/PRG-025/milestones | 404 program_not_found |
      | alumno02 | /api/programs/PRG-025/milestones | 200 con un único hito, PRG-025-M01 |
      | alumno01 | /api/documents/DOC-001 | 200 con la última versión 3 |
      | alumno02 | /api/documents/DOC-001 | 200 con la última versión 4 |

  Esquema del escenario: Las listas y las fichas con datos de varios elementos cuentan solo el tenant del token
    Dado que en los tenants alumno01 y alumno02, recién reiniciados y con la preparación de la regla, la cuenta de administración de <tenant> tiene su accessToken
    Cuando envía GET <ruta> con ese accessToken y la cabecera x-tenant <tenant>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | tenant | ruta | respuesta |
      | alumno01 | /api/programs?q=aislamiento | 200 con total 0 y ningún programa en la lista |
      | alumno02 | /api/programs?q=aislamiento | 200 con total 2: PRG-001 y PRG-025 |
      | alumno01 | /api/nc?q=NC-013 | 200 con total 0 |
      | alumno01 | /api/programs/PRG-001/requirements | 200 con 14 requisitos y sin REQ-041 |
      | alumno02 | /api/programs/PRG-001/requirements | 200 con 15 requisitos, incluido REQ-041 |
      | alumno01 | /api/test-cases/TC-001 | 200 con sus ejecuciones y sin la ejecución de alumno02 |
      | alumno02 | /api/test-cases/TC-001 | 200 con sus ejecuciones, incluida la ejecución de alumno02 |
      | alumno01 | /api/suppliers | 200 con 6 proveedores; el contrato de «Aeronáutica Levante S.L.» con PRG-001 indica el programa «Sistema de mando táctico Ártemis» |
      | alumno02 | /api/suppliers | 200 con 6 proveedores; el contrato de «Aeronáutica Levante S.L.» con PRG-001 indica el programa «Programa de aislamiento» |
      | alumno01 | /api/audit?q=PRG-025 | 200 con total 0 |
      | alumno02 | /api/audit?q=PRG-025 | 200 con total 2: la creación de PRG-025 y la del hito PRG-025-M01 |
```

## Fuera de alcance
- Las reglas de orden, filtros, paginación y campos de cada listado: sus épicas (EP-PROG-LISTA, EP-REQ-ARBOL, EP-NC-TABLERO, EP-DOC-LISTA, EP-PROVEEDORES, EP-AUDITORIA).
- Las escrituras sobre recursos ajenos: US-MULTITENANT-PERMISOS-003.
- La cabecera `x-tenant` frente a un token: US-MULTITENANT-PERMISOS-004.
- Las comprobaciones de permiso de cada lectura: US-MULTITENANT-PERMISOS-005.
