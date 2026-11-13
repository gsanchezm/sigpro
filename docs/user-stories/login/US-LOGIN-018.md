---
id: US-LOGIN-018
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Mostrar y ocultar la contraseña"
etiquetas: [web]
relacionadas: [US-LOGIN-032]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona que escribe su contraseña, quiero poder verla en claro un momento y volver a ocultarla,
para comprobar que la he escrito bien antes de enviarla.

## Reglas
- La contraseña empieza oculta.
- Dentro del campo «Contraseña» hay un botón con el texto visible «Mostrar» y el nombre accesible «Mostrar contraseña».
- Al pulsarlo la contraseña se ve en claro, el botón pasa a «Ocultar» (nombre accesible «Ocultar contraseña») y queda marcado como pulsado.
- Al pulsarlo otra vez la contraseña vuelve a ocultarse y el botón vuelve a «Mostrar».
- Mostrar u ocultar no cambia lo escrito ni envía el formulario.

## Criterios de aceptación
```gherkin
Característica: Mostrar y ocultar la contraseña en la web

  Esquema del escenario: El botón alterna la visibilidad de la contraseña
    Dado una persona en /login que ha escrito "Gestor1234!" en el campo "Contraseña"
    Cuando pulsa el botón de la contraseña <veces> veces
    Entonces la contraseña se ve <visibilidad>
    Y el botón muestra "<texto>" y se llama "<nombre>"
    Y el botón <pulsado>
    Y el campo sigue conteniendo "Gestor1234!"

    Ejemplos:
      | veces | visibilidad | texto | nombre | pulsado |
      | 0 | oculta | Mostrar | Mostrar contraseña | no está marcado como pulsado |
      | 1 | en claro | Ocultar | Ocultar contraseña | está marcado como pulsado |
      | 2 | oculta | Mostrar | Mostrar contraseña | no está marcado como pulsado |
      | 3 | en claro | Ocultar | Ocultar contraseña | está marcado como pulsado |
```
