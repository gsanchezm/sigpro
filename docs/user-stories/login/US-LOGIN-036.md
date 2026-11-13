---
id: US-LOGIN-036
tipo: historia
epica: EP-LOGIN
titulo: "[Android] El botón atrás tras cerrar sesión no vuelve a una pantalla privada"
etiquetas: [android]
relacionadas: [US-LOGIN-031]
verificacion: pendiente-nativo
---

## Historia
Como persona que acaba de cerrar sesión en un móvil Android, quiero que el botón atrás del sistema no me devuelva a las pantallas de mi sesión,
para que nadie que coja el móvil después vea mis datos.

## Reglas
- Tras «Cerrar sesión», el botón atrás de Android no muestra ninguna pantalla de la sesión cerrada (Perfil, Programas ni ninguna otra pantalla privada).
- Desde la pantalla de acceso a la que se llega al cerrar sesión, el botón atrás deja la app, como en cualquier pantalla inicial.
- Al volver a la app se ve la pantalla de acceso, sin sesión.

## Criterios de aceptación
```gherkin
Característica: Botón atrás de Android tras cerrar sesión

  Esquema del escenario: El botón atrás no recupera la sesión cerrada
    Dado que "<correo>" ha recorrido <recorrido> en la app Android
    Y pulsa "Cerrar sesión" en Perfil y llega a /login
    Cuando pulsa el botón atrás del sistema <veces>
    Entonces no ve ninguna pantalla privada
    Y al volver a la app ve el título "Iniciar sesión"

    Ejemplos:
      | correo | recorrido | veces |
      | consultor@sigpro.test | Programas y después Más y Perfil | una vez |
      | gestor@sigpro.test | Programas, el detalle de PRG-001, Más y Perfil | una vez |
      | gestor@sigpro.test | Programas, el detalle de PRG-001, Más y Perfil | tres veces seguidas |
```
