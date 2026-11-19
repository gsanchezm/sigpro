---
id: US-MISION-KPI-006
tipo: historia
epica: EP-MISION-KPI
titulo: "[Web] Panel de misión: cuatro indicadores con su cifra y su explicación"
etiquetas: [web]
relacionadas: [US-MISION-KPI-001, US-MISION-KPI-003, US-MISION-KPI-010, US-MISION-FEED-007]
verificacion: codigo
cubre: ["/mission"]
---

## Historia
Como persona con una cuenta en SIGPRO que abre el panel de misión en la web, quiero ver cuatro indicadores con su cifra y su detalle,
para saber de un vistazo cuántos programas están activos, cuánto avanzan sus hitos, cuántas no conformidades siguen abiertas y qué parte de los casos verificados supera.

## Reglas
- La página `/mission` se titula «Panel de misión» y, debajo, dice «Estado del tenant en tiempo real: hitos, no conformidades y verificación.».
- Hay cuatro tarjetas, en este orden: «Programas activos», «Hitos cumplidos», «NC abiertas» y «Verificación superada». Cada una tiene una cifra grande y, debajo, una línea de detalle.
- «Programas activos»: la cifra es el número de programas del tenant en estado activo. El detalle es «de N programas», con N todos los programas del tenant, en cualquier estado.
- «Hitos cumplidos»: la cifra es el porcentaje entero de hitos cumplidos sobre el total de hitos de todos los programas del tenant, escrito con «%» (por ejemplo, «49 %»). El detalle es «D de H hitos», con D los hitos cumplidos y H el total.
- «NC abiertas»: la cifra es el número de no conformidades del tenant que no están cerradas ni rechazadas. El detalle es «de N no conformidades», con N todas las del tenant.
- «Verificación superada»: la cifra es el porcentaje de casos de prueba con ejecuciones cuyo último resultado es «Superado», escrito con «%». El detalle es «C casos con ejecuciones», con C los casos que tienen alguna ejecución.
- Cada tarjeta tiene un icono de información. Al pasar el puntero sobre él, o al llegar a él con el teclado, aparece un texto que explica el indicador.
- Las cifras son las del tenant de la sesión. No hay ningún filtro en esta página.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado. Después se abre `/login?tenant=alumno01` en un navegador sin sesión de SIGPRO guardada, se inicia sesión con la cuenta de la fila y se abre `/mission`. Los cambios de programas, de no conformidades y de ejecuciones de una fila se hacen con la API y el token de `alumno01@sigpro.lab`, antes de abrir la página.
- Con el reinicio, el tenant tiene 24 programas (`PRG-001` a `PRG-024`), 12 de ellos activos, 175 hitos de los que 86 están cumplidos, 12 no conformidades de las que 8 están abiertas, y 25 casos de prueba con ejecuciones de los que 14 tienen como último resultado «Superado».

## Criterios de aceptación
```gherkin
Característica: Indicadores del panel de misión en la web

  Esquema del escenario: Cada tarjeta muestra su cifra y su detalle con los datos del seed
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01 y tiene abierto /mission
    Cuando la página ha terminado de cargar
    Entonces la tarjeta <tarjeta> muestra <cifra> y debajo <detalle>
    Y la página se titula «Panel de misión»

    Ejemplos:
      | tarjeta | cifra | detalle |
      | «Programas activos» | 12 | «de 24 programas» |
      | «Hitos cumplidos» | 49 % | «86 de 175 hitos» |
      | «NC abiertas» | 8 | «de 12 no conformidades» |
      | «Verificación superada» | 56 % | «25 casos con ejecuciones» |

  Esquema del escenario: Las cifras reflejan el tenant cuando se abre la página
    Dado que en el tenant alumno01, recién reiniciado, <cambio>
    Y gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01
    Cuando abre /mission y la página ha terminado de cargar
    Entonces «Programas activos» muestra <activos>, «Hitos cumplidos» muestra <hitos>, «NC abiertas» muestra <nc> y «Verificación superada» muestra <verificacion>

    Ejemplos:
      | cambio | activos | hitos | nc | verificacion |
      | alumno01@sigpro.lab archiva PRG-001 con POST /api/programs/PRG-001/archive | 11 | 49 % | 8 | 56 % |
      | alumno01@sigpro.lab ejecuta TC-001 con POST /api/test-cases/TC-001/runs y el resultado `pass` | 12 | 49 % | 8 | 60 % |
      | alumno01@sigpro.lab pasa NC-003 a `closed` con POST /api/nc/NC-003/transition y el comentario `Acción correctiva verificada por calidad` | 12 | 49 % | 7 | 56 % |

  Esquema del escenario: El icono de información explica cada indicador
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01 y tiene abierto /mission
    Cuando pasa el puntero sobre el icono de información de <tarjeta>
    Entonces ve el texto <texto>

    Ejemplos:
      | tarjeta | texto |
      | «Programas activos» | «Programas en estado «Activo» del tenant.» |
      | «NC abiertas» | «No conformidades que no están cerradas ni rechazadas. Se actualiza con cada cambio en el tablero.» |
```

## Fuera de alcance
- La actualización en vivo de la cifra de «NC abiertas» y los eventos de la misión: EP-MISION-FEED.
- Las gráficas de hitos y de NC: US-MISION-KPI-007, de esta misma épica.
- Los estados de carga, vacío y error, y el botón «Simular evento»: US-MISION-KPI-008 y US-MISION-KPI-009, de esta misma épica.
- Las cuatro tarjetas de la cabecera de la lista de programas: EP-PROG-METRICAS.
