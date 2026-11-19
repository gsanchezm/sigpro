---
id: US-RECUPERAR-001
tipo: historia
epica: EP-RECUPERAR
titulo: "[API] Responder 202 con cuerpo vacío a la recuperación, exista o no la cuenta"
etiquetas: [api]
relacionadas: [US-RECUPERAR-002, US-RECUPERAR-004, US-RECUPERAR-006, US-REGISTRO-006]
verificacion: ejecutada
cubre: ["POST /api/auth/forgot"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero pedir la recuperación de la contraseña con un correo en `POST /api/auth/forgot`,
para que la respuesta no me diga nada sobre si ese correo tiene una cuenta en SIGPRO.

## Reglas
- `POST /api/auth/forgot` es público: no necesita cabecera `Authorization`. El cuerpo lleva `email`.
- Con un `email` con forma de dirección, la respuesta es 202 con el cuerpo vacío `{}`, exista o no una cuenta con ese correo. La respuesta es la misma en los dos casos.
- El 202 es la respuesta acordada y no afirma que llegue ningún correo: el envío del enlace está en «Fuera de alcance».
- **Validación del cuerpo.** Ocurre antes de responder, con las mismas reglas que la web y la app móvil. Un cuerpo no válido responde 422 con `code: "validation_failed"` y un objeto `errors` con un motivo para `email`: `required` (obligatorio) o `badEmail` (correo con formato no válido).
  - Se recortan los espacios del principio y del final. Si no queda nada, el motivo es `required`.
  - Debe tener la forma `texto@dominio.extensión`, sin espacios, con una sola `@` y con un punto en el dominio. Si no, `badEmail`: `a@b` no vale y `a@b.c` sí.
  - Un campo que falta en el cuerpo se trata igual que un campo vacío: motivo `required`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y la petición lleva la cabecera `x-tenant: alumno01`. Las cuentas de los ejemplos son las del seed tras ese reinicio.
- En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución: `nadie-` seguido de una marca de tiempo y `@sigpro.test`.

## Criterios de aceptación
```gherkin
Característica: Recuperación de la contraseña por la API

  Esquema del escenario: La petición con un correo con forma de dirección responde 202 con cuerpo vacío
    Dado que en el tenant alumno01, recién reiniciado, <situacion>
    Cuando envía POST /api/auth/forgot con x-tenant alumno01 y el correo <correo>
    Entonces la respuesta es 202 con el cuerpo vacío {}

    Ejemplos:
      | situacion | correo |
      | la cuenta gestor@sigpro.test está activa | gestor@sigpro.test |
      | la cuenta gestor@sigpro.test está activa | (GESTOR@sigpro.test con un espacio delante y otro detrás) |
      | la cuenta bloqueado@sigpro.test está bloqueada | bloqueado@sigpro.test |
      | la cuenta pendiente@sigpro.test está pendiente de aprobación | pendiente@sigpro.test |
      | no existe ninguna cuenta con ese correo | (correo sin cuenta) |
      | no existe ninguna cuenta con ese correo | a@b.c |

  Esquema del escenario: Un cuerpo no válido responde 422 con el motivo del correo
    Dado que en el tenant alumno01, recién reiniciado, la fila todavía no ha enviado ninguna petición de recuperación
    Cuando envía POST /api/auth/forgot con x-tenant alumno01 y un cuerpo en el que email vale <email>
    Entonces la respuesta es <respuesta>
    Y el motivo del correo es <motivo>

    Ejemplos:
      | email | respuesta | motivo |
      | (vacío) | 422 validation_failed | required |
      | (sin el campo) | 422 validation_failed | required |
      | (tres espacios) | 422 validation_failed | required |
      | no-es-un-correo | 422 validation_failed | badEmail |
      | ana@sigpro | 422 validation_failed | badEmail |
      | @sigpro.test | 422 validation_failed | badEmail |
      | (ana @sigpro.test, con un espacio antes de la arroba) | 422 validation_failed | badEmail |
      | a@b | 422 validation_failed | badEmail |
      | a@b.c | 202 con el cuerpo vacío {} | (ninguno) |
```

## Fuera de alcance
- Que llegue el correo con el enlace de un solo uso: la historia no-implementada de la API de esta misma épica.
- El restablecimiento de la contraseña con ese enlace: la historia transversal no-implementada de esta misma épica.
- Las pantallas «Recuperar contraseña» de la web y de la app móvil: las historias de web y de móvil de esta misma épica.

## Decisiones pendientes
- En qué tenant se busca la cuenta. Hoy el endpoint no lee la cabecera `x-tenant` y responde igual con cualquier valor, también con un tenant que no existe. No está decidido si debe leerla ni qué responder con un tenant desconocido.
- Si hay un límite de peticiones por correo y una espera entre ellas. Hoy no hay ninguno.
