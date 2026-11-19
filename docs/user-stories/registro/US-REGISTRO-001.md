---
id: US-REGISTRO-001
tipo: historia
epica: EP-REGISTRO
titulo: "[API] Crear una solicitud de acceso pendiente de aprobación"
etiquetas: [api]
relacionadas: [US-LOGIN-003, US-REGISTRO-005, US-REGISTRO-011, US-REGISTRO-015]
verificacion: ejecutada
cubre: ["POST /api/auth/register"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) que pide acceso en nombre de una persona, quiero enviar sus datos y el rol que necesita a `POST /api/auth/register`,
para que SIGPRO registre una cuenta nueva que queda a la espera de la aprobación de un administrador.

## Reglas
- `POST /api/auth/register` es público: no necesita cabecera `Authorization`.
- **Cuerpo válido de la fila.** Lleva `first` Ana, `last` Prueba, `email` (correo nuevo), `org` Unidad de pruebas, `role` consultant, `password` y `confirm` Abcdefghij1! y `terms` true. Cada fila cambia solo el campo que indica.
- Con un cuerpo válido, la respuesta es 201 con `status` `pending_approval`, `email` (el correo en minúsculas y sin espacios de los extremos), `role` (el rol pedido) y `requestId`, un identificador con la forma `REQ-AAAA-NNNN`: `REQ-`, el año en curso, un guion y cuatro cifras.
- La cuenta nace pendiente de aprobación: hasta que un administrador la apruebe, no puede abrir sesión. Lo que responde el acceso de una cuenta pendiente se describe en la épica de inicio de sesión.
- La cuenta se crea en el tenant indicado por la cabecera `x-tenant` y solo existe en ese tenant. Sin cabecera, el tenant es `demo`; esta regla no lleva ejemplo, porque `demo` es compartido y las pruebas no lo usan.
- Un tenant que no existe responde 404 `tenant_not_found` y no trae `requestId`. Con los datos de demostración por defecto, `alumno25` es el último tenant `alumnoNN`; `alumno26` no existe.
- **Correo nuevo.** En los ejemplos, `(correo nuevo)` es un correo que no existe en el tenant de la fila: `nueva-` seguido de una marca de tiempo y `@organizacion.es`. Es distinto en cada fila y en cada ejecución.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Si la fila usa otro tenant, se reinicia también con el token de su administrador (`alumno25@sigpro.lab`). Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa.

## Criterios de aceptación
```gherkin
Característica: Solicitud de acceso por la API

  Esquema del escenario: Una solicitud con datos válidos queda pendiente de aprobación
    Dado que en el tenant alumno01 y en el tenant alumno25, recién reiniciados, el correo (correo nuevo) no tiene cuenta
    Cuando envía POST /api/auth/register con x-tenant <cabecera> y un cuerpo válido en el que email vale <correo> y role vale <rol>
    Entonces la respuesta es 201
    Y trae status pending_approval, role <rol> y el email <correo_respuesta>
    Y trae un requestId con la forma REQ-AAAA-NNNN: REQ-, el año en curso, un guion y cuatro cifras

    Ejemplos:
      | cabecera | correo | rol | correo_respuesta |
      | alumno01 | (correo nuevo) | consultant | (correo nuevo) |
      | alumno01 | (correo nuevo) | program_manager | (correo nuevo) |
      | alumno01 | (correo nuevo) | auditor | (correo nuevo) |
      | alumno01 | (correo nuevo con mayúsculas y espacios en los extremos) | consultant | (correo nuevo en minúsculas y sin espacios) |
      | alumno25 | (correo nuevo) | consultant | (correo nuevo) |

  Esquema del escenario: Un tenant que no existe no recibe la solicitud
    Dado que en el tenant alumno01, recién reiniciado, la solicitud se envía a un tenant que no existe
    Cuando envía POST /api/auth/register con x-tenant <cabecera> y un cuerpo válido en el que email vale (correo nuevo)
    Entonces la respuesta es 404 tenant_not_found
    Y no trae requestId

    Ejemplos:
      | cabecera |
      | alumno26 |
      | noexiste |
```

## Fuera de alcance
- El acceso con la cuenta pendiente (403 `pending_approval`) y su aviso: épica de inicio de sesión (EP-LOGIN).
- La aprobación de la cuenta por un administrador: épica de Administración de usuarios (EP-ADMIN-USUARIOS).
- El envío del correo de verificación: esta misma épica, en su historia no-implementada de la API.

## Decisiones pendientes
- Cómo se numera el `requestId`: hoy depende de cuántas cuentas pendientes tiene el tenant. La historia solo fija su forma.
