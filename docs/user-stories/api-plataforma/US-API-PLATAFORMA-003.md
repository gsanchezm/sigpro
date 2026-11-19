---
id: US-API-PLATAFORMA-003
tipo: historia
epica: EP-API-PLATAFORMA
titulo: "[API] Listar los tenants y los usuarios de prueba de la pantalla de acceso"
etiquetas: [api]
relacionadas: [US-API-PLATAFORMA-007, US-API-PLATAFORMA-008]
verificacion: codigo
cubre: ["GET /api/config/tenants", "GET /api/config/test-users"]
---

## Historia
Como persona que va a entrar en SIGPRO, o alumno que prueba la API, quiero ver qué tenants existen y qué cuentas de demostración hay,
para elegir el tenant de trabajo y rellenar el acceso sin buscar correos ni contraseñas en la documentación.

## Reglas
- `GET /api/config/tenants` y `GET /api/config/test-users` son públicos: no necesitan la cabecera `Authorization`, y la cabecera `x-tenant` no cambia su respuesta.
- `GET /api/config/tenants` devuelve una lista (no un objeto) con un elemento por tenant del seed, ordenada por el identificador de menor a mayor. Con el seed por defecto, que crea 25 tenants de alumno además de `demo`, son 26 elementos: `alumno01` … `alumno25` y, al final, `demo`.
- Cada elemento trae solo `id` y `name`. El nombre de `demo` es `Demo`, y el de cada alumno es `Alumno` seguido del número de dos cifras (`Alumno 01` … `Alumno 25`).
- `GET /api/config/test-users` devuelve una lista (no un objeto) con las seis cuentas de demostración del seed, en el orden de la tabla de ejemplos. No incluye las cuentas `alumnoNN@sigpro.lab`.
- Cada cuenta trae `id`, `name`, `email`, `password`, `role`, `mfa` y `status`. La contraseña va en claro porque es un entorno de prueba.
- `status` es el estado de fábrica del seed: `active`, `locked` (bloqueada) o `pending` (pendiente de aprobación). No refleja el estado actual de la cuenta en el tenant: si después se bloquea o se aprueba una cuenta, la lista no cambia.
- `mfa` vale `true` solo para `admin@sigpro.test`.
- Con `APP_ENV` en `production`, `GET /api/config/test-users` responde 200 con una lista vacía, sin error.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Como el reinicio no apaga el caos, antes de cada fila se comprueba con `GET /api/config` (cabecera `x-tenant: alumno01`) que `chaos` tiene latencia 0, tasa de error 0 y etiquetas no variables; si no es así, se apaga con `PATCH /api/admin/chaos` y ese mismo token.

## Criterios de aceptación
```gherkin
Característica: Listas públicas de tenants y de usuarios de prueba

  Esquema del escenario: La lista de tenants va ordenada por identificador
    Dado que en el tenant alumno01, recién reiniciado, la API tiene el seed por defecto de 25 tenants de alumno
    Cuando envía GET /api/config/tenants
    Entonces la respuesta es 200 con 26 elementos y el elemento <posicion> tiene id <id> y name <nombre>

    Ejemplos:
      | posicion | id | nombre |
      | 1 | alumno01 | Alumno 01 |
      | 25 | alumno25 | Alumno 25 |
      | 26 | demo | Demo |

  Esquema del escenario: Las dos listas no dependen de la cabecera x-tenant
    Dado que en el tenant alumno01, recién reiniciado, la API tiene el seed por defecto
    Cuando envía GET <ruta> con la cabecera x-tenant <cabecera>
    Entonces la respuesta es 200 con <cantidad>

    Ejemplos:
      | ruta | cabecera | cantidad |
      | /api/config/tenants | alumno02 | 26 elementos |
      | /api/config/tenants | noexiste | 26 elementos |
      | /api/config/test-users | alumno02 | 6 cuentas de demostración |
      | /api/config/test-users | noexiste | 6 cuentas de demostración |

  Esquema del escenario: Las seis cuentas de demostración con sus datos
    Dado que en el tenant alumno01, recién reiniciado, la API tiene el seed por defecto
    Cuando envía GET /api/config/test-users
    Entonces la respuesta incluye la cuenta con id <id>, name <nombre>, email <correo>, password <contraseña>, role <rol>, mfa <mfa> y status <estado>

    Ejemplos:
      | id | nombre | correo | contraseña | rol | mfa | estado |
      | u1 | Marta Ruiz | admin@sigpro.test | Admin1234! | admin | true | active |
      | u2 | Javier Ortega | gestor@sigpro.test | Gestor1234! | program_manager | false | active |
      | u3 | Lucía Fernández | consultor@sigpro.test | Consul1234! | consultant | false | active |
      | u4 | Andrés Molina | auditor@sigpro.test | Audit1234! | auditor | false | active |
      | u5 | Carmen Vidal | bloqueado@sigpro.test | Block1234! | consultant | false | locked |
      | u6 | Pablo Serrano | pendiente@sigpro.test | Pend1234! | consultant | false | pending |

  Esquema del escenario: Con la API en producción la lista de usuarios de prueba está vacía
    Dado que en el tenant alumno01, recién reiniciado, la API tiene APP_ENV <entorno>
    Cuando envía GET /api/config/test-users
    Entonces la respuesta es 200 con <resultado>

    Ejemplos:
      | entorno | resultado |
      | dev | una lista con las seis cuentas de demostración |
      | staging | una lista con las seis cuentas de demostración |
      | production | una lista vacía |
```

## Fuera de alcance
- La configuración del tenant con su entorno, su versión y su caos: otra historia de esta épica.
- La pantalla de acceso que muestra o rellena estas listas: las historias de los paneles de la web y de la app móvil de esta épica.
- El selector de tenant de la pantalla del instructor `/lab`: no se describe en esta épica. El reinicio de datos, que también está en esa pantalla, es de la épica EP-CAOS-RESET.
