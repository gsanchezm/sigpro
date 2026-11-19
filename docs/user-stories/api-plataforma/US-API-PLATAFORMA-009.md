---
id: US-API-PLATAFORMA-009
tipo: historia
epica: EP-API-PLATAFORMA
titulo: "[Móvil] Mostrar en cada usuario de prueba su correo, su contraseña, su estado y su segundo factor, como en la web"
etiquetas: [movil, no-implementada]
relacionadas: [US-API-PLATAFORMA-007, US-API-PLATAFORMA-008, US-LOGIN-012]
verificacion: no-ejecutable
---

## Historia
Como alumno que prueba el acceso desde la app móvil, quiero ver en cada usuario de prueba su correo, su contraseña, su estado y su segundo factor, como en la web,
para elegir la cuenta que necesito y saber si está bloqueada o pendiente antes de tocarla.

## Reglas
- Cada opción del panel muestra el correo y la contraseña de su cuenta, como la tarjeta de la web.
- Si la cuenta no está activa, la opción muestra su estado: «bloqueado» o «pendiente».
- Si la cuenta tiene segundo factor, la opción muestra la marca «mfa».
- Ver estos datos no rellena el acceso ni envía el formulario.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en /login sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo». Como el reinicio no apaga el caos, antes de cada fila se comprueba con `GET /api/config` (cabecera `x-tenant: alumno01`) que `chaos` tiene latencia 0, tasa de error 0 y etiquetas no variables; si no es así, se apaga con `PATCH /api/admin/chaos` y el token de `alumno01@sigpro.lab`.

## Criterios de aceptación
```gherkin
Característica: Datos de cada usuario de prueba en la app móvil

  Esquema del escenario: La opción muestra el correo y la contraseña de la cuenta
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /login, con alumno01 en «Tenant de trabajo»
    Cuando mira la opción de <nombre> en «Usuarios de prueba»
    Entonces ve el correo <correo> y la contraseña <contraseña> en esa opción

    Ejemplos:
      | nombre | correo | contraseña |
      | Javier Ortega | gestor@sigpro.test | Gestor1234! |
      | Marta Ruiz | admin@sigpro.test | Admin1234! |
      | Carmen Vidal | bloqueado@sigpro.test | Block1234! |

  Esquema del escenario: La opción muestra la marca de segundo factor o el estado de la cuenta
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /login, con alumno01 en «Tenant de trabajo»
    Cuando mira la opción de <nombre> en «Usuarios de prueba»
    Entonces ve <marca> en esa opción

    Ejemplos:
      | nombre | marca |
      | Marta Ruiz | «mfa» |
      | Carmen Vidal | «bloqueado» |
      | Pablo Serrano | «pendiente» |
```

## Decisiones pendientes
- Si la contraseña se ve en claro en la opción, como en la web, o con un control para ocultarla.
- Si el rol de las cuentas activas se escribe como en la web (el rol técnico) o con otro texto.
- Si el panel también debe aparecer en la solicitud de acceso de la app, como en la web.

## Fuera de alcance
- Tocar una opción para rellenar el acceso, que ya existe: la historia móvil de esta épica sobre ese toque.
- El inicio de sesión que sigue: épica EP-LOGIN.
