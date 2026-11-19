---
id: US-SESION-006
tipo: historia
epica: EP-SESION
titulo: "[Web] Renovar la sesión sin cambiar de pantalla cuando caduca el acceso"
etiquetas: [web]
relacionadas: [US-SESION-001, US-SESION-004, US-SESION-007, US-SESION-009, US-LOGIN-007, US-LOGIN-008]
verificacion: codigo
cubre: ["/programs", "/nc"]
---

## Historia
Como persona que trabaja en SIGPRO desde el navegador, quiero que la sesión se renueve sola cuando caduca el acceso,
para seguir trabajando en la pantalla que tengo abierta sin volver a escribir mi contraseña.

## Reglas
- Cuando una petición de la pantalla recibe 401 `invalid_token`, la web pide una renovación con el refreshToken que guarda y repite la misma petición una sola vez. Si la repetición responde bien, la pantalla muestra los datos como si nada hubiera pasado.
- La renovación no pide la contraseña ni cambia de dirección: la persona sigue en la misma pantalla.
- La renovación conserva la casilla «Mantener la sesión en este equipo» con la que se inició la sesión. Si estaba desmarcada, la sesión renovada sigue valiendo solo en esta pestaña, como al iniciar sesión.
- Las peticiones de la pantalla caducan a los 900 segundos desde la emisión del accessToken. La prueba no espera ese tiempo: responde 401 `invalid_token` a una petición, y eso es el dato de entrada de la fila.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, y `gestor@sigpro.test` inicia sesión con `Gestor1234!` en la propia fila, con la casilla «Mantener la sesión en este equipo» que diga la fila (marcada si la fila no dice nada). Después de iniciar sesión, la prueba responde 401 `invalid_token` a la primera petición de la lista de no conformidades que haga la web.

## Criterios de aceptación
```gherkin
Característica: Renovación de la sesión en la web

  Esquema del escenario: La pantalla sigue abierta cuando el acceso caduca
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 con la casilla «Mantener la sesión en este equipo» <casilla> y está en /programs
    Y la prueba responde 401 invalid_token a la primera petición de la lista de no conformidades que haga la web
    Cuando pulsa «No conformidades» en el menú de navegación
    Entonces llega a /nc y ve la no conformidad NC-001 en la pantalla
    Y no llega a /login
    Y en la misma pestaña pulsa «Programas» en el menú de navegación y ve /programs sin volver a iniciar sesión

    Ejemplos:
      | casilla |
      | marcada |
      | desmarcada |
```

## Fuera de alcance
- Lo que pasa cuando la renovación falla: US-SESION-007 de esta épica.
- Los plazos de cada token: US-SESION-004 de esta épica.
- El aviso de sesión caducada en el acceso: US-SESION-008 de esta épica.
- Cerrar sesión y el aviso de sesión cerrada: EP-LOGIN (US-LOGIN-008).
