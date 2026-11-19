---
id: US-CAOS-RESET-015
tipo: historia
epica: EP-CAOS-RESET
titulo: "[Móvil] Pantalla de laboratorio /lab"
etiquetas: [movil, no-implementada]
relacionadas: [US-CAOS-RESET-008, US-CAOS-RESET-009, US-CAOS-RESET-010, US-CAOS-RESET-012]
verificacion: no-ejecutable
---

## Historia
Como alumno que prepara las prácticas desde el móvil, quiero abrir en la app la pantalla de laboratorio con las credenciales de demo, el reinicio de datos, el modo caos y los contraejemplos,
para tener las herramientas del curso a mano sin abrir la web en un ordenador.

## Reglas
- Hoy la app móvil no tiene la pantalla de laboratorio: no hay ninguna ruta que la muestre y su ayuda no enlaza a ella. El reinicio de datos y el modo caos del móvil están en Administración.
- La capacidad que falta es la pantalla de laboratorio. Lo que debe mostrar, si existe, es lo que muestra la web: bajo el título «Laboratorio», las secciones «Credenciales de demo», «Tenants», «Reiniciar datos del tenant», «Modo caos», «Contraejemplos» y «Preguntas frecuentes», con el mismo contenido y comportamiento que en la web.
- Lo que no se afirma aquí, porque nadie lo ha decidido, está en «Decisiones pendientes».

## Criterios de aceptación
```gherkin
Característica: Pantalla de laboratorio en la app móvil

  Esquema del escenario: La pantalla de laboratorio muestra las secciones de la web
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y <cuenta> ha iniciado sesión en la app móvil con el tenant alumno01
    Cuando abre la pantalla de laboratorio
    Entonces ve el título «Laboratorio» y las secciones «Credenciales de demo», «Tenants», «Reiniciar datos del tenant», «Modo caos», «Contraejemplos» y «Preguntas frecuentes»

    Ejemplos:
      | cuenta |
      | alumno01@sigpro.lab |
```

## Decisiones pendientes
- Si la pantalla existe en la app móvil. La decisión de paridad del móvil la deja fuera por ser propia del navegador o del curso, mientras esa misma decisión pide que lo que se puede hacer en la web se pueda hacer en el móvil.
- Cómo se llega a ella: una ruta propia, una entrada en «Más» o un enlace desde la ayuda. Hoy no hay ninguna de las tres.
- Si sus secciones de reinicio y de modo caos repiten las de Administración o las sustituyen.
- Qué secciones no tienen sentido en un teléfono (la descarga del proyecto de ejemplo y la tabla de las familias de componentes responsive) y cómo se mostrarían.

## Fuera de alcance
- El contenido de cada sección en la web: historias web de esta épica.
- El reinicio y el modo caos desde Administración en el móvil: historias móviles de esta épica.
