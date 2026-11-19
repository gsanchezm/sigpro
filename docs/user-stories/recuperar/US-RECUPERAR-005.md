---
id: US-RECUPERAR-005
tipo: historia
epica: EP-RECUPERAR
titulo: "[Web] Enviar la petición: aviso de éxito, botón ocupado y fallo sin aviso de éxito"
etiquetas: [web]
relacionadas: [US-RECUPERAR-001, US-RECUPERAR-004, US-RECUPERAR-007]
verificacion: ejecutada
cubre: ["/forgot"]
---

## Historia
Como persona que ha pedido el enlace de recuperación desde la web, quiero ver un aviso que me diga que la petición está hecha sin que la pantalla revele si mi correo tiene cuenta,
para saber qué hacer después sin deducir de la pantalla si mi correo está registrado.

## Reglas
- Con un correo válido, «Enviar enlace» envía la petición una vez. Mientras espera la respuesta, el botón queda deshabilitado con la explicación «Procesando…», muestra un indicador de carga y no se puede volver a pulsar.
- Al llegar la respuesta, aparece encima del campo «Correo electrónico» el aviso «Si el correo existe, recibirás un enlace en breve.»
- El aviso es el mismo exista o no una cuenta con ese correo, y la pantalla no cambia según el caso.
- Tras el aviso, la pantalla sigue en /forgot con el mismo correo escrito, sin sesión iniciada y sin redirección.
- Si la petición falla, no aparece el aviso de éxito y «Enviar enlace» vuelve a estar disponible.
- En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución: `nadie-` seguido de una marca de tiempo y `@sigpro.test`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y el navegador se abre en `/forgot?tenant=alumno01` sin ninguna sesión de SIGPRO guardada.

## Criterios de aceptación
```gherkin
Característica: Envío de la petición de recuperación en la web

  Esquema del escenario: Un correo válido muestra el aviso y la pantalla no cambia
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /forgot?tenant=alumno01 y todavía no ha enviado ninguna petición
    Cuando escribe <correo> en «Correo electrónico» y pulsa «Enviar enlace»
    Entonces ve el aviso «Si el correo existe, recibirás un enlace en breve.»
    Y sigue en /forgot sin sesión iniciada, con <correo> escrito en «Correo electrónico»

    Ejemplos:
      | correo |
      | gestor@sigpro.test |
      | pendiente@sigpro.test |
      | (correo sin cuenta) |
      | a@b.c |

  Esquema del escenario: Mientras espera la respuesta el botón no se puede volver a pulsar
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /forgot?tenant=alumno01 con gestor@sigpro.test escrito en «Correo electrónico»
    Y la prueba retrasa <espera> la respuesta de POST /api/auth/forgot en el navegador
    Cuando pulsa «Enviar enlace»
    Entonces durante la espera «Enviar enlace» está deshabilitado con la explicación «Procesando…»
    Y al llegar la respuesta ve el aviso «Si el correo existe, recibirás un enlace en breve.»

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Si la petición falla no aparece el aviso de éxito
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /forgot?tenant=alumno01 con gestor@sigpro.test escrito en «Correo electrónico»
    Y la prueba responde <estado> a POST /api/auth/forgot
    Cuando pulsa «Enviar enlace»
    Entonces no ve el aviso «Si el correo existe, recibirás un enlace en breve.»
    Y «Enviar enlace» vuelve a estar disponible
    Y sigue en /forgot sin sesión iniciada

    Ejemplos:
      | estado |
      | 500 |
      | 503 |
```

## Fuera de alcance
- La respuesta de la API a la petición y la validación del correo en el servidor: la historia de la API de esta misma épica.
- El campo, los botones y la validación antes de enviar: la historia de la web «Recuperar contraseña» de esta misma épica.
- El restablecimiento de la contraseña con el enlace: la historia transversal no-implementada de esta misma épica.
- Los avisos de error de las demás pantallas de Acceso: fuera de esta épica.

## Decisiones pendientes
- Qué ve la persona si la petición falla. Hoy la pantalla no muestra ningún aviso de error ni de éxito, mientras que la app móvil sí muestra un aviso emergente de error. No está decidido si la web debe avisarlo ni con qué texto.
- Si el aviso «Si el correo existe, recibirás un enlace en breve.» debe desaparecer al cambiar el correo. Hoy se mantiene hasta salir de la pantalla.
- Si la petición puede repetirse sin límite y sin espera. Hoy no hay límite ni espera.
