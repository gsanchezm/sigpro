---
id: US-SESION-009
tipo: historia
epica: EP-SESION
titulo: "[Móvil] Renovar la sesión sin cambiar de pantalla cuando caduca el acceso"
etiquetas: [movil]
relacionadas: [US-SESION-001, US-SESION-004, US-SESION-006, US-SESION-010, US-LOGIN-013]
verificacion: codigo
cubre: ["/programs", "/nc"]
---

## Historia
Como persona que usa SIGPRO en el móvil, quiero que la app renueve mi sesión sola cuando caduca el acceso,
para seguir trabajando en la misma pantalla sin volver a escribir mi contraseña.

## Reglas
- Cuando una petición de la pantalla recibe 401 `invalid_token`, la app pide una renovación con el refreshToken guardado en el dispositivo y repite la misma petición una sola vez. Si la repetición responde bien, la pantalla muestra los datos sin cambiar de pantalla.
- La app no ofrece la casilla «Mantener la sesión en este equipo»: su sesión guardada es siempre la de 7 días, contados desde cada renovación (`remember` verdadero).
- Las peticiones de la pantalla caducan a los 900 segundos desde la emisión del accessToken. La prueba no espera ese tiempo: responde 401 `invalid_token` a una petición, y eso es el dato de entrada de la fila.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login`, sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo». La cuenta de la fila inicia sesión en la propia fila con su contraseña de demostración. Después de iniciar sesión, la prueba responde 401 `invalid_token` a la primera petición de la lista de no conformidades que haga la app.

## Criterios de aceptación
```gherkin
Característica: Renovación de la sesión en la app móvil

  Esquema del escenario: La app sigue en la pantalla cuando el acceso caduca
    Dado que el tenant alumno01 está recién reiniciado y <correo> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y está en /programs
    Y la prueba responde 401 invalid_token a la primera petición de la lista de no conformidades que haga la app
    Cuando pulsa la pestaña «No conformidades»
    Entonces llega a /nc y ve la no conformidad NC-001 en la pantalla
    Y no llega a /login
    Y pulsa la pestaña «Programas» y ve /programs sin volver a iniciar sesión

    Ejemplos:
      | correo |
      | gestor@sigpro.test |
      | consultor@sigpro.test |
```

## Fuera de alcance
- Lo que pasa cuando la renovación falla: US-SESION-010 de esta épica.
- Los plazos de cada token: US-SESION-004 de esta épica.
- El cierre de sesión desde el perfil: EP-LOGIN (US-LOGIN-013).
- El feed en tiempo real del Panel de misión: su propia épica.
