---
id: US-MULTITENANT-PERMISOS-007
tipo: historia
epica: EP-MULTITENANT-PERMISOS
titulo: "[Transversal] La API decide el permiso y la interfaz solo lo refleja"
etiquetas: [transversal]
relacionadas: [US-MULTITENANT-PERMISOS-005, US-MULTITENANT-PERMISOS-008, US-MULTITENANT-PERMISOS-009, US-REQ-FLUJO-003, US-NC-TABLERO-004, US-AUDITORIA-006]
verificacion: ejecutada
permisos: [program.delete, requirement.approve, requirement.validate, testrun.execute, nc.close, audit.view, users.manage]
---

## Historia
Como persona que usa SIGPRO desde la web o desde la app móvil, quiero que una acción que mi rol no puede hacer no se complete, ni desde la pantalla ni con una llamada directa a la API,
para que nadie gane un permiso por usar otra vía, y para que lo que la pantalla me ofrece coincida con lo que el servidor me deja hacer.

## Reglas
- La matriz de permisos es la misma en la API, en la web y en la app móvil. Lo que una plataforma ofrece como habilitado, las otras lo permiten, y lo que una deshabilita o no muestra, las otras lo niegan.
- Un rol sin el permiso no completa la acción, aunque la pantalla se la ofrezca. Una llamada directa a la API responde 403 `forbidden` y no cambia ningún dato ni añade ningún evento al registro de auditoría.
- Ocultar o deshabilitar una acción en la pantalla no sustituye la comprobación de la API: la API es la barrera, y la pantalla solo lo refleja.
- Sin una sesión válida, la respuesta es 401 y no 403, aunque el rol de la cuenta no tuviera el permiso.
- Acciones de la prueba, con su petición de la API: eliminar un programa (`DELETE /api/programs/PRG-024`); aprobar un requisito (`POST /api/requirements/REQ-017/transition` con {"to": "approved"}); validar un requisito (`POST /api/requirements/REQ-002/transition` con {"to": "validated"}); ejecutar un caso de prueba (`POST /api/test-cases/TC-001/runs` con el resultado `pass`); cerrar una no conformidad (`POST /api/nc/NC-003/transition` con {"to": "closed", "comment": "Cierre de prueba de permisos"}); consultar el registro de auditoría (`GET /api/audit`); listar los usuarios (`GET /api/admin/users`).
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset`, el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`) y la cabecera `x-tenant: alumno01`, con el caos apagado. Cada rol inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`: `consultor@sigpro.test` (`Consul1234!`) para `consultant`, `gestor@sigpro.test` (`Gestor1234!`) para `program_manager` y `auditor@sigpro.test` (`Audit1234!`) para `auditor`.

## Criterios de aceptación
```gherkin
Característica: El permiso se aplica en la API y la interfaz coincide con él

  Esquema del escenario: Una acción que el rol no puede hacer no se completa y la API la niega
    Dado que en el tenant alumno01, recién reiniciado, la cuenta del rol <rol> ha iniciado sesión con x-tenant alumno01
    Cuando intenta <accion> desde la interfaz o con una llamada directa a la API
    Entonces la acción no se completa
    Y la llamada directa responde <respuesta> sin cambiar ningún dato

    Ejemplos:
      | rol | accion | respuesta |
      | consultant | eliminar un programa | 403 forbidden |
      | consultant | aprobar un requisito | 403 forbidden |
      | program_manager | validar un requisito | 403 forbidden |
      | auditor | ejecutar un caso de prueba | 403 forbidden |
      | auditor | cerrar una no conformidad | 403 forbidden |
      | program_manager | consultar el registro de auditoría | 403 forbidden |
      | consultant | listar los usuarios | 403 forbidden |

  Esquema del escenario: Sin una sesión válida, la llamada directa responde 401 y no 403
    Dado que en el tenant alumno01, recién reiniciado, el recurso de la acción existe con los datos del seed
    Cuando hace <accion> con <credencial> en la cabecera Authorization
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | accion | credencial | respuesta |
      | eliminar un programa | (sin cabecera) | 401 missing_token |
      | consultar el registro de auditoría | Bearer texto-sin-formato-JWT | 401 invalid_token |
```

## Fuera de alcance
- La tabla completa de permisos por operación y por rol: US-MULTITENANT-PERMISOS-005.
- Qué acciones ve cada rol en la web y en la app móvil: US-MULTITENANT-PERMISOS-008 y US-MULTITENANT-PERMISOS-009.
- La forma exacta del registro de auditoría y del tablero de no conformidades: EP-AUDITORIA y EP-NC-TABLERO.
