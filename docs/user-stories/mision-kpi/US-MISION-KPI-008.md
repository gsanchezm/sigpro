---
id: US-MISION-KPI-008
tipo: historia
epica: EP-MISION-KPI
titulo: "[Web] Panel de misión: estados de carga, vacío y error"
etiquetas: [web]
relacionadas: [US-MISION-KPI-006, US-MISION-KPI-007, US-MISION-KPI-011]
verificacion: codigo
cubre: ["/mission"]
---

## Historia
Como persona que abre el panel de misión en la web, quiero ver cuándo las cifras todavía están llegando, cuándo no hay datos que dibujar y cuándo el panel no se ha podido cargar, con un botón para volver a intentarlo,
para no tomar por cifras reales lo que solo es una carga, una falta de datos o un fallo.

## Reglas
- Mientras llega el resumen, las cuatro tarjetas no muestran ninguna cifra: muestran un marcador de carga, y el bloque de tarjetas está en carga. Las gráficas no muestran barras ni columnas, y muestran un marcador de carga.
- Cuando el resumen llega, cada gráfica sin datos muestra el texto «Sin datos todavía» en lugar de sus barras. La gráfica de hitos no tiene datos cuando ningún programa activo tiene hitos; la de NC, cuando no hay ninguna no conformidad abierta.
- Si el resumen no se puede cargar, aparece un aviso de error con el título «No se pudo cargar el panel de misión». Debajo aparece la traza de la respuesta, que empieza por el método, la ruta y el código de estado (por ejemplo, «GET /api/mission/summary → 503»), o, si no hubo respuesta, el texto «No se pudo contactar con el servidor». El aviso tiene un botón «Reintentar».
- Pulsar «Reintentar» vuelve a pedir el resumen. Si la respuesta llega bien, el aviso desaparece y las cifras aparecen con sus valores.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado. Después se abre `/login?tenant=alumno01` en un navegador sin sesión de SIGPRO guardada, se inicia sesión con la cuenta de la fila y se abre `/mission`. Las demoras y los fallos de la petición del resumen los provoca la prueba, no el caos del tenant.
- Con el reinicio, el tenant tiene 24 programas (`PRG-001` a `PRG-024`), 12 de ellos activos, y 12 no conformidades de las que 8 están abiertas.

## Criterios de aceptación
```gherkin
Característica: Estados de carga, vacío y error del panel de misión en la web

  Esquema del escenario: Mientras llega el resumen, las tarjetas y las gráficas no muestran cifras
    Dado que en el tenant alumno01, recién reiniciado, la respuesta de GET /api/mission/summary llega <retraso> después de la petición
    Y gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01
    Cuando abre /mission
    Entonces las cuatro tarjetas no muestran ninguna cifra y el bloque de tarjetas está en carga
    Y las gráficas muestran un marcador de carga y ninguna barra
    Y cuando llega la respuesta, «Programas activos» muestra 12 y «NC abiertas» muestra 8

    Ejemplos:
      | retraso |
      | 3 segundos |
      | 6 segundos |

  Esquema del escenario: Una gráfica sin datos dice que todavía no hay datos
    Dado que en el tenant alumno01, recién reiniciado, <cambio>
    Y gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01
    Cuando abre /mission y la página ha terminado de cargar
    Entonces la gráfica <grafica> muestra «Sin datos todavía» y no dibuja ninguna barra ni ninguna columna

    Ejemplos:
      | cambio | grafica |
      | alumno01@sigpro.lab archiva los 12 programas activos con POST /api/programs/:code/archive | «Hitos cumplidos por programa» |
      | alumno01@sigpro.lab elimina los 24 programas con DELETE /api/programs/:code | «Hitos cumplidos por programa» |
      | alumno01@sigpro.lab elimina los 24 programas con DELETE /api/programs/:code | «NC abiertas por severidad» |

  Esquema del escenario: Si el resumen falla, el panel dice qué ha pasado y ofrece reintentar
    Dado que en el tenant alumno01, recién reiniciado, la petición de GET /api/mission/summary <fallo>
    Y gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01
    Cuando abre /mission
    Entonces ve el aviso «No se pudo cargar el panel de misión» y debajo <detalle>
    Y ve el botón «Reintentar»

    Ejemplos:
      | fallo | detalle |
      | responde con error 503 | la traza de la respuesta, que empieza por «GET /api/mission/summary → 503» |
      | no recibe ninguna respuesta (sin conexión) | el texto «No se pudo contactar con el servidor» |

  Esquema del escenario: Reintentar vuelve a pedir el resumen
    Dado que en el tenant alumno01, recién reiniciado, la petición de GET /api/mission/summary ha fallado con error 503 al abrir /mission con gestor@sigpro.test
    Y la siguiente petición de GET /api/mission/summary responde con normalidad
    Cuando pulsa «Reintentar»
    Entonces desaparece el aviso «No se pudo cargar el panel de misión»
    Y «Programas activos» muestra <cifra>

    Ejemplos:
      | cifra |
      | 12 |
```

## Decisiones pendientes
- Qué muestran las cuatro tarjetas y las gráficas mientras el resumen no se ha podido cargar. Hoy las tarjetas muestran 0, 0 % y «de 0 programas» como si el tenant estuviera vacío, y las gráficas no aparecen. Ninguna fila afirma lo que se ve en ese estado.
- Qué debe mostrarse cuando una recarga falla después de haber mostrado cifras. Hoy el aviso de error sustituye a las cifras anteriores.

## Fuera de alcance
- La conexión en tiempo real y el indicador de conexión del panel: EP-MISION-FEED.
- La forma de las gráficas con datos y la vista de tabla: US-MISION-KPI-007, de esta misma épica.
- El aviso de error de la lista de programas y su botón de reintentar: EP-PROG-LISTA.
