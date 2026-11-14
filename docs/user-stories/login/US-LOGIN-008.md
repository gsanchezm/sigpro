---
id: US-LOGIN-008
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Mantener la sesión en el navegador y cerrarla con el aviso de sesión cerrada"
etiquetas: [web]
relacionadas: [US-LOGIN-004, US-LOGIN-013, US-LOGIN-014]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona que usa SIGPRO en el navegador, quiero elegir al entrar si mi sesión se mantiene fuera de la pestaña y poder cerrarla desde cualquier pantalla con una confirmación,
para no volver a escribir la contraseña en mi equipo, no dejar la sesión abierta en uno compartido y estar segura de que la he cerrado.

## Reglas
- La casilla «Mantener la sesión en este equipo» aparece marcada al abrir /login.
- Con la casilla marcada, la sesión se mantiene en todo el navegador: al recargar y en una pestaña nueva se entra sin volver a escribir la contraseña.
- Con la casilla desmarcada, la sesión solo vale en la pestaña en la que se inició: recargar o navegar en esa pestaña la mantiene, pero una pestaña nueva pide iniciar sesión.
- «Cerrar sesión» está en el «Menú de usuario» de la cabecera (escritorio), en el menú de navegación (diseño responsive) y en la página «Perfil».
- Al cerrar sesión se llega a /login y se ve el aviso de confirmación «Sesión cerrada correctamente.».
- Cerrar sesión hace que **esta pestaña** ya no tenga la sesión y, **si no queda otra pestaña del mismo navegador con esa cuenta abierta**, tampoco la tengan las que se abran después, con la casilla marcada o no: en ellas ninguna pantalla privada se abre sin volver a iniciar sesión. El servidor no revoca los tokens que ya se emitieron (decisión de diseño del laboratorio: los tokens son sin estado y no hay registro de sesiones en el servidor); lo que garantiza el cierre es que el navegador los descarta.
- El aviso «Sesión cerrada correctamente.» desaparece cuando se vuelve a intentar entrar con un correo y una contraseña que pasan la validación del formulario, o al ir a otra pantalla de Acceso. Abrir /login sin haber cerrado sesión no lo muestra.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), se abre `/login?tenant=alumno01` en una sola pestaña de un navegador sin ninguna sesión de SIGPRO guardada y, después, la cuenta de la fila inicia sesión en la propia fila con su contraseña de demostración (`Gestor1234!`, `Consul1234!`, `Audit1234!`) y la casilla como diga la fila (marcada si no lo dice).

## Criterios de aceptación
```gherkin
Característica: Mantener y cerrar la sesión en la web

  Esquema del escenario: La casilla decide dónde sigue valiendo la sesión
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 con la casilla «Mantener la sesión en este equipo» <casilla> y está en /programs
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | casilla | accion | resultado |
      | marcada | recarga /programs | en menos de 5 segundos ve /programs sin volver a iniciar sesión |
      | marcada | escribe la dirección de /programs en una pestaña nueva del mismo navegador | en menos de 5 segundos ve /programs sin iniciar sesión |
      | desmarcada | recarga /programs | en menos de 5 segundos ve /programs sin volver a iniciar sesión |
      | desmarcada | escribe la dirección de /programs en una pestaña nueva del mismo navegador | en menos de 5 segundos llega a /login y tiene que iniciar sesión |
      | desmarcada | abre /profile en la misma pestaña y después vuelve a /programs | en menos de 5 segundos ve /programs sin volver a iniciar sesión |

  Esquema del escenario: Cerrar sesión desde cada punto lleva al acceso con el aviso
    Dado que el tenant alumno01 está recién reiniciado y <correo> ha iniciado sesión en /login?tenant=alumno01 con la casilla marcada y está en <pantalla> con una ventana de <ancho>
    Cuando pulsa «Cerrar sesión» en <lugar>
    Entonces en menos de 5 segundos llega a /login
    Y en menos de 5 segundos ve el aviso «Sesión cerrada correctamente.»
    Y al abrir /programs en esa pestaña o en una nueva, en menos de 5 segundos llega a /login

    Ejemplos:
      | correo | pantalla | ancho | lugar |
      | gestor@sigpro.test | /programs | 1440 px | el «Menú de usuario» de la cabecera |
      | auditor@sigpro.test | /programs | 390 px | el menú de navegación |
      | consultor@sigpro.test | /profile | 1440 px | la página «Perfil» |

  Esquema del escenario: El aviso de sesión cerrada solo acompaña al cierre de sesión
    Dado que el tenant alumno01 está recién reiniciado y en este navegador <situacion>
    Cuando <accion>
    Entonces <aviso>

    Ejemplos:
      | situacion | accion | aviso |
      | gestor@sigpro.test ha iniciado sesión en alumno01 y acaba de pulsar «Cerrar sesión» | mira /login | en menos de 5 segundos ve «Sesión cerrada correctamente.» |
      | gestor@sigpro.test ha iniciado sesión en alumno01 y acaba de pulsar «Cerrar sesión» | escribe el correo gestor@sigpro.test y la contraseña incorrecta y pulsa «Entrar» | ya no ve «Sesión cerrada correctamente.» y en menos de 5 segundos ve «Correo o contraseña incorrectos» |
      | gestor@sigpro.test ha iniciado sesión en alumno01 y acaba de pulsar «Cerrar sesión» | pulsa «¿Olvidaste la contraseña?» y vuelve con «Volver al inicio de sesión» | en menos de 5 segundos está de vuelta en /login y ya no ve «Sesión cerrada correctamente.» |
      | nadie ha iniciado sesión | abre /login?tenant=alumno01 | en menos de 5 segundos ve el formulario «Iniciar sesión» y no ve «Sesión cerrada correctamente.» |
```

## Fuera de alcance
- Cuánto dura la sesión en cada caso y su renovación: épica de Sesión y renovación de token.
- Lo que el servidor hace con los tokens al cerrar sesión: historia de cierre de sesión de la API de esta épica.
- Lo que ocurre, al cerrar sesión, en otras pestañas del mismo navegador que ya estaban abiertas con esa cuenta conectada, y en las que se abran después mientras alguna de ellas siga abierta.
