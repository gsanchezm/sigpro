---
id: US-VER-EJECUCION-001
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[API] Solo quien tiene el permiso registra ejecuciones, y el orden de los rechazos"
etiquetas: [api]
relacionadas: [US-VER-EJECUCION-002, US-VER-EJECUCION-003, US-VER-EJECUCION-005, US-VER-EJECUCION-008]
verificacion: ejecutada
cubre: ["POST /api/test-cases/:code/runs"]
permisos: [testrun.execute]
---

## Historia
Como cliente de la API con una sesión de SIGPRO (la web, la app móvil o una suite de pruebas), quiero registrar una ejecución de un caso de prueba solo si mi rol tiene el permiso de ejecutar pruebas,
para que el resultado de una verificación lo registre quien la hace y, si mi petición no se acepta, saber por qué sin que se haya tocado ningún dato.

## Reglas
- `POST /api/test-cases/:code/runs` exige una sesión de acceso. Sin cabecera `Authorization` responde 401 con `code: "missing_token"`; con una cabecera `Bearer` cuyo texto no es un token válido, 401 con `code: "invalid_token"`. En ambos casos no se lee el cuerpo y no se crea nada.
- El permiso `testrun.execute` lo tienen `admin` y `consultant`. `program_manager` y `auditor` reciben 403 con `code: "forbidden"`, sea cual sea el caso y el cuerpo que envíen.
- El orden de las comprobaciones de una petición con sesión es este: primero el rol (403); después el resultado y las notas (422 `validation_failed`, con el motivo en `errors`); después la existencia del caso en el tenant del token (404 `test_case_not_found`); y al final las evidencias, con sus respuestas de validación de archivos. Un 403 o un 422 sobre el resultado llega antes que el 404, aunque el código del caso no exista.
- El código del caso se busca en el tenant del token. `TC-999` no existe en el seed y responde 404 `test_case_not_found`.
- La cabecera `x-tenant` no cambia el tenant de una petición con token.
- Las peticiones de registro son `multipart/form-data`, con los campos `result`, `notes` (opcional) y `files` (uno por archivo, opcional).
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las cuentas de la fila inician sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usan su `accessToken` como `Authorization: Bearer`. Las contraseñas son las del seed: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`) y `auditor@sigpro.test` (`Audit1234!`).

## Criterios de aceptación
```gherkin
Característica: Permiso y orden de los rechazos al registrar una ejecución

  Esquema del escenario: Solo los roles con el permiso registran la ejecución
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/TC-001/runs con el campo result pass y sin archivos
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | respuesta |
      | alumno01@sigpro.lab | 201 con una ejecución del caso TC-001 |
      | consultor@sigpro.test | 201 con una ejecución del caso TC-001 |
      | gestor@sigpro.test | 403 forbidden |
      | auditor@sigpro.test | 403 forbidden |

  Esquema del escenario: Sin una sesión válida no se registra nada
    Dado que en el tenant alumno01, recién reiniciado, el caso TC-001 tiene 2 ejecuciones
    Cuando envía POST /api/test-cases/TC-001/runs con la cabecera Authorization <cabecera_authorization>, con el campo result pass y con x-tenant alumno01
    Entonces la respuesta es <respuesta>
    Y el caso TC-001 sigue con 2 ejecuciones

    Ejemplos:
      | cabecera_authorization | respuesta |
      | (sin cabecera) | 401 missing_token |
      | (Bearer con un texto que no es un token) | 401 invalid_token |

  Esquema del escenario: El rol se comprueba antes que el caso y que el cuerpo
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/<caso>/runs con <cuerpo>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | caso | cuerpo | respuesta |
      | auditor@sigpro.test | TC-999 | el campo result pass | 403 forbidden |
      | alumno01@sigpro.lab | TC-999 | el campo result pass | 404 test_case_not_found |
      | alumno01@sigpro.lab | TC-999 | (sin el campo result) | 422 validation_failed con el motivo resultRequired en result |
      | alumno01@sigpro.lab | TC-001 | (sin el campo result) | 422 validation_failed con el motivo resultRequired en result |
```

## Fuera de alcance
- El efecto de una ejecución aceptada sobre el caso, el resultado y las notas que se guardan, y el registro de auditoría: historia 002 de esta épica.
- Las reglas de las evidencias (tipo, tamaño y cantidad) y sus respuestas 413 y 400: historia 003.
- La descarga de una evidencia por su identificador: historia 004.
- La lista y el detalle del caso que se leen después de registrar la ejecución: EP-VER-CASOS.
- El inicio de sesión con el que se obtiene el `accessToken`: EP-LOGIN.
