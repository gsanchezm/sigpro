---
id: US-NC-TABLERO-006
tipo: historia
epica: EP-NC-TABLERO
titulo: "[Web] Ver el tablero de no conformidades por estado, con sus tarjetas, sus avisos y la vista de pestañas"
etiquetas: [web]
relacionadas: [US-NC-TABLERO-001, US-NC-TABLERO-007, US-NC-TABLERO-008, US-NC-TABLERO-009, US-NC-TABLERO-010]
verificacion: ejecutada
cubre: ["/nc"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero ver en /nc las no conformidades de mi tenant repartidas en columnas por estado, con cuántas hay en cada una y con su severidad,
para saber de un vistazo qué está abierto, qué está en análisis y qué se ha cerrado o rechazado.

## Reglas
- Con 1024 px o más de ancho, el tablero muestra cinco columnas de izquierda a derecha: «Abierta», «En análisis», «Acción correctiva», «Cerrada» y «Rechazada». Cada columna tiene su título y, junto a él, el número de tarjetas que contiene.
- Cada tarjeta muestra su código, que al pulsarlo abre el detalle de la no conformidad; su severidad escrita con su nombre («Menor», «Mayor» o «Crítica»); el código de su programa; su contador de comentarios, que dice «1 comentario» si hay uno y «N comentarios» en cualquier otro caso, también con cero; y su responsable, o «Sin asignar» si no tiene.
- Encima del tablero, un recuento general dice cuántas no conformidades hay y cuántas están abiertas, en la forma «N no conformidades · M abiertas». Una no conformidad está abierta mientras no está cerrada ni rechazada.
- Mientras llega la lista, el tablero está ocupado, con indicador de carga, y no muestra tarjetas.
- Si la lista no llega, el tablero muestra el aviso «No se pudo cargar el tablero» con el botón «Reintentar», sin tarjetas. «Reintentar» vuelve a pedir la lista; si llega bien, el tablero aparece con sus tarjetas y el aviso desaparece.
- Con menos de 1024 px de ancho, el tablero muestra una pestaña por estado, con su nombre y su contador, dentro del grupo «Estados del tablero». Al abrir /nc está elegida la pestaña «Abierta», y el panel muestra solo las tarjetas del estado elegido. Las flechas ← y → del teclado llevan a la pestaña anterior o a la siguiente.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga. Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, la cuenta de la fila inicia sesión con su contraseña y se abre /nc. Las cuentas son `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y `alumno01@sigpro.lab` (`Alumno1234!`).
- Para los fallos, la prueba hace que la primera petición de `GET /api/nc` responda con el código HTTP de la fila; las siguientes llegan al servidor.

## Criterios de aceptación
```gherkin
Característica: Tablero de no conformidades en la web

  Esquema del escenario: Cada columna lleva su título y el número de tarjetas de su estado
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre /nc con la ventana de 1440 px de ancho
    Entonces la columna «<titulo>» muestra el contador <contador>
    Y sus tarjetas son <codigos>

    Ejemplos:
      | titulo | contador | codigos |
      | Abierta | 4 | NC-001, NC-006, NC-007 y NC-012 |
      | En análisis | 2 | NC-002 y NC-008 |
      | Acción correctiva | 2 | NC-003 y NC-009 |
      | Cerrada | 2 | NC-004 y NC-010 |
      | Rechazada | 2 | NC-005 y NC-011 |

  Esquema del escenario: Cada tarjeta muestra su severidad como texto, su programa, sus comentarios y su responsable
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre /nc con la ventana de 1440 px de ancho
    Entonces la tarjeta <codigo> muestra la severidad <severidad>, el programa <programa>, el contador de comentarios <comentarios> y el responsable <responsable>

    Ejemplos:
      | codigo | severidad | programa | comentarios | responsable |
      | NC-001 | «Menor» | PRG-001 | «1 comentario» | Javier Ortega |
      | NC-003 | «Crítica» | PRG-001 | «3 comentarios» | Andrés Molina |
      | NC-005 | «Mayor» | PRG-002 | «1 comentario» | «Sin asignar» |

  Esquema del escenario: El recuento general dice cuántas no conformidades hay y cuántas están abiertas
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre /nc
    Entonces el recuento general dice <recuento>

    Ejemplos:
      | recuento |
      | «12 no conformidades · 8 abiertas» |

  Esquema del escenario: Mientras llega la lista el tablero está ocupado y sin tarjetas
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la prueba retrasa <espera> la respuesta de GET /api/nc
    Cuando abre /nc
    Entonces mientras espera, el tablero está ocupado, con indicador de carga y sin tarjetas
    Y al llegar la respuesta ve las cinco columnas con sus 12 tarjetas

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Un fallo de la lista muestra el aviso con su botón de reintento
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la prueba hace que la primera petición de GET /api/nc responda <codigo_http>
    Cuando abre /nc
    Entonces ve el aviso «No se pudo cargar el tablero» con el botón «Reintentar» y no ve ninguna tarjeta
    Y al pulsar «Reintentar» ve las cinco columnas con sus 12 tarjetas

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |

  Esquema del escenario: Con menos de 1024 px de ancho el tablero muestra una pestaña por estado
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la ventana mide 390 px de ancho
    Cuando abre /nc y elige la pestaña «<pestaña>»
    Entonces la pestaña «<pestaña>» muestra el contador <contador> y el panel muestra las tarjetas <codigos>

    Ejemplos:
      | pestaña | contador | codigos |
      | Abierta | 4 | NC-001, NC-006, NC-007 y NC-012 |
      | Cerrada | 2 | NC-004 y NC-010 |
```

## Decisiones pendientes
- Ninguna.

## Fuera de alcance
- Filtrar el tablero por texto, programa, severidad o responsable: US-NC-TABLERO-007.
- Cambiar el estado de una no conformidad desde el tablero: US-NC-TABLERO-008. Desde su detalle: US-NC-TABLERO-009.
- La alta, la edición, la asignación, los comentarios y el comentario rápido de una no conformidad: EP-NC-GESTION.
- El KPI «NC abiertas» del panel de misión, que se actualiza en vivo: EP-MISION-FEED.
