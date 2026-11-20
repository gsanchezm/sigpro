---
id: US-MISION-KPI-010
tipo: historia
epica: EP-MISION-KPI
titulo: "[Móvil] Panel de misión: cuatro indicadores con su hoja de explicación"
etiquetas: [movil]
relacionadas: [US-MISION-KPI-001, US-MISION-KPI-003, US-MISION-KPI-006, US-MISION-KPI-011]
verificacion: ejecutada
cubre: ["/mission"]
---

## Historia
Como persona con una cuenta en SIGPRO que abre el panel de misión en la app móvil, quiero ver las cuatro cifras con su detalle y, si quiero saber qué mide cada una, abrir su explicación,
para entender la cartera desde el móvil con el mismo significado que en la web.

## Reglas
- Se abre la pantalla con la pestaña «Misión» de la barra inferior. La pestaña está disponible para todos los roles. La pantalla se titula «Panel de misión» y, debajo, dice «Estado del tenant en tiempo real: hitos, no conformidades y verificación.».
- Hay cuatro tarjetas, dispuestas en dos columnas y en este orden: «Programas activos», «Hitos cumplidos», «NC abiertas» y «Verificación superada». Cada una tiene una cifra grande y, debajo, una línea de detalle. Las cifras y los detalles se calculan igual que en la web: «Programas activos» cuenta los programas activos y su detalle es «de N programas»; «Hitos cumplidos» es el porcentaje entero de hitos cumplidos y su detalle es «D de H hitos»; «NC abiertas» cuenta las no conformidades que no están cerradas ni rechazadas, con el detalle «de N no conformidades»; «Verificación superada» es el porcentaje de casos con ejecuciones cuyo último resultado es «Superado», con el detalle «C casos con ejecuciones».
- Cada tarjeta tiene un botón con la letra «i». Al pulsarlo se abre una hoja titulada «Qué mide» seguido del nombre del indicador, con el texto que explica qué mide. La hoja se cierra con su botón «Cerrar».
- Mientras llega el resumen, cada tarjeta muestra «…» en lugar de la cifra y no muestra ningún detalle.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado. Después se abre la app móvil sin sesión, se escribe `alumno01` en «Tenant de trabajo», se inicia sesión con la cuenta de la fila y se abre la pestaña «Misión». Los cambios de programas, de no conformidades y de ejecuciones de una fila se hacen con la API y el token de `alumno01@sigpro.lab`, antes de abrir la pantalla.
- Con el reinicio, el tenant tiene 24 programas (`PRG-001` a `PRG-024`), 12 de ellos activos, 175 hitos de los que 86 están cumplidos, 12 no conformidades de las que 8 están abiertas, y 25 casos de prueba con ejecuciones de los que 14 tienen como último resultado «Superado».

## Criterios de aceptación
```gherkin
Característica: Indicadores del panel de misión en la app móvil

  Esquema del escenario: Cada tarjeta muestra su cifra y su detalle con los datos del seed
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Misión»
    Cuando la carga ha terminado
    Entonces la tarjeta <tarjeta> muestra <cifra> y debajo <detalle>

    Ejemplos:
      | tarjeta | cifra | detalle |
      | «Programas activos» | 12 | «de 24 programas» |
      | «Hitos cumplidos» | 49 % | «86 de 175 hitos» |
      | «NC abiertas» | 8 | «de 12 no conformidades» |
      | «Verificación superada» | 56 % | «25 casos con ejecuciones» |

  Esquema del escenario: La hoja explica el indicador que se elige
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierta la pestaña «Misión» con las cifras cargadas
    Cuando pulsa el «i» de la tarjeta <tarjeta>
    Entonces se abre una hoja titulada <titulo_hoja> con el texto <texto>
    Y al pulsar «Cerrar» la hoja se cierra

    Ejemplos:
      | tarjeta | titulo_hoja | texto |
      | «Programas activos» | «Qué mide Programas activos» | «Programas en estado «Activo» del tenant.» |
      | «Hitos cumplidos» | «Qué mide Hitos cumplidos» | «Hitos con avance del 100 % sobre el total de hitos de todos los programas.» |

  Esquema del escenario: Antes de llegar el resumen, las tarjetas muestran puntos suspensivos
    Dado que en el tenant alumno01, recién reiniciado, la respuesta de GET /api/mission/summary llega <retraso> después de la petición
    Y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo»
    Cuando abre la pestaña «Misión»
    Entonces cada tarjeta muestra «…» en lugar de su cifra y no muestra ningún detalle
    Y cuando llega la respuesta, «Programas activos» muestra 12

    Ejemplos:
      | retraso |
      | 3 segundos |
      | 6 segundos |

  Esquema del escenario: Si el resumen no se puede cargar, aparece el aviso de error y se puede reintentar
    Dado que en el tenant alumno01, recién reiniciado, la petición de GET /api/mission/summary <fallo>
    Y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo»
    Cuando abre la pestaña «Misión»
    Entonces ve el aviso «No se pudo cargar el panel de misión» y el botón «Reintentar»

    Ejemplos:
      | fallo |
      | responde con error 503 |
      | no recibe ninguna respuesta (sin conexión) |
```

## Decisiones pendientes
- Qué tarjetas se muestran cuando el resumen no se puede cargar. Hoy la app móvil no muestra ninguna tarjeta, mientras que la web muestra sus tarjetas con cero. Ninguna fila afirma si las tarjetas deben aparecer en ese estado.

## Fuera de alcance
- La conexión en tiempo real, el feed de eventos y la actualización en vivo de la cifra de NC abiertas: EP-MISION-FEED.
- Las gráficas, su leyenda y su vista de tabla, y los estados de carga y vacío de las gráficas: US-MISION-KPI-011, de esta misma épica.
- El botón «Emitir evento de prueba»: US-MISION-KPI-012, de esta misma épica.
- Las cuatro tarjetas de la cabecera de la lista de programas: EP-PROG-METRICAS.
