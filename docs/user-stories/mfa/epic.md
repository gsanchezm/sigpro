---
id: EP-MFA
tipo: epica
titulo: "Verificación en dos pasos"
etiquetas: [epic]
---

## Objetivo
Que una persona cuya cuenta exige un segundo factor complete el acceso con un código de seis dígitos, sin obtener una sesión antes de validarlo y sin eludir un bloqueo o una desactivación ocurridos entre los dos pasos.

## Alcance
- Canje del token temporal y el código en la API, incluidos los errores de formato, código y token y la caducidad a los cinco minutos.
- Revisión del estado de la cuenta en el momento del canje.
- Paso de verificación y regreso al formulario de acceso en la web y la app móvil.

## Plataformas
API, web y móvil común a iOS y Android. No hay aquí un comportamiento propio de uno de los sistemas nativos.

## Historias
- US-MFA-001: [API] Canjear el token temporal y el código por una sesión
- US-MFA-002: [API] Impedir el canje si la cuenta quedó bloqueada o desactivada
- US-MFA-003: [Web] Completar o abandonar la verificación en dos pasos
- US-MFA-004: [Móvil] Completar o abandonar la verificación en dos pasos

## Fuera de alcance
- El primer paso con correo y contraseña: EP-LOGIN.
- La renovación, la expiración y el cierre de la sesión ya emitida: EP-SESION.
- La gestión administrativa del estado de las cuentas: EP-ADMIN-USUARIOS.
- La configuración de un autenticador real: este prototipo usa un código fijo en los datos de demostración.
