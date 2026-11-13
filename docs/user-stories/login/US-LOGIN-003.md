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
- Un correo que no existe en el tenant recibe la misma respuesta 401 `invalid_credentials`, con su propio contador de intentos: la respuesta no revela si la cuenta existe.
- El contador es de cada cuenta en cada tenant: los fallos de una cuenta no cambian el contador de otra ni el de la misma cuenta en otro tenant.
- El contador se compara sin distinguir mayúsculas en el correo: `Gestor@sigpro.test` y `gestor@sigpro.test` comparten contador.
- Un inicio de sesión correcto pone el contador a cero: el siguiente fallo vuelve a ser el intento 1.
- Una cuenta pendiente de aprobación o desactivada con una contraseña incorrecta también responde 401 `invalid_credentials` y suma un intento: su estado solo se revela con la contraseña correcta.
- Al llegar al 5.º intento fallido consecutivo de una cuenta existente la respuesta ya no es 401, sino el bloqueo (US-LOGIN-004).

## Criterios de aceptación
```gherkin
Característica: Credenciales incorrectas

  Esquema del escenario: Cada fallo devuelve el número de intento acumulado
    Dado que "<correo>" acumula <fallos_previos> intentos fallidos consecutivos
    Cuando envía POST /api/auth/login con ese correo y la contraseña "<contraseña>"
    Entonces la respuesta es 401 con el código invalid_credentials
    Y "attempts" vale <intento>

    Ejemplos:
      | correo | fallos_previos | contraseña | intento |
      | gestor@sigpro.test | 0 | incorrecta | 1 |
      | gestor@sigpro.test | 1 | incorrecta | 2 |
      | gestor@sigpro.test | 3 | incorrecta | 4 |
      | Gestor@SIGPRO.test | 2 | incorrecta | 3 |
      | nadie@sigpro.test | 0 | incorrecta | 1 |
      | nadie@sigpro.test | 1 | incorrecta | 2 |
      | pendiente@sigpro.test | 0 | incorrecta | 1 |

  Esquema del escenario: Un acceso correcto reinicia el contador
    Dado que "consultor@sigpro.test" acumula <fallos_previos> intentos fallidos consecutivos
    Y entra con la contraseña correcta "Consul1234!"
    Cuando vuelve a enviar la contraseña "incorrecta"
    Entonces la respuesta es 401 con "attempts" igual a 1

    Ejemplos:
      | fallos_previos |
      | 1 |
      | 3 |
      | 4 |

  Esquema del escenario: El contador es propio de cada cuenta y de cada tenant
    Dado que "gestor@sigpro.test" acumula 3 intentos fallidos en el tenant "alumno01"
    Cuando "<correo>" envía la contraseña "incorrecta" en el tenant "<tenant>"
    Entonces la respuesta es 401 con "attempts" igual a <intento>

    Ejemplos:
      | correo | tenant | intento |
      | gestor@sigpro.test | alumno01 | 4 |
      | consultor@sigpro.test | alumno01 | 1 |
      | gestor@sigpro.test | alumno02 | 1 |
```

## Fuera de alcance
- El bloqueo en el 5.º intento (US-LOGIN-004).
