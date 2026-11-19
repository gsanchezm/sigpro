---
id: US-CAOS-RESET-002
tipo: historia
epica: EP-CAOS-RESET
titulo: "[API] Tras el reinicio, las cuentas vuelven al estado del seed"
etiquetas: [api]
relacionadas: [US-CAOS-RESET-001, US-CAOS-RESET-003, US-LOGIN-001]
verificacion: codigo
cubre: ["POST /api/admin/reset"]
---

## Historia
Como alumno que prueba el acceso, quiero que el reinicio devuelva cada cuenta a su estado del seed (bloqueos, intentos fallidos, desactivaciones y rol),
para que cada prueba de acceso empiece con las mismas cuentas y no tenga que arreglarlas a mano.

## Reglas
- Tras el reinicio, cada cuenta del seed está activa, sin intentos fallidos y con el rol que le da el seed, salvo `bloqueado@sigpro.test` (cuenta bloqueada) y `pendiente@sigpro.test` (pendiente de aprobación), que conservan su estado del seed.
- Una cuenta bloqueada por intentos fallidos o desactivada por un administrador vuelve a entrar con su contraseña después del reinicio. El reinicio también deshace un cambio de rol.
- Los estados que la prueba fabrica se crean después del reinicio que prepara la fila y antes del reinicio que se prueba. Para desactivar una cuenta se usa `PATCH /api/admin/users/u2` con el cuerpo `{ "active": false }`; para cambiar un rol, `PATCH /api/admin/users/u2` con `{ "role": "consultant" }`. El id `u2` es el de `gestor@sigpro.test` en todos los tenants. Para acumular intentos fallidos se envía `POST /api/auth/login` con `x-tenant: alumno01`, ese correo y una contraseña incorrecta, tantas veces como indique la fila. Todas estas peticiones usan el token de `alumno01@sigpro.lab`, salvo los intentos fallidos, que no llevan token.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos` y el cuerpo `{ "latencyMs": 0, "errorRate": 0, "flakyLabels": false }`. Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos.

## Criterios de aceptación
```gherkin
Característica: Estado de las cuentas después del reinicio

  Esquema del escenario: El reinicio devuelve la cuenta bloqueada o desactivada a su estado del seed
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, gestor@sigpro.test <estado_previo>
    Cuando envía POST /api/admin/reset con el token de alumno01@sigpro.lab
    Y después envía POST /api/auth/login con x-tenant alumno01, el correo gestor@sigpro.test y la contraseña Gestor1234!
    Entonces la respuesta es 200 con accessToken

    Ejemplos:
      | estado_previo |
      | ha acumulado 5 intentos fallidos consecutivos, su cuenta está bloqueada y entrar con la contraseña correcta responde 423 account_locked |
      | ha sido desactivada por un administrador y entrar con la contraseña correcta responde 403 account_disabled |

  Esquema del escenario: Tras el reinicio, un fallo cuenta desde cero
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, gestor@sigpro.test acumula <fallos_previos> intentos fallidos consecutivos
    Cuando envía POST /api/admin/reset con el token de alumno01@sigpro.lab
    Y después envía POST /api/auth/login con x-tenant alumno01, el correo gestor@sigpro.test y una contraseña incorrecta
    Entonces la respuesta es 401 invalid_credentials con attempts 1

    Ejemplos:
      | fallos_previos |
      | 4 |
      | 5 |

  Esquema del escenario: Las cuentas bloqueada y pendiente del seed conservan su estado
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, <cuenta> está en el estado que le da el seed
    Cuando envía POST /api/auth/login con x-tenant alumno01, ese correo y la contraseña <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cuenta | contraseña | respuesta |
      | bloqueado@sigpro.test | Block1234! | 423 account_locked |
      | pendiente@sigpro.test | Pend1234! | 403 pending_approval |

  Esquema del escenario: El reinicio devuelve el rol que da el seed
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab ha cambiado con PATCH el rol de gestor@sigpro.test a <rol_asignado>
    Cuando envía POST /api/admin/reset con el token de alumno01@sigpro.lab
    Y después envía POST /api/auth/login con x-tenant alumno01, el correo gestor@sigpro.test y la contraseña Gestor1234!
    Entonces el usuario de la respuesta tiene el rol <rol_tras_reinicio>

    Ejemplos:
      | rol_asignado | rol_tras_reinicio |
      | consultant | program_manager |
      | auditor | program_manager |
```

## Fuera de alcance
- Las cuentas creadas durante la prueba y los programas dados de alta: otra historia de EP-CAOS-RESET.
- El desbloqueo, la activación y el cambio de rol hechos por un administrador desde su pantalla o su API: EP-ADMIN-USUARIOS.
- Las reglas de intentos fallidos y de bloqueo con una cuenta existente: EP-LOGIN.
