---
id: US-MISION-KPI-007
tipo: historia
epica: EP-MISION-KPI
titulo: "[Web] Panel de misión: gráficas de hitos y de NC con vista de tabla"
etiquetas: [web]
relacionadas: [US-MISION-KPI-002, US-MISION-KPI-008, US-MISION-KPI-011, US-MISION-FEED-007]
verificacion: codigo
cubre: ["/mission"]
---

## Historia
Como persona que revisa el panel de misión en la web, quiero ver el avance de los hitos de cada programa activo y las no conformidades abiertas por severidad en dos gráficas, y poder cambiar cada una a una tabla con los mismos números,
para comparar programas y severidades sin tener que leer cada barra.

## Reglas
- La gráfica «Hitos cumplidos por programa» tiene una barra por programa: los primeros programas activos que tienen hitos, como mucho ocho, en orden de código. Cada barra muestra la parte cumplida en color de acento y la pendiente en gris, y a su derecha el texto «D/T», con D los hitos cumplidos y T el total.
- La anchura de cada barra es proporcional a su total de hitos respecto al programa con más hitos de la gráfica. Con los datos de demostración, PRG-009 (10 hitos) ocupa todo el ancho disponible y PRG-001 (9 hitos) el 90 %.
- Al pasar el puntero sobre una barra, o al llegar a ella con el teclado, aparece un texto con el código del programa y sus cifras, con esta forma: «PRG-001: 1 de 9 hitos cumplidos».
- La gráfica de hitos tiene una leyenda con «Cumplidos» y «Pendientes».
- La gráfica «NC abiertas por severidad» tiene tres columnas, «Menor», «Mayor» y «Crítica», con su número encima de cada una. Al pasar el puntero sobre una columna, o al llegar a ella con el teclado, aparece un texto con esta forma: «Menor: 2 NC abiertas».
- Cada gráfica tiene un botón «Ver como tabla». Cuando la tabla está a la vista, el botón dice «Ver como gráfica» y vuelve a mostrar la gráfica al pulsarlo.
- La tabla de hitos tiene las columnas «Programa», «Cumplidos» y «Total», con una fila por programa de la gráfica. La tabla de NC tiene las columnas «Severidad» y «NC abiertas», con una fila por severidad.
- Cada gráfica tiene su título: «Hitos cumplidos por programa» y «NC abiertas por severidad».
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado. Después se abre `/login?tenant=alumno01` en un navegador sin sesión de SIGPRO guardada, se inicia sesión con la cuenta de la fila y se abre `/mission`.

## Criterios de aceptación
```gherkin
Característica: Gráficas del panel de misión en la web

  Esquema del escenario: La tabla de hitos muestra cada programa con sus hitos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01 y tiene abierto /mission
    Cuando pulsa «Ver como tabla» en la gráfica «Hitos cumplidos por programa»
    Entonces la fila de <programa> muestra <cumplidos> en «Cumplidos» y <total> en «Total»

    Ejemplos:
      | programa | cumplidos | total |
      | PRG-001 | 1 | 9 |
      | PRG-002 | 3 | 6 |
      | PRG-005 | 3 | 5 |
      | PRG-007 | 2 | 6 |
      | PRG-009 | 1 | 10 |
      | PRG-010 | 4 | 9 |
      | PRG-013 | 5 | 9 |
      | PRG-015 | 2 | 7 |

  Esquema del escenario: Al pasar el puntero sobre una barra aparece su texto y se ve su anchura
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01 y tiene abierto /mission
    Cuando pasa el puntero sobre la barra de <programa>
    Entonces aparece el texto <texto> y la barra ocupa el <anchura> % del ancho de la gráfica

    Ejemplos:
      | programa | texto | anchura |
      | PRG-001 | «PRG-001: 1 de 9 hitos cumplidos» | 90 |
      | PRG-009 | «PRG-009: 1 de 10 hitos cumplidos» | 100 |

  Esquema del escenario: La tabla de NC muestra el número de cada severidad
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01 y tiene abierto /mission
    Cuando pulsa «Ver como tabla» en la gráfica «NC abiertas por severidad»
    Entonces la fila de <severidad> muestra <cantidad> en «NC abiertas»

    Ejemplos:
      | severidad | cantidad |
      | «Menor» | 2 |
      | «Mayor» | 2 |
      | «Crítica» | 4 |

  Esquema del escenario: Al pasar el puntero sobre una columna de NC aparece su texto
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01 y tiene abierto /mission
    Cuando pasa el puntero sobre la columna de <severidad> en la gráfica «NC abiertas por severidad»
    Entonces aparece el texto <texto>

    Ejemplos:
      | severidad | texto |
      | «Menor» | «Menor: 2 NC abiertas» |
      | «Crítica» | «Crítica: 4 NC abiertas» |
```

## Fuera de alcance
- Las gráficas vacías, la carga y el error del panel: US-MISION-KPI-008, de esta misma épica.
- La actualización en vivo de la gráfica de NC y los eventos de la misión: EP-MISION-FEED.
- Los datos que dibujan las gráficas en el resumen: US-MISION-KPI-002, de esta misma épica.
