---
id: EP-API-PLATAFORMA
tipo: epica
titulo: "API de plataforma: salud, configuración y documentación"
etiquetas: [epic]
---

## Objetivo
Que quien prueba SIGPRO, y la propia web y la app móvil, pueda comprobar sin iniciar sesión que la API responde, leer su configuración pública y su documentación, y encontrar en la pantalla de acceso las cuentas de demostración para entrar sin tener que memorizarlas.

## Alcance
- Estado del servicio (`GET /api/health`) y el prefijo `/api` de todas las rutas.
- Configuración pública del tenant indicado con la cabecera `x-tenant` (`GET /api/config`): entorno, versión, usuarios de prueba y estado del caos.
- Listas públicas para la pantalla de acceso: los tenants y los usuarios de prueba (`GET /api/config/tenants` y `GET /api/config/test-users`).
- Formato común de los errores de la API: `statusCode`, `error`, `message`, `code`, `errors` y `traceId`.
- Documentación OpenAPI en `/api/docs` y `/api/docs-json`, y su protección opcional con credenciales.
- Orígenes permitidos para el navegador (CORS).
- Panel «Usuarios de prueba» de la pantalla de acceso en la web y en la app móvil.

## Plataformas
API, web y app móvil común a iOS y Android. Las historias `ios` y `android` no aplican: el panel y las rutas de esta épica se comportan igual en los dos sistemas.

## Historias
- US-API-PLATAFORMA-001: [API] Comprobar que el servicio responde sin autenticación
- US-API-PLATAFORMA-002: [API] Leer la configuración pública del tenant con la cabecera x-tenant
- US-API-PLATAFORMA-003: [API] Listar los tenants y los usuarios de prueba de la pantalla de acceso
- US-API-PLATAFORMA-004: [API] Responder los errores con código, mensaje, traza y errores por campo
- US-API-PLATAFORMA-005: [API] Publicar la documentación OpenAPI en /api/docs
- US-API-PLATAFORMA-006: [API] Aceptar las peticiones de los orígenes permitidos del navegador
- US-API-PLATAFORMA-007: [Web] Panel «Usuarios de prueba» en /login: un clic rellena correo y contraseña
- US-API-PLATAFORMA-008: [Móvil] Panel «Usuarios de prueba» en /login: un toque rellena correo y contraseña
- US-API-PLATAFORMA-009: [Móvil] Mostrar en cada usuario de prueba su correo, su contraseña, su estado y su segundo factor, como en la web

La historia 009 lleva la etiqueta `no-implementada`: es una capacidad futura, no se prueba contra la app y dice en «Decisiones pendientes» lo que aún no está decidido. Las demás son vigentes.

## Fuera de alcance
- El reinicio del tenant y el modo caos (`/api/admin/*`): épica EP-CAOS-RESET. Aquí `GET /api/config` solo se describe por su forma pública.
- El inicio de sesión, sus avisos y la validación del acceso: épica EP-LOGIN.
- El paso «Verificación en dos pasos»: épica EP-MFA.
- La pantalla `/lab`: su lista de endpoints, sus credenciales y su descarga no se describen aquí.
- El panel de marca de la pantalla de acceso, que muestra el entorno y la versión: no se describe en esta épica.
- Las respuestas propias de cada módulo (programas, requisitos, documentos y demás): cada una de sus épicas.
