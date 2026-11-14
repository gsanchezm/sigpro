---
id: US-LOGIN-014
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Mostrar la contraseña, la casilla de mantener la sesión y el aviso de sesión cerrada, como en la web"
etiquetas: [movil, no-implementada]
relacionadas: [US-LOGIN-006, US-LOGIN-008, US-LOGIN-013]
verificacion: no-ejecutable
---

## Historia
Como persona que entra en SIGPRO desde la app móvil, quiero las mismas ayudas del acceso que tiene la web (ver la contraseña, elegir si se mantiene la sesión y confirmar que la he cerrado),
para no tener en el móvil menos control sobre mi acceso que en el navegador.

## Reglas
- La web ya tiene estas tres ayudas en su pantalla de acceso; el requisito es la paridad del móvil con ella. Esta historia solo describe lo que la app móvil todavía no tiene.
- **Mostrar la contraseña.** La contraseña empieza oculta y un control junto al campo «Contraseña» alterna entre verla en claro y ocultarla. Mostrar u ocultar no cambia lo escrito ni envía el formulario.
- **Casilla de mantener la sesión.** El formulario tiene la casilla «Mantener la sesión en este equipo», marcada al abrir /login y también al volver a /login tras cerrar sesión. Qué cambia al desmarcarla está pendiente de decidir.
- **Aviso de sesión cerrada.** Tras «Cerrar sesión», la pantalla de acceso muestra el aviso de confirmación «Sesión cerrada correctamente.». El aviso desaparece cuando se vuelve a intentar entrar con un correo y una contraseña que pasan la validación del formulario, o al ir a otra pantalla de Acceso. Abrir la app o la pantalla de acceso sin haber cerrado sesión no lo muestra.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); después la app está sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo», y la cuenta de la fila inicia sesión en la propia fila con su contraseña de demostración (`Consul1234!`).

## Criterios de aceptación
```gherkin
Característica: Ayudas del acceso de la web en la app móvil

  Esquema del escenario: El control alterna la visibilidad de la contraseña
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login ha escrito Consul1234! en «Contraseña»
    Cuando pulsa el control de la contraseña <veces> veces
    Entonces en menos de 1 segundo la contraseña se ve <visibilidad>
    Y el campo sigue conteniendo Consul1234! y no se ha enviado nada

    Ejemplos:
      | veces | visibilidad |
      | 0 | oculta |
      | 1 | en claro |
      | 2 | oculta |

  Esquema del escenario: La casilla de mantener la sesión aparece marcada
    Dado que el tenant alumno01 está recién reiniciado y en la app <situacion>
    Cuando llega a /login
    Entonces en menos de 5 segundos ve la casilla «Mantener la sesión en este equipo» marcada

    Ejemplos:
      | situacion |
      | nadie ha iniciado sesión |
      | consultor@sigpro.test ha iniciado sesión en alumno01 y acaba de pulsar «Cerrar sesión» en la página «Perfil» |

  Esquema del escenario: El aviso de sesión cerrada solo acompaña al cierre de sesión
    Dado que el tenant alumno01 está recién reiniciado y en la app <situacion>
    Cuando <accion>
    Entonces <aviso>

    Ejemplos:
      | situacion | accion | aviso |
      | consultor@sigpro.test ha iniciado sesión en alumno01 y está en la página «Perfil» | pulsa «Cerrar sesión» | en menos de 5 segundos llega a /login y ve «Sesión cerrada correctamente.» |
      | consultor@sigpro.test acaba de pulsar «Cerrar sesión» | escribe el correo consultor@sigpro.test y la contraseña incorrecta y pulsa «Entrar» | ya no ve «Sesión cerrada correctamente.» y en menos de 5 segundos ve «Correo o contraseña incorrectos» |
      | consultor@sigpro.test acaba de pulsar «Cerrar sesión» | pulsa «¿Olvidaste la contraseña?» y vuelve con «Volver al inicio de sesión» | en menos de 5 segundos está de vuelta en /login y ya no ve «Sesión cerrada correctamente.» |
      | nadie ha iniciado sesión | abre la app | en menos de 5 segundos ve /login y no ve «Sesión cerrada correctamente.» |
```

## Decisiones pendientes
- El aspecto del control de la contraseña (botón con texto, como «Mostrar» / «Ocultar» en la web, o un icono), su nombre accesible y cómo indica que está pulsado.
- Si mostrar u ocultar la contraseña cierra el teclado o lo mantiene abierto.
- Qué cambia al desmarcar «Mantener la sesión en este equipo»: en la web la sesión solo vale entonces en la pestaña en la que se inició, y en el móvil no hay pestañas del navegador (por ejemplo, hasta cerrar la app, o un tiempo fijo).

## Fuera de alcance
- Que la sesión siga al cerrar la app y volver a abrirla, y el cierre de sesión desde el perfil: historia vigente de la sesión móvil en esta épica.
- Cuánto dura la sesión en cada caso y su renovación: épica de Sesión y renovación de token.
