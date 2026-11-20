---
id: US-NAVEGACION-005
tipo: historia
epica: EP-NAVEGACION
titulo: "[Web] Diseño de escritorio desde 1024 px: barra lateral plegable y migas de pan"
etiquetas: [web]
relacionadas: [US-NAVEGACION-004, US-NAVEGACION-006]
verificacion: ejecutada
---

## Historia
Como persona que trabaja con SIGPRO en un ordenador, quiero una barra lateral que pueda plegar para ganar espacio y una cabecera que me diga dónde estoy,
para moverme por las secciones sin perder el contexto de la pantalla en la que trabajo.

## Reglas
- El diseño de escritorio se usa con una ventana de 1024 px de ancho o más. Con menos de 1024 px se usa el diseño responsive, que tiene su propio menú. No hay un tercer diseño intermedio.
- Al entrar, la barra lateral está desplegada: muestra el icono y el nombre de cada entrada.
- El botón «Contraer barra lateral», en el pie de la barra, y el botón «Menú» de la cabecera pliegan la barra y la despliegan: cada pulsación alterna entre los dos estados. Plegada, la barra muestra solo los iconos; cada entrada conserva su nombre y sigue siendo un enlace, y la insignia de No conformidades no se ve.
- Plegar o desplegar no cambia la sección ni la dirección de la página.
- La cabecera de escritorio muestra, de izquierda a derecha: el botón «Menú», las migas de pan, el cuadro «Búsqueda global», el selector de idioma, el botón de tema, la campana y el menú de usuario.
- Las migas de pan empiezan por «Inicio», que es un enlace a `/` y lleva a Programas. Siguen la sección con el nombre de su entrada de la barra lateral, como enlace a su lista, y terminan con el elemento en el que está la persona. El último elemento no es un enlace y es la página actual. Una sección tiene el nombre de su entrada aunque la persona no tenga esa entrada en su barra.

## Criterios de aceptación
```gherkin
Característica: Diseño de escritorio, plegado y migas de pan

  Esquema del escenario: El diseño de escritorio empieza en 1024 px de ancho
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada y está en /programs
    Cuando la ventana tiene <ancho> px de ancho
    Entonces ve <diseno>

    Ejemplos:
      | ancho | diseno |
      | 1023 | el diseño responsive, sin barra lateral fija y con el botón «Menú» en la cabecera |
      | 1024 | el diseño de escritorio, con la barra lateral fija y la cabecera con migas de pan |
      | 1440 | el diseño de escritorio, con la barra lateral fija y la cabecera con migas de pan |

  Esquema del escenario: Las migas de pan muestran la sección y el elemento en el que está la persona
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene sesión iniciada en la web de escritorio
    Cuando abre <ruta>
    Entonces las migas de pan son <migas>

    Ejemplos:
      | cuenta | ruta | migas |
      | gestor@sigpro.test | /programs | Inicio / Programas |
      | gestor@sigpro.test | /programs/PRG-001 | Inicio / Programas / PRG-001 |
      | gestor@sigpro.test | /programs/PRG-001/requirements | Inicio / Programas / PRG-001 / Requisitos |
      | gestor@sigpro.test | /programs/PRG-001/edit | Inicio / Programas / PRG-001 / Editar |
      | gestor@sigpro.test | /verification/TC-001 | Inicio / Verificación / TC-001 |
      | gestor@sigpro.test | /nc/NC-001 | Inicio / No conformidades / NC-001 |
      | gestor@sigpro.test | /profile | Inicio / Perfil |
      | consultor@sigpro.test | /admin | Inicio / Administración |

  Esquema del escenario: El control de plegado alterna la barra lateral entre desplegada y plegada
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs en la web de escritorio con la barra desplegada
    Cuando pulsa <control>
    Entonces la barra lateral se pliega y solo muestra los iconos
    Y pulsa <control> otra vez
    Entonces la barra lateral se despliega y muestra el nombre de cada entrada

    Ejemplos:
      | control |
      | «Contraer barra lateral» |
      | «Menú» |
```

## Fuera de alcance
- El cajón de navegación del diseño responsive: US-NAVEGACION-006.
- La búsqueda de la cabecera, la campana y el menú de usuario, que se describen en sus propias historias de la web.
- Los selectores de idioma y de tema de la cabecera: épicas transversales de idioma y de tema.

## Decisiones pendientes
- Si el plegado de la barra se recuerda al recargar la página. Hoy, al recargar, la barra vuelve a estar desplegada.
