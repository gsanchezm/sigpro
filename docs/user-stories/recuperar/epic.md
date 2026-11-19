---
id: EP-RECUPERAR
tipo: epica
titulo: "Recuperación de la contraseña"
etiquetas: [epic]
---

## Objetivo
Que una persona que no recuerda su contraseña pueda pedir desde la web o la app móvil un enlace de recuperación, sin que la respuesta revele si su correo tiene cuenta, y sepa qué le llegará y durante cuánto tiempo sirve ese enlace. El correo con el enlace y el restablecimiento de la contraseña todavía no existen en la app: aquí se describen como capacidades futuras, con lo mínimo acordado.

## Alcance
- `POST /api/auth/forgot` en la API: responde 202 con el cuerpo vacío exista o no la cuenta, y valida el correo con un motivo por campo.
- La pantalla «Recuperar contraseña» (`/forgot`) en la web y en la app móvil: su contenido, el correo que ya estaba escrito en el acceso, la validación antes de enviar, el aviso «Si el correo existe, recibirás un enlace en breve.», el botón ocupado y, en el móvil, el aviso emergente de error.
- Como capacidades futuras (`no-implementada`): el correo con un enlace de un solo uso válido durante 30 minutos y el restablecimiento de la contraseña con ese enlace.

## Plataformas
API, web y móvil (común a iOS y Android). No hay historias propias de iOS ni de Android: ningún comportamiento de esta épica cambia por el sistema. El restablecimiento, que todavía no tiene pantalla ni endpoint decididos, va como transversal.

## Historias
- US-RECUPERAR-001: [API] Responder 202 con cuerpo vacío a la recuperación, exista o no la cuenta
- US-RECUPERAR-002: [API] Enviar a la cuenta un correo con un enlace de un solo uso válido durante 30 minutos
- US-RECUPERAR-003: [Transversal] Restablecer la contraseña con el enlace de un solo uso
- US-RECUPERAR-004: [Web] Recuperar contraseña: correo del acceso, validación y salidas de la pantalla
- US-RECUPERAR-005: [Web] Enviar la petición: aviso de éxito, botón ocupado y fallo sin aviso de éxito
- US-RECUPERAR-006: [Móvil] Recuperar contraseña: correo del acceso, validación y salidas de la pantalla
- US-RECUPERAR-007: [Móvil] Enviar la petición: aviso de éxito, botón ocupado, aviso de error y tecla de envío

Las historias 002 y 003 llevan la etiqueta `no-implementada`: son capacidades futuras, no se prueban contra la app y dicen en «Decisiones pendientes» lo que aún no está decidido. Las demás son vigentes.

## Fuera de alcance
- El enlace «¿Olvidaste la contraseña?» de la pantalla de acceso y lo que hace al pulsarlo: épica de inicio de sesión (EP-LOGIN). Aquí solo se describe lo que muestra la pantalla de recuperación.
- La solicitud de acceso y el reenvío de la verificación: épica de solicitud de acceso (EP-REGISTRO).
- Los avisos de error de las demás pantallas de Acceso (inicio de sesión, solicitud de acceso y verificación en dos pasos): fuera de esta épica.
- El inicio de sesión con la contraseña nueva: épica de inicio de sesión (EP-LOGIN). Las sesiones ya abiertas al cambiar la contraseña son una decisión pendiente de la historia transversal de esta épica.
