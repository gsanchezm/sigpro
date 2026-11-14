---
id: US-LOGIN-002
tipo: historia
epica: EP-LOGIN
titulo: "[API] Rechazar credenciales incorrectas y bloquear la cuenta en el 5.º intento fallido"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-LOGIN-003, US-LOGIN-007, US-LOGIN-012]
verificacion: codigo
cubre: ["POST /api/auth/login"]
---

## Historia
Como responsable de seguridad de un tenant, quiero que cada intento con credenciales incorrectas se cuente y que la cuenta se bloquee en el 5.º fallo consecutivo,
para que nadie pueda probar contraseñas sin límite y para que la persona sepa cuántas veces ha fallado.

## Reglas
- Una contraseña incorrecta para una cuenta existente responde 401 con `code: "invalid_credentials"` y `attempts` igual al número de intentos fallidos consecutivos de esa cuenta, contando el actual.
- El umbral es de 5 intentos fallidos consecutivos: el intento que llega a 5 ya no responde 401, responde 423 con `code: "account_locked"`, y la cuenta queda bloqueada. Con 4 sigue activa.
- Una cuenta bloqueada responde 423 `account_locked` a todo intento posterior, con la contraseña correcta o con otra. Ese 423 no lleva `attempts`, no incluye ningún token y no cambia el contador. El bloqueo se comprueba antes que la contraseña.
- Un correo que no tiene cuenta en el tenant se trata exactamente igual que una cuenta existente con la contraseña incorrecta: 401 `invalid_credentials` con su propio contador de intentos y 423 `account_locked` en el 5.º intento fallido consecutivo y en los siguientes. Así ninguna respuesta revela si la cuenta existe.
- Un inicio de sesión correcto pone el contador a cero: el siguiente fallo vuelve a ser el intento 1.
- El contador es de cada correo en cada tenant: los fallos de un correo no cambian el contador de otro ni el del mismo correo en otro tenant. El correo se compara sin distinguir mayúsculas: `Gestor@SIGPRO.test` y `gestor@sigpro.test` comparten contador.
- Una cuenta pendiente de aprobación con la contraseña incorrecta también responde 401 y suma un intento, y también se bloquea en el 5.º.
- Una petición rechazada por validación (422) no cuenta como intento.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (y el tenant `alumno02` con el de `alumno02@sigpro.lab` cuando la fila lo usa); después, en el mismo tenant, se envían tantos `POST /api/auth/login` con ese correo y una contraseña incorrecta como indique `fallos_previos`. Todas las peticiones llevan la cabecera `x-tenant` del tenant de la fila. En el reinicio, todas las cuentas de demostración quedan activas y sin intentos fallidos, salvo `bloqueado@sigpro.test`, que queda bloqueada.
- En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución: `nadie-` seguido de una marca de tiempo y `@sigpro.test`. Sus fallos previos también se envían en la propia fila.

## Criterios de aceptación
```gherkin
Característica: Credenciales incorrectas y bloqueo de la cuenta

  Esquema del escenario: Cada fallo devuelve el número de intento acumulado
    Dado que en el tenant alumno01, recién reiniciado, <correo> acumula <fallos_previos> intentos fallidos consecutivos
    Cuando envía POST /api/auth/login con x-tenant alumno01, ese correo y la contraseña incorrecta
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | correo | fallos_previos | respuesta |
      | gestor@sigpro.test | 0 | 401 invalid_credentials con attempts 1 |
      | gestor@sigpro.test | 1 | 401 invalid_credentials con attempts 2 |
      | gestor@sigpro.test | 3 | 401 invalid_credentials con attempts 4 |
      | Gestor@SIGPRO.test | 2 | 401 invalid_credentials con attempts 3 |
      | pendiente@sigpro.test | 0 | 401 invalid_credentials con attempts 1 |
      | (correo sin cuenta) | 0 | 401 invalid_credentials con attempts 1 |
      | (correo sin cuenta) | 1 | 401 invalid_credentials con attempts 2 |
      | (correo sin cuenta) | 3 | 401 invalid_credentials con attempts 4 |

  Esquema del escenario: El quinto fallo consecutivo bloquea la cuenta
    Dado que en el tenant alumno01, recién reiniciado, <correo> acumula <fallos_previos> intentos fallidos consecutivos
    Cuando envía POST /api/auth/login con x-tenant alumno01, ese correo y la contraseña <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | correo | fallos_previos | contraseña | respuesta |
      | gestor@sigpro.test | 3 | incorrecta | 401 invalid_credentials con attempts 4 |
      | gestor@sigpro.test | 4 | incorrecta | 423 account_locked, sin attempts |
      | gestor@sigpro.test | 4 | Gestor1234! | 200 con accessToken y refreshToken |
      | gestor@sigpro.test | 5 | Gestor1234! | 423 account_locked, sin attempts ni ningún token |
      | gestor@sigpro.test | 5 | incorrecta | 423 account_locked, sin attempts |
      | pendiente@sigpro.test | 4 | incorrecta | 423 account_locked, sin attempts |
      | (correo sin cuenta) | 3 | incorrecta | 401 invalid_credentials con attempts 4 |
      | (correo sin cuenta) | 4 | incorrecta | 423 account_locked, sin attempts |
      | (correo sin cuenta) | 5 | incorrecta | 423 account_locked, sin attempts |

  Esquema del escenario: Una cuenta bloqueada no abre sesión ni con su contraseña
    Dado que en el tenant alumno01, recién reiniciado, la cuenta bloqueado@sigpro.test está bloqueada
    Cuando envía POST /api/auth/login con x-tenant alumno01, el correo <correo> y la contraseña <contraseña>
    Entonces la respuesta es 423 account_locked
    Y la respuesta no incluye attempts ni ningún token

    Ejemplos:
      | correo | contraseña |
      | bloqueado@sigpro.test | Block1234! |
      | bloqueado@sigpro.test | incorrecta |
      | BLOQUEADO@sigpro.test | Block1234! |

  Esquema del escenario: Un acceso correcto reinicia el contador
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test acumula <fallos_previos> intentos fallidos consecutivos
    Y después entra con la contraseña correcta Consul1234! y recibe 200
    Cuando vuelve a enviar ese correo con la contraseña incorrecta
    Entonces la respuesta es 401 invalid_credentials con attempts 1

    Ejemplos:
      | fallos_previos |
      | 1 |
      | 3 |
      | 4 |

  Esquema del escenario: El contador es propio de cada correo y de cada tenant
    Dado que los tenants alumno01 y alumno02 están recién reiniciados y gestor@sigpro.test acumula 3 intentos fallidos en alumno01
    Cuando envía POST /api/auth/login con x-tenant <tenant>, el correo <correo> y la contraseña incorrecta
    Entonces la respuesta es 401 invalid_credentials con attempts <intento>

    Ejemplos:
      | correo | tenant | intento |
      | gestor@sigpro.test | alumno01 | 4 |
      | consultor@sigpro.test | alumno01 | 1 |
      | gestor@sigpro.test | alumno02 | 1 |
```

## Fuera de alcance
- El desbloqueo de una cuenta por un administrador: épica de Usuarios y roles.
- Los estados de pendiente de aprobación y desactivada con la contraseña correcta: historias de esos estados en esta misma épica.
