---
id: US-PROG-ALTA-006
tipo: historia
epica: EP-PROG-ALTA
titulo: "[API] Listar las personas que pueden ser responsables"
etiquetas: [api]
relacionadas: [US-PROG-ALTA-009]
verificacion: ejecutada
cubre: ["GET /api/users/owners"]
---

## Historia
Como persona que da de alta o edita un programa, quiero recibir la lista de personas del tenant con su nombre y el número de programas que tienen a su cargo,
para elegir al responsable sin escribir ningún identificador.

## Reglas
- `GET /api/users/owners` responde 200 con una lista de personas del tenant del token. Cada persona trae `id`, `name`, `email`, `role` y `programCount`, el número de programas cuyo responsable es esa persona.
- Lo puede pedir cualquier rol con sesión. No depende del permiso de crear o editar programas.
- La lista incluye a todas las personas del tenant, también a las que tienen la cuenta bloqueada, pendiente de aprobación o desactivada. Ver «Decisiones pendientes».
- El orden es el de antigüedad de la cuenta y, a igualdad, el de `id`.
- Sin cabecera `Authorization` responde 401 con `code: "missing_token"`; con un texto que no es un token válido, 401 con `code: "invalid_token"`.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Tras el reinicio, el tenant tiene siete personas: las seis cuentas de demostración (`u1` a `u6`, con los nombres Marta Ruiz, Javier Ortega, Lucía Fernández, Andrés Molina, Carmen Vidal y Pablo Serrano) y la cuenta de administración del tenant (`u7`, con el nombre Alumno 01). Cada una de las seis cuentas de demostración tiene cuatro programas a su cargo; la de administración, ninguno.
- La petición de cada fila lleva la cabecera `x-tenant: alumno01` y el token de la cuenta de la fila, obtenido con `POST /api/auth/login`.
- En los ejemplos, «(sin cabecera)» es una petición sin cabecera `Authorization`.

## Criterios de aceptación
```gherkin
Característica: Lista de personas que pueden ser responsables de un programa

  Esquema del escenario: Cualquier rol con sesión recibe la lista de personas del tenant
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene un token de acceso
    Cuando envía GET /api/users/owners con x-tenant alumno01 y ese token
    Entonces la respuesta es 200 con siete personas, cada una con id, name, email, role y programCount

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | consultor@sigpro.test |
      | auditor@sigpro.test |
      | alumno01@sigpro.lab |

  Esquema del escenario: Cada persona lleva el número de programas a su cargo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía GET /api/users/owners con x-tenant alumno01 y ese token
    Entonces la persona <persona> tiene programCount <programas>

    Ejemplos:
      | persona | programas |
      | Marta Ruiz | 4 |
      | Carmen Vidal | 4 |
      | Pablo Serrano | 4 |
      | Alumno 01 | 0 |

  Esquema del escenario: Sin token no hay lista de responsables
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía GET /api/users/owners con x-tenant alumno01 y la credencial <credencial>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera) | 401 missing_token |
      | un texto que no es un token | 401 invalid_token |
```

## Fuera de alcance
- El selector de responsable de la web y de la app móvil, que usa esta lista: EP-PROG-ALTA, historias de asistente y de selector de responsable.
- El número de programas que aparece en el filtro por responsable de la lista de programas: EP-PROG-LISTA.
- El bloqueo, la aprobación y la desactivación de las cuentas: EP-ADMIN-USUARIOS.

## Decisiones pendientes
- Si las personas con la cuenta bloqueada, pendiente de aprobación o desactivada deben poder ser responsables de un programa. Hoy la lista las incluye; no está decidido si debe filtrarlas.
- Si el correo de cada persona debe ser visible para cualquier rol con sesión. Hoy lo es; no está decidido.
