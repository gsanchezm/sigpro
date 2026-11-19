---
id: US-REGISTRO-003
tipo: historia
epica: EP-REGISTRO
titulo: "[API] Exigir una contraseña de diez caracteres con mayúscula, minúscula, número y símbolo, y su confirmación"
etiquetas: [api]
relacionadas: [US-REGISTRO-009, US-REGISTRO-010, US-REGISTRO-014]
verificacion: ejecutada
cubre: ["POST /api/auth/register"]
---

## Historia
Como cliente de la API que pide acceso en nombre de una persona, quiero que `POST /api/auth/register` no acepte una contraseña débil ni una confirmación distinta,
para que cada cuenta nueva empiece con una contraseña que cumple las reglas de SIGPRO.

## Reglas
- Una contraseña cumple si tiene al menos 10 caracteres, una mayúscula, una minúscula, un número y un símbolo. Un símbolo es un carácter que no es letra ni número (ver «Decisiones pendientes» para los casos dudosos).
- Si `password` no cumple, la respuesta es 422 `validation_failed` con un motivo para `password`. Cuando falla solo la longitud, el motivo es `pwShort`.
- `password` no se recorta: un espacio cuenta como carácter.
- `confirm` debe ser exactamente igual a `password`, con las mismas mayúsculas, minúsculas y espacios. Si no lo es, la respuesta es 422 `validation_failed` con el motivo `pwMismatch` para `confirm`.
- Una solicitud rechazada por la contraseña no trae `requestId`.
- **Cuerpo válido de la fila.** Lleva `first` Ana, `last` Prueba, `email` (correo nuevo), `org` Unidad de pruebas, `role` consultant, `password` y `confirm` Abcdefghij1! y `terms` true. Cada fila cambia solo la contraseña o la confirmación que indica.
- **Correo nuevo.** En los ejemplos, `(correo nuevo)` es un correo que no existe en el tenant de la fila: `nueva-` seguido de una marca de tiempo y `@organizacion.es`. Es distinto en cada fila y en cada ejecución.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Reglas de la contraseña de la solicitud por la API

  Esquema del escenario: La longitud mínima son diez caracteres
    Dado que en el tenant alumno01, recién reiniciado, la fila todavía no ha enviado ninguna solicitud
    Cuando envía POST /api/auth/register con x-tenant alumno01 y un cuerpo válido en el que password y confirm valen <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | contraseña | respuesta |
      | Abcdefg1! | 422 validation_failed con motivo pwShort para password |
      | Abcdefgh1! | 201 con status pending_approval |
      | Abcdefghi1! | 201 con status pending_approval |

  Esquema del escenario: Cada regla de la contraseña es obligatoria
    Dado que en el tenant alumno01, recién reiniciado, la contraseña <contraseña> de diez o más caracteres no tiene <regla>
    Cuando envía POST /api/auth/register con x-tenant alumno01 y un cuerpo válido en el que password y confirm valen <contraseña>
    Entonces la respuesta es 422 validation_failed con un motivo para password
    Y no trae requestId

    Ejemplos:
      | contraseña | regla |
      | abcdefghi1! | una mayúscula |
      | ABCDEFGHI1! | una minúscula |
      | Abcdefghij! | un número |
      | Abcdefghi1 | un símbolo |

  Esquema del escenario: La confirmación debe ser igual a la contraseña
    Dado que en el tenant alumno01, recién reiniciado, la fila todavía no ha enviado ninguna solicitud
    Cuando envía POST /api/auth/register con x-tenant alumno01 y un cuerpo válido en el que password vale Abcdefghij1! y confirm vale <confirmacion>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | confirmacion | respuesta |
      | Abcdefghij1! | 201 con status pending_approval |
      | abcdefghij1! | 422 validation_failed con motivo pwMismatch para confirm |
      | Abcdefghij1 | 422 validation_failed con motivo pwMismatch para confirm |
      | (Abcdefghij1! con un espacio detrás) | 422 validation_failed con motivo pwMismatch para confirm |
      | (vacío) | 422 validation_failed con motivo pwMismatch para confirm |
```

## Fuera de alcance
- Lo que el formulario de la web y de la app móvil muestra bajo el campo de la contraseña: historias de validación de esta misma épica.
- El medidor de fuerza de la contraseña: historias de esta misma épica en la web y en la app móvil.

## Decisiones pendientes
- Motivo y aviso cuando falla una regla distinta de la longitud: hoy el motivo es `pwShort` también para una mayúscula, una minúscula, un número o un símbolo que faltan, y el aviso de la web y de la app dice «Mínimo 10 caracteres». Hasta que se decida, la historia solo fija el rechazo y el motivo para `password`.
- Qué cuenta como símbolo: hoy cuenta cualquier carácter que no sea una letra inglesa sin acento ni un dígito. Así, un espacio o una letra acentuada cuentan como símbolo. La historia no afirma ninguno de los dos casos.
