---
id: US-API-PLATAFORMA-008
tipo: historia
epica: EP-API-PLATAFORMA
titulo: "[Móvil] Panel «Usuarios de prueba» en /login: un toque rellena correo y contraseña"
etiquetas: [movil]
relacionadas: [US-API-PLATAFORMA-003, US-API-PLATAFORMA-007, US-API-PLATAFORMA-009, US-LOGIN-012]
verificacion: ejecutada
cubre: ["/login"]
---

## Historia
Como alumno que prueba el acceso desde la app móvil, quiero ver las cuentas de demostración debajo del formulario y rellenar el correo y la contraseña con un toque,
para entrar con cada rol desde el móvil sin escribir ni recordar sus datos.

## Reglas
- Debajo del formulario de acceso aparece el panel: el texto «Usuarios de prueba» seguido de la ayuda «clic para rellenar».
- El panel tiene una opción por cada una de las seis cuentas de demostración, con el nombre de la cuenta y su rol.
- Tocar una opción rellena «Correo electrónico» con el correo de esa cuenta y «Contraseña» con su contraseña, y deja seleccionada esa opción.
- Tocar una opción no envía el formulario: la persona sigue en /login sin sesión iniciada y el campo «Tenant de trabajo» no cambia.
- Tocar una opción quita el aviso de error que estuviera visible.
- El panel solo aparece en el paso de credenciales. En la verificación en dos pasos no hay panel.
- Si la API no ofrece usuarios de prueba (entorno de producción), el panel no aparece.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en /login sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo». Como el reinicio no apaga el caos, antes de cada fila se comprueba con `GET /api/config` (cabecera `x-tenant: alumno01`) que `chaos` tiene latencia 0, tasa de error 0 y etiquetas no variables; si no es así, se apaga con `PATCH /api/admin/chaos` y el token de `alumno01@sigpro.lab`.

## Criterios de aceptación
```gherkin
Característica: Panel de usuarios de prueba en la app móvil

  Esquema del escenario: Tocar una opción rellena el acceso sin enviarlo
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /login, con alumno01 en «Tenant de trabajo»
    Cuando toca la opción de <nombre> en «Usuarios de prueba»
    Entonces «Correo electrónico» tiene <correo> y «Contraseña» tiene <contraseña>
    Y sigue en /login sin sesión iniciada, con alumno01 en «Tenant de trabajo»

    Ejemplos:
      | nombre | correo | contraseña |
      | Javier Ortega | gestor@sigpro.test | Gestor1234! |
      | Marta Ruiz | admin@sigpro.test | Admin1234! |
      | Lucía Fernández | consultor@sigpro.test | Consul1234! |

  Esquema del escenario: Tocar otra opción sustituye los datos del acceso
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /login, con alumno01 en «Tenant de trabajo», y ha tocado la opción de <primera>
    Cuando toca la opción de <segunda> en «Usuarios de prueba»
    Entonces «Correo electrónico» tiene <correo> y «Contraseña» tiene <contraseña>

    Ejemplos:
      | primera | segunda | correo | contraseña |
      | Javier Ortega | Marta Ruiz | admin@sigpro.test | Admin1234! |

  Esquema del escenario: Tocar una opción quita el aviso de error
    Dado que en el tenant alumno01, recién reiniciado, una persona en /login, con alumno01 en «Tenant de trabajo», ha escrito consultor@sigpro.test con la contraseña incorrecta, ha pulsado «Entrar» y ve el aviso «Correo o contraseña incorrectos»
    Cuando toca la opción de <nombre> en «Usuarios de prueba»
    Entonces deja de ver el aviso de error

    Ejemplos:
      | nombre |
      | Marta Ruiz |
      | Javier Ortega |

  Esquema del escenario: El panel depende del entorno de la API
    Dado que en el tenant alumno01, recién reiniciado, la API tiene APP_ENV <entorno> y una persona sin sesión iniciada está en /login, con alumno01 en «Tenant de trabajo»
    Cuando observa la pantalla de acceso
    Entonces <resultado>

    Ejemplos:
      | entorno | resultado |
      | dev | ve «Usuarios de prueba» y una opción por cada una de las seis cuentas |
      | staging | ve «Usuarios de prueba» y una opción por cada una de las seis cuentas |
      | production | no ve «Usuarios de prueba» ni ninguna opción |

  Esquema del escenario: El panel no aparece en la verificación en dos pasos
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test con la contraseña Admin1234! ha pulsado «Entrar» y ve el título «Verificación en dos pasos»
    Cuando observa la pantalla de <paso>
    Entonces no ve «Usuarios de prueba»

    Ejemplos:
      | paso |
      | verificación en dos pasos |
```

## Fuera de alcance
- La verificación en dos pasos y el código de seis dígitos: épica EP-MFA.
- Lo que el panel muestra en la app móvil además del nombre y el rol (correo, contraseña, estado y segundo factor): la historia móvil de esta épica sobre los datos de cada usuario, que es una capacidad futura.
- El inicio de sesión que sigue a rellenar el acceso: épica EP-LOGIN.
