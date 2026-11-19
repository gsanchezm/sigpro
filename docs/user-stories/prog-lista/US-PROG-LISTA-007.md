---
id: US-PROG-LISTA-007
tipo: historia
epica: EP-PROG-LISTA
titulo: "[Web] Ver los estados de carga, vacío y error de la lista de programas"
etiquetas: [web]
relacionadas: [US-PROG-LISTA-001, US-PROG-LISTA-005, US-PROG-LISTA-010]
verificacion: ejecutada
cubre: ["/programs"]
---

## Historia
Como responsable de programas, quiero saber si la lista está cargando, si no tiene programas que mostrar o si no se ha podido cargar,
para entender en qué estado está la lista y qué puedo hacer en cada caso.

## Reglas
- Mientras llega la primera respuesta, la tabla (o la lista de tarjetas del diseño responsive) muestra filas de carga en lugar de programas, y la tabla queda marcada como ocupada.
- Al cambiar un filtro, un orden o una página, se siguen viendo los datos anteriores hasta que llegan los nuevos, y la tabla queda marcada como ocupada mientras tanto.
- Si la consulta no tiene programas, aparece el bloque «Sin programas». Con filtros aplicados, el mensaje es «Ningún programa coincide con los filtros aplicados.» y se ofrece el botón «Limpiar filtros». Sin filtros aplicados, el mensaje es «Todavía no hay programas registrados.».
- Si la petición falla, aparece el aviso «No se pudieron cargar los programas» con el botón «Reintentar». Ningún programa se muestra en ese caso.
- «Reintentar» vuelve a pedir la lista y muestra el aviso «Datos recargados». Si la respuesta llega bien, la lista muestra sus programas.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe `gestor@sigpro.test` con `Gestor1234!` y se llega a `/programs`. Las demoras y los errores que se describen en cada fila los provoca la prueba antes de abrir la lista.

## Criterios de aceptación
```gherkin
Característica: Estados de la lista de programas en la web

  Esquema del escenario: Mientras llega la respuesta se ven filas de carga y después los programas
    Dado que en el tenant alumno01, recién reiniciado, la prueba retrasa 3 segundos la respuesta de GET /api/programs en el navegador de gestor@sigpro.test en un diseño <diseno>
    Cuando abre /programs
    Entonces ve <carga> mientras espera y, al llegar la respuesta, los programas PRG-001 a PRG-010

    Ejemplos:
      | diseno | carga |
      | escritorio | filas de carga y la tabla marcada como ocupada |

  Esquema del escenario: Un filtro sin coincidencias muestra el bloque vacío con la opción de limpiar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en un diseño <diseno>
    Cuando escribe zzzz-no-existe en el buscador de la lista
    Entonces ve el título «Sin programas», el mensaje «Ningún programa coincide con los filtros aplicados.» y el botón «Limpiar filtros»

    Ejemplos:
      | diseno |
      | escritorio |
      | responsive |

  Esquema del escenario: Un fallo de la petición muestra el aviso de error con reintento
    Dado que en el tenant alumno01, recién reiniciado, la prueba responde con error 500 a GET /api/programs en el navegador de gestor@sigpro.test
    Cuando abre /programs en un diseño <diseno>
    Entonces ve el aviso «No se pudieron cargar los programas» con el botón «Reintentar» y ningún programa

    Ejemplos:
      | diseno |
      | escritorio |

  Esquema del escenario: «Reintentar» recupera la lista cuando la petición vuelve a funcionar
    Dado que en el tenant alumno01, recién reiniciado, la primera petición de GET /api/programs responde con error 500 en el navegador de gestor@sigpro.test y las siguientes responden bien
    Cuando abre /programs en un diseño <diseno> y después pulsa «Reintentar»
    Entonces ve el aviso «Datos recargados» y los programas PRG-001 a PRG-010 con el recuento «1–10 de 24»

    Ejemplos:
      | diseno |
      | escritorio |
```

## Decisiones pendientes
- La línea de detalle técnico que la lista muestra bajo el aviso de error (la traza de la petición fallida). Hoy la muestra; no está decidido si forma parte del producto ni qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.

## Fuera de alcance
- Los avisos generales de la aplicación, como los de falta de conexión: épica transversal de avisos (EP-TOASTS).
- El inicio de sesión que lleva a la lista: EP-LOGIN.
- Las tarjetas de métricas de la cabecera, que tienen sus propios estados de carga: EP-PROG-METRICAS.
