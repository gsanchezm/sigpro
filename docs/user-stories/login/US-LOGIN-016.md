---
id: US-LOGIN-016
tipo: historia
epica: EP-LOGIN
titulo: "[Android] El botón atrás tras cerrar sesión no vuelve a una pantalla privada"
etiquetas: [android]
relacionadas: [US-LOGIN-013]
verificacion: pendiente-nativo
---

## Historia
Como persona que acaba de cerrar sesión en un móvil Android, quiero que el botón atrás del sistema no me devuelva a las pantallas de mi sesión,
para que nadie que coja el móvil después vea mis datos.

## Reglas
- Tras «Cerrar sesión», el botón atrás de Android no muestra ninguna pantalla de la sesión cerrada («Perfil», «Programas» ni ninguna otra pantalla privada).
- Desde la pantalla de acceso a la que se llega al cerrar sesión, el botón atrás deja la app, como en cualquier pantalla inicial.
- Al volver a la app se ve la pantalla de acceso, sin sesión iniciada.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); después la app Android está instalada y sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y la cuenta de la fila inicia sesión en la propia fila con su contraseña de demostración (`Gestor1234!`, `Consul1234!`) y recorre las pantallas de la fila.

## Criterios de aceptación
```gherkin
Característica: Botón atrás de Android tras cerrar sesión

  Esquema del escenario: El botón atrás no recupera la sesión cerrada
    Dado que el tenant alumno01 está recién reiniciado y <correo> ha iniciado sesión en la app Android con alumno01 en «Tenant de trabajo» y ha recorrido <recorrido>
    Y pulsa «Cerrar sesión» en la página «Perfil» y en menos de 5 segundos llega a /login
    Cuando pulsa el botón atrás del sistema <veces>
    Entonces durante los 5 segundos siguientes no ve ninguna pantalla privada
    Y al volver a abrir la app, en menos de 5 segundos ve el título «Iniciar sesión»

    Ejemplos:
      | correo | recorrido | veces |
      | consultor@sigpro.test | «Programas» y después «Más» y «Perfil» | una vez |
      | gestor@sigpro.test | «Programas», el detalle de PRG-001, «Más» y «Perfil» | una vez |
      | gestor@sigpro.test | «Programas», el detalle de PRG-001, «Más» y «Perfil» | tres veces seguidas |
```

## Fuera de alcance
- El cierre de sesión común a iOS y Android: historia móvil de cierre de sesión de esta épica.
