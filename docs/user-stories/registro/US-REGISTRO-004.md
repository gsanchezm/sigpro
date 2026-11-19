---
id: US-REGISTRO-004
tipo: historia
epica: EP-REGISTRO
titulo: "[API] Exigir la aceptación de las condiciones y un rol solicitable"
etiquetas: [api]
relacionadas: [US-REGISTRO-009, US-REGISTRO-014]
verificacion: codigo
cubre: ["POST /api/auth/register"]
---

## Historia
Como cliente de la API que pide acceso en nombre de una persona, quiero que `POST /api/auth/register` exija la aceptación de las condiciones y solo admita los roles que se pueden pedir,
para que ninguna solicitud entre sin aceptar las condiciones ni pida un rol que solo asigna un administrador.

## Reglas
- `terms` debe ser `true`. Con `false`, la respuesta es 422 `validation_failed` con el motivo `termsReq` para `terms`. Un `terms` que falta responde 422 `validation_failed` con un motivo para `terms`.
- `terms` debe ser un booleano. Otro tipo de valor responde 422 `validation_failed` con un motivo para `terms`.
- `role` admite solo `consultant`, `program_manager` y `auditor`. El rol `admin` no se puede solicitar: lo asigna un administrador a mano. Cualquier otro valor, un valor vacío o un `role` ausente responde 422 `validation_failed` con un motivo para `role`.
- Una solicitud rechazada por estos campos no trae `requestId`.
- Con un rol de la lista, la respuesta 201 trae ese mismo rol en `role`.
- **Cuerpo válido de la fila.** Lleva `first` Ana, `last` Prueba, `email` (correo nuevo), `org` Unidad de pruebas, `role` consultant, `password` y `confirm` Abcdefghij1! y `terms` true. Cada fila cambia solo el campo que indica.
- **Correo nuevo.** En los ejemplos, `(correo nuevo)` es un correo que no existe en el tenant de la fila: `nueva-` seguido de una marca de tiempo y `@organizacion.es`. Es distinto en cada fila y en cada ejecución.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Condiciones y rol de la solicitud por la API

  Esquema del escenario: Las condiciones deben aceptarse
    Dado que en el tenant alumno01, recién reiniciado, la fila todavía no ha enviado ninguna solicitud
    Cuando envía POST /api/auth/register con x-tenant alumno01 y un cuerpo válido en el que terms vale <condiciones>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | condiciones | respuesta |
      | true | 201 con status pending_approval |
      | false | 422 validation_failed con motivo termsReq para terms |
      | (sin el campo) | 422 validation_failed con un motivo para terms |
      | (el texto si) | 422 validation_failed con un motivo para terms |

  Esquema del escenario: Solo se pueden pedir los roles de la lista
    Dado que en el tenant alumno01, recién reiniciado, la fila todavía no ha enviado ninguna solicitud
    Cuando envía POST /api/auth/register con x-tenant alumno01 y un cuerpo válido en el que role vale <rol>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | rol | respuesta |
      | consultant | 201 con status pending_approval y role consultant |
      | program_manager | 201 con status pending_approval y role program_manager |
      | auditor | 201 con status pending_approval y role auditor |
      | admin | 422 validation_failed con un motivo para role y no trae requestId |
      | superusuario | 422 validation_failed con un motivo para role y no trae requestId |
      | (vacío) | 422 validation_failed con un motivo para role y no trae requestId |
      | (sin el campo) | 422 validation_failed con un motivo para role y no trae requestId |
```

## Fuera de alcance
- Las casillas y el rol en la web y en la app móvil: historias de validación y de formulario de esta misma épica.
- La asignación del rol `admin` a una cuenta: épica de Administración de usuarios (EP-ADMIN-USUARIOS).

## Decisiones pendientes
- Qué motivo lleva `role` cuando el rol no se puede solicitar. Hoy no es una clave del catálogo de textos: el motivo es el texto por defecto de la validación del esquema. La historia solo fija que `role` aparece en `errors`.
- Qué motivo lleva `terms` cuando el valor no es un booleano. Hoy tampoco es una clave del catálogo.
