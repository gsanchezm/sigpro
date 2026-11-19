---
id: US-PROG-ALTA-005
tipo: historia
epica: EP-PROG-ALTA
titulo: "[API] Permisos de alta y edición por rol"
etiquetas: [api]
relacionadas: [US-PROG-ALTA-001, US-PROG-ALTA-003]
verificacion: codigo
cubre: ["POST /api/programs", "PATCH /api/programs/:code"]
permisos: [program.create, program.edit]
---

## Historia
Como administrador de un tenant, quiero que solo los roles que gestionan programas puedan crearlos o editarlos,
para que una cuenta de consulta no cambie datos de programas aunque llame a la API directamente.

## Reglas
- Pueden crear un programa (`program.create`) y editarlo (`program.edit`) los roles administrador (`admin`) y gestor de programas (`program_manager`). Consultor (`consultant`) y auditor (`auditor`) no pueden ninguna de las dos cosas: su petición responde 403 con `code: "forbidden"` y no cambia nada.
- La comprobación de rol va antes de validar el cuerpo y antes de buscar el programa: un rol sin permiso recibe 403 aunque el cuerpo no sea válido, y 403 aunque el código no exista.
- Sin cabecera `Authorization`, la petición responde 401 con `code: "missing_token"`. Con un texto que no es un token válido, responde 401 con `code: "invalid_token"`.
- Cuentas de la preparación: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y la cuenta de administración del tenant `alumno01@sigpro.lab` (`Alumno1234!`, rol administrador, sin segundo factor).
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la cuenta de la fila obtiene su token de acceso con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`. Tras el reinicio, `PRG-001` existe con los datos de la semilla.
- Cuerpo base de los ejemplos: nombre `Programa de prueba alfa`, propietario `u2`, inicio `2027-03-01`, fin `2027-03-02` y presupuesto `900000`.
- En las tablas, «(vacío)» es un nombre enviado con cadena vacía.

## Criterios de aceptación
```gherkin
Característica: Permisos de alta y edición de programas por rol

  Esquema del escenario: Un rol sin permiso recibe 403 al crear o editar y no cambia nada
    Dado que en el tenant alumno01, recién reiniciado, PRG-001 tiene los datos de la semilla y <cuenta> tiene un token de acceso
    Cuando envía <peticion> con x-tenant alumno01 y ese token
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | peticion | cuenta | respuesta |
      | POST /api/programs con el cuerpo base | consultor@sigpro.test | 403 forbidden y no se crea ningún programa |
      | POST /api/programs con el cuerpo base | auditor@sigpro.test | 403 forbidden y no se crea ningún programa |
      | POST /api/programs con el nombre (vacío) | consultor@sigpro.test | 403 forbidden y no 422 |
      | PATCH /api/programs/PRG-001 con solo el nombre Radar nuevo de prueba | consultor@sigpro.test | 403 forbidden y PRG-001 conserva su nombre |
      | PATCH /api/programs/PRG-001 con solo el nombre Radar nuevo de prueba | auditor@sigpro.test | 403 forbidden y PRG-001 conserva su nombre |
      | PATCH /api/programs/PRG-999 con solo el nombre Radar nuevo de prueba | consultor@sigpro.test | 403 forbidden y no 404 |

  Esquema del escenario: Sin token o con un token que no es válido no se crea el programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/programs con x-tenant alumno01, la credencial <credencial> y el cuerpo base
    Entonces la respuesta es <respuesta>
    Y no se crea ningún programa

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera) | 401 missing_token |
      | un texto que no es un token | 401 invalid_token |
```

## Fuera de alcance
- Los motivos de cada dato no válido del alta y de la edición: EP-PROG-ALTA, historias de validación por la API.
- La pantalla que oculta o deshabilita el botón de alta o el acceso a la edición en la web y en la app móvil: EP-PROG-ALTA, historias de asistente y de edición de cada plataforma.
- La gestión de usuarios, roles y cuentas del tenant: EP-ADMIN-USUARIOS.
