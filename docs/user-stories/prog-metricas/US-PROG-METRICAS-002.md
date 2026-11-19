---
id: US-PROG-METRICAS-002
tipo: historia
epica: EP-PROG-METRICAS
titulo: "[Web] Cuatro tarjetas y subtítulo de la lista de programas"
etiquetas: [web]
relacionadas: [US-PROG-METRICAS-001, US-PROG-METRICAS-005, US-PROG-LISTA-002]
verificacion: ejecutada
cubre: ["/programs"]
---

## Historia
Como gestor de programas que abre la lista en la web, quiero ver en la cabecera cuatro tarjetas con las cifras de todos los programas del tenant y el número de programas en el subtítulo,
para saber cómo va la cartera antes de aplicar ningún filtro.

## Reglas
- La cabecera de `/programs` muestra, bajo el título «Programas», el subtítulo y, a continuación, cuatro tarjetas en este orden: «Programas», «Activos», «Avance medio» y «NC abiertas». Cada tarjeta tiene una cifra grande y una línea auxiliar debajo.
- «Programas»: la cifra es el número de programas del tenant, en cualquier estado. La línea es «activos: N», con N los programas en estado Activo.
- «Activos»: la cifra es el número de programas en estado Activo. La línea es «P % del total», con P la cifra entre el número total de programas, redondeada al entero más próximo (0,5 se redondea hacia arriba). Sin programas, P es 0.
- «Avance medio»: la cifra es la media del porcentaje de avance de todos los programas del tenant, redondeada al entero y escrita con «%» (por ejemplo, «49 %»). Un programa sin hitos cuenta 0 %, y cuentan también los borradores, los cerrados y los cancelados. La línea es «D de H hitos cumplidos», con D los hitos cumplidos y H los hitos de todos los programas del tenant. La barra de la tarjeta se llena hasta esa cifra, sobre 100.
- «NC abiertas»: la cifra es el número de no conformidades del tenant que no están cerradas ni rechazadas. La línea es «de N registradas», con N todas las no conformidades del tenant.
- Las cuatro tarjetas son del tenant: no cambian al escribir en la búsqueda de la cabecera, ni al elegir un estado en el filtro «Estado», ni con ningún otro filtro de la lista.
- El subtítulo dice «N programas · M activo»: N es el número de programas del tenant sin filtros; M es el número de programas en estado Activo que cumplen la búsqueda de la cabecera (código o nombre) y los filtros de responsable y fechas. El filtro de estado no entra en M mientras no se decida lo contrario (ver Decisiones pendientes).
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin sesión, se inicia sesión con `gestor@sigpro.test` y `Gestor1234!` y se abre `/programs`. Cada fila parte de un contexto nuevo.
- Con el reinicio, el tenant `alumno01` tiene 24 programas (`PRG-001` a `PRG-024`), 12 de ellos en estado Activo, 175 hitos de los que 86 están cumplidos, y 12 no conformidades de las que 8 están abiertas.

## Criterios de aceptación
```gherkin
Característica: Tarjetas y subtítulo de la lista de programas en la web

  Esquema del escenario: Cada tarjeta muestra la cifra del tenant y su línea auxiliar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y tiene abierta la lista de programas
    Cuando la lista ha terminado de cargar
    Entonces la tarjeta <tarjeta> muestra <cifra> y debajo la línea <linea>

    Ejemplos:
      | tarjeta | cifra | linea |
      | «Programas» | 24 | «activos: 12» |
      | «Activos» | 12 | «50 % del total» |
      | «Avance medio» | 49 % | «86 de 175 hitos cumplidos» |
      | «NC abiertas» | 8 | «de 12 registradas» |

  Esquema del escenario: Los filtros de la lista no cambian las cuatro tarjetas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y tiene abierta la lista de programas
    Cuando <filtro>
    Entonces las cuatro tarjetas siguen mostrando 24, 12, 49 % y 8, con las líneas «activos: 12», «50 % del total», «86 de 175 hitos cumplidos» y «de 12 registradas»

    Ejemplos:
      | filtro |
      | escribe PRG-001 en «Búsqueda global» |
      | elige «En pausa» en «Estado» |
      | escribe zzz-sin-coincidencias en «Búsqueda global» |

  Esquema del escenario: El subtítulo cuenta todos los programas y los activos que cumplen la búsqueda
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y tiene abierta la lista de programas
    Cuando <busqueda>
    Entonces el subtítulo de la cabecera de la página dice <subtitulo>

    Ejemplos:
      | busqueda | subtitulo |
      | no hay texto en «Búsqueda global» | «24 programas · 12 activo» |
      | escribe PRG-001 en «Búsqueda global» | «24 programas · 1 activo» |
      | escribe zzz-sin-coincidencias en «Búsqueda global» | «24 programas · 0 activo» |

  Esquema del escenario: La barra de Avance medio se llena hasta su cifra
    Dado que en el tenant alumno01, recién reiniciado, <cambio>
    Y gestor@sigpro.test ha iniciado sesión en la web y tiene abierta la lista de programas
    Cuando la lista ha terminado de cargar
    Entonces la barra de «Avance medio» está llena hasta el <porcentaje> % y su valor es <porcentaje>

    Ejemplos:
      | cambio | porcentaje |
      | no se hace ningún cambio | 49 |
      | alumno01@sigpro.lab duplica PRG-001 con POST /api/programs/PRG-001/duplicate | 47 |
```

## Fuera de alcance
- Los resultados, los filtros, el orden, la paginación y el recuento «de N» de la parte inferior de la lista: EP-PROG-LISTA.
- Las cifras después de cambiar un programa, la carga, el error y el vacío de las tarjetas, y las no conformidades en vivo: esta misma épica, en otras historias.
- El detalle de un programa: EP-PROG-DETALLE.

## Decisiones pendientes
- Si el número de activos del subtítulo debe respetar el filtro de estado. Hoy, con «En pausa» elegido, el subtítulo sigue contando los activos que cumplen la búsqueda y los demás filtros, no los que cumplen el estado elegido. La misma decisión afecta al contador de activos de la cabecera de la lista (EP-PROG-LISTA).
