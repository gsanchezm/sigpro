---
id: US-NAVEGACION-016
tipo: historia
epica: EP-NAVEGACION
titulo: "[Móvil] Llegar a los requisitos de un programa desde la navegación principal"
etiquetas: [movil, no-implementada]
relacionadas: [US-NAVEGACION-004, US-NAVEGACION-011, US-NAVEGACION-015]
verificacion: no-ejecutable
---

## Historia
Como persona que trabaja con requisitos desde el móvil, quiero llegar a los requisitos de un programa desde la navegación principal, como desde la barra lateral de la web,
para no tener que pasar antes por la ficha de un programa.

## Reglas
- Lo que la app tiene hoy: la pantalla de requisitos de un programa, a la que se llega con el botón «Ver requisitos» desde la ficha de ese programa. La navegación principal de la app (las pestañas inferiores y «Más») no tiene ninguna entrada de requisitos.
- Lo mínimo acordado, por paridad con la barra lateral de la web: una entrada «Requisitos» en la navegación principal de la app, con su nombre, que lleva a la pantalla de requisitos de un programa y que queda marcada como activa mientras la persona está en esa pantalla.

## Criterios de aceptación
```gherkin
Característica: Entrada de Requisitos en la navegación de la app móvil

  Esquema del escenario: La entrada Requisitos lleva a la pantalla de requisitos de un programa
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene sesión iniciada en la app móvil
    Cuando toca la entrada «Requisitos» de la navegación principal
    Entonces <resultado>

    Ejemplos:
      | cuenta | resultado |
      | gestor@sigpro.test | llega a la pantalla de requisitos de un programa y la entrada «Requisitos» queda marcada como activa |
      | consultor@sigpro.test | llega a la pantalla de requisitos de un programa y la entrada «Requisitos» queda marcada como activa |
```

## Fuera de alcance
- La pantalla de requisitos en sí: EP-REQ-ARBOL, EP-REQ-EDICION y EP-REQ-FLUJO.
- La entrada Requisitos de la barra lateral de la web: US-NAVEGACION-004.

## Decisiones pendientes
- En qué lugar de la navegación principal va la entrada: en la barra inferior, sustituyendo a una pestaña, o dentro de «Más».
- A qué programa lleva. Hoy la web lleva siempre a los requisitos de PRG-001; no está decidido si la app debe llevar a la lista de programas, al último programa visitado u otra pantalla.
- Qué roles la ven. Hoy la web la muestra a todos los roles.
