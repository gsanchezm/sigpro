---
id: EP-ADMIN-USUARIOS
tipo: epica
titulo: "Administración de usuarios y roles"
etiquetas: [epic]
---

## Objetivo
Que quien administra un tenant vea a todas sus personas con su rol y su estado (activa, bloqueada, pendiente de aprobación o desactivada), pueda cambiar el rol de cada una y activarla o desactivarla, y no pueda quitarse el acceso a sí misma ni dejar el tenant sin ningún administrador activo. Ningún otro rol entra en esta administración.

## Alcance
- Listado de usuarios del tenant en la API: campos, estados, orden y aislamiento por tenant.
- Permiso `users.manage`: solo el rol admin; sin un token válido, 401, y para el resto de roles, 403.
- Cambio del rol y del estado (activa o desactivada) en la API: validación del cuerpo, cuenta inexistente, protección de la propia cuenta y del último admin activo, y registro en la auditoría de lo que cambia.
- Pantalla `/admin` en la web y en la app móvil: acceso según el rol, pestañas, tabla o tarjetas de usuarios, búsqueda, cambio de rol y de estado con sus avisos.
- Como capacidades futuras (`no-implementada`): aprobar las cuentas pendientes de aprobación y desbloquear las cuentas bloqueadas. La app no tiene hoy ningún camino para ninguna de las dos.

## Plataformas
API, web y móvil (común a iOS y Android). No hay historias propias de iOS ni de Android: ningún comportamiento de esta épica cambia por el sistema.

## Historias
- US-ADMIN-USUARIOS-001: [API] Listar los usuarios del tenant con su rol y su estado
- US-ADMIN-USUARIOS-002: [API] Permitir la administración de usuarios solo al rol admin
- US-ADMIN-USUARIOS-003: [API] Cambiar el rol o el estado de un usuario del tenant
- US-ADMIN-USUARIOS-004: [API] Validar el cuerpo y el id de un cambio de usuario
- US-ADMIN-USUARIOS-005: [API] Impedir quitarse el acceso o dejar el tenant sin admin activo
- US-ADMIN-USUARIOS-006: [Web] Entrar en Administración según el rol y elegir sus pestañas
- US-ADMIN-USUARIOS-007: [Web] Ver la tabla de usuarios, buscarlos y ver sus avisos de carga, vacío y error
- US-ADMIN-USUARIOS-008: [Web] Cambiar el rol o el estado de un usuario desde su fila
- US-ADMIN-USUARIOS-009: [Móvil] Entrar en Administración según el rol y elegir sus pestañas
- US-ADMIN-USUARIOS-010: [Móvil] Ver a los usuarios del tenant en tarjetas y buscarlos
- US-ADMIN-USUARIOS-011: [Móvil] Cambiar el rol o el estado de un usuario desde su tarjeta
- US-ADMIN-USUARIOS-012: [Web] Aprobar una cuenta pendiente de aprobación desde la tabla de usuarios
- US-ADMIN-USUARIOS-013: [Web] Desbloquear una cuenta bloqueada tras cinco intentos fallidos

Las historias 012 y 013 llevan la etiqueta `no-implementada`: son capacidades futuras, no se prueban contra la app y dicen en «Decisiones pendientes» lo que aún no está decidido. Las demás son vigentes.

## Fuera de alcance
- La solicitud de acceso que crea una cuenta pendiente de aprobación, su correo de verificación y el rechazo de una solicitud antes de crear la cuenta: épica de Solicitud de acceso (EP-REGISTRO).
- El inicio de sesión de las cuentas bloqueadas, pendientes o desactivadas, con sus avisos: épica de Inicio y cierre de sesión (EP-LOGIN).
- El segundo paso de verificación de un administrador: épica de Verificación en dos pasos (EP-MFA).
- La renovación de la sesión, la caducidad de los tokens y la renovación de una cuenta desactivada: épica de Sesión y renovación de token (EP-SESION).
- La pestaña «Auditoría» de Administración y el registro de auditoría como pantalla: épica de Auditoría (EP-AUDITORIA). Aquí solo se describe que el registro recoge cada cambio.
- Las pestañas «Modo caos» y «Datos» de Administración, con el reinicio del tenant y la información del tenant: épica de Modo caos y reinicio del tenant (EP-CAOS-RESET). Aquí solo se describe cómo se elige cada pestaña.
- Crear o borrar usuarios a mano: la API no tiene ninguno de los dos endpoints. Las cuentas nuevas llegan con la solicitud de acceso (EP-REGISTRO).
- La lista de responsables de un programa, `GET /api/users/owners`: épica de Alta de programas (EP-PROG-ALTA).
