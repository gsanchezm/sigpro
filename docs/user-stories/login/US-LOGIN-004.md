---
id: US-LOGIN-004
tipo: historia
epica: EP-LOGIN
titulo: "[API] Bloquear la cuenta en el quinto intento fallido consecutivo"
etiquetas: [api]
relacionadas: [US-LOGIN-003, US-LOGIN-005, US-LOGIN-015, US-LOGIN-028]
verificacion: codigo
cubre: ["POST /api/auth/login"]
---

## Historia
Como responsable de seguridad de un tenant, quiero que una cuenta se bloquee al 5.º intento fallido consecutivo,
para que nadie pueda probar contraseñas sin límite contra ella.

## Reglas
- El umbral es de 5 intentos fallidos consecutivos de una cuenta existente.
- El intento que llega a 5 ya no responde 401: responde 423 con `code: "account_locked"` y la cuenta queda bloqueada.
- Con 4 intentos fallidos la cuenta sigue activa y el siguiente acceso correcto entra y pone el contador a cero.
- Una vez bloqueada, la cuenta responde 423 `account_locked` a cualquier intento posterior, con la contraseña correcta o con otra (US-LOGIN-005).
- Una cuenta pendiente de aprobación también se bloquea al 5.º fallo.
- Una petición rechazada por validación (422) no cuenta como intento.

## Criterios de aceptación
```gherkin
Característica: Bloqueo de la cuenta por intentos fallidos

  Esquema del escenario: El quinto fallo consecutivo bloquea la cuenta
    Dado que "<correo>" acumula <fallos_previos> intentos fallidos consecutivos
    Cuando envía POST /api/auth/login con la contraseña <contraseña>
    Entonces la respuesta es <respuesta>
    Y la cuenta queda <cuenta>

    Ejemplos:
      | correo | fallos_previos | contraseña | respuesta | cuenta |
      | gestor@sigpro.test | 3 | incorrecta | 401 invalid_credentials con attempts 4 | activa |
      | gestor@sigpro.test | 4 | incorrecta | 423 account_locked | bloqueada |
      | gestor@sigpro.test | 4 | correcta (Gestor1234!) | 200 con la sesión | activa, con el contador a cero |
      | gestor@sigpro.test | 5 | correcta (Gestor1234!) | 423 account_locked | bloqueada |
      | gestor@sigpro.test | 5 | incorrecta | 423 account_locked | bloqueada |
      | pendiente@sigpro.test | 4 | incorrecta | 423 account_locked | bloqueada |
```

## Fuera de alcance
- El desbloqueo de la cuenta por un administrador (épica de Usuarios y roles).
