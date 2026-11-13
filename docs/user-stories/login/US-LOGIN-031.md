---
id: US-LOGIN-031
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Cerrar sesión desde el perfil"
etiquetas: [movil]
relacionadas: [US-LOGIN-009, US-LOGIN-020, US-LOGIN-034, US-LOGIN-036]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona con la sesión iniciada en la app móvil, quiero cerrar sesión desde mi perfil,
para dejar el móvil sin mi sesión abierta.

## Reglas
- «Cerrar sesión» está en la página Perfil, a la que se llega desde la pestaña «Más».
- Al cerrar sesión se llega a /login y la sesión guardada en el dispositivo se borra.
- Tras cerrar sesión, ninguna pantalla privada se abre sin volver a iniciar sesión, tampoco al cerrar la app y volver a abrirla.

## Criterios de aceptación
```gherkin
Característica: Cierre de sesión en la app móvil

  Esquema del escenario: Cerrar sesión borra la sesión del dispositivo
    Dado que <correo> tiene la sesión iniciada en la app
    Y está en la página Perfil
    Cuando pulsa «Cerrar sesión»
    Entonces llega a /login
    Y <despues>

    Ejemplos:
      | correo | despues |
      | consultor@sigpro.test | al abrir /programs vuelve a /login |
      | gestor@sigpro.test | al cerrar la app y volver a abrirla ve /login |
      | admin@sigpro.test | al abrir /nc vuelve a /login |
```

## Fuera de alcance
- El aviso «Sesión cerrada correctamente.» tras cerrar sesión (US-LOGIN-034).
