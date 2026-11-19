---
id: US-NAVEGACION-015
tipo: historia
epica: EP-NAVEGACION
titulo: "[Móvil] Ver la campana de avisos con su contador y su panel"
etiquetas: [movil, no-implementada]
relacionadas: [US-NAVEGACION-008, US-NAVEGACION-016]
verificacion: no-ejecutable
---

## Historia
Como persona que usa SIGPRO en el móvil, quiero ver en la app cuántos avisos nuevos han llegado mientras la tengo abierta y leerlos, como en la web,
para no perderme los problemas de mis programas cuando trabajo desde el móvil.

## Reglas
- Lo que la app tiene hoy: la preferencia «Notificaciones en tiempo real» del Perfil, que se guarda, y ninguna campana de avisos. La preferencia no cambia nada más en la app.
- Lo mínimo acordado, por paridad con la web: una campana en la cabecera de las pantallas autenticadas que muestra el número de avisos sin leer. Cuenta los avisos de gravedad aviso o peligro que llegan después de iniciar la sesión en la app, sin contar los que ya existían antes. Con diez o más muestra «9+». Sin avisos sin leer no muestra ningún número.
- Lo mínimo acordado, también por paridad: un panel que se abre al pulsar la campana, con la lista de avisos, el más reciente primero, y el botón «Marcar leídas», que deja el número a cero.

## Criterios de aceptación
```gherkin
Característica: Campana de avisos en la app móvil

  Esquema del escenario: La app muestra la campana con el número de avisos sin leer
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil y alumno01@sigpro.lab ha provocado <pulsaciones> eventos de misión con POST /api/mission/tick
    Cuando mira la campana de avisos de la app
    Entonces ve <resultado>

    Ejemplos:
      | pulsaciones | resultado |
      | 4 | la campana sin ningún número, con el texto «Notificaciones» |
      | 5 | la campana con el número 1, con el texto «Notificaciones, 1 sin leer» |
```

## Fuera de alcance
- La campana de la web, su panel y sus reglas: US-NAVEGACION-008.
- La preferencia «Notificaciones en tiempo real» del Perfil y la página Perfil: EP-PERFIL.
- El feed del panel de misión en la app móvil: EP-MISION-FEED.

## Decisiones pendientes
- Dónde va la campana en la app: en la cabecera de cada pantalla, o dentro de una pestaña.
- Si la preferencia «Notificaciones en tiempo real» del Perfil de la app debe encender y apagar la campana. Hoy no tiene ningún efecto en la app.
- Si el panel de avisos de la app debe permitir «Marcar leídas» y cerrarse con la misma regla que el de la web.
