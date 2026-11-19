---
id: US-RECUPERAR-002
tipo: historia
epica: EP-RECUPERAR
titulo: "[API] Enviar a la cuenta un correo con un enlace de un solo uso válido durante 30 minutos"
etiquetas: [api, no-implementada]
relacionadas: [US-RECUPERAR-001, US-RECUPERAR-003, US-RECUPERAR-004, US-REGISTRO-007]
verificacion: no-ejecutable
---

## Historia
Como persona que ha olvidado la contraseña de su cuenta de SIGPRO, quiero recibir en el correo de mi cuenta un enlace de un solo uso válido durante 30 minutos,
para poder recuperar el acceso a mi cuenta.

## Reglas
- Lo mínimo acordado: tras pedir la recuperación con el correo de una cuenta activa, llega a la dirección de esa cuenta un correo con un enlace de un solo uso válido durante 30 minutos.
- El enlace vale 30 minutos desde su envío, como anuncia la pantalla «Recuperar contraseña» de la web y de la app móvil.
- La respuesta que ve quien pide la recuperación no cambia: es 202 con el cuerpo vacío `{}`, exista o no la cuenta.
- El enlace solo llega a la dirección de una cuenta. Si una dirección sin cuenta recibe algún correo y qué dice, está en «Decisiones pendientes».
- Qué pasa al pulsar el enlace no está en esta historia: ver «Fuera de alcance».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se envía `POST /api/auth/forgot` con la cabecera `x-tenant: alumno01` y el correo de la fila.
- En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución: `nadie-` seguido de una marca de tiempo y `@sigpro.test`.

## Criterios de aceptación
```gherkin
Característica: Correo de recuperación con enlace de un solo uso

  Esquema del escenario: La cuenta activa recibe el correo con el enlace
    Dado que en el tenant alumno01, recién reiniciado, la cuenta <correo> está activa
    Cuando se pide la recuperación con POST /api/auth/forgot, con x-tenant alumno01 y el correo <correo>
    Entonces llega a la dirección de la cuenta un correo con un enlace de un solo uso válido durante 30 minutos

    Ejemplos:
      | correo |
      | gestor@sigpro.test |
      | consultor@sigpro.test |
      | (GESTOR@sigpro.test con un espacio delante y otro detrás) |

  Esquema del escenario: Una dirección sin cuenta no recibe ningún enlace de recuperación
    Dado que en el tenant alumno01, recién reiniciado, no existe ninguna cuenta con <correo>
    Cuando se pide la recuperación con POST /api/auth/forgot, con x-tenant alumno01 y el correo <correo>
    Entonces no llega a esa dirección ningún enlace de recuperación

    Ejemplos:
      | correo |
      | (correo sin cuenta) |
```

## Fuera de alcance
- La respuesta de la API a la petición, 202 con el cuerpo vacío, y la validación del correo: la historia de la API de esta misma épica.
- Lo que hace el enlace al pulsarlo y el restablecimiento de la contraseña: la historia transversal no-implementada de esta misma épica.
- Las pantallas «Recuperar contraseña» de la web y de la app móvil: las historias de web y de móvil de esta misma épica.

## Decisiones pendientes
- Quién envía el correo y por qué medio: proveedor de correo, remitente y método de envío.
- El asunto, el texto del mensaje, el idioma en que llega y el dominio y la ruta a los que lleva el enlace.
- Qué cuentas reciben el enlace. Esta historia lo afirma solo para cuentas activas. Las bloqueadas, las pendientes de aprobación y las desactivadas no están decididas.
- En qué tenant está la cuenta cuando el mismo correo existe en varios tenants (las cuentas de demostración existen en todos los `alumnoNN`), y si la petición debe leer la cabecera `x-tenant` para elegirla.
- Si una dirección sin cuenta recibe algún correo, por ejemplo para avisar de que no hay cuenta, y qué diría.
- Cuántas peticiones se permiten y con qué espera entre ellas, y si un enlace nuevo deja sin valor a los anteriores.
- Qué pasa si el envío falla o tarda después de la respuesta 202.
- Cómo consulta quien ejecuta una fila el correo que llega a la cuenta.
