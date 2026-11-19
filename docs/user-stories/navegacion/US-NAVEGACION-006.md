---
id: US-NAVEGACION-006
tipo: historia
epica: EP-NAVEGACION
titulo: "[Web] Abrir y cerrar el menú de navegación en el diseño responsive"
etiquetas: [web]
relacionadas: [US-NAVEGACION-004, US-NAVEGACION-005, US-NAVEGACION-009]
verificacion: codigo
---

## Historia
Como persona que usa SIGPRO en un móvil o en una tableta, quiero abrir el menú con un botón de la cabecera y cerrarlo al elegir una sección,
para llegar a cualquier módulo sin que una barra fija ocupe la pantalla.

## Reglas
- En el diseño responsive, la cabecera muestra, de izquierda a derecha: el botón «Menú», el título de la sección actual (que es el último elemento de las migas de pan, por ejemplo «Programas» o «TC-001»), el icono «Búsqueda global» (salvo en Programas), el botón de tema y la campana.
- Al pulsar «Menú» se abre el cajón, a la izquierda de la pantalla. Tiene la marca de SIGPRO, un botón de cierre, la lista «Navegación principal» con las mismas entradas, orden y reglas por rol que la barra lateral, y al pie la sección de usuario (ver la regla siguiente).
- Al pie del cajón se ven el nombre y el rol de la sesión. Debajo, en este orden, las opciones «Perfil», «Atajos de teclado» y «Cerrar sesión». Las opciones hacen lo mismo que en el menú de usuario de escritorio.
- En el cajón, la entrada No conformidades muestra la misma insignia que en la barra lateral.
- El cajón se cierra con su botón de cierre, con la tecla Esc, con un clic en la zona oscura que queda fuera del cajón, o cuando la ruta cambia porque la persona ha elegido otra sección. Al cerrarlo con Esc, el foco vuelve al botón «Menú». Al abrirse, el foco entra en el cajón.
- El cajón existe solo mientras está abierto: cerrado, sus entradas no están en la página.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); después se inicia sesión en `/login?tenant=alumno01` con la cuenta de la fila y se abre la página indicada con una ventana de 390 px de ancho.

## Criterios de aceptación
```gherkin
Característica: Cajón de navegación en el diseño responsive

  Esquema del escenario: El cajón se abre con «Menú» y se cierra de cuatro maneras
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs con una ventana de 390 px
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | pulsa «Menú» | ve el cajón con «Navegación principal» y sus 7 entradas |
      | pulsa «Menú» y después el botón de cierre del cajón | el cajón se cierra y no queda ninguna entrada del menú en la página |
      | pulsa «Menú» y después la tecla Esc | el cajón se cierra y el foco vuelve a «Menú» |
      | pulsa «Menú» y después la zona oscura que queda fuera del cajón | el cajón se cierra |

  Esquema del escenario: Elegir una entrada lleva a su sección y cierra el cajón
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs con una ventana de 390 px y ha abierto el cajón
    Cuando elige <entrada>
    Entonces llega a <ruta>
    Y el cajón se cierra

    Ejemplos:
      | entrada | ruta |
      | «Verificación» | /verification |
      | «No conformidades» | /nc |

  Esquema del escenario: El pie del cajón muestra la sesión y sus tres opciones
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene sesión iniciada en la web con una ventana de 390 px
    Cuando abre el cajón
    Entonces ve al pie el nombre <nombre> y el rol <rol>
    Y ve las opciones «Perfil», «Atajos de teclado» y «Cerrar sesión», en ese orden

    Ejemplos:
      | cuenta | nombre | rol |
      | gestor@sigpro.test | Javier Ortega | Gestor de programas |
      | alumno01@sigpro.lab | Alumno 01 | Admin |
```

## Fuera de alcance
- La barra lateral del escritorio y su plegado: US-NAVEGACION-004 y US-NAVEGACION-005.
- El cuadro de búsqueda y el icono que la abre: US-NAVEGACION-007.
- La campana y su panel: US-NAVEGACION-008. El menú de usuario de escritorio y lo que hace cada opción: US-NAVEGACION-009.
- El contenido de cada sección a la que se llega desde el cajón.

## Decisiones pendientes
- Si elegir la entrada de la sección en la que ya se está cierra el cajón. Hoy el cajón solo se cierra cuando cambia la ruta, así que al elegir la sección actual se queda abierto.
- El nombre del botón de cierre del cajón. Hoy se llama «Contraer barra lateral», el mismo nombre que el botón de escritorio, que pliega la barra y no cierra ningún cajón. No está decidido si debe llamarse de otra forma.
- A qué elemento va el foco al abrir el cajón. Hoy va al botón de cierre; no está decidido si debe ir a la primera entrada.
