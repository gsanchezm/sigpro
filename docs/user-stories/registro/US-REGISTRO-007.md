---
id: US-REGISTRO-007
tipo: historia
epica: EP-REGISTRO
titulo: "[API] Enviar el correo de verificación con un enlace al pedir acceso y al reenviarlo"
etiquetas: [api, no-implementada]
relacionadas: [US-REGISTRO-001, US-REGISTRO-006, US-REGISTRO-012, US-REGISTRO-015]
verificacion: no-ejecutable
---

## Historia
Como persona que ha pedido acceso a SIGPRO, quiero recibir en mi correo corporativo un mensaje con un enlace de verificación,
para confirmar que la dirección es mía y que la solicitud la he hecho yo.

## Reglas
- Lo mínimo acordado: tras una solicitud válida, llega a la dirección de la solicitud un mensaje con un enlace de verificación.
- Lo mismo al pedir el reenvío de la verificación de una solicitud existente.
- Qué contiene el mensaje, quién lo envía y qué hace el enlace no están decididos: ver «Decisiones pendientes».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las peticiones llevan la cabecera `x-tenant: alumno01`.
- **Correo nuevo.** En los ejemplos, `(correo nuevo)` es un correo que no existe en el tenant de la fila: `nueva-` seguido de una marca de tiempo y `@organizacion.es`. Es distinto en cada fila y en cada ejecución.
- **Cuenta recién solicitada.** En los ejemplos, `(cuenta recién solicitada)` es una solicitud hecha en la propia fila en `alumno01`, con `(correo nuevo)` como correo y `Abcdefghij1!` como contraseña.

## Criterios de aceptación
```gherkin
Característica: Correo de verificación con enlace

  Esquema del escenario: El correo de verificación llega a la dirección de la solicitud
    Dado que en el tenant alumno01, recién reiniciado, <previo>
    Cuando <accion>
    Entonces llega a la dirección de la solicitud un mensaje con un enlace de verificación

    Ejemplos:
      | previo | accion |
      | la fila todavía no ha enviado ninguna solicitud con (correo nuevo) | se envía la solicitud con POST /api/auth/register y el correo (correo nuevo) |
      | existe (cuenta recién solicitada) | se pide el reenvío con POST /api/auth/resend y ese mismo correo |
```

## Fuera de alcance
- La respuesta de la API a la solicitud y al reenvío (201 y 202): historias vigentes de esta misma épica.
- La aprobación de la cuenta por un administrador: épica de Administración de usuarios (EP-ADMIN-USUARIOS).
- La recuperación de la contraseña y su correo: épica de recuperación (EP-RECUPERAR).

## Decisiones pendientes
- Quién envía el correo y por qué medio: proveedor de correo, remitente y método de envío.
- El asunto, el texto del mensaje y el idioma en el que llega.
- Qué hace el enlace al pulsarlo: si marca la dirección como verificada, si cambia algo de la solicitud y cómo se relaciona con la aprobación de un administrador.
- Cuánto tiempo sirve el enlace y si se puede usar una sola vez.
- Qué pasa cuando la dirección no tiene una solicitud: si no sale ningún correo y si la respuesta de la API cambia.
- Cuántos reenvíos se permiten y con qué espera entre ellos.
- Qué ve la persona si el envío falla o tarda.
