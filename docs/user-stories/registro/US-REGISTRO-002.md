---
id: US-REGISTRO-002
tipo: historia
epica: EP-REGISTRO
titulo: "[API] Rechazar una solicitud con campos obligatorios vacíos o un correo sin forma de dirección"
etiquetas: [api]
relacionadas: [US-REGISTRO-009, US-REGISTRO-014]
verificacion: ejecutada
cubre: ["POST /api/auth/register"]
---

## Historia
Como cliente de la API que pide acceso en nombre de una persona, quiero que `POST /api/auth/register` diga qué campo del cuerpo no vale y por qué,
para corregir solo ese dato y volver a enviar la solicitud sin adivinar nada.

## Reglas
- Un cuerpo no válido responde 422 `validation_failed` con un objeto `errors` que lleva un motivo por cada campo no válido: `required` (obligatorio) o `badEmail` (correo con forma no válida). Esa respuesta no trae `requestId`.
- `first`, `last` y `org` se recortan de los espacios del principio y del final; si no queda nada, el motivo es `required`.
- `email` se recorta igual; si no queda nada, el motivo es `required`. Debe tener la forma `texto@dominio.extensión`, sin espacios y con una sola `@`; si no, el motivo es `badEmail`.
- Un campo que falta en el cuerpo se trata igual que un campo vacío: motivo `required`.
- **Cuerpo válido de la fila.** Lleva `first` Ana, `last` Prueba, `email` (correo nuevo), `org` Unidad de pruebas, `role` consultant, `password` y `confirm` Abcdefghij1! y `terms` true. Cada fila cambia solo el campo que indica.
- **Correo nuevo.** En los ejemplos, `(correo nuevo)` es un correo que no existe en el tenant de la fila: `nueva-` seguido de una marca de tiempo y `@organizacion.es`. Es distinto en cada fila y en cada ejecución.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Validación del cuerpo de la solicitud por la API

  Esquema del escenario: Un campo obligatorio vacío o con solo espacios responde required
    Dado que en el tenant alumno01, recién reiniciado, la fila todavía no ha enviado ninguna solicitud
    Cuando envía POST /api/auth/register con x-tenant alumno01 y un cuerpo válido en el que <campo> vale <valor>
    Entonces la respuesta es 422 validation_failed
    Y el motivo de <campo> es required
    Y no trae requestId

    Ejemplos:
      | campo | valor |
      | first | (vacío) |
      | first | (tres espacios) |
      | first | (sin el campo) |
      | last | (vacío) |
      | last | (tres espacios) |
      | last | (sin el campo) |
      | org | (vacío) |
      | org | (tres espacios) |
      | org | (sin el campo) |
      | email | (vacío) |
      | email | (tres espacios) |
      | email | (sin el campo) |

  Esquema del escenario: Un correo que no tiene forma de dirección responde badEmail
    Dado que en el tenant alumno01, recién reiniciado, la fila todavía no ha enviado ninguna solicitud
    Cuando envía POST /api/auth/register con x-tenant alumno01 y un cuerpo válido en el que email vale <correo>
    Entonces la respuesta es 422 validation_failed
    Y el motivo de email es badEmail
    Y no trae requestId

    Ejemplos:
      | correo |
      | no-es-un-correo |
      | ana@sigpro |
      | @sigpro.test |
      | ana@@sigpro.test |
      | ana@sigpro. |
      | (ana @sigpro.test, con un espacio antes de la arroba) |
```

## Fuera de alcance
- El correo ya registrado en el tenant (409 `email_exists`): historia de esta épica sobre la respuesta 409.
- La contraseña y su confirmación, las condiciones y el rol: historias de esta misma épica sobre esos campos.
- El envío del correo de verificación: esta misma épica, en su historia no-implementada de la API.
