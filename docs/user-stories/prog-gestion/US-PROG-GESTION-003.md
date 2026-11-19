---
id: US-PROG-GESTION-003
tipo: historia
epica: EP-PROG-GESTION
titulo: "[API] Eliminar un programa con todo lo que cuelga de él, sin posibilidad de deshacer"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-PROG-LISTA-001, US-PROG-GESTION-001, US-PROG-GESTION-004, US-PROG-GESTION-008]
verificacion: ejecutada
cubre: ["DELETE /api/programs/:code"]
permisos: [program.delete]
---

## Historia
Como administrador que da de baja un programa, quiero eliminarlo desde la API,
para que desaparezca junto con sus datos y no queden restos que se vean desde otros programas.

## Reglas
- `DELETE /api/programs/:code` exige sesión: el `accessToken` va en la cabecera `Authorization` como Bearer. Sin esa cabecera responde 401 `missing_token`; con un texto que no es un token válido, 401 `invalid_token`.
- El permiso `program.delete` lo tiene solo el administrador. Con el gestor, el consultor o el auditor la respuesta es 403 `forbidden` y no se borra nada. El rol se comprueba antes de buscar el programa.
- Con el administrador y un código que existe, la respuesta es 204 sin cuerpo y el programa deja de existir en el tenant.
- El borrado es permanente: no hay papelera ni forma de deshacerlo.
- El borrado de un programa arrastra, dentro de su tenant, todo lo que cuelga de él: sus hitos; sus requisitos, con sus vínculos con los casos de prueba; sus casos de prueba, con sus ejecuciones y las evidencias de esas ejecuciones; sus no conformidades, con sus comentarios; sus documentos, con sus versiones; y sus contratos con proveedores.
- No se borran los proveedores, los usuarios ni el registro de auditoría anterior. El borrado añade a la auditoría un evento `program.deleted` con el código del programa.
- Los demás programas del tenant no cambian: sus requisitos, sus casos y sus no conformidades siguen igual.
- Un código que no existe responde 404 `program_not_found`, y también un segundo borrado del mismo código.
- Un programa con no conformidades y ejecuciones de prueba se borra igual, sin error.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la fila obtiene el `accessToken` de la cuenta de su ejemplo con `POST /api/auth/login`: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o, para el rol admin, `admin@sigpro.test` (`Admin1234!`), que completa el segundo factor con el código `123456` (`POST /api/auth/mfa`) y usa el `accessToken` que recibe. Todas las peticiones llevan la cabecera `x-tenant: alumno01`. Los datos que cita el ejemplo son los del seed: `PRG-001` tiene los requisitos `REQ-001` a `REQ-014`, los casos `TC-001` a `TC-009`, las no conformidades `NC-001` a `NC-004` y los documentos `DOC-001` y `DOC-002`.

## Criterios de aceptación
```gherkin
Característica: Eliminar un programa por la API

  Esquema del escenario: Solo el administrador puede eliminar un programa
    Dado que en el tenant alumno01, recién reiniciado, el tenant tiene 24 programas
    Cuando <cuenta> pide DELETE /api/programs/<codigo>
    Entonces la respuesta es <respuesta>
    Y el tenant tiene <total> programas

    Ejemplos:
      | cuenta | codigo | respuesta | total |
      | gestor@sigpro.test | PRG-001 | 403 forbidden | 24 |
      | consultor@sigpro.test | PRG-001 | 403 forbidden | 24 |
      | auditor@sigpro.test | PRG-001 | 403 forbidden | 24 |
      | admin@sigpro.test | PRG-001 | 204 sin cuerpo | 23 |
      | admin@sigpro.test | PRG-002 | 204 sin cuerpo | 23 |

  Esquema del escenario: Tras borrar PRG-001 no se encuentran sus datos y sí los de los demás programas
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test, con el segundo factor completado, ha borrado PRG-001 con DELETE /api/programs/PRG-001
    Cuando pide <consulta>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | consulta | respuesta |
      | GET /api/programs/PRG-001 | 404 program_not_found |
      | GET /api/requirements/REQ-001 | 404 requirement_not_found |
      | GET /api/test-cases/TC-001 | 404 test_case_not_found |
      | GET /api/nc/NC-001 | 404 nc_not_found |
      | GET /api/documents/DOC-001 | 404 document_not_found |
      | GET /api/programs/PRG-002 | 200 con code PRG-002 |
      | GET /api/requirements/REQ-015 | 200 con code REQ-015 |

  Esquema del escenario: Un código inexistente o ya borrado responde 404 y no borra nada
    Dado que en el tenant alumno01, recién reiniciado, <preparacion>
    Cuando admin@sigpro.test, con el segundo factor completado, pide DELETE /api/programs/<codigo>
    Entonces la respuesta es <respuesta>
    Y el tenant tiene <total> programas

    Ejemplos:
      | preparacion | codigo | respuesta | total |
      | no se ha borrado ningún programa antes | PRG-099 | 404 program_not_found | 24 |
      | PRG-001 se ha borrado antes con DELETE /api/programs/PRG-001 | PRG-001 | 404 program_not_found | 23 |
```

## Decisiones pendientes
- Si el código de un programa borrado puede volver a asignarse. Hoy sí: el siguiente código es el mayor de los que quedan más uno, así que tras borrar `PRG-024` la siguiente alta o copia recibe `PRG-024`.

## Fuera de alcance
- Archivar en lugar de borrar: US-PROG-GESTION-001.
- El diálogo de confirmación y la forma de pedir el borrado desde la web y la app móvil: historias web y móvil de EP-PROG-GESTION.
- Borrar un requisito, un hito o una no conformidad por separado: las épicas de cada uno.
- El aislamiento de los datos entre tenants: EP-MULTITENANT-PERMISOS.
- Cómo se llega a la lista con una sesión iniciada: EP-LOGIN.
