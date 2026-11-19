---
id: US-REGISTRO-005
tipo: historia
epica: EP-REGISTRO
titulo: "[API] Responder 409 si el correo ya tiene cuenta en el tenant"
etiquetas: [api]
relacionadas: [US-REGISTRO-011, US-REGISTRO-015]
verificacion: ejecutada
cubre: ["POST /api/auth/register"]
---

## Historia
Como cliente de la API que pide acceso, quiero que `POST /api/auth/register` responda 409 cuando el correo ya tiene una cuenta en ese tenant,
para no crear dos cuentas con el mismo correo y poder decir a la persona que ya existe una cuenta con él.

## Reglas
- Si el correo de la solicitud ya tiene cuenta en el tenant de la cabecera `x-tenant`, la respuesta es 409 con `code` `email_exists`, sin `requestId`, y no se crea ninguna cuenta nueva.
- Cuentan como cuentas existentes todas las del tenant: las de demostración (`admin@sigpro.test`, `gestor@sigpro.test`…), la cuenta pendiente de aprobación `pendiente@sigpro.test`, la administración del tenant (`alumno01@sigpro.lab`) y las cuentas creadas por una solicitud anterior.
- La comparación ignora las mayúsculas y los espacios del principio y del final del correo.
- El mismo correo en otro tenant no cuenta: en ese otro tenant es una cuenta nueva.
- **Cuerpo válido de la fila.** Lleva `first` Ana, `last` Prueba, `email` (el correo de la fila), `org` Unidad de pruebas, `role` consultant, `password` y `confirm` Abcdefghij1! y `terms` true.
- **Correo nuevo.** En los ejemplos, `(correo nuevo)` es un correo que no existe en el tenant de la fila: `nueva-` seguido de una marca de tiempo y `@organizacion.es`. Es distinto en cada fila y en cada ejecución.
- **Cuenta recién solicitada.** En los ejemplos, `(cuenta recién solicitada)` es una solicitud hecha en la propia fila en `alumno01`, con `(correo nuevo)` como correo y `Abcdefghij1!` como contraseña. En los pasos siguientes de la fila, el correo es ese mismo correo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); si la fila usa `alumno02`, se reinicia también con el token de `alumno02@sigpro.lab`. Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa.

## Criterios de aceptación
```gherkin
Característica: Correo ya registrado en la solicitud por la API

  Esquema del escenario: Un correo de una cuenta que ya existe en el tenant responde 409
    Dado que en el tenant alumno01, recién reiniciado, existe la cuenta <cuenta>
    Cuando envía POST /api/auth/register con x-tenant alumno01 y un cuerpo válido en el que email vale <correo>
    Entonces la respuesta es 409 email_exists
    Y no trae requestId

    Ejemplos:
      | cuenta | correo |
      | admin@sigpro.test | admin@sigpro.test |
      | gestor@sigpro.test | (GESTOR@sigpro.test con un espacio delante y otro detrás) |
      | pendiente@sigpro.test | pendiente@sigpro.test |
      | alumno01@sigpro.lab | alumno01@sigpro.lab |

  Esquema del escenario: Una solicitud anterior cuenta en su tenant y no en otro
    Dado que los tenants alumno01 y alumno02 están recién reiniciados y en alumno01 existe (cuenta recién solicitada)
    Cuando envía POST /api/auth/register con x-tenant <cabecera> y un cuerpo válido en el que email vale ese mismo correo
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cabecera | respuesta |
      | alumno01 | 409 email_exists |
      | alumno02 | 201 con status pending_approval |
```

## Fuera de alcance
- El texto del aviso de correo ya registrado en la web y en la app móvil: historias de envío de esta misma épica.
- La cuenta pendiente que se crea y su acceso: épica de inicio de sesión (EP-LOGIN).

## Decisiones pendientes
- Si una cuenta bloqueada o desactivada cuenta como correo ya registrado. Hoy cuenta igual: la respuesta es 409 sin distinguir el estado de la cuenta.
