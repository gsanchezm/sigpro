---
id: EP-LOGIN
tipo: epica
titulo: "Inicio y cierre de sesión"
etiquetas: [epic]
---

## Objetivo
Que cada persona de un tenant entre en SIGPRO con su correo y su contraseña, sepa con claridad por qué no puede entrar cuando no puede (credenciales incorrectas, cuenta bloqueada, pendiente de aprobación o desactivada) y salga de su sesión cuando quiera, sabiendo qué garantiza ese cierre. Protege las cuentas frente a intentos repetidos con un bloqueo en el quinto fallo consecutivo, sin revelar si una cuenta existe.

## Alcance
- Inicio de sesión con correo y contraseña en la API, la web y la app móvil, en el tenant que corresponde, con la validación de los campos antes de enviar y del cuerpo en el servidor.
- Respuesta a credenciales incorrectas con el número de intento y bloqueo en el 5.º intento fallido consecutivo, también para un correo sin cuenta.
- Avisos de cuenta bloqueada, pendiente de aprobación y desactivada, con su mensaje.
- Mostrar y ocultar la contraseña y mantener la sesión en el navegador.
- Cierre de sesión: lo que garantiza (el cliente descarta sus tokens) y lo que no (el servidor no los revoca), y el aviso «Sesión cerrada correctamente.».
- Acceso con certificado digital o SSO: el contrato actual (no disponible) y, como capacidad futura, lo mínimo acordado.
- Lo que en la app móvil todavía falta respecto de la web (mostrar la contraseña, la casilla de mantener la sesión, el aviso de sesión cerrada y el SSO), como capacidad futura.

## Plataformas
API, web y móvil (común a iOS y Android), con una historia propia de Android para el botón atrás.

## Historias
- US-LOGIN-001: [API] Iniciar sesión con correo y contraseña en un tenant
- US-LOGIN-002: [API] Rechazar credenciales incorrectas y bloquear la cuenta en el 5.º intento fallido
- US-LOGIN-003: [API] Rechazar el inicio de sesión de una cuenta pendiente de aprobación o desactivada
- US-LOGIN-004: [API] Cerrar sesión sin revocar los tokens ya emitidos
- US-LOGIN-005: [API] Responder que el acceso con certificado digital o SSO no está disponible
- US-LOGIN-006: [Web] Formulario de acceso: elementos, validación antes de enviar y mostrar la contraseña
- US-LOGIN-007: [Web] Iniciar sesión: entrar en Programas o ver por qué no se puede
- US-LOGIN-008: [Web] Mantener la sesión en el navegador y cerrarla con el aviso de sesión cerrada
- US-LOGIN-009: [Web] Avisar de que el acceso con certificado digital o SSO no está disponible
- US-LOGIN-010: [Web] Entrar con «Acceder con certificado digital / SSO» sin la contraseña de SIGPRO
- US-LOGIN-011: [Móvil] Formulario de acceso: elementos, tenant de trabajo y validación antes de enviar
- US-LOGIN-012: [Móvil] Iniciar sesión: entrar en Programas o ver por qué no se puede
- US-LOGIN-013: [Móvil] Mantener la sesión al cerrar la app y cerrarla desde el perfil
- US-LOGIN-014: [Móvil] Mostrar la contraseña, la casilla de mantener la sesión y el aviso de sesión cerrada, como en la web
- US-LOGIN-015: [Móvil] Entrar con «Acceder con certificado digital / SSO» sin la contraseña de SIGPRO
- US-LOGIN-016: [Android] El botón atrás tras cerrar sesión no vuelve a una pantalla privada

Las historias 010, 014 y 015 llevan la etiqueta `no-implementada`: son capacidades futuras, no se prueban contra la app y dicen en «Decisiones pendientes» lo que aún no está decidido. Las demás son vigentes.

## Fuera de alcance
- El segundo paso de verificación (código de 6 dígitos): épica del segundo factor (MFA). Aquí solo se describe que el inicio de sesión lo pide.
- La solicitud de acceso (registro), el reenvío del correo de verificación y la recuperación de la contraseña: tienen sus propias épicas. Aquí solo se describen los enlaces que llevan a ellas.
- La renovación del token y la duración de la sesión con y sin «Mantener la sesión»: épica de Sesión y renovación de token. Aquí solo se describe que cerrar sesión no revoca los tokens ya emitidos.
- La aprobación de las cuentas pendientes y el desbloqueo o la desactivación de una cuenta por un administrador: épica de Usuarios y roles.
- El panel «Usuarios de prueba» de la pantalla de acceso, que rellena el correo y la contraseña de los usuarios de demostración: épica de la API de plataforma y configuración.
- El idioma y el tema de la cabecera de Acceso y los enlaces del pie (Privacidad, Condiciones y Ayuda): épicas transversales de idioma, tema y páginas legales.
- Los avisos de error genéricos de las pantallas de Acceso (sin conexión o error inesperado del servidor).
