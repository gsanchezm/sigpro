---
id: US-TEMA-006
tipo: historia
epica: EP-TEMA
titulo: "[Transversal] Textos con contraste de al menos 4,5:1 sobre su fondo en los dos temas"
etiquetas: [transversal]
relacionadas: [US-TEMA-001, US-TEMA-004]
verificacion: codigo
---

## Historia
Como persona que lee SIGPRO durante horas, en el tema claro o en el oscuro, quiero que los textos y los botones principales se distingan bien de su fondo,
para leer cifras, códigos y avisos sin forzar la vista.

## Reglas
- En los dos temas, el texto principal, el texto secundario, las etiquetas y ayudas, el texto de los botones principales y el de los botones de peligro tienen un contraste de al menos 4,5:1 con el fondo donde aparecen. Es el criterio WCAG AA para texto normal.
- Los colores son los del tema y son los mismos en la web y en la app móvil.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Cada fila empieza en un navegador o dispositivo nuevo, sin preferencia de tema guardada y con el tema del sistema en claro; la fila indica si el tema es el claro o el oscuro. En la web el tenant se indica con `/login?tenant=alumno01`; en la app móvil, escribiendo `alumno01` en «Tenant de trabajo».

## Criterios de aceptación
```gherkin
Característica: Contraste mínimo de los textos en los dos temas

  Esquema del escenario: Con el tema claro cada texto tiene un contraste de al menos 4,5:1 sobre su fondo
    Dado que en el tenant alumno01, recién reiniciado, con el tema del sistema en claro, gestor@sigpro.test ha iniciado sesión con Gestor1234! desde la pantalla de acceso de un navegador o dispositivo nuevo y está en /programs con el tema claro
    Cuando aparece <texto> sobre <fondo>
    Entonces su color es <color_texto> y su contraste con ese fondo es de al menos 4,5:1

    Ejemplos:
      | texto | color_texto | fondo |
      | el texto principal de la página | #1d1424 | #faf8fb |
      | el texto principal de tarjetas y paneles | #1d1424 | #ffffff |
      | el texto principal de cabeceras y campos de búsqueda | #1d1424 | #f4f0f6 |
      | el texto principal de una fila seleccionada | #1d1424 | #f3e3f0 |
      | el texto secundario de la página | #5b4f66 | #faf8fb |
      | el texto secundario de tarjetas y paneles | #5b4f66 | #ffffff |
      | el texto secundario de cabeceras y campos de búsqueda | #5b4f66 | #f4f0f6 |
      | el texto secundario de una fila seleccionada | #5b4f66 | #f3e3f0 |
      | la etiqueta o ayuda de tarjetas y paneles | #6f627a | #ffffff |
      | la etiqueta o ayuda de cabeceras y campos de búsqueda | #6f627a | #f4f0f6 |
      | el texto del botón principal | #ffffff | #7a2e6e |
      | el texto del botón principal con el cursor encima | #ffffff | #632259 |

  Esquema del escenario: Con el tema oscuro cada texto tiene un contraste de al menos 4,5:1 sobre su fondo
    Dado que en el tenant alumno01, recién reiniciado, con el tema del sistema en claro, una persona sin sesión iniciada ha pulsado «Cambiar tema» una vez en la pantalla de acceso de un navegador o dispositivo nuevo, ha iniciado sesión con gestor@sigpro.test y Gestor1234! y está en /programs con el tema oscuro
    Cuando aparece <texto> sobre <fondo>
    Entonces su color es <color_texto> y su contraste con ese fondo es de al menos 4,5:1

    Ejemplos:
      | texto | color_texto | fondo |
      | el texto principal de la página | #f0eaf3 | #141017 |
      | el texto principal de tarjetas y paneles | #f0eaf3 | #1c1721 |
      | el texto principal de cabeceras y campos de búsqueda | #f0eaf3 | #261f2c |
      | el texto principal de una fila seleccionada | #f0eaf3 | #3a2137 |
      | el texto secundario de la página | #b3a7bd | #141017 |
      | el texto secundario de tarjetas y paneles | #b3a7bd | #1c1721 |
      | el texto secundario de cabeceras y campos de búsqueda | #b3a7bd | #261f2c |
      | el texto secundario de una fila seleccionada | #b3a7bd | #3a2137 |
      | la etiqueta o ayuda de tarjetas y paneles | #968c9f | #1c1721 |
      | la etiqueta o ayuda de cabeceras y campos de búsqueda | #968c9f | #261f2c |
      | el texto del botón principal | #1d1424 | #d68ac9 |
      | el texto del botón principal con el cursor encima | #1d1424 | #e3a5d8 |

  Esquema del escenario: Con el tema claro el texto del botón de peligro tiene un contraste de al menos 4,5:1 sobre su fondo
    Dado que en el tenant alumno01, recién reiniciado, con el tema del sistema en claro, alumno01@sigpro.lab ha iniciado sesión con Alumno1234! desde la pantalla de acceso de un navegador o dispositivo nuevo, está en /programs con el tema claro y ha abierto el diálogo de eliminación de PRG-001 desde el menú de acciones de su fila
    Cuando aparece <texto> sobre <fondo>
    Entonces su color es <color_texto> y su contraste con ese fondo es de al menos 4,5:1

    Ejemplos:
      | texto | color_texto | fondo |
      | el texto del botón de peligro | #ffffff | #b93232 |

  Esquema del escenario: Con el tema oscuro el texto del botón de peligro tiene un contraste de al menos 4,5:1 sobre su fondo
    Dado que en el tenant alumno01, recién reiniciado, con el tema del sistema en claro, una persona sin sesión iniciada ha pulsado «Cambiar tema» una vez en la pantalla de acceso de un navegador o dispositivo nuevo, ha iniciado sesión con alumno01@sigpro.lab y Alumno1234!, está en /programs con el tema oscuro y ha abierto el diálogo de eliminación de PRG-001 desde el menú de acciones de su fila
    Cuando aparece <texto> sobre <fondo>
    Entonces su color es <color_texto> y su contraste con ese fondo es de al menos 4,5:1

    Ejemplos:
      | texto | color_texto | fondo |
      | el texto del botón de peligro | #1d1424 | #f0716b |
```

## Fuera de alcance
- Los colores de los avisos de error y de las insignias de estado sobre sus fondos suaves: cada épica del módulo que los muestra.
