---
id: US-MISION-FEED-007
tipo: historia
epica: EP-MISION-FEED
titulo: "[Web] Actualizar en vivo «NC abiertas», su gráfica por severidad y «Hitos cumplidos» sin recargar"
etiquetas: [web]
relacionadas: [US-MISION-FEED-003, US-MISION-FEED-006, US-MISION-FEED-008, US-PROG-METRICAS-004, US-HITOS-004]
verificacion: ejecutada
cubre: ["/mission"]
---

## Historia
Como gestor de programas que tiene el panel de misión abierto, quiero que las cifras de no conformidades abiertas y de hitos cumplidos cambien cuando cambian en mi tenant,
para ver la situación real sin recargar la página ni salir de ella.

## Reglas
- «NC abiertas» muestra el número de no conformidades abiertas del tenant. Al abrir la página es la cifra de la carga inicial (8 tras un reinicio). Desde entonces, cada evento de no conformidades la sustituye por la cifra que trae ese evento, sin recargar la página.
- Son no conformidades abiertas las que no están «Cerrada» ni «Rechazada». «Abierta», «En análisis» y «Acción correctiva» cuentan como abiertas.
- La gráfica «NC abiertas por severidad» muestra las abiertas de cada gravedad, con los nombres «Menor», «Mayor» y «Crítica». Se actualiza con los mismos eventos, y su vista de tabla muestra las mismas cifras.
- «Hitos cumplidos» muestra el porcentaje de hitos cumplidos y, debajo, «N de M hitos»: los hitos cumplidos de todos los programas sobre el total de hitos. La gráfica «Hitos cumplidos por programa» muestra, para cada programa, los hitos cumplidos y el total.
- En los criterios, N y M son las cifras que muestra la página justo antes del cambio: los hitos cumplidos y el total.
- Cuando un hito pasa a cumplido (avance del 100 %), la cifra y la gráfica se actualizan solas, sin recargar la página, y el evento del hito aparece en el feed.
- Un hito que se queda por debajo del 100 % no cambia ninguna de esas cifras ni llega al feed.
- Cuando se elimina un programa, «NC abiertas» baja sin recargar la página a las no conformidades abiertas que quedan en el tenant.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y antes de la fila se comprueba que el caos del tenant está apagado. Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se inicia sesión con `gestor@sigpro.test` (`Gestor1234!`) y se abre `/mission`. Los cambios se hacen con el token de `alumno01@sigpro.lab`. Las no conformidades del seed son `NC-001` a `NC-012`: 8 están abiertas (`NC-001`, `NC-002`, `NC-003`, `NC-006`, `NC-007`, `NC-008`, `NC-009` y `NC-012`) y por gravedad son 2 menores, 2 mayores y 4 críticas. La API se arranca con `SIMULATOR_MS=0`.

## Criterios de aceptación
```gherkin
Característica: Cifras en vivo del panel de misión en la web

  Esquema del escenario: Cada cambio de no conformidades actualiza «NC abiertas» sin recargar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto y «NC abiertas» muestra 8
    Cuando <cambio>
    Entonces «NC abiertas» muestra <cifra>

    Ejemplos:
      | cambio | cifra |
      | alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución` | 9 |
      | alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad major y la descripción `Desviación de prueba en la ejecución` | 9 |
      | alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad critical y la descripción `Desviación de prueba en la ejecución` | 9 |
      | alumno01@sigpro.lab pasa NC-001 a in_analysis con POST /api/nc/NC-001/transition | 8 |
      | alumno01@sigpro.lab pasa NC-002 a rejected con POST /api/nc/NC-002/transition | 7 |
      | alumno01@sigpro.lab cierra NC-003 con POST /api/nc/NC-003/transition, to closed y el comentario `Acción correctiva verificada por calidad` | 7 |
      | alumno01@sigpro.lab pide pasar NC-001 a rejected desde open con POST /api/nc/NC-001/transition, que la API rechaza | 8 |
      | alumno01@sigpro.lab cambia la gravedad de NC-001 a critical con PATCH /api/nc/NC-001 | 8 |
      | alumno01@sigpro.lab añade a NC-006 el comentario `Seguimiento de prueba` con POST /api/nc/NC-006/comments | 8 |

  Esquema del escenario: La gráfica de NC abiertas por severidad sigue a los cambios de gravedad y de alta
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto y ha pasado la gráfica «NC abiertas por severidad» a su vista de tabla
    Cuando <cambio>
    Entonces la tabla muestra «Menor» <menor>, «Mayor» <mayor> y «Crítica» <critica>

    Ejemplos:
      | cambio | menor | mayor | critica |
      | no se hace ningún cambio | 2 | 2 | 4 |
      | alumno01@sigpro.lab cambia la gravedad de NC-001 a critical con PATCH /api/nc/NC-001 | 1 | 2 | 5 |
      | alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad major y la descripción `Desviación de prueba en la ejecución` | 2 | 3 | 4 |

  Esquema del escenario: Un hito que pasa a cumplido actualiza «Hitos cumplidos» y su gráfica sin recargar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto y «Hitos cumplidos» muestra N de M hitos
    Cuando alumno01@sigpro.lab registra con PATCH /api/milestones/PRG-001-M02 un avance de <avance>
    Entonces «Hitos cumplidos» <efecto>
    Y <feed>

    Ejemplos:
      | avance | efecto | feed |
      | 99 | sigue en N de M hitos y la gráfica de PRG-001 no cambia | no aparece ningún evento de hito |
      | 100 | pasa a N+1 de M hitos y la gráfica de PRG-001 sube en 1 | aparece el texto «Hito «PDR» de PRG-001 cumplido» |

  Esquema del escenario: Eliminar un programa baja «NC abiertas» a las que quedan en el tenant
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto y «NC abiertas» muestra 8
    Cuando alumno01@sigpro.lab elimina <programa>
    Entonces «NC abiertas» muestra <nc_abiertas> sin recargar la página

    Ejemplos:
      | programa | nc_abiertas |
      | PRG-001 con DELETE /api/programs/PRG-001 | 5 |
      | PRG-003 con DELETE /api/programs/PRG-003 | 6 |
```

## Fuera de alcance
- La cifra «NC abiertas» de la lista de programas, sus tarjetas y su actualización en esa lista: EP-PROG-METRICAS (US-PROG-METRICAS-004).
- Los indicadores estáticos del panel, su aviso de error y el resumen `GET /api/mission/summary`: EP-MISION-KPI.
- Los hitos en sí (alta, edición, avance y borrado): EP-HITOS. La eliminación de un programa en sí: EP-PROG-GESTION.
- La insignia «NC» del menú lateral: EP-NAVEGACION.
- La forma de los eventos de no conformidades: US-MISION-FEED-003. La lista de eventos: US-MISION-FEED-006.

## Decisiones pendientes
- Si la línea «de N no conformidades» del KPI debe ponerse al día cuando se crea una no conformidad. Hoy la web muestra en esa línea el total de la carga inicial de la página, y no se decide si debe cambiar en vivo.
