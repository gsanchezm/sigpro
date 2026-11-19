---
id: US-VER-CASOS-004
tipo: historia
epica: EP-VER-CASOS
titulo: "[Web] Ver la tabla de casos de prueba y sus estados de carga, vacío y error"
etiquetas: [web]
relacionadas: [US-LOGIN-007, US-VER-CASOS-001, US-VER-CASOS-005, US-VER-CASOS-007]
verificacion: ejecutada
cubre: ["/verification"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero ver en /verification todos los casos de prueba con su último resultado y su número de ejecuciones, y un aviso claro si la lista no carga,
para saber de un vistazo qué casos superan, cuáles fallan y cuáles no se han ejecutado nunca.

## Reglas
- El escritorio es un ancho de ventana de 1024 px o más. Por debajo, la pantalla usa el diseño responsive.
- En escritorio, la lista es una tabla con las columnas «Código», «Título», «Programa», «Último resultado» y «Ejecuciones», en ese orden, y una columna de acciones con el botón de menú de cada fila. La columna de casillas para el informe se describe en EP-VER-INFORME.
- Por debajo de 1024 px, cada caso es una tarjeta con su código, su último resultado, su título, su programa y su número de ejecuciones, como «2 ejecuciones».
- El código de cada caso es un enlace a su detalle, /verification/<código>.
- El último resultado se muestra con su etiqueta: «Superado», «Fallido» o «Bloqueado», o «Sin ejecutar» si el caso nunca se ha ejecutado.
- Encima de la lista aparece el título «Verificación» en escritorio y, debajo, el resumen de la lista filtrada: sin filtros, «25 casos de prueba · 50 ejecuciones». Mientras no hay datos, el resumen muestra «…».
- Sin filtros, la lista se ordena por código ascendente y cada página trae 10 casos.
- Mientras llega la primera respuesta no se muestran casos antiguos: aparecen filas de carga.
- Si la lista no llega, aparece el aviso «No se pudieron cargar los casos de prueba» con la traza de la petición fallida o, si no hubo respuesta del servidor, con el texto «No se pudo contactar con el servidor»; y el botón «Reintentar». «Reintentar» vuelve a pedir la lista y, si llega, sustituye el aviso por la lista.
- Si el tenant no tiene casos, la pantalla muestra «Sin casos de prueba» y «Todavía no hay casos de prueba.».
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe `gestor@sigpro.test` con `Gestor1234!`, se pulsa «Entrar» y se llega a /programs.

## Criterios de aceptación
```gherkin
Característica: Tabla de casos de prueba en la web

  Esquema del escenario: La lista se presenta como tabla en escritorio y como tarjetas por debajo de 1024 px
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con una ventana de <ancho> px de ancho
    Cuando abre /verification
    Entonces ve <presentacion> con 10 casos en la primera página

    Ejemplos:
      | ancho | presentacion |
      | 1440 | una tabla con las columnas «Código», «Título», «Programa», «Último resultado» y «Ejecuciones» |
      | 1024 | una tabla con las columnas «Código», «Título», «Programa», «Último resultado» y «Ejecuciones» |
      | 1023 | tarjetas, una por caso, con su código, su resultado, su título, su programa y su número de ejecuciones |
      | 390 | tarjetas, una por caso, con su código, su resultado, su título, su programa y su número de ejecuciones |

  Esquema del escenario: Cada caso muestra su programa, su título, su último resultado y sus ejecuciones
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification
    Cuando mira en la lista el caso <codigo>
    Entonces ve el programa <programa>, el título <titulo>, el último resultado <resultado> y <ejecuciones> ejecuciones

    Ejemplos:
      | codigo | programa | titulo | resultado | ejecuciones |
      | TC-001 | PRG-001 | Verificar disponibilidad (caso 001) | «Bloqueado» | 2 |
      | TC-002 | PRG-001 | Verificar latencia (caso 002) | «Fallido» | 3 |
      | TC-004 | PRG-001 | Verificar trazabilidad (caso 004) | «Superado» | 2 |

  Esquema del escenario: El resumen y el recuento describen la lista completa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification
    Cuando la lista carga sin filtros
    Entonces ve el resumen <resumen> y el recuento <recuento>

    Ejemplos:
      | resumen | recuento |
      | «25 casos de prueba · 50 ejecuciones» | «1–10 de 25» |

  Esquema del escenario: Mientras llega la lista se ven filas de carga y después los casos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la prueba retrasa <espera> la respuesta de GET /api/test-cases
    Cuando abre /verification
    Entonces mientras espera ve filas de carga y ningún caso
    Y al llegar la respuesta ve 10 casos, empezando por TC-001

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Si la lista no llega, el aviso dice qué ha pasado y ofrece volver a pedirla
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y <fallo>
    Cuando abre /verification
    Entonces ve el aviso «No se pudieron cargar los casos de prueba», con <detalle>, y el botón «Reintentar»
    Y no ve ningún caso

    Ejemplos:
      | fallo | detalle |
      | la prueba hace que GET /api/test-cases responda con error 500 | la traza de la petición fallida |
      | la prueba corta GET /api/test-cases sin respuesta del servidor | el texto «No se pudo contactar con el servidor» |

  Esquema del escenario: «Reintentar» vuelve a pedir la lista y la muestra cuando llega
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, la prueba hace que la primera petición de GET /api/test-cases responda con error 500 y en /verification ve el aviso de error
    Cuando pulsa «Reintentar»
    Entonces deja de ver el aviso de error y ve 10 casos, empezando por <primero>

    Ejemplos:
      | primero |
      | TC-001 |
```

## Fuera de alcance
- Los controles de búsqueda, filtros, orden y paginación: la historia de la web de búsqueda, filtros, orden y paginación de EP-VER-CASOS.
- La selección de casos, su barra de acciones y el informe PDF, con su botón de cabecera y su opción de menú: EP-VER-INFORME.
- La opción «Registrar ejecución» del menú de cada fila: EP-VER-EJECUCION.
- El detalle de un caso: la historia de detalle web de EP-VER-CASOS.

## Decisiones pendientes
- Cómo se escribe una ejecución única: hoy el contador de la tarjeta y el resumen dicen «1 ejecuciones» y «1 casos de prueba» con uno solo. Queda por decidir si se usa el singular.
