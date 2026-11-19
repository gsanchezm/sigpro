---
id: US-ADMIN-USUARIOS-012
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[Web] Aprobar una cuenta pendiente de aprobación desde la tabla de usuarios"
etiquetas: [web, no-implementada]
relacionadas: [US-ADMIN-USUARIOS-007, US-ADMIN-USUARIOS-008, US-LOGIN-003, US-LOGIN-007, US-REGISTRO-011]
verificacion: no-ejecutable
---

## Historia
Como administrador de un tenant, quiero aprobar la solicitud de acceso de una persona que espera en la tabla de usuarios,
para que pueda entrar en SIGPRO con su contraseña.

## Reglas
- Lo mínimo acordado: una cuenta pendiente de aprobación solo la puede aprobar un administrador del tenant. Ningún otro rol la puede aprobar.
- Mientras una cuenta está pendiente de aprobación no abre sesión, aunque su contraseña sea la correcta. La respuesta es 403 `pending_approval`, y quien intenta entrar ve el aviso «Cuenta pendiente de aprobación. Revisa tu correo.».
- Aprobar una cuenta pendiente de aprobación significa que deja de estar pendiente.
- El control, su texto, la forma en que la API recibe la aprobación y lo que ve la persona después están sin decidir: ver «Decisiones pendientes».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). En el seed, `pendiente@sigpro.test` (contraseña `Pend1234!`) está pendiente de aprobación. En los ejemplos, `(cuenta recién solicitada en alumno01)` es una cuenta creada en la propia fila con `POST /api/auth/register` y la cabecera `x-tenant: alumno01`, con el correo `nueva-` seguido de una marca de tiempo y `@organizacion.es`, la contraseña `Abcdefghij1!` y el rol consultant.

## Criterios de aceptación
```gherkin
Característica: Aprobación de cuentas pendientes de aprobación

  Esquema del escenario: Solo un administrador del tenant aprueba la cuenta pendiente
    Dado que el tenant alumno01 está recién reiniciado y pendiente@sigpro.test está pendiente de aprobación
    Cuando <quien> aprueba esa cuenta
    Entonces la cuenta <resultado>

    Ejemplos:
      | quien | resultado |
      | un administrador del tenant | deja de estar pendiente de aprobación |
      | un gestor de programas | sigue pendiente de aprobación |
      | un auditor | sigue pendiente de aprobación |

  Esquema del escenario: Sin aprobación la cuenta pendiente no abre sesión
    Dado que el tenant alumno01 está recién reiniciado y pendiente@sigpro.test está pendiente de aprobación
    Cuando pendiente@sigpro.test inicia sesión en alumno01 con la contraseña <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | contraseña | respuesta |
      | Pend1234! | 403 pending_approval |
      | incorrecta | 401 invalid_credentials con attempts 1 |
```

## Decisiones pendientes
- Dónde se aprueba y cómo: un control en la fila «Pendiente» de la tabla de usuarios, una acción aparte, o las dos cosas. Hoy la tabla muestra la cuenta con el estado «Pendiente» y no tiene ningún control para aprobarla.
- Qué petición lo hace (por ejemplo, un campo nuevo en `PATCH /api/admin/users/:id` o un endpoint propio) y qué respuesta devuelve en cada caso.
- Si al aprobar el administrador confirma o cambia el rol que pidió la persona en el registro.
- Si la aprobación avisa a la persona (por ejemplo, con un correo) y qué dice ese aviso.
- Si el administrador puede rechazar una solicitud en lugar de aprobarla, y qué pasa con la cuenta rechazada: que se elimine, que quede desactivada o que siga pendiente.
- Qué pasa con el interruptor de «Activo» de una cuenta pendiente de aprobación. Hoy se puede cambiar sin aprobar la cuenta, y la cuenta sigue pendiente.
- Si la aprobación queda en el registro de auditoría y con qué acción.
- Si la aprobación también aparece en la app móvil, y con qué texto.

## Fuera de alcance
- La solicitud de acceso que crea la cuenta pendiente de aprobación, la vista «Solicitud enviada» y el reenvío de la verificación: épica de Solicitud de acceso (EP-REGISTRO).
- El inicio de sesión de una cuenta pendiente de aprobación y su aviso, que hoy existen: épica de Inicio y cierre de sesión (EP-LOGIN).
- El cambio de estado de una cuenta pendiente de aprobación con el interruptor de «Activo»: historia 008 de esta épica, con su comportamiento vigente.
- Una historia propia para la app móvil, si se decide: esta misma épica, como capacidad futura, cuando el producto la fije.
