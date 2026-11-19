---
id: US-PROG-GESTION-001
tipo: historia
epica: EP-PROG-GESTION
titulo: "[API] Archivar un programa: su estado pasa a closed y el resto de sus datos no cambia"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-PROG-LISTA-001, US-PROG-GESTION-002, US-PROG-GESTION-003]
verificacion: codigo
cubre: ["POST /api/programs/:code/archive"]
permisos: [program.archive]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con una sesión iniciada en un tenant, quiero archivar un programa,
para que deje de contar como activo sin perder ni sus hitos ni sus datos.

## Reglas
- `POST /api/programs/:code/archive` exige sesión: el `accessToken` va en la cabecera `Authorization` como Bearer. Sin esa cabecera responde 401 `missing_token`; con un texto que no es un token válido, 401 `invalid_token`.
- El permiso `program.archive` lo tienen el administrador y el gestor de programas. Con el consultor o el auditor la respuesta es 403 `forbidden`. El rol se comprueba antes de buscar el programa, así que un código que no existe tampoco cambia esa respuesta para ellos.
- Archivar pasa el programa al estado `closed` (se muestra como «Cerrado» en la web). La respuesta 200 trae el programa con el mismo formato que la lista de programas, ya con `status` `closed`.
- Archivar no borra nada: el programa conserva su nombre, su responsable, sus fechas, su presupuesto, sus hitos y su avance.
- Un programa que ya está en `closed` se archiva sin error: la respuesta es 200 y sigue en `closed`.
- Un código que no existe en el tenant responde 404 `program_not_found` y no cambia ningún programa.
- Cada archivado queda en la auditoría como `program.archived`, con el código del programa.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la fila obtiene el `accessToken` de la cuenta de su ejemplo con `POST /api/auth/login`: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o, para el rol admin, `admin@sigpro.test` (`Admin1234!`), que completa el segundo factor con el código `123456` (`POST /api/auth/mfa`) y usa el `accessToken` que recibe. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Archivar un programa por la API

  Esquema del escenario: El archivado pasa el programa a closed
    Dado que en el tenant alumno01, recién reiniciado, <codigo> tiene el estado <estado_inicial>
    Cuando <cuenta> pide POST /api/programs/<codigo>/archive
    Entonces la respuesta es <respuesta>
    Y el estado de <codigo> es <estado_final>

    Ejemplos:
      | codigo | estado_inicial | cuenta | respuesta | estado_final |
      | PRG-001 | active | gestor@sigpro.test | 200 con status closed | closed |
      | PRG-003 | draft | admin@sigpro.test | 200 con status closed | closed |
      | PRG-006 | closed | gestor@sigpro.test | 200 con status closed | closed |

  Esquema del escenario: Solo el administrador y el gestor pueden archivar
    Dado que en el tenant alumno01, recién reiniciado, PRG-001 tiene el estado active
    Cuando <cuenta> pide POST /api/programs/PRG-001/archive
    Entonces la respuesta es <respuesta>
    Y el estado de PRG-001 es <estado_final>

    Ejemplos:
      | cuenta | respuesta | estado_final |
      | consultor@sigpro.test | 403 forbidden | active |
      | auditor@sigpro.test | 403 forbidden | active |
      | gestor@sigpro.test | 200 con status closed | closed |

  Esquema del escenario: Una petición sin sesión válida o a un código inexistente no archiva nada
    Dado que en el tenant alumno01, recién reiniciado, la petición de la fila se hace con la credencial indicada
    Cuando pide POST /api/programs/<codigo>/archive con <credencial>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | codigo | credencial | respuesta |
      | PRG-001 | (sin cabecera Authorization) | 401 missing_token |
      | PRG-001 | (un texto que no es un token) | 401 invalid_token |
      | PRG-099 | el accessToken de gestor@sigpro.test | 404 program_not_found |
      | PRG-099 | el accessToken de consultor@sigpro.test | 403 forbidden |
```

## Fuera de alcance
- Archivar desde la lista de la web y de la app móvil, con sus avisos y su selección: historias web y móvil de EP-PROG-GESTION.
- Volver a activar un programa archivado (cambiar su estado por edición): EP-PROG-ALTA.
- Filtrar la lista por el estado «Cerrado»: EP-PROG-LISTA.
- Las cifras de las tarjetas de la cabecera después de archivar: EP-PROG-METRICAS.
- La consulta del registro de auditoría: fuera de esta épica.
- Cómo se llega a la lista con una sesión iniciada: EP-LOGIN.
