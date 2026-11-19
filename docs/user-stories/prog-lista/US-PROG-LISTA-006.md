---
id: US-PROG-LISTA-006
tipo: historia
epica: EP-PROG-LISTA
titulo: "[Web] Paginar la lista de programas de 10 en 10"
etiquetas: [web]
relacionadas: [US-PROG-LISTA-001, US-PROG-LISTA-005, US-PROG-LISTA-008]
verificacion: codigo
cubre: ["/programs"]
---

## Historia
Como responsable de programas con más de diez programas, quiero pasar de página en la lista,
para ver todos los programas sin que una sola pantalla los muestre a la vez.

## Reglas
- La lista muestra 10 programas por página. El recuento dice qué filas se ven con la forma «inicio–fin de total»: «1–10 de 24» en la primera página, «11–20 de 24» en la segunda y «21–24 de 24» en la última.
- En escritorio, la paginación tiene un botón «Página anterior», los números de página y un botón «Página siguiente». El número de la página actual se distingue de los demás. «Página anterior» está deshabilitado en la primera página, y «Página siguiente» en la última.
- En el diseño responsive la paginación son solo los dos botones «Página anterior» y «Página siguiente», sin números.
- Cambiar de página mantiene los filtros y el orden elegidos.
- La página actual va en la dirección de la página (`page=`). La primera página no lleva ese parámetro. Recargar la página deja la misma página.
- Si la dirección pide una página mayor que la última, la lista muestra la última y la dirección pasa a indicar esa página.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe `gestor@sigpro.test` con `Gestor1234!` y se llega a `/programs`.

## Criterios de aceptación
```gherkin
Característica: Paginación de la lista de programas en la web

  Esquema del escenario: «Página siguiente» muestra la página que sigue
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en un diseño <diseno>
    Cuando pulsa «Página siguiente» <veces> veces
    Entonces la lista muestra desde <primera> hasta <ultima> y el recuento dice <recuento>

    Ejemplos:
      | diseno | veces | primera | ultima | recuento |
      | escritorio | 1 | PRG-011 | PRG-020 | «11–20 de 24» |
      | escritorio | 2 | PRG-021 | PRG-024 | «21–24 de 24» |
      | responsive | 2 | PRG-021 | PRG-024 | «21–24 de 24» |

  Esquema del escenario: El número de página lleva a esa página en escritorio
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en escritorio
    Cuando pulsa el número <pagina> de la paginación
    Entonces la lista muestra desde <primera> hasta <ultima> y «Página anterior» está <anterior>

    Ejemplos:
      | pagina | primera | ultima | anterior |
      | 3 | PRG-021 | PRG-024 | habilitado |

  Esquema del escenario: Los botones de página se deshabilitan en los extremos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su sesión iniciada en un diseño <diseno>
    Cuando abre /programs?page=<pagina>
    Entonces «Página anterior» está <anterior> y «Página siguiente» está <siguiente>

    Ejemplos:
      | diseno | pagina | anterior | siguiente |
      | escritorio | 1 | deshabilitado | habilitado |
      | responsive | 3 | habilitado | deshabilitado |

  Esquema del escenario: La página viaja en la dirección y una página fuera de rango se corrige
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su sesión iniciada en escritorio
    Cuando abre <direccion>
    Entonces la lista muestra desde <primera> hasta <ultima> y la dirección de la página es <direccion_final>

    Ejemplos:
      | direccion | primera | ultima | direccion_final |
      | /programs?page=3 | PRG-021 | PRG-024 | /programs?page=3 |
      | /programs?page=9 | PRG-021 | PRG-024 | /programs?page=3 |
```

## Fuera de alcance
- Los filtros y el orden que se mantienen al cambiar de página: EP-PROG-LISTA, en las historias de filtros y de tabla de la web.
- La paginación de «Cargar más» de la app móvil: EP-PROG-LISTA, en la historia de la lista móvil.
- La selección de los programas de la página (casillas) y las acciones masivas: EP-PROG-GESTION.
