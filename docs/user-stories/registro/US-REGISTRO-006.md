---
id: US-REGISTRO-006
tipo: historia
epica: EP-REGISTRO
titulo: "[API] Responder 202 al reenvío de la verificación sin revelar si hay una solicitud"
etiquetas: [api]
relacionadas: [US-REGISTRO-007, US-REGISTRO-012, US-REGISTRO-015]
verificacion: ejecutada
cubre: ["POST /api/auth/resend"]
---

## Historia
Como persona que ha pedido acceso y no tiene el correo de verificación, quiero que `POST /api/auth/resend` acepte mi petición de reenvío,
para que la respuesta no me diga nada sobre si mi correo tiene una solicitud ni sobre si existe una cuenta con él.

## Reglas
- `POST /api/auth/resend` es público: no necesita cabecera `Authorization`. Recibe `email`.
- Con un `email` no vacío, la respuesta es 202 con el cuerpo vacío `{}`, exista o no una solicitud o una cuenta con ese correo. La respuesta es la misma en los dos casos.
- Hoy el endpoint no envía ningún correo. El 202 es el contrato de la respuesta; no afirma que llegue ningún correo.
- Si el cuerpo no trae `email`, o lo trae vacío, la respuesta es 422 `validation_failed` con un motivo para `email`.
- **Correo sin cuenta.** En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución: `nadie-` seguido de una marca de tiempo y `@sigpro.test`.
- **Cuenta recién solicitada.** En los ejemplos, `(cuenta recién solicitada)` es una solicitud hecha en la propia fila en `alumno01`, con un correo nuevo (`nueva-` seguido de una marca de tiempo y `@organizacion.es`) y la contraseña `Abcdefghij1!`. El reenvío pide ese mismo correo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Reenvío de la verificación por la API

  Esquema del escenario: Con un correo no vacío la respuesta es 202 con cuerpo vacío, exista o no la solicitud
    Dado que en el tenant alumno01, recién reiniciado, <situacion>
    Cuando envía POST /api/auth/resend con x-tenant alumno01 y el correo <correo>
    Entonces la respuesta es 202 con el cuerpo vacío {}

    Ejemplos:
      | situacion | correo |
      | la cuenta pendiente@sigpro.test está pendiente de aprobación | pendiente@sigpro.test |
      | existe (cuenta recién solicitada) | (cuenta recién solicitada) |
      | la cuenta gestor@sigpro.test está activa | gestor@sigpro.test |
      | no existe ninguna cuenta con ese correo | (correo sin cuenta) |

  Esquema del escenario: El correo es obligatorio
    Dado que en el tenant alumno01, recién reiniciado, la fila todavía no ha enviado ningún reenvío
    Cuando envía POST /api/auth/resend con x-tenant alumno01 y un cuerpo en el que email vale <email>
    Entonces la respuesta es 422 validation_failed con un motivo para email

    Ejemplos:
      | email |
      | (vacío) |
      | (sin el campo) |
```

## Fuera de alcance
- Que llegue de verdad el correo de verificación con un enlace: esta misma épica, en su historia no-implementada de la API.
- El aviso «Correo reenviado» que ve la persona en la web y en la app móvil: historias de esta misma épica sobre la vista «Solicitud enviada».

## Decisiones pendientes
- Qué pasa con un correo que no tiene forma de dirección, por ejemplo `no-es-un-correo`: hoy el endpoint responde 202, porque solo exige un texto no vacío. No está decidido si debe rechazarlo como el registro (`badEmail`).
- Qué pasa con un correo de solo espacios: hoy responde 202 y no se recorta. No está decidido si debe tratarse como vacío.
- En qué tenant se busca la solicitud. Hoy el endpoint no lee la cabecera `x-tenant` y responde igual con un tenant que no existe.
- Si hay un límite de reenvíos y una espera entre ellos. Hoy no hay ninguno.
