---
id: US-PROG-LISTA-010
tipo: historia
epica: EP-PROG-LISTA
titulo: "[Móvil] Ver los estados de carga, vacío y error de la lista de programas"
etiquetas: [movil]
relacionadas: [US-PROG-LISTA-007, US-PROG-LISTA-008, US-LOGIN-012]
verificacion: ejecutada
cubre: ["/programs"]
---

## Historia
Como persona que usa la app móvil, quiero saber si la lista de programas está cargando, si no tiene programas que mostrar o si no se ha podido cargar,
para entender el estado de la lista y poder volver a pedirla sin salir de la pantalla.

## Reglas
- Mientras llega la primera respuesta se ve «Cargando…» con un indicador de actividad, y ninguna tarjeta.
- Si la consulta no tiene programas, aparece el título «Sin programas». Con filtros aplicados, el mensaje es «Ningún programa coincide con los filtros aplicados.» y se ofrece el botón «Limpiar filtros». Sin filtros aplicados, el mensaje es «Todavía no hay programas registrados.».
- Si falla la primera carga, aparece el aviso «No se pudieron cargar los programas» con el botón «Reintentar», y ninguna tarjeta. «Reintentar» vuelve a pedir la lista.
- Si falla la página siguiente pedida con «Cargar más», se conservan las tarjetas ya vistas y aparece el aviso «No se pudieron cargar los programas» con el botón «Reintentar». Mientras ese aviso está, «Cargar más» no aparece. «Reintentar» vuelve a pedir esa página y añade sus programas.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada en el dispositivo, con `alumno01` en «Tenant de trabajo», y `gestor@sigpro.test` inicia sesión con `Gestor1234!` y llega a `/programs`. Las demoras y los errores de cada fila los provoca la prueba antes de abrir la lista.

## Criterios de aceptación
```gherkin
Característica: Estados de la lista de programas en la app móvil

  Esquema del escenario: Mientras llega la respuesta se ve «Cargando…» y después los programas
    Dado que en el tenant alumno01, recién reiniciado, la prueba retrasa <espera> la respuesta de GET /api/programs en la app de gestor@sigpro.test
    Cuando abre /programs
    Entonces ve «Cargando…» y ninguna tarjeta, y al llegar la respuesta ve los programas PRG-001 a PRG-010 con el recuento «1–10 de 24»

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Un filtro sin coincidencias muestra el bloque vacío con la opción de limpiar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs en la app sin filtros
    Cuando <filtro>
    Entonces ve el título «Sin programas», el mensaje «Ningún programa coincide con los filtros aplicados.» y el botón «Limpiar filtros»

    Ejemplos:
      | filtro |
      | escribe zzzz-no-existe en «Buscar programas» |
      | elige «Cancelado» en el grupo «Estado» y escribe radar en «Buscar programas» |

  Esquema del escenario: Un fallo de la primera carga muestra el aviso con reintento
    Dado que en el tenant alumno01, recién reiniciado, la primera respuesta de GET /api/programs es <respuesta_fallida> y las siguientes son correctas en la app de gestor@sigpro.test
    Cuando abre /programs
    Entonces ve el aviso «No se pudieron cargar los programas» con el botón «Reintentar» y ninguna tarjeta
    Y al pulsar «Reintentar» ve los programas PRG-001 a PRG-010 con el recuento «1–10 de 24»

    Ejemplos:
      | respuesta_fallida |
      | un error 500 |

  Esquema del escenario: Un fallo al pedir más programas conserva los vistos y ofrece reintentar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs en la app y la página siguiente de GET /api/programs responde <respuesta_fallida> la primera vez
    Cuando pulsa «Cargar más»
    Entonces siguen viéndose los programas PRG-001 a PRG-010, aparece el aviso «No se pudieron cargar los programas» con el botón «Reintentar» y «Cargar más» no aparece
    Y al pulsar «Reintentar» ve los programas PRG-001 a PRG-020 con el recuento «1–20 de 24»

    Ejemplos:
      | respuesta_fallida |
      | un error 500 |
```

## Decisiones pendientes
- La línea de detalle técnico que la lista muestra bajo el aviso de error (la traza de la petición fallida). Hoy la muestra; no está decidido si forma parte del producto ni qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.

## Fuera de alcance
- Los estados de la tabla y de las tarjetas del diseño responsive de la web: EP-PROG-LISTA, en la historia de estados de la web.
- Los avisos generales de la aplicación, como los de falta de conexión: épica transversal de avisos (EP-TOASTS).
- El inicio de sesión que lleva a la lista: EP-LOGIN.
