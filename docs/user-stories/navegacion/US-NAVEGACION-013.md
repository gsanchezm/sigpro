---
id: US-NAVEGACION-013
tipo: historia
epica: EP-NAVEGACION
titulo: "[Móvil] Abrir cada resultado de la búsqueda en su pantalla móvil"
etiquetas: [movil]
relacionadas: [US-NAVEGACION-011, US-NAVEGACION-012, US-NAVEGACION-007]
verificacion: codigo
cubre: ["/programs/:code", "/programs/:code/requirements", "/verification/:code", "/documents/:id"]
---

## Historia
Como persona que ha encontrado algo con la búsqueda del móvil, quiero tocar el resultado y abrir directamente su pantalla,
para seguir trabajando con ello sin volver a buscarlo.

## Reglas
- Tocar un resultado abre su pantalla dentro de la app móvil:
  - programa: la ficha del programa;
  - requisito: la pantalla de requisitos de su programa, con ese requisito abierto en su detalle;
  - caso de prueba: la ficha del caso de prueba;
  - documento: la ficha del documento;
  - no conformidad: el tablero de no conformidades, con el detalle de esa no conformidad abierto encima.
- Cada resultado abre la pantalla de la app móvil, no la de la web.
- Al volver a «Búsqueda global», el campo está vacío.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se inicia sesión en la app móvil con `gestor@sigpro.test` y `Gestor1234!`, con `alumno01` en «Tenant de trabajo», y se abre «Búsqueda global» desde «Más».

## Criterios de aceptación
```gherkin
Característica: Abrir un resultado de la búsqueda en la app móvil

  Esquema del escenario: Tocar un resultado abre su pantalla en la app móvil
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil y ha abierto «Búsqueda global» desde «Más»
    Cuando escribe <texto> en «Búsqueda global» y toca el resultado <codigo>
    Entonces ve <destino>

    Ejemplos:
      | texto | codigo | destino |
      | PRG-001 | PRG-001 | la ficha del programa PRG-001 |
      | subsistema | REQ-001 | la pantalla de requisitos de PRG-001 con el detalle de REQ-001 abierto |
      | verificar | TC-001 | la ficha del caso de prueba TC-001 |
      | PRG-001 | DOC-001 | la ficha del documento DOC-001 |
      | criterio | NC-001 | el tablero de no conformidades con el detalle de NC-001 abierto |

  Esquema del escenario: Al volver a la búsqueda el campo está vacío
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil, ha escrito <texto> en «Búsqueda global» y ha tocado el resultado <codigo>
    Cuando vuelve a la pestaña «Más» y toca «Búsqueda global»
    Entonces el campo «Búsqueda global» está vacío y ve el aviso «Escribe al menos 2 caracteres»

    Ejemplos:
      | texto | codigo |
      | PRG-001 | PRG-001 |
```

## Fuera de alcance
- La pantalla de búsqueda, su campo, sus grupos y sus avisos: US-NAVEGACION-012.
- Lo que muestra cada ficha a la que se llega (programa, requisitos, caso de prueba, documento o tablero de no conformidades): las épicas de cada módulo.
- La búsqueda de la web y el paso de un resultado a su página de escritorio: US-NAVEGACION-007.
