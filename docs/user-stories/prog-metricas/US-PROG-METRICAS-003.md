---
id: US-PROG-METRICAS-003
tipo: historia
epica: EP-PROG-METRICAS
titulo: "[Web] Carga, error, vacío y actualización de las cifras de programas"
etiquetas: [web]
relacionadas: [US-PROG-METRICAS-001, US-PROG-METRICAS-002, US-PROG-METRICAS-005]
verificacion: codigo
cubre: ["/programs"]
---

## Historia
Como gestor de programas que abre la lista en la web, quiero que las tarjetas muestren con claridad cuándo se están cargando, cuándo no se han podido cargar y cuándo no hay programas, y que se pongan al día cuando cambio un programa,
para no tomar decisiones con cifras antiguas ni con cifras que no existen.

## Reglas
- Mientras llega la respuesta del resumen, cada tarjeta muestra «…» en su cifra y en su línea auxiliar, y el bloque de las cuatro tarjetas está en estado de carga.
- Si el resumen no se puede cargar y todavía no hay cifras que mostrar, cada tarjeta muestra «—» en su cifra y en su línea auxiliar. No aparece ningún aviso emergente por las cifras, y la lista de programas sigue funcionando debajo. Las tarjetas no tienen botón de reintentar: se vuelven a calcular al abrir de nuevo la lista o al cambiar un programa desde la lista.
- Las cifras se vuelven a pedir y se recalculan después de duplicar, archivar o eliminar un programa desde su menú de acciones de la lista.
- Sin programas en el tenant, las cuatro tarjetas muestran 0: «Programas» con «activos: 0», «Activos» con «0 % del total», «Avance medio» con «0 %» y la barra vacía, con «0 de 0 hitos cumplidos», y «NC abiertas» con «de 0 registradas».
- Los programas archivados (estado cerrado) siguen contando como programas del tenant y no como activos. Archivar todos los activos deja «Activos» en 0 sin cambiar el número de programas.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Los estados que se fabrican con la API se preparan después del reinicio, con el token de `alumno01@sigpro.lab`. Después se abre `/login?tenant=alumno01` en un navegador sin sesión y se inicia sesión con la cuenta de la fila. Las demoras y los fallos de la petición del resumen los provoca la prueba, no el caos del tenant: antes de cada fila, el caos del tenant debe estar apagado.
- Con el reinicio, el tenant `alumno01` tiene 24 programas (`PRG-001` a `PRG-024`), 12 de ellos en estado Activo, 175 hitos de los que 86 están cumplidos, y 12 no conformidades de las que 8 están abiertas.

## Criterios de aceptación
```gherkin
Característica: Carga, error, vacío y actualización de las tarjetas de programas en la web

  Esquema del escenario: Mientras el resumen no llega, las tarjetas muestran puntos suspensivos
    Dado que en el tenant alumno01, recién reiniciado, la respuesta de GET /api/mission/summary llega <retraso> después de la petición
    Y gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01
    Cuando abre /programs
    Entonces las cuatro tarjetas muestran «…» en la cifra y en la línea auxiliar, y el bloque de tarjetas está en estado de carga
    Y cuando llega la respuesta, las tarjetas muestran 24, 12, 49 % y 8

    Ejemplos:
      | retraso |
      | 3 segundos |
      | 8 segundos |

  Esquema del escenario: Si el resumen falla, las cuatro tarjetas muestran un guion largo
    Dado que en el tenant alumno01, recién reiniciado, GET /api/mission/summary <fallo>
    Y gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01
    Cuando abre /programs
    Entonces las cuatro tarjetas muestran «—» en la cifra y en la línea auxiliar
    Y no aparece ningún aviso emergente de error por las cifras
    Y la lista de programas sigue visible

    Ejemplos:
      | fallo |
      | responde con error 503 |
      | no recibe ninguna respuesta (sin conexión) |

  Esquema del escenario: Sin programas activos o sin programas, las tarjetas reflejan el tenant
    Dado que en el tenant alumno01, recién reiniciado, <cambio>
    Y gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01
    Cuando abre /programs y la lista ha terminado de cargar
    Entonces la tarjeta <tarjeta> muestra <cifra> y debajo la línea <linea>

    Ejemplos:
      | cambio | tarjeta | cifra | linea |
      | alumno01@sigpro.lab elimina los 24 programas con DELETE /api/programs/:code | «Programas» | 0 | «activos: 0» |
      | alumno01@sigpro.lab elimina los 24 programas con DELETE /api/programs/:code | «Activos» | 0 | «0 % del total» |
      | alumno01@sigpro.lab elimina los 24 programas con DELETE /api/programs/:code | «Avance medio» | 0 % | «0 de 0 hitos cumplidos» |
      | alumno01@sigpro.lab elimina los 24 programas con DELETE /api/programs/:code | «NC abiertas» | 0 | «de 0 registradas» |
      | alumno01@sigpro.lab archiva los 12 programas activos con POST /api/programs/:code/archive | «Programas» | 24 | «activos: 0» |
      | alumno01@sigpro.lab archiva los 12 programas activos con POST /api/programs/:code/archive | «Activos» | 0 | «0 % del total» |
      | alumno01@sigpro.lab archiva los 12 programas activos con POST /api/programs/:code/archive | «Avance medio» | 49 % | «86 de 175 hitos cumplidos» |
      | alumno01@sigpro.lab archiva los 12 programas activos con POST /api/programs/:code/archive | «NC abiertas» | 8 | «de 12 registradas» |

  Esquema del escenario: Las tarjetas se recalculan sin recargar la página tras un cambio desde la lista
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la web con el tenant alumno01 y tiene abierta la lista de programas
    Cuando <operacion>
    Entonces, sin recargar la página, la tarjeta «Programas» muestra <programas>, la tarjeta «Activos» muestra <activos> y la tarjeta «Avance medio» muestra <avance>

    Ejemplos:
      | operacion | programas | activos | avance |
      | duplica PRG-001 con «Duplicar» en el menú de acciones de su fila | 25 | 12 | 47 % |
      | archiva PRG-001 con «Archivar» en el menú de acciones de su fila | 24 | 11 | 49 % |
      | elimina PRG-001 con «Eliminar» en el menú de acciones de su fila y confirma con «Eliminar» | 23 | 11 | 51 % |
```

## Fuera de alcance
- El aviso de error de la lista de programas y su botón de reintentar: EP-PROG-LISTA.
- El alta y la edición de un programa, que también recalculan las cifras: EP-PROG-ALTA. Archivar, duplicar y eliminar en sí, con sus confirmaciones y avisos: EP-PROG-GESTION.
- Las no conformidades que llegan en vivo y la eliminación de un programa con NC abiertas: esta misma épica, en otra historia.
- El detalle de un programa: EP-PROG-DETALLE.

## Decisiones pendientes
- Si una recarga fallida, después de haber mostrado cifras, debe mostrar «—» o conservar la última cifra que se vio. Hoy conserva la última cifra.
- Qué debe mostrar el subtítulo de la cabecera cuando falla la lista de programas. Hoy muestra «0 programas · 0 activo», aunque el tenant tenga programas.
