---
id: US-LOGIN-032
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Mostrar y ocultar la contraseña"
etiquetas: [movil, no-implementada]
relacionadas: [US-LOGIN-018]
verificacion: no-ejecutable
---

## Historia
Como persona que escribe su contraseña en el teclado del móvil, quiero poder verla en claro un momento y volver a ocultarla,
para comprobar que la he escrito bien antes de enviarla, como en la web.

## Reglas
- La contraseña empieza oculta.
- Junto al campo «Contraseña» hay un botón con el texto visible «Mostrar» y el nombre accesible «Mostrar contraseña».
- Al pulsarlo la contraseña se ve en claro, el botón pasa a «Ocultar» (nombre accesible «Ocultar contraseña») y queda marcado como pulsado.
- Al pulsarlo otra vez la contraseña vuelve a ocultarse.
- Mostrar u ocultar no cambia lo escrito, no envía el formulario y no cierra el teclado.

## Criterios de aceptación
```gherkin
Característica: Mostrar y ocultar la contraseña en la app móvil

  Esquema del escenario: El botón alterna la visibilidad de la contraseña
    Dado una persona en /login que ha escrito "Consul1234!" en el campo "Contraseña"
    Cuando pulsa el botón de la contraseña <veces> veces
    Entonces la contraseña se ve <visibilidad>
    Y el botón muestra "<texto>" y se llama "<nombre>"
    Y el campo sigue conteniendo "Consul1234!"

    Ejemplos:
      | veces | visibilidad | texto | nombre |
      | 0 | oculta | Mostrar | Mostrar contraseña |
      | 1 | en claro | Ocultar | Ocultar contraseña |
      | 2 | oculta | Mostrar | Mostrar contraseña |
```
