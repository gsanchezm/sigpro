---
id: US-ADMIN-USUARIOS-013
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[Web] Desbloquear una cuenta bloqueada tras cinco intentos fallidos"
etiquetas: [web, no-implementada]
relacionadas: [US-ADMIN-USUARIOS-007, US-ADMIN-USUARIOS-008, US-ADMIN-USUARIOS-012, US-LOGIN-002, US-LOGIN-007]
verificacion: no-ejecutable
---

## Historia
Como administrador de un tenant, quiero desbloquear una cuenta que se ha bloqueado tras cinco intentos fallidos,
para que quien la usa vuelva a entrar con su contraseña sin que haya que restaurar todo el tenant.

## Reglas
- Lo mínimo acordado: solo un administrador del tenant puede desbloquear una cuenta bloqueada. Ningún otro rol puede hacerlo.
- Mientras una cuenta está bloqueada no abre sesión, ni con su contraseña correcta. La respuesta es 423 `account_locked`, y quien intenta entrar ve el aviso «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.».
- Desbloquear una cuenta significa que deja de estar bloqueada. Si además tiene otro impedimento, como estar pendiente de aprobación o desactivada, sigue sin abrir sesión por ese impedimento.
- El control, la forma en que la API recibe el desbloqueo, el contador de intentos y el registro quedan sin decidir: ver «Decisiones pendientes».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). En el seed, `bloqueado@sigpro.test` (contraseña `Block1234!`) está bloqueada.

## Criterios de aceptación
```gherkin
Característica: Desbloqueo de cuentas bloqueadas

  Esquema del escenario: Solo un administrador del tenant desbloquea la cuenta
    Dado que el tenant alumno01 está recién reiniciado y bloqueado@sigpro.test está bloqueada
    Cuando <quien> desbloquea esa cuenta
    Entonces la cuenta <resultado>

    Ejemplos:
      | quien | resultado |
      | un administrador del tenant | deja de estar bloqueada |
      | un gestor de programas | sigue bloqueada |
      | un consultor | sigue bloqueada |

  Esquema del escenario: Sin desbloqueo, la cuenta bloqueada no abre sesión
    Dado que el tenant alumno01 está recién reiniciado y bloqueado@sigpro.test está bloqueada
    Cuando bloqueado@sigpro.test inicia sesión en alumno01 con la contraseña <contraseña>
    Entonces la respuesta es 423 account_locked

    Ejemplos:
      | contraseña |
      | Block1234! |
      | incorrecta |
```

## Decisiones pendientes
- Dónde se desbloquea y cómo: un control en la fila «Bloqueado» de la tabla de usuarios, una acción aparte, o un campo nuevo en `PATCH /api/admin/users/:id`, y qué respuesta devuelve cada caso. Hoy la tabla muestra la cuenta como «Bloqueado» y no tiene ningún control para desbloquearla.
- Si el desbloqueo pone también a cero el contador de intentos fallidos. Hoy la cuenta bloqueada del seed tiene el contador en cinco, y solo vuelve a estar desbloqueada al reiniciar el tenant.
- Si desactivar y reactivar una cuenta bloqueada la desbloquea. Hoy no la desbloquea.
- Si el desbloqueo queda en el registro de auditoría y con qué acción.
- Si la regla de la propia cuenta se aplica también al desbloqueo.
- Si el desbloqueo aparece también en la app móvil, y con qué texto.

## Fuera de alcance
- La regla del bloqueo al quinto intento fallido consecutivo y el aviso que se ve al entrar: épica de Inicio y cierre de sesión (EP-LOGIN).
- El bloqueo por intentos fallidos de una cuenta que no existe: épica de Inicio y cierre de sesión (EP-LOGIN).
- El cambio de estado de una cuenta bloqueada con el interruptor de «Activo»: historia 008 de esta épica, con su comportamiento vigente.
- Una historia propia para la app móvil, si se decide: esta misma épica, como capacidad futura, cuando el producto la fije.
