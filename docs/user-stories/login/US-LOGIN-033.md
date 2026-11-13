---
id: US-LOGIN-033
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Mantener la sesión en este equipo"
etiquetas: [movil, no-implementada]
relacionadas: [US-LOGIN-019]
verificacion: no-ejecutable
---

## Historia
Como persona que a veces usa un móvil compartido, quiero elegir al entrar si la app recuerda mi sesión,
para no escribir la contraseña cada vez en mi móvil y no dejarla abierta en uno ajeno.

## Reglas
- El formulario de acceso tiene la casilla «Mantener la sesión en este equipo», marcada al abrir /login.
- Con la casilla marcada, la sesión sigue al cerrar la app y volver a abrirla.
- Con la casilla desmarcada, la sesión dura mientras la app está abierta: al cerrarla y volver a abrirla se pide iniciar sesión.
- Cerrar sesión la termina en los dos casos.

## Criterios de aceptación
```gherkin
Característica: Mantener la sesión en la app móvil

  Esquema del escenario: La casilla decide si la sesión sobrevive al cierre de la app
    Dado que gestor@sigpro.test inicia sesión con la casilla «Mantener la sesión en este equipo» <casilla>
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | casilla | accion | resultado |
      | marcada | pasa a la pestaña de no conformidades | sigue con su sesión |
      | marcada | cierra la app y la vuelve a abrir | entra en /programs sin iniciar sesión |
      | desmarcada | pasa a la pestaña de no conformidades | sigue con su sesión |
      | desmarcada | cierra la app y la vuelve a abrir | llega a /login y tiene que iniciar sesión |
```

## Fuera de alcance
- Cuánto dura la sesión en cada caso y su renovación (épica de Sesión y renovación de token).
