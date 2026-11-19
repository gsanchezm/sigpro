---
id: EP-REGISTRO
tipo: epica
titulo: "Solicitud de acceso y reenvío de la verificación"
etiquetas: [epic]
---

## Objetivo
Que una persona sin cuenta pida acceso a SIGPRO eligiendo el rol que necesita, sepa qué le falta para completar la solicitud y qué ve después: una solicitud enviada, pendiente de aprobación por un administrador. La cuenta que se crea nace pendiente y no abre sesión hasta que se apruebe. Quien ya ha pedido acceso puede pedir otra vez el correo de verificación.

## Alcance
- Solicitud de acceso en la API: cuenta nueva pendiente de aprobación, validación del cuerpo con un motivo por campo, contraseña de diez caracteres con mayúscula, minúscula, número y símbolo, confirmación, aceptación de las condiciones, rol solicitable y correo ya registrado en el tenant.
- Reenvío de la verificación en la API (202 sin cuerpo), la web y la app móvil.
- Pantalla `/register` en la web y en la app móvil: elementos, ayudas, medidor de fuerza de la contraseña, validación antes de enviar, aviso de correo ya registrado y vista «Solicitud enviada» con el estado y el reenvío.
- Como capacidades futuras (`no-implementada`): el envío real del correo de verificación y el foco al primer campo con aviso en la app móvil.

## Plataformas
API, web y móvil (común a iOS y Android). No hay historias propias de iOS ni de Android: ningún comportamiento de esta épica cambia por el sistema.

## Historias
- US-REGISTRO-001: [API] Crear una solicitud de acceso pendiente de aprobación
- US-REGISTRO-002: [API] Rechazar una solicitud con campos obligatorios vacíos o un correo sin forma de dirección
- US-REGISTRO-003: [API] Exigir una contraseña de diez caracteres con mayúscula, minúscula, número y símbolo, y su confirmación
- US-REGISTRO-004: [API] Exigir la aceptación de las condiciones y un rol solicitable
- US-REGISTRO-005: [API] Responder 409 si el correo ya tiene cuenta en el tenant
- US-REGISTRO-006: [API] Responder 202 al reenvío de la verificación sin revelar si hay una solicitud
- US-REGISTRO-007: [API] Enviar el correo de verificación con un enlace al pedir acceso y al reenviarlo
- US-REGISTRO-008: [Web] Formulario de solicitud: elementos, ayudas y salidas
- US-REGISTRO-009: [Web] Validar la solicitud antes de enviarla: avisos por campo, foco y borrado al editar
- US-REGISTRO-010: [Web] Medidor de fuerza de la contraseña y sus cuatro reglas
- US-REGISTRO-011: [Web] Enviar la solicitud: aviso de correo ya registrado y vista «Solicitud enviada»
- US-REGISTRO-012: [Web] Reenviar el correo de verificación desde «Solicitud enviada»
- US-REGISTRO-013: [Móvil] Formulario de solicitud: elementos, ayudas, medidor y mostrar la contraseña
- US-REGISTRO-014: [Móvil] Validar la solicitud antes de enviarla: avisos por campo y borrado al editar
- US-REGISTRO-015: [Móvil] Enviar la solicitud: aviso de correo ya registrado, «Solicitud enviada» y reenvío de la verificación
- US-REGISTRO-016: [Móvil] Llevar el foco al primer campo con aviso al enviar la solicitud

Las historias 007 y 016 llevan la etiqueta `no-implementada`: son capacidades futuras, no se prueban contra la app y dicen en «Decisiones pendientes» lo que aún no está decidido. Las demás son vigentes.

## Fuera de alcance
- El inicio de sesión de una cuenta pendiente de aprobación (403 `pending_approval`) y su aviso: épica de inicio de sesión (EP-LOGIN).
- La aprobación, el rechazo y la reactivación de cuentas por un administrador: épica de Administración de usuarios (EP-ADMIN-USUARIOS).
- La recuperación de la contraseña: épica de recuperación (EP-RECUPERAR).
- El segundo paso de verificación (código de seis dígitos): épica de verificación en dos pasos (EP-MFA).
- Las páginas legales (condiciones y privacidad), la ayuda, el idioma y el tema de la cabecera: épicas transversales.
- El panel «Usuarios de prueba» de la pantalla de acceso: épica de la API de plataforma y configuración.
