---
id: US-API-PLATAFORMA-007
tipo: historia
epica: EP-API-PLATAFORMA
titulo: "[Web] Panel «Usuarios de prueba» en /login: un clic rellena correo y contraseña"
etiquetas: [web]
relacionadas: [US-API-PLATAFORMA-003, US-API-PLATAFORMA-008, US-API-PLATAFORMA-009, US-LOGIN-007]
verificacion: codigo
cubre: ["/login", "/register"]
---

## Historia
Como alumno que prueba el acceso en la web, quiero ver las cuentas de demostración junto al formulario y rellenar el correo y la contraseña con un clic,
para entrar con cada rol sin escribir ni recordar sus datos.

## Reglas
- Debajo del formulario de acceso aparece el panel, con el encabezado «Usuarios de prueba» y la ayuda «clic para rellenar».
- El panel tiene una tarjeta por cada una de las seis cuentas de demostración. Cada tarjeta muestra el nombre y, debajo, el correo y la contraseña separados por un punto medio (·).
- La insignia de cada tarjeta muestra el estado de la cuenta si no está activa («bloqueado» o «pendiente»). Si está activa, muestra su rol y añade la marca «mfa» cuando la cuenta tiene segundo factor.
- Pulsar una tarjeta rellena «Correo electrónico» con el correo de esa cuenta y «Contraseña» con su contraseña, y deja el foco en «Correo electrónico».
- Pulsar una tarjeta no envía el formulario: la persona sigue en /login sin sesión iniciada y la dirección no cambia de tenant.
- Pulsar una tarjeta quita el aviso de error que estuviera visible.
- El panel también aparece en la solicitud de acceso (/register). Pulsar una tarjeta allí lleva a /login con los campos rellenos.
- Si la API no ofrece usuarios de prueba (entorno de producción), el panel no aparece en ninguna de las dos pantallas.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada. Como el reinicio no apaga el caos, antes de cada fila se comprueba con `GET /api/config` (cabecera `x-tenant: alumno01`) que `chaos` tiene latencia 0, tasa de error 0 y etiquetas no variables; si no es así, se apaga con `PATCH /api/admin/chaos` y el token de `alumno01@sigpro.lab`.

## Criterios de aceptación
```gherkin
Característica: Panel de usuarios de prueba en la web

  Esquema del escenario: Cada tarjeta muestra el nombre, el correo y la contraseña de su cuenta
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /login?tenant=alumno01
    Cuando mira la tarjeta de <nombre>
    Entonces ve el correo <correo> y la contraseña <contraseña> en esa tarjeta
    Y ve junto al encabezado «Usuarios de prueba» la ayuda «clic para rellenar»

    Ejemplos:
      | nombre | correo | contraseña |
      | Marta Ruiz | admin@sigpro.test | Admin1234! |
      | Javier Ortega | gestor@sigpro.test | Gestor1234! |
      | Lucía Fernández | consultor@sigpro.test | Consul1234! |
      | Andrés Molina | auditor@sigpro.test | Audit1234! |
      | Carmen Vidal | bloqueado@sigpro.test | Block1234! |
      | Pablo Serrano | pendiente@sigpro.test | Pend1234! |

  Esquema del escenario: La insignia muestra el estado o la marca de segundo factor
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /login?tenant=alumno01
    Cuando mira la tarjeta de <nombre>
    Entonces la insignia de esa tarjeta contiene <marca>

    Ejemplos:
      | nombre | marca |
      | Marta Ruiz | «mfa» |
      | Carmen Vidal | «bloqueado» |
      | Pablo Serrano | «pendiente» |

  Esquema del escenario: Pulsar una tarjeta rellena el acceso sin enviarlo
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /login?tenant=alumno01
    Cuando pulsa la tarjeta de <nombre>
    Entonces «Correo electrónico» tiene <correo> y «Contraseña» tiene <contraseña>
    Y el foco está en «Correo electrónico»
    Y sigue en /login sin sesión iniciada

    Ejemplos:
      | nombre | correo | contraseña |
      | Javier Ortega | gestor@sigpro.test | Gestor1234! |
      | Marta Ruiz | admin@sigpro.test | Admin1234! |
      | Lucía Fernández | consultor@sigpro.test | Consul1234! |

  Esquema del escenario: Pulsar una tarjeta quita el aviso de error
    Dado que en el tenant alumno01, recién reiniciado, una persona en /login?tenant=alumno01 ha escrito gestor@sigpro.test con la contraseña incorrecta, ha pulsado «Entrar» y ve el aviso «Correo o contraseña incorrectos»
    Cuando pulsa la tarjeta de <nombre>
    Entonces deja de ver el aviso de error

    Ejemplos:
      | nombre |
      | Marta Ruiz |
      | Javier Ortega |

  Esquema del escenario: En la solicitud de acceso, una tarjeta lleva a /login con los campos rellenos
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /register?tenant=alumno01
    Cuando pulsa la tarjeta de <nombre>
    Entonces llega a /login con «Correo electrónico» con <correo> y «Contraseña» con <contraseña>

    Ejemplos:
      | nombre | correo | contraseña |
      | Javier Ortega | gestor@sigpro.test | Gestor1234! |
      | Carmen Vidal | bloqueado@sigpro.test | Block1234! |

  Esquema del escenario: El panel depende del entorno de la API
    Dado que en el tenant alumno01, recién reiniciado, la API tiene APP_ENV <entorno> y una persona sin sesión iniciada está en /login?tenant=alumno01
    Cuando observa la pantalla de acceso
    Entonces <resultado>

    Ejemplos:
      | entorno | resultado |
      | dev | ve el encabezado «Usuarios de prueba» con las seis tarjetas |
      | staging | ve el encabezado «Usuarios de prueba» con las seis tarjetas |
      | production | no ve el encabezado «Usuarios de prueba» ni ninguna tarjeta |
```

## Decisiones pendientes
- La forma en que la insignia escribe el rol de las cuentas activas: hoy aparece el rol técnico de la cuenta. No está decidido si debe usar otro texto, así que ningún ejemplo lo afirma.

## Fuera de alcance
- El inicio de sesión que sigue a rellenar el acceso (pulsar «Entrar», sus avisos y la redirección): épica EP-LOGIN.
- El paso «Verificación en dos pasos» que pide una cuenta con segundo factor: épica EP-MFA.
- El panel de marca de la pantalla de acceso, que muestra el entorno y la versión: no se describe en esta épica.
