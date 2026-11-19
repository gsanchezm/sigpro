---
id: EP-MULTITENANT-PERMISOS
tipo: epica
titulo: "Aislamiento por tenant y matriz de permisos por rol"
etiquetas: [epic]
---

## Objetivo
Que cada alumno trabaje en su tenant sin ver ni cambiar datos de otro, aunque coincidan los códigos, y que cada rol pueda hacer exactamente lo que la matriz de permisos le concede, con la misma respuesta en la API, en la web y en la app móvil. Es una vista transversal: las reglas de cada módulo están en su épica, y aquí se comprueban las que valen para toda la plataforma y la matriz completa de permisos.

## Alcance
- Aislamiento por tenant en la API: lecturas y escrituras de cada módulo sobre recursos de otro tenant, listas que no mezclan datos y la cabecera `x-tenant` frente a un token.
- Las cuentas de demostración de cada tenant y la cuenta de administración de cada alumno.
- La matriz de permisos completa: cada clave de `PERMISSIONS` con los cuatro roles, y el orden de las comprobaciones (401 antes que 403).
- Las reglas transversales del tenant (listados, búsquedas, exportaciones, descargas) y del permiso (la API decide y la interfaz lo refleja).
- Qué acciones ofrecen la web y la app móvil a cada rol, con el motivo cuando están deshabilitadas, y qué accesos del menú ve cada rol.

## Plataformas
API, web y transversal. La app móvil tiene su propia historia de acciones por rol, con la misma matriz y otra superficie. El comportamiento es el mismo en iOS y en Android, así que no hay historias `ios` ni `android`.

## Historias
- US-MULTITENANT-PERMISOS-001: [API] Las cuentas de demostración existen en cada tenant y la de alumnoNN solo en el suyo
- US-MULTITENANT-PERMISOS-002: [API] Un token lee solo los datos de su tenant
- US-MULTITENANT-PERMISOS-003: [API] Un token no escribe en otro tenant: los recursos ajenos responden 404
- US-MULTITENANT-PERMISOS-004: [API] La cabecera x-tenant no cambia el tenant de un token
- US-MULTITENANT-PERMISOS-005: [API] Permisos por rol: la matriz de cada familia y el orden 401 → 403
- US-MULTITENANT-PERMISOS-006: [Transversal] Ningún listado, búsqueda, exportación ni descarga mezcla datos de dos tenants
- US-MULTITENANT-PERMISOS-007: [Transversal] La API decide el permiso y la interfaz solo lo refleja
- US-MULTITENANT-PERMISOS-008: [Web] Acciones por rol: deshabilitadas con su motivo y accesos del menú según el rol
- US-MULTITENANT-PERMISOS-009: [Móvil] Acciones por rol: deshabilitadas con su motivo y accesos de la pestaña Más según el rol

## Fuera de alcance
- Las reglas de cada módulo (programas, requisitos, verificación, no conformidades, documentos, hitos, proveedores y auditoría): su épica. Aquí solo se repite lo necesario para el aislamiento y la matriz.
- El inicio de sesión, el segundo factor, el registro y la renovación de la sesión: EP-LOGIN, EP-MFA, EP-REGISTRO y EP-SESION.
- El reinicio del tenant y el modo caos: EP-CAOS-RESET. La clave de administración del reinicio nocturno (`X-Admin-Key`) no es un token de usuario y queda fuera.
- El contenido de la pantalla de Administración de usuarios: EP-ADMIN-USUARIOS.
