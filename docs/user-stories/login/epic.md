---
id: EP-LOGIN
tipo: epica
titulo: "Inicio y cierre de sesión"
etiquetas: [epic]
---

## Objetivo
Que cada persona de un tenant entre en SIGPRO con su correo y su contraseña, sepa con claridad por qué no puede entrar cuando no puede (credenciales incorrectas, cuenta bloqueada, pendiente de aprobación o desactivada) y salga de su sesión cuando quiera. Protege las cuentas frente a intentos repetidos con un bloqueo en el quinto fallo consecutivo.

## Alcance
- Inicio de sesión con correo y contraseña en la API, la web y la app móvil, en el tenant que corresponde.
- Validación de los campos antes de enviar y validación del cuerpo en el servidor.
- Respuesta a credenciales incorrectas con el número de intento y bloqueo de la cuenta en el 5.º intento fallido consecutivo.
- Avisos de cuenta bloqueada, pendiente de aprobación y desactivada.
- Mostrar y ocultar la contraseña y mantener la sesión en el equipo.
- Cierre de sesión y aviso «Sesión cerrada correctamente.».
- Acceso con certificado digital o SSO: el contrato actual (no disponible) y el acceso que se debió construir.
- Lo que en la app móvil todavía falta respecto de la web (mostrar la contraseña, mantener la sesión, el aviso de sesión cerrada y el SSO), descrito como el ideal.

## Plataformas
API, web y móvil (común a iOS y Android), con una historia propia de Android para el botón atrás.

## Historias
- US-LOGIN-001: [API] Iniciar sesión con credenciales válidas
- US-LOGIN-002: [API] Validar el cuerpo de la petición de inicio de sesión
- US-LOGIN-003: [API] Rechazar credenciales incorrectas con el número de intento
- US-LOGIN-004: [API] Bloquear la cuenta en el quinto intento fallido consecutivo
- US-LOGIN-005: [API] Rechazar el inicio de sesión de una cuenta bloqueada
- US-LOGIN-006: [API] Rechazar el inicio de sesión de una cuenta pendiente de aprobación
- US-LOGIN-007: [API] Rechazar el inicio de sesión de una cuenta desactivada
- US-LOGIN-008: [API] Iniciar sesión en el tenant que corresponde
- US-LOGIN-009: [API] Cerrar sesión
- US-LOGIN-010: [API] Responder que el acceso con SSO no está disponible
- US-LOGIN-011: [Web] Mostrar el formulario de acceso y sus enlaces
- US-LOGIN-012: [Web] Validar el correo y la contraseña antes de enviar
- US-LOGIN-013: [Web] Entrar con credenciales válidas
- US-LOGIN-014: [Web] Mostrar el error de credenciales con el número de intento
- US-LOGIN-015: [Web] Avisar del bloqueo de la cuenta
- US-LOGIN-016: [Web] Avisar de una cuenta pendiente de aprobación
- US-LOGIN-017: [Web] Avisar de una cuenta desactivada
- US-LOGIN-018: [Web] Mostrar y ocultar la contraseña
- US-LOGIN-019: [Web] Mantener la sesión en este equipo
- US-LOGIN-020: [Web] Cerrar sesión y ver el aviso de sesión cerrada
- US-LOGIN-021: [Web] Avisar de que el acceso con SSO no está disponible
- US-LOGIN-022: [Web] Acceder con certificado digital o SSO
- US-LOGIN-023: [Móvil] Mostrar el formulario de acceso y sus enlaces
- US-LOGIN-024: [Móvil] Elegir el tenant de trabajo al iniciar sesión
- US-LOGIN-025: [Móvil] Validar el correo y la contraseña antes de enviar
- US-LOGIN-026: [Móvil] Entrar con credenciales válidas
- US-LOGIN-027: [Móvil] Mostrar el error de credenciales con el número de intento
- US-LOGIN-028: [Móvil] Avisar del bloqueo de la cuenta
- US-LOGIN-029: [Móvil] Avisar de una cuenta pendiente de aprobación
- US-LOGIN-030: [Móvil] Avisar de una cuenta desactivada
- US-LOGIN-031: [Móvil] Cerrar sesión desde el perfil
- US-LOGIN-032: [Móvil] Mostrar y ocultar la contraseña
- US-LOGIN-033: [Móvil] Mantener la sesión en este equipo
- US-LOGIN-034: [Móvil] Ver el aviso de sesión cerrada
- US-LOGIN-035: [Móvil] Acceder con certificado digital o SSO
- US-LOGIN-036: [Android] El botón atrás tras cerrar sesión no vuelve a una pantalla privada

Las historias 022, 032, 033, 034 y 035 llevan la etiqueta `no-implementada`: describen una capacidad que la app todavía no tiene y no se pueden probar contra ella.

## Fuera de alcance
- El segundo paso de verificación (código de 6 dígitos): épica del segundo factor (MFA). Aquí solo se describe que el inicio de sesión lo pide.
- La solicitud de acceso (registro), el reenvío del correo de verificación y la recuperación de la contraseña: tienen sus propias épicas. Aquí solo se describen los enlaces que llevan a ellas.
- La renovación del token, la duración de la sesión con y sin «Mantener la sesión» y lo que ocurre con el token de renovación tras cerrar sesión: épica de Sesión y renovación de token.
- La aprobación de las cuentas pendientes y el desbloqueo o la desactivación de una cuenta por un administrador: épica de Usuarios y roles.
- El panel «Usuarios de prueba» de la pantalla de acceso, que rellena el correo y la contraseña de los usuarios de demostración: épica de la API de plataforma y configuración.
- El idioma y el tema de la cabecera de Acceso y los enlaces del pie (Privacidad, Condiciones y Ayuda): épicas transversales de idioma, tema y páginas legales.
- Los avisos de error genéricos de las pantallas de Acceso (sin conexión o error inesperado del servidor).
