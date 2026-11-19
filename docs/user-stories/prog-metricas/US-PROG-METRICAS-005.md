---
id: US-PROG-METRICAS-005
tipo: historia
epica: EP-PROG-METRICAS
titulo: "[Móvil] Cuatro tarjetas y subtítulo de la lista de programas"
etiquetas: [movil]
relacionadas: [US-PROG-METRICAS-001, US-PROG-METRICAS-002, US-PROG-METRICAS-003, US-PROG-LISTA-008]
verificacion: codigo
cubre: ["/programs"]
---

## Historia
Como gestor de programas que abre la lista en la app móvil, quiero ver las mismas cuatro cifras y el mismo subtítulo que en la web, con sus mismos estados de carga, de error y de vacío,
para ver la cartera desde el móvil sin cambiar de pantalla.

## Reglas
- La cabecera de `/programs` muestra el título «Programas», el subtítulo y, debajo, las cuatro tarjetas «Programas», «Activos», «Avance medio» y «NC abiertas», dispuestas en dos columnas. Cada tarjeta tiene una cifra grande y una línea auxiliar debajo, con los mismos textos que en la web.
- Las cifras son las del tenant y se calculan igual que en la web: «Programas» cuenta todos los programas del tenant; «Activos», los que están en estado Activo; «Avance medio» es la media del avance de todos los programas, donde un programa sin hitos cuenta 0 %; «NC abiertas» cuenta las no conformidades que no están cerradas ni rechazadas.
- Las líneas auxiliares son «activos: N», «P % del total», «D de H hitos cumplidos» y «de N registradas», con P redondeado al entero más próximo.
- El subtítulo dice «N programas · M activo»: N es el número de programas del tenant sin filtros, y M es el número de programas en estado Activo que cumplen el texto escrito en el buscador.
- Los filtros de la lista (el buscador y el estado) no cambian las cuatro tarjetas.
- Las cifras se vuelven a pedir después de duplicar, archivar o eliminar un programa desde su menú ⋯ de la lista, y después de un alta.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre la app móvil sin sesión, se escribe `alumno01` en «Tenant de trabajo» y se inicia sesión con el correo y la contraseña de la fila. Los estados que se fabrican con la API se preparan después del reinicio, con el token de `alumno01@sigpro.lab`. Antes de cada fila, el caos del tenant debe estar apagado.
- Con el reinicio, el tenant `alumno01` tiene 24 programas (`PRG-001` a `PRG-024`), 12 de ellos en estado Activo, 175 hitos de los que 86 están cumplidos, y 12 no conformidades de las que 8 están abiertas.

## Criterios de aceptación
```gherkin
Característica: Tarjetas y subtítulo de la lista de programas en la app móvil

  Esquema del escenario: Cada tarjeta muestra la cifra del tenant y su línea auxiliar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con «Tenant de trabajo» alumno01 y tiene abierta /programs
    Cuando la lista ha terminado de cargar
    Entonces la tarjeta <tarjeta> muestra <cifra> y debajo la línea <linea>

    Ejemplos:
      | tarjeta | cifra | linea |
      | «Programas» | 24 | «activos: 12» |
      | «Activos» | 12 | «50 % del total» |
      | «Avance medio» | 49 % | «86 de 175 hitos cumplidos» |
      | «NC abiertas» | 8 | «de 12 registradas» |

  Esquema del escenario: Los filtros de la lista no cambian las cuatro tarjetas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con «Tenant de trabajo» alumno01 y tiene abierta /programs
    Cuando <filtro>
    Entonces las cuatro tarjetas siguen mostrando 24, 12, 49 % y 8, con las líneas «activos: 12», «50 % del total», «86 de 175 hitos cumplidos» y «de 12 registradas»

    Ejemplos:
      | filtro |
      | escribe PRG-001 en «Buscar programas» |
      | elige «En pausa» en «Estado» |

  Esquema del escenario: El subtítulo cuenta todos los programas y los activos que cumplen la búsqueda
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con «Tenant de trabajo» alumno01 y tiene abierta /programs
    Cuando <busqueda>
    Entonces el subtítulo de la pantalla dice <subtitulo>

    Ejemplos:
      | busqueda | subtitulo |
      | no hay texto en «Buscar programas» | «24 programas · 12 activo» |
      | escribe PRG-001 en «Buscar programas» | «24 programas · 1 activo» |
      | escribe zzz-sin-coincidencias en «Buscar programas» | «24 programas · 0 activo» |

  Esquema del escenario: Mientras el resumen no llega, las tarjetas muestran puntos suspensivos
    Dado que en el tenant alumno01, recién reiniciado, la respuesta de GET /api/mission/summary llega <retraso> después de la petición
    Y gestor@sigpro.test ha iniciado sesión en la app móvil con «Tenant de trabajo» alumno01
    Cuando abre /programs
    Entonces las cuatro tarjetas muestran «…» en la cifra y en la línea auxiliar, y el bloque de tarjetas está en estado de carga
    Y cuando llega la respuesta, las tarjetas muestran 24, 12, 49 % y 8

    Ejemplos:
      | retraso |
      | 3 segundos |
      | 8 segundos |

  Esquema del escenario: Si el resumen falla, las cuatro tarjetas muestran un guion largo y la lista sigue
    Dado que en el tenant alumno01, recién reiniciado, GET /api/mission/summary <fallo>
    Y gestor@sigpro.test ha iniciado sesión en la app móvil con «Tenant de trabajo» alumno01
    Cuando abre /programs
    Entonces las cuatro tarjetas muestran «—» en la cifra y en la línea auxiliar
    Y la lista de programas sigue visible

    Ejemplos:
      | fallo |
      | responde con error 503 |
      | no recibe ninguna respuesta (sin conexión) |

  Esquema del escenario: Sin programas, las tarjetas muestran cero
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab elimina los 24 programas con DELETE /api/programs/:code
    Y gestor@sigpro.test ha iniciado sesión en la app móvil con «Tenant de trabajo» alumno01
    Cuando abre /programs y la lista ha terminado de cargar
    Entonces la tarjeta <tarjeta> muestra <cifra> y debajo la línea <linea>

    Ejemplos:
      | tarjeta | cifra | linea |
      | «Programas» | 0 | «activos: 0» |
      | «Activos» | 0 | «0 % del total» |
      | «Avance medio» | 0 % | «0 de 0 hitos cumplidos» |
      | «NC abiertas» | 0 | «de 0 registradas» |

  Esquema del escenario: Las tarjetas se recalculan tras un cambio desde el menú de la lista
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app móvil con «Tenant de trabajo» alumno01 y tiene abierta /programs
    Cuando <operacion>
    Entonces las cuatro tarjetas muestran «Programas» con <programas>, «Activos» con <activos>, «Avance medio» con <avance> y «NC abiertas» con <nc_abiertas>, y la línea de «NC abiertas» es <linea_nc>

    Ejemplos:
      | operacion | programas | activos | avance | nc_abiertas | linea_nc |
      | duplica PRG-001 con «Duplicar» en su menú ⋯ | 25 | 12 | 47 % | 8 | «de 12 registradas» |
      | archiva PRG-001 con «Archivar» en su menú ⋯ | 24 | 11 | 49 % | 8 | «de 12 registradas» |
      | elimina PRG-001 con «Eliminar» en su menú ⋯ y confirma con «Eliminar» | 23 | 11 | 51 % | 5 | «de 8 registradas» |
```

## Fuera de alcance
- La lista: chips de estado, buscador y sus resultados, «Cargar más» y el recuento «mostrados» de la parte inferior: EP-PROG-LISTA. La exportación CSV, la selección múltiple y las acciones de cada fila en sí: EP-PROG-GESTION.
- El detalle de un programa: EP-PROG-DETALLE. El alta y la edición de un programa: EP-PROG-ALTA.
- El panel de misión y sus cifras en vivo: la épica del panel de misión.

## Decisiones pendientes
- Si la cifra de NC abiertas debe actualizarse en vivo cuando otra persona registra o cambia una no conformidad, como ocurre en la web. Hoy la app la pide al entrar en la pantalla y después de cada cambio de programa desde la lista.
- Qué debe mostrar el subtítulo cuando falla la lista de programas. Hoy queda en «…».
- Si el número de activos del subtítulo debe respetar el filtro de estado: hoy no lo respeta, y cuenta los activos que cumplen el texto del buscador aunque se haya elegido un estado. La misma decisión afecta al contador de activos de la cabecera de la lista (EP-PROG-LISTA).
