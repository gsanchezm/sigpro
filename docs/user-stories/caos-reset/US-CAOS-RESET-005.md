---
id: US-CAOS-RESET-005
tipo: historia
epica: EP-CAOS-RESET
titulo: "[API] Solo el administrador del tenant reinicia o gestiona el modo caos"
etiquetas: [api]
relacionadas: [US-CAOS-RESET-001, US-CAOS-RESET-006, US-CAOS-RESET-011]
verificacion: ejecutada
cubre: ["POST /api/admin/reset", "GET /api/admin/chaos", "PATCH /api/admin/chaos"]
permisos: [users.manage]
---

## Historia
Como responsable de los datos de un tenant de prácticas, quiero que solo su administrador pueda reiniciarlo o cambiar el modo caos,
para que ningún otro rol altere los datos ni el caos de quienes practican.

## Reglas
- Las tres rutas exigen un token de acceso en `Authorization: Bearer`. Sin esa cabecera responden 401 `missing_token`. Con un token que no sirve (un texto cualquiera o el refreshToken de una cuenta) responden 401 `invalid_token`.
- Con un token de acceso válido de un rol distinto de admin (`program_manager`, `consultant` o `auditor`), responden 403 `forbidden` y no cambian nada.
- El permiso se comprueba antes de leer el cuerpo: una petición de un rol sin permiso responde 403 aunque su cuerpo no sea válido.
- Con el token de `alumno01@sigpro.lab`, admin del tenant, las tres rutas responden con normalidad.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos` y el cuerpo `{ "latencyMs": 0, "errorRate": 0, "flakyLabels": false }`. Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos.

## Criterios de aceptación
```gherkin
Característica: Permisos del reinicio y del modo caos

  Esquema del escenario: Un rol que no es admin recibe 403 y el modo caos no cambia
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, <cuenta> tiene un token de acceso
    Cuando envía <peticion> con x-tenant alumno01 y ese token
    Entonces la respuesta es 403 forbidden
    Y GET /api/admin/chaos con el token de alumno01@sigpro.lab devuelve latencyMs 0, errorRate 0 y flakyLabels false

    Ejemplos:
      | cuenta | peticion |
      | gestor@sigpro.test | POST /api/admin/reset |
      | consultor@sigpro.test | POST /api/admin/reset |
      | auditor@sigpro.test | POST /api/admin/reset |
      | gestor@sigpro.test | GET /api/admin/chaos |
      | consultor@sigpro.test | PATCH /api/admin/chaos con el cuerpo { "errorRate": 0.5 } |
      | consultor@sigpro.test | PATCH /api/admin/chaos con el cuerpo { "latencyMs": -1 } |

  Esquema del escenario: Sin un token válido la petición no se ejecuta
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, la petición no lleva un token válido
    Cuando envía <peticion> con x-tenant alumno01 y <credencial>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | peticion | credencial | respuesta |
      | POST /api/admin/reset | (sin cabecera Authorization) | 401 missing_token |
      | GET /api/admin/chaos | (sin cabecera Authorization) | 401 missing_token |
      | PATCH /api/admin/chaos con el cuerpo { "errorRate": 0.5 } | (sin cabecera Authorization) | 401 missing_token |
      | POST /api/admin/reset | un texto que no es un token | 401 invalid_token |
      | GET /api/admin/chaos | el refreshToken de alumno01@sigpro.lab | 401 invalid_token |
```

## Fuera de alcance
- La variante del reinicio con la clave de infraestructura (todos los tenants, cron nocturno): no se describe en esta épica.
- La gestión de usuarios de Administración, que usa el mismo permiso (`GET /api/admin/users`, `PATCH /api/admin/users/:id`): EP-ADMIN-USUARIOS.
- Los permisos de las demás áreas de la aplicación: la épica de cada módulo.
