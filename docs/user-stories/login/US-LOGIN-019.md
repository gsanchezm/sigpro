---
id: US-LOGIN-019
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Mantener la sesión en este equipo"
etiquetas: [web]
relacionadas: [US-LOGIN-033]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona que usa SIGPRO en su propio equipo, quiero elegir si la sesión se mantiene fuera de la pestaña en la que entré,
para no volver a escribir la contraseña en mi equipo y no dejar la sesión abierta en uno compartido.

## Reglas
- La casilla «Mantener la sesión en este equipo» aparece marcada al abrir /login.
- Con la casilla marcada, la sesión se mantiene en todo el navegador: al recargar, en una pestaña nueva y tras cerrar y volver a abrir el navegador se entra sin volver a escribir la contraseña.
- Con la casilla desmarcada, la sesión solo vale en la pestaña en la que se inició: recargar la mantiene, pero una pestaña nueva pide iniciar sesión.
- Cerrar sesión la termina en los dos casos (US-LOGIN-020).

## Criterios de aceptación
```gherkin
Característica: Mantener la sesión en la web

  Esquema del escenario: La casilla decide dónde sigue valiendo la sesión
    Dado que "gestor@sigpro.test" inicia sesión con la casilla "Mantener la sesión en este equipo" <casilla>
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | casilla | accion | resultado |
      | marcada | recarga /programs | sigue en /programs con su sesión |
      | marcada | escribe la dirección de /programs en una pestaña nueva | entra en /programs sin iniciar sesión |
      | desmarcada | recarga /programs | sigue en /programs con su sesión |
      | desmarcada | escribe la dirección de /programs en una pestaña nueva | llega a /login y tiene que iniciar sesión |
      | desmarcada | abre /programs en la misma pestaña tras visitar otra página | sigue en /programs con su sesión |
```

## Fuera de alcance
- Cuánto dura la sesión en cada caso y su renovación (épica de Sesión y renovación de token).
