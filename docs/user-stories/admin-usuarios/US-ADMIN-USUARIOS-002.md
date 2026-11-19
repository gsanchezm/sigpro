---
id: US-ADMIN-USUARIOS-002
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[API] Permitir la administración de usuarios solo al rol admin"
etiquetas: [api]
relacionadas: [US-ADMIN-USUARIOS-001, US-ADMIN-USUARIOS-003, US-ADMIN-USUARIOS-004, US-ADMIN-USUARIOS-006, US-SESION-005]
verificacion: codigo
cubre: ["GET /api/admin/users", "PATCH /api/admin/users/:id"]
permisos: [users.manage]
---

## Historia
Como administrador de un tenant, quiero que solo un administrador pueda listar y cambiar las cuentas del tenant,
para que ningún otro rol cambie quién entra en SIGPRO ni con qué permisos.

## Reglas
- Solo el rol admin tiene el permiso `users.manage`. Los roles program_manager, consultant y auditor reciben 403 `forbidden` en `GET /api/admin/users` y en `PATCH /api/admin/users/:id`.
- Sin cabecera `Authorization` la respuesta es 401 `missing_token`. Con un token que no es un accessToken válido de SIGPRO (inventado o alterado) la respuesta es 401 `invalid_token`.
- La clave de administración (`X-Admin-Key`) no sustituye al token en estos dos endpoints.
- El orden de las comprobaciones es: token, después rol y después cuerpo e id. Un 403 por rol gana aunque el cuerpo no sea válido o el id no exista.
- El permiso se decide con el rol que lleva el accessToken de la petición, no con el que la cuenta tenga en ese momento en la base de datos.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después cada cuenta de la fila inicia sesión con `POST /api/auth/login`, la cabecera `x-tenant: alumno01` y su contraseña del seed (`Gestor1234!`, `Consul1234!` o `Audit1234!`), y usa el accessToken que recibe.

## Criterios de aceptación
```gherkin
Característica: Permiso de administración de usuarios

  Esquema del escenario: Solo el rol admin recibe la lista de usuarios
    Dado que en el tenant alumno01, recién reiniciado, <correo> ha iniciado sesión con el rol <rol>
    Cuando envía GET /api/admin/users con x-tenant alumno01 y su accessToken
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | correo | rol | respuesta |
      | alumno01@sigpro.lab | admin | 200 con la lista de usuarios |
      | gestor@sigpro.test | program_manager | 403 forbidden |
      | consultor@sigpro.test | consultant | 403 forbidden |
      | auditor@sigpro.test | auditor | 403 forbidden |

  Esquema del escenario: Un rol sin el permiso no cambia ninguna cuenta
    Dado que en el tenant alumno01, recién reiniciado, <correo> ha iniciado sesión con el rol <rol>
    Cuando envía PATCH /api/admin/users/u4 con x-tenant alumno01, su accessToken y el cuerpo {"active": false}
    Entonces la respuesta es 403 forbidden
    Y auditor@sigpro.test sigue pudiendo iniciar sesión en alumno01 con Audit1234!

    Ejemplos:
      | correo | rol |
      | gestor@sigpro.test | program_manager |
      | consultor@sigpro.test | consultant |
      | auditor@sigpro.test | auditor |

  Esquema del escenario: El permiso se comprueba antes que el cuerpo y que el id
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión con el rol consultant
    Cuando envía PATCH /api/admin/users/<id> con x-tenant alumno01, su accessToken y el cuerpo <cuerpo>
    Entonces la respuesta es 403 forbidden y no 422 ni 404

    Ejemplos:
      | id | cuerpo |
      | u99 | {"active": false} |
      | u1 | {"role": "dios"} |
      | u1 | {} |

  Esquema del escenario: Sin un token válido la respuesta es 401
    Dado que en el tenant alumno01, recién reiniciado
    Cuando envía <metodo> <ruta> con x-tenant alumno01 y <autorizacion>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | metodo | ruta | autorizacion | respuesta |
      | GET | /api/admin/users | (sin cabecera) | 401 missing_token |
      | GET | /api/admin/users | Bearer token-inventado | 401 invalid_token |
      | PATCH | /api/admin/users/u4 | (sin cabecera) | 401 missing_token |
      | PATCH | /api/admin/users/u4 | Bearer (token de alumno01 con una letra cambiada) | 401 invalid_token |
```

## Fuera de alcance
- La pantalla de Administración y lo que ve cada rol en la web y en la app móvil: esta misma épica (historias 006 y 009).
- La renovación del accessToken y su caducidad, y las comprobaciones de token de las demás rutas: épica de Sesión y renovación de token (EP-SESION).
- Los permisos de las pestañas «Modo caos» y «Datos» y del reinicio del tenant, que usan el mismo permiso: épica de Modo caos y reinicio del tenant (EP-CAOS-RESET).
