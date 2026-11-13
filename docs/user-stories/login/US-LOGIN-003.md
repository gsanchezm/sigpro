---
id: US-LOGIN-003
tipo: historia
epica: EP-LOGIN
titulo: "[API] Rechazar credenciales incorrectas con el número de intento"
etiquetas: [api]
relacionadas: [US-LOGIN-004, US-LOGIN-014, US-LOGIN-027]
verificacion: codigo
cubre: ["POST /api/auth/login"]
---

## Historia
Como cliente de la API, quiero que unas credenciales incorrectas se rechacen con el número de intento fallido acumulado,
para avisar a la persona de cuántas veces ha fallado antes de que su cuenta se bloquee.

## Reglas
- Una contraseña incorrecta para una cuenta existente responde 401 con `code: "invalid_credentials"` y `attempts` igual al número de intentos fallidos consecutivos de esa cuenta, contando el actual.
- Un correo que no existe en el tenant se trata exactamente igual que una cuenta existente con la contraseña incorrecta: 401 `invalid_credentials` con su propio contador de intentos y, al 5.º intento fallido consecutivo, 423 `account_locked` (US-LOGIN-004). Así ninguna respuesta revela si la cuenta existe.
- El contador es de cada correo en cada tenant: los fallos de un correo no cambian el contador de otro ni el del mismo correo en otro tenant.
- El contador se compara sin distinguir mayúsculas en el correo: `Gestor@sigpro.test` y `gestor@sigpro.test` comparten contador.
- Un inicio de sesión correcto pone el contador a cero: el siguiente fallo vuelve a ser el intento 1.
- Una cuenta pendiente de aprobación o desactivada con una contraseña incorrecta también responde 401 `invalid_credentials` y suma un intento: su estado solo se revela con la contraseña correcta.
- En los ejemplos, `(correo sin cuenta)` es un correo que nunca se ha usado en ese tenant, como `nadie-` seguido de una marca de tiempo y `@sigpro.test`.

## Criterios de aceptación
```gherkin
Característica: Credenciales incorrectas

  Esquema del escenario: Cada fallo devuelve el número de intento acumulado
    Dado que <correo> acumula <fallos_previos> intentos fallidos consecutivos
    Cuando envía POST /api/auth/login con ese correo y la contraseña <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | correo | fallos_previos | contraseña | respuesta |
      | gestor@sigpro.test | 0 | incorrecta | 401 invalid_credentials con attempts 1 |
      | gestor@sigpro.test | 1 | incorrecta | 401 invalid_credentials con attempts 2 |
      | gestor@sigpro.test | 3 | incorrecta | 401 invalid_credentials con attempts 4 |
      | Gestor@SIGPRO.test | 2 | incorrecta | 401 invalid_credentials con attempts 3 |
      | pendiente@sigpro.test | 0 | incorrecta | 401 invalid_credentials con attempts 1 |
      | (correo sin cuenta) | 0 | incorrecta | 401 invalid_credentials con attempts 1 |
      | (correo sin cuenta) | 1 | incorrecta | 401 invalid_credentials con attempts 2 |
      | (correo sin cuenta) | 3 | incorrecta | 401 invalid_credentials con attempts 4 |
      | (correo sin cuenta) | 4 | incorrecta | 423 account_locked, igual que una cuenta existente |
      | (correo sin cuenta) | 5 | incorrecta | 423 account_locked, igual que una cuenta existente |

  Esquema del escenario: Un acceso correcto reinicia el contador
    Dado que consultor@sigpro.test acumula <fallos_previos> intentos fallidos consecutivos
    Y entra con la contraseña correcta Consul1234!
    Cuando vuelve a enviar la contraseña incorrecta
    Entonces la respuesta es 401 invalid_credentials con attempts igual a 1

    Ejemplos:
      | fallos_previos |
      | 1 |
      | 3 |
      | 4 |

  Esquema del escenario: El contador es propio de cada correo y de cada tenant
    Dado que gestor@sigpro.test acumula 3 intentos fallidos en el tenant alumno01
    Cuando <correo> envía la contraseña incorrecta en el tenant <tenant>
    Entonces la respuesta es 401 invalid_credentials con attempts igual a <intento>

    Ejemplos:
      | correo | tenant | intento |
      | gestor@sigpro.test | alumno01 | 4 |
      | consultor@sigpro.test | alumno01 | 1 |
      | gestor@sigpro.test | alumno02 | 1 |
```

## Fuera de alcance
- El bloqueo de una cuenta existente en el 5.º intento (US-LOGIN-004).
