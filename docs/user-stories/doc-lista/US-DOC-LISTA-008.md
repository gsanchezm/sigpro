---
id: US-DOC-LISTA-008
tipo: historia
epica: EP-DOC-LISTA
titulo: "[Web] Ver los estados de carga, vacío y error de la lista de documentos"
etiquetas: [web]
relacionadas: [US-DOC-LISTA-006, US-DOC-LISTA-007, US-DOC-LISTA-011]
verificacion: ejecutada
cubre: ["/documents"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero saber si la lista de documentos está cargando, si no tiene documentos que mostrar o si no se ha podido cargar,
para entender en qué estado está la lista y qué puedo hacer en cada caso.

## Reglas
- Mientras llega la primera respuesta, la tabla (o las tarjetas, en el diseño responsive) muestra filas de carga en lugar de documentos, y queda marcada como ocupada.
- Al cambiar un filtro o el texto del buscador, la lista queda marcada como ocupada mientras llega la respuesta nueva, y al llegar muestra solo los documentos que cumplen los filtros nuevos. Ningún documento de la lista anterior queda en la lista nueva.
- Si los filtros no dejan ningún documento, aparece el bloque «Sin documentos» con el mensaje «Ningún documento coincide con los filtros aplicados.» y el botón «Limpiar filtros».
- Si el tenant no tiene ningún documento y no hay filtros puestos, aparece el bloque «Sin documentos» con el mensaje «Todavía no hay documentos.». El seed siempre tiene documentos, así que ningún ejemplo de esta historia llega a ese caso.
- Si la petición falla, aparece el aviso «No se pudieron cargar los documentos» con la traza de la petición y el botón «Reintentar». Ningún documento se muestra en ese caso.
- «Reintentar» vuelve a pedir la lista. Si la respuesta llega bien, la lista muestra sus documentos con el recuento y el aviso de error desaparece.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada; `gestor@sigpro.test` (contraseña `Gestor1234!`) entra y llega a `/programs`. Las demoras y los errores de cada fila los provoca la prueba en ese navegador antes de abrir `/documents`, y siempre después de que la sesión esté iniciada.

## Criterios de aceptación
```gherkin
Característica: Estados de la lista de documentos en la web

  Esquema del escenario: Mientras llega la respuesta se ven filas de carga y después los documentos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la web y la prueba retrasa <espera> la respuesta de GET /api/documents en ese navegador
    Cuando abre /documents con un diseño <diseno>
    Entonces ve filas de carga y la lista marcada como ocupada mientras espera
    Y al llegar la respuesta ve los 12 documentos y el recuento «12 documentos»

    Ejemplos:
      | espera | diseno |
      | 1 segundo | de escritorio |
      | 3 segundos | responsive (menos de 1024 px) |

  Esquema del escenario: Un filtro sin coincidencias muestra el bloque vacío con la opción de limpiar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /documents con un diseño <diseno>
    Cuando escribe zzz-no-existe en «Buscar documentos»
    Entonces ve el título «Sin documentos», el mensaje «Ningún documento coincide con los filtros aplicados.» y el botón «Limpiar filtros», y ninguna fila

    Ejemplos:
      | diseno |
      | de escritorio |
      | responsive (menos de 1024 px) |

  Esquema del escenario: Un fallo de la petición muestra el aviso de error con «Reintentar» y ningún documento
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la web y la prueba responde con error 500 a GET /api/documents en ese navegador
    Cuando abre /documents con un diseño <diseno>
    Entonces ve el aviso «No se pudieron cargar los documentos» con el botón «Reintentar» y ningún documento

    Ejemplos:
      | diseno |
      | de escritorio |
      | responsive (menos de 1024 px) |

  Esquema del escenario: «Reintentar» pide la lista otra vez y la muestra cuando la respuesta llega bien
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la web, la primera petición de GET /api/documents responde con error 500 en ese navegador y las siguientes responden bien
    Cuando abre /documents con un diseño <diseno> y pulsa «Reintentar»
    Entonces ve los 12 documentos con el recuento «12 documentos» y ya no ve el aviso de error

    Ejemplos:
      | diseno |
      | de escritorio |
      | responsive (menos de 1024 px) |
```

## Decisiones pendientes
- La línea de detalle técnico que aparece bajo el aviso de error (la traza de la petición fallida). Hoy la muestra; no está decidido si forma parte del producto ni qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.

## Fuera de alcance
- Los avisos generales de la aplicación, como los de falta de conexión: épica transversal de avisos (EP-TOASTS).
- El buscador y los desplegables de filtro: historia de búsqueda y filtros de la web de esta épica.
- El aviso de error de la ficha de un documento: historia de la ficha de la web de esta épica.
