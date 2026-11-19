---
id: US-NC-GESTION-013
tipo: historia
epica: EP-NC-GESTION
titulo: "[Móvil] Dar formato a la descripción de una no conformidad"
etiquetas: [movil, no-implementada]
relacionadas: [US-NC-GESTION-010, US-NC-GESTION-011, US-NC-GESTION-007]
verificacion: no-ejecutable
---

## Historia
Como persona que describe una desviación desde el móvil, quiero marcar partes de la descripción en negrita, en cursiva o como lista, como en la web,
para que la descripción se lea con la misma estructura en los dos lados.

## Reglas
- Lo acordado es la paridad con la web: en el alta y en la edición de la descripción hay tres controles de formato, «Negrita», «Cursiva» y «Lista», que dan formato al texto seleccionado, y el formato se ve igual en el detalle de la web y en el de la app móvil.
- Hoy la app móvil edita la descripción como texto plano, un párrafo por línea, y avisa de que el formato se pierde al editar el texto (US-NC-GESTION-010 y US-NC-GESTION-011). La capacidad no existe en el móvil.
- Esta historia describe lo mínimo acordado y no se prueba contra la app.
- En los ejemplos, `(10 letras a)` es un texto de diez letras `a` seguidas, sin espacios.

## Criterios de aceptación
```gherkin
Característica: Formato de la descripción en la app móvil

  Esquema del escenario: Cada control da formato al texto seleccionado
    Dado que en el tenant alumno01, recién reiniciado, una persona con sesión en la app móvil ha escrito (10 letras a) en «Descripción» del alta de una no conformidad
    Cuando selecciona ese texto y pulsa <control>
    Entonces el texto se ve <formato> en el campo
    Y la descripción guardada conserva ese formato

    Ejemplos:
      | control | formato |
      | «Negrita» | en negrita |
      | «Cursiva» | en cursiva |
      | «Lista» | como elemento de una lista |
```

## Fuera de alcance
- El alta y la edición de la descripción con texto plano, que la app móvil sí tiene: US-NC-GESTION-010 y US-NC-GESTION-011.
- El mismo formato en la web: US-NC-GESTION-006 y US-NC-GESTION-007.

## Decisiones pendientes
- Dónde se colocan los tres controles en el móvil (sobre el campo, como en la web, o junto al campo) y cómo se usan con el teclado en pantalla.
- Si el formato se ofrece en el alta, en la edición o en las dos, como en la web.
- Cómo se muestra una lista dentro de un campo de texto de varias líneas.
- Qué pasa con el formato de una descripción que ya lo tiene cuando se edita solo su texto: si se conserva o se pierde.
