---
id: US-CAOS-RESET-008
tipo: historia
epica: EP-CAOS-RESET
titulo: "[Web] Credenciales de demo y tenant de trabajo en /lab"
etiquetas: [web]
relacionadas: [US-CAOS-RESET-009, US-CAOS-RESET-012, US-CAOS-RESET-015, US-LOGIN-007]
verificacion: codigo
---

## Historia
Como alumno que empieza una práctica, quiero ver en /lab las credenciales de demo y elegir mi tenant de trabajo,
para entrar con el usuario correcto y saber en qué tenant estoy antes de tocar datos.

## Reglas
- /lab se ve sin sesión iniciada: su cabecera mínima tiene el enlace «Entrar», que lleva a /login. Con una sesión iniciada, la página se ve dentro de la aplicación.
- La sección «Credenciales de demo» tiene una fila por cada usuario de demostración, con las columnas «Nombre», «Correo», «Contraseña», «Rol» y «Notas». En «Rol» aparece la clave del rol tal cual (admin, program_manager, consultant o auditor).
- En «Notas», la cuenta con segundo paso muestra «MFA: 123456»; la cuenta bloqueada, «Cuenta bloqueada (423)»; la pendiente, «Pendiente de aprobación (403)»; y el resto, «—».
- Debajo de la tabla aparece «Tu usuario de alumno:» seguido del correo de alumno del tenant de trabajo, con la contraseña `Alumno1234!`, y la ayuda «Administrador de tu tenant y sin MFA. Es la cuenta con la que el proyecto de ejemplo reinicia tus datos.». Para el tenant `alumno01`, el correo es `alumno01@sigpro.lab`.
- La sección «Tenants» tiene un selector «Tenant de trabajo», con los tenants que ofrece la API (`demo` y `alumno01` a `alumno25`), y el tenant activo seleccionado. El botón «Usar este tenant» elige el tenant seleccionado como tenant de trabajo:
  - aparece el aviso informativo «Tenant activo: <tenant>» con el tenant elegido;
  - la línea «Tenant activo» de la cabecera y la línea de tu usuario de alumno pasan a mostrar ese tenant;
  - si había una sesión iniciada, se cierra y la página lleva a /login.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos`. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos. La fila empieza sin sesión guardada en el navegador salvo que diga otra cosa.

## Criterios de aceptación
```gherkin
Característica: Credenciales de demo y tenant de trabajo en /lab

  Esquema del escenario: La tabla de credenciales muestra cada usuario de demostración con su nota
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y una persona sin sesión iniciada está en /lab con el tenant de trabajo alumno01
    Cuando mira la sección «Credenciales de demo»
    Entonces ve la fila de <nombre> con el correo <correo>, la contraseña <contraseña>, el rol <rol> y la nota <nota>

    Ejemplos:
      | nombre | correo | contraseña | rol | nota |
      | Marta Ruiz | admin@sigpro.test | Admin1234! | admin | «MFA: 123456» |
      | Javier Ortega | gestor@sigpro.test | Gestor1234! | program_manager | «—» |
      | Lucía Fernández | consultor@sigpro.test | Consul1234! | consultant | «—» |
      | Andrés Molina | auditor@sigpro.test | Audit1234! | auditor | «—» |
      | Carmen Vidal | bloqueado@sigpro.test | Block1234! | consultant | «Cuenta bloqueada (423)» |
      | Pablo Serrano | pendiente@sigpro.test | Pend1234! | consultant | «Pendiente de aprobación (403)» |

  Esquema del escenario: Elegir el tenant de trabajo cambia el aviso y la línea de alumno
    Dado que los tenants alumno01 y alumno02 están recién reiniciados y con el modo caos apagado, y una persona sin sesión iniciada está en /lab con el tenant de trabajo alumno01
    Cuando elige <tenant> en «Tenant de trabajo» y pulsa «Usar este tenant»
    Entonces ve el aviso «Tenant activo: <tenant>»
    Y la línea de su usuario de alumno muestra <correo> con la contraseña Alumno1234!

    Ejemplos:
      | tenant | correo |
      | alumno02 | alumno02@sigpro.lab |

  Esquema del escenario: Elegir otro tenant con una sesión iniciada cierra la sesión
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y <cuenta> ha iniciado sesión en /login?tenant=alumno01 y ha abierto /lab con esa sesión
    Cuando elige alumno02 en «Tenant de trabajo» y pulsa «Usar este tenant»
    Entonces ve el aviso «Tenant activo: alumno02»
    Y llega a /login sin sesión iniciada

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | consultor@sigpro.test |
```

## Fuera de alcance
- Iniciar sesión, con su formulario y sus avisos: EP-LOGIN.
- El reinicio de datos desde esta página: historia 009 de esta épica.
- El modo caos desde esta página: historia 010 de esta épica.
- Los contraejemplos y las preguntas frecuentes: historia 012 de esta épica.
- La lista de endpoints de la API, la descarga del material del curso, la tabla de familias responsive y el estado de la API en esta página: pendiente de asignar a una épica.
