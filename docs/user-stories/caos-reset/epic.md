---
id: EP-CAOS-RESET
tipo: epica
titulo: "Reinicio del tenant y modo caos"
etiquetas: [epic]
---

## Objetivo
Dar a quien practica y a quien prueba dos herramientas sobre su propio tenant: un reinicio que devuelve sus datos al estado del seed determinista y un modo caos que añade latencia, errores 500 en las escrituras y textos de botón que alternan. Cada fila de las demás épicas parte de un reinicio y de un caos apagado; por eso esta épica describe con detalle qué restaura el reinicio, qué borra, qué conserva y qué no, y cómo se comporta el caos.

## Alcance
- `POST /api/admin/reset` con el token del administrador del tenant: qué restaura, qué borra, qué conserva y los códigos de respuesta.
- `GET /api/admin/chaos` y `PATCH /api/admin/chaos`: lectura y fijación de la latencia, la tasa de errores y los textos variables, con sus rangos.
- Permisos y autenticación de esas tres rutas: solo el administrador del tenant.
- El efecto del modo caos en las peticiones del tenant: retardo, errores 500 en escrituras, rutas exentas y aislamiento entre tenants.
- Las pantallas que manejan el reinicio y el caos: /lab en la web (credenciales, tenant de trabajo, reinicio, modo caos, contraejemplos y preguntas frecuentes), y las pestañas «Modo caos» y «Datos» de Administración en la web y en el móvil.

## Plataformas
API, web y móvil. La pantalla /lab existe en la web y no existe en el móvil (historia no implementada). En el móvil, el reinicio y el modo caos están en Administración.

## Historias
- US-CAOS-RESET-001: [API] Restaurar el tenant con el token de su administrador
- US-CAOS-RESET-002: [API] Tras el reinicio, las cuentas vuelven al estado del seed
- US-CAOS-RESET-003: [API] El reinicio borra las cuentas y los programas creados en la prueba
- US-CAOS-RESET-004: [API] El reinicio conserva el caos, las sesiones y los contadores de correos sin cuenta
- US-CAOS-RESET-005: [API] Solo el administrador del tenant reinicia o gestiona el modo caos
- US-CAOS-RESET-006: [API] Leer y fijar el modo caos del tenant
- US-CAOS-RESET-007: [API] El modo caos retrasa y falla solo las peticiones de su tenant
- US-CAOS-RESET-008: [Web] Credenciales de demo y tenant de trabajo en /lab
- US-CAOS-RESET-009: [Web] Reiniciar los datos del tenant desde /lab y desde Administración
- US-CAOS-RESET-010: [Web] Aplicar y apagar el modo caos desde /lab
- US-CAOS-RESET-011: [Web] Modo caos en Administración
- US-CAOS-RESET-012: [Web] Contraejemplos y preguntas frecuentes de /lab
- US-CAOS-RESET-013: [Móvil] Modo caos en Administración
- US-CAOS-RESET-014: [Móvil] Restaurar los datos del tenant desde Administración
- US-CAOS-RESET-015: [Móvil] Pantalla de laboratorio /lab

## Fuera de alcance
- `GET /api/config`, `GET /api/config/tenants`, `GET /api/config/test-users` y `GET /api/health`: EP-API-PLATAFORMA. El campo `chaos` de `GET /api/config` sí se comprueba en la historia 006 de esta épica, porque es el estado del caos.
- La variante de `POST /api/admin/reset` que usa la cabecera de administración global para reiniciar todos los tenants: es infraestructura (el cron nocturno) y no la usa quien trabaja en su tenant, así que no se describe.
- La pestaña «Usuarios» de Administración, sus endpoints (`GET /api/admin/users`, `PATCH /api/admin/users/:id`) y el diálogo «Información del tenant» de la pestaña «Datos»: EP-ADMIN-USUARIOS.
- La pestaña «Auditoría» de Administración y `GET /api/audit`: EP-AUDITORIA.
- La lista de endpoints de /lab, la descarga del material de ejemplo, la tabla de familias de componentes responsive y el estado de la API: pendiente de asignar a una épica.
- El aislamiento de datos entre tenants que no pasa por el caos: EP-MULTITENANT-PERMISOS.
- La renovación, la caducidad y el cierre de sesión: EP-SESION.
- El «Guardar» alterno de las pantallas de Programas, Requisitos, No conformidades y Perfil: las épicas de cada módulo.
