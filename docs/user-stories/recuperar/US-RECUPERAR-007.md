---
id: US-RECUPERAR-007
tipo: historia
epica: EP-RECUPERAR
titulo: "[Móvil] Enviar la petición: aviso de éxito, botón ocupado, aviso de error y tecla de envío"
etiquetas: [movil]
relacionadas: [US-RECUPERAR-001, US-RECUPERAR-005, US-RECUPERAR-006]
verificacion: codigo
cubre: ["/forgot"]
---

## Historia
Como persona que ha pedido el enlace de recuperación desde la app móvil, quiero ver un aviso que me diga que la petición está hecha sin que la pantalla revele si mi correo tiene cuenta, y un aviso de error si la petición no llega,
para saber qué hacer después sin deducir de la pantalla si mi correo está registrado.

## Reglas
- Con un correo válido, «Enviar enlace» envía la petición una vez. Mientras espera la respuesta, «Enviar enlace» muestra que está ocupado y no se puede volver a pulsar.
- La tecla de envío del teclado en el campo «Correo electrónico» equivale a pulsar «Enviar enlace».
- Al llegar la respuesta, aparece encima del campo «Correo electrónico» el aviso «Si el correo existe, recibirás un enlace en breve.» El aviso es el mismo exista o no una cuenta con ese correo.
- Tras el aviso, la pantalla sigue en /forgot con el mismo correo escrito, sin sesión iniciada y sin redirección.
- Si la petición falla, no aparece el aviso de éxito y aparece un aviso emergente de error con el título que corresponde al caso: «Ha ocurrido un error inesperado» si el servidor responde con error, o «No se pudo contactar con el servidor» si no hay conexión. «Enviar enlace» vuelve a estar disponible.
- El aviso emergente se cierra solo a los 3 segundos: es la regla de los avisos emergentes del producto.
- En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución: `nadie-` seguido de una marca de tiempo y `@sigpro.test`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y la app se abre en /forgot sin ninguna sesión de SIGPRO guardada en el dispositivo (en Expo web, en el navegador).

## Criterios de aceptación
```gherkin
Característica: Envío de la petición de recuperación en la app móvil

  Esquema del escenario: Un correo válido muestra el aviso y la pantalla no cambia
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada ha abierto /forgot y ha escrito <correo> en «Correo electrónico»
    Cuando pulsa «Enviar enlace»
    Entonces ve el aviso «Si el correo existe, recibirás un enlace en breve.»
    Y sigue en /forgot sin sesión iniciada, con <correo> en «Correo electrónico»

    Ejemplos:
      | correo |
      | gestor@sigpro.test |
      | pendiente@sigpro.test |
      | (correo sin cuenta) |
      | a@b.c |

  Esquema del escenario: Mientras espera la respuesta no se puede volver a enviar
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada ha abierto /forgot y ha escrito gestor@sigpro.test en «Correo electrónico»
    Y la prueba retrasa <espera> la respuesta de POST /api/auth/forgot
    Cuando pulsa «Enviar enlace»
    Entonces durante la espera «Enviar enlace» muestra que está ocupado y no se puede volver a pulsar
    Y al llegar la respuesta ve el aviso «Si el correo existe, recibirás un enlace en breve.»

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: El teclado envía la petición igual que el botón
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada ha abierto /forgot y ha escrito gestor@sigpro.test en «Correo electrónico»
    Cuando <envio>
    Entonces ve el aviso «Si el correo existe, recibirás un enlace en breve.»

    Ejemplos:
      | envio |
      | pulsa «Enviar enlace» |
      | pulsa la tecla de envío del teclado en el campo «Correo electrónico» |

  Esquema del escenario: Si la petición falla no aparece el aviso de éxito y se avisa del error
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada ha abierto /forgot y ha escrito gestor@sigpro.test en «Correo electrónico»
    Y la prueba hace que <fallo>
    Cuando pulsa «Enviar enlace»
    Entonces ve un aviso emergente de error con el título <titulo>
    Y no ve el aviso «Si el correo existe, recibirás un enlace en breve.»
    Y «Enviar enlace» vuelve a estar disponible

    Ejemplos:
      | fallo | titulo |
      | POST /api/auth/forgot responda con un error 500 | «Ha ocurrido un error inesperado» |
      | la conexión con POST /api/auth/forgot se corte | «No se pudo contactar con el servidor» |
```

## Fuera de alcance
- La validación del correo antes de enviar: la historia de la app móvil «Recuperar contraseña» de esta misma épica.
- La respuesta de la API a la petición y la validación del correo en el servidor: la historia de la API de esta misma épica.
- El restablecimiento de la contraseña con el enlace: la historia transversal no-implementada de esta misma épica.
- Los avisos de error de las demás pantallas de Acceso: fuera de esta épica.

## Decisiones pendientes
- **Línea de detalle técnico visible.** Hoy el aviso emergente de error lleva además una traza con la petición HTTP real (método, ruta y código de estado). Está pendiente de decisión de producto si esa traza forma parte del producto y qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.
- Si la web debe avisar también cuando la petición falla. Hoy no muestra ningún aviso en ese caso.
- Si el aviso «Si el correo existe, recibirás un enlace en breve.» debe desaparecer al cambiar el correo. Hoy se mantiene hasta salir de la pantalla.
