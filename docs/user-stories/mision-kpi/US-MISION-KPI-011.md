---
id: US-MISION-KPI-011
tipo: historia
epica: EP-MISION-KPI
titulo: "[Móvil] Panel de misión: gráficas, leyenda, vista de tabla y estados de carga y vacío"
etiquetas: [movil]
relacionadas: [US-MISION-KPI-002, US-MISION-KPI-007, US-MISION-KPI-008, US-MISION-KPI-010]
verificacion: ejecutada
cubre: ["/mission"]
---

## Historia
Como persona que revisa el panel de misión en la app móvil, quiero ver el avance de los hitos por programa y las no conformidades abiertas por severidad en gráficas con leyenda, y poder verlas como tabla,
para leer desde el móvil las mismas cifras que en la web.

## Reglas
- La gráfica «Hitos cumplidos por programa» tiene una barra fina por programa: los primeros programas activos que tienen hitos, como mucho ocho, en orden de código. Cada barra muestra la parte cumplida en color de acento y, a su derecha, el texto «D/T», con D los hitos cumplidos y T el total. La gráfica tiene una leyenda con «Cumplidos» y «Pendientes».
- La gráfica «NC abiertas por severidad» tiene tres columnas, con su número encima y su nombre debajo: «Menor», «Mayor» y «Crítica». La gráfica tiene una leyenda con los mismos tres nombres.
- Cada gráfica tiene un botón «Ver como tabla». Cuando la tabla está a la vista, el botón dice «Ver como gráfica» y vuelve a mostrar la gráfica al pulsarlo.
- La tabla de hitos tiene las columnas «Programa», «Cumplidos» y «Total», con una fila por programa de la gráfica. La tabla de NC tiene las columnas «Severidad» y «NC abiertas», con una fila por severidad.
- Si una gráfica no tiene datos, muestra el texto «Sin datos todavía» en lugar de sus barras o columnas. La de hitos no tiene datos cuando ningún programa activo tiene hitos; la de NC, cuando no hay ninguna no conformidad abierta.
- Mientras llega el resumen, cada gráfica muestra el texto «Cargando…».
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado. Después se abre la app móvil sin sesión, se escribe `alumno01` en «Tenant de trabajo», se inicia sesión con la cuenta de la fila y se abre la pestaña «Misión». Las demoras de la petición del resumen las provoca la prueba, no el caos del tenant.

## Criterios de aceptación
```gherkin
Característica: Gráficas del panel de misión en la app móvil

  Esquema del escenario: La tabla de hitos muestra cada programa con sus hitos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Misión»
    Cuando pulsa «Ver como tabla» en la gráfica «Hitos cumplidos por programa»
    Entonces la fila de <programa> muestra <cumplidos> en «Cumplidos» y <total> en «Total»

    Ejemplos:
      | programa | cumplidos | total |
      | PRG-001 | 1 | 9 |
      | PRG-009 | 1 | 10 |
      | PRG-015 | 2 | 7 |

  Esquema del escenario: La tabla de NC muestra el número de cada severidad
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Misión»
    Cuando pulsa «Ver como tabla» en la gráfica «NC abiertas por severidad»
    Entonces la fila de <severidad> muestra <cantidad> en «NC abiertas»

    Ejemplos:
      | severidad | cantidad |
      | «Menor» | 2 |
      | «Mayor» | 2 |
      | «Crítica» | 4 |

  Esquema del escenario: Cada gráfica muestra su leyenda
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Misión»
    Cuando la carga ha terminado
    Entonces la gráfica <grafica> muestra la leyenda <leyenda>

    Ejemplos:
      | grafica | leyenda |
      | «Hitos cumplidos por programa» | «Cumplidos» y «Pendientes» |
      | «NC abiertas por severidad» | «Menor», «Mayor» y «Crítica» |

  Esquema del escenario: Una gráfica sin datos dice que todavía no hay datos
    Dado que en el tenant alumno01, recién reiniciado, <cambio>
    Y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo»
    Cuando abre la pestaña «Misión» y la carga ha terminado
    Entonces la gráfica <grafica> muestra «Sin datos todavía» y no dibuja ninguna barra ni ninguna columna

    Ejemplos:
      | cambio | grafica |
      | alumno01@sigpro.lab archiva los 12 programas activos con POST /api/programs/:code/archive | «Hitos cumplidos por programa» |
      | alumno01@sigpro.lab elimina los 24 programas con DELETE /api/programs/:code | «NC abiertas por severidad» |

  Esquema del escenario: Mientras llega el resumen, las gráficas muestran el texto de carga
    Dado que en el tenant alumno01, recién reiniciado, la respuesta de GET /api/mission/summary llega <retraso> después de la petición
    Y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo»
    Cuando abre la pestaña «Misión»
    Entonces las gráficas muestran «Cargando…» hasta que llega la respuesta

    Ejemplos:
      | retraso |
      | 3 segundos |
```

## Fuera de alcance
- Las cifras de las cuatro tarjetas y su hoja de explicación: US-MISION-KPI-010, de esta misma épica.
- La conexión en tiempo real, el feed de eventos y la actualización en vivo de la gráfica de NC: EP-MISION-FEED.
- Los datos que dibujan las gráficas en el resumen: US-MISION-KPI-002, de esta misma épica.
- El botón «Emitir evento de prueba»: US-MISION-KPI-012, de esta misma épica.
