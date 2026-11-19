---
id: EP-SESION
tipo: epica
titulo: "Sesión y renovación del token"
etiquetas: [epic]
---

## Objetivo
Que una persona que ya ha iniciado sesión siga trabajando sin volver a escribir su contraseña mientras su sesión pueda renovarse, y que, cuando no pueda, la pantalla de acceso sea el siguiente paso. Fija cuánto dura cada token y qué comprueba el servidor en cada petición: el estado de la cuenta se mira al iniciar sesión y al renovar, no en cada llamada.

## Alcance
- Renovación con el refreshToken en la API (`POST /api/auth/refresh`): la respuesta, los datos que se conservan y los rechazos por estado de la cuenta, por token que no sirve o por cuerpo inválido.
- Duración de los tokens: el accessToken caduca a los 900 segundos; el refreshToken dura 7 días si la sesión se inició con «Mantener la sesión en este equipo» y 12 horas si no. La app móvil siempre pide la sesión de 7 días.
- Usuario de la sesión (`GET /api/auth/me`) y comprobación del token en las peticiones protegidas de la API.
- Web y app móvil: renovación automática cuando el acceso caduca, y paso a la pantalla de acceso cuando la sesión no se puede renovar.
- Aviso de sesión caducada en la pantalla de acceso: capacidad futura, en la web y en la app móvil.

## Plataformas
API, web y móvil (común a iOS y Android). El comportamiento no depende del sistema.

## Historias
- US-SESION-001: [API] Renovar la sesión con el refreshToken
- US-SESION-002: [API] Rechazar la renovación de una cuenta bloqueada o desactivada
- US-SESION-003: [API] Rechazar la renovación con un token que no sirve o con un cuerpo inválido
- US-SESION-004: [API] Duración de los tokens: 900 segundos de acceso y 7 días o 12 horas de renovación
- US-SESION-005: [API] Identificar la sesión en GET /api/auth/me y rechazar las peticiones sin token válido
- US-SESION-006: [Web] Renovar la sesión sin cambiar de pantalla cuando caduca el acceso
- US-SESION-007: [Web] Llevar al acceso cuando no hay sesión o no se puede renovar
- US-SESION-008: [Web] Aviso de sesión caducada en el acceso
- US-SESION-009: [Móvil] Renovar la sesión sin cambiar de pantalla cuando caduca el acceso
- US-SESION-010: [Móvil] Llevar al acceso cuando no hay sesión o no se puede renovar
- US-SESION-011: [Móvil] Aviso de sesión caducada en el acceso

Las historias 008 y 011 llevan la etiqueta `no-implementada`: son capacidades futuras, no se prueban contra la app y dicen en «Decisiones pendientes» lo que aún no está decidido. Las demás son vigentes.

## Fuera de alcance
- El inicio de sesión, sus avisos y el bloqueo en el quinto fallo: EP-LOGIN (US-LOGIN-001 a US-LOGIN-003).
- El cierre de sesión, que no revoca los tokens, y lo que pasa en las pantallas al cerrarla: EP-LOGIN (US-LOGIN-004, US-LOGIN-008, US-LOGIN-013 y US-LOGIN-016).
- El segundo paso de verificación y su `mfaToken`: EP-MFA.
- Bloquear, desbloquear, desactivar, reactivar o cambiar el rol de una cuenta: épica de Usuarios y roles.
- La solicitud de acceso y el reenvío del correo de verificación: EP-REGISTRO.
- La conexión en tiempo real del Panel de misión: su propia épica.
