---
id: US-REGISTRO-012
tipo: historia
epica: EP-REGISTRO
titulo: "[Web] Reenviar el correo de verificación desde «Solicitud enviada»"
etiquetas: [web]
relacionadas: [US-REGISTRO-006, US-REGISTRO-007, US-REGISTRO-015]
verificacion: ejecutada
cubre: ["/register"]
---

## Historia
Como persona que acaba de pedir acceso y no ha recibido el correo de verificación, quiero reenviarlo desde la vista «Solicitud enviada»,
para tener otra oportunidad sin volver a rellenar el formulario.

## Reglas
- **Datos válidos de la fila.** Ana en «Nombre», Prueba en «Apellidos», Unidad de pruebas en «Organización / Unidad», consultant en «Rol solicitado», Abcdefghij1! en «Contraseña» y en «Confirmar contraseña», y la casilla de condiciones marcada. La fila indica el correo.
- El botón «Reenviar correo de verificación» de la vista «Solicitud enviada» pide el reenvío para el correo de la solicitud. No cambia la vista ni inicia ninguna sesión.
- Tras pulsarlo aparece un aviso emergente correcto con el título «Correo reenviado». Cada pulsación muestra su aviso.
- Tras reenviar, la vista sigue mostrando «Solicitud enviada» con el mismo correo.
- «Volver al inicio de sesión» desde la vista «Solicitud enviada» lleva a /login sin sesión iniciada.
- **Correo nuevo.** En los ejemplos, `(correo nuevo)` es un correo que no existe en el tenant de la fila: `nueva-` seguido de una marca de tiempo y `@organizacion.es`. Es distinto en cada fila y en cada ejecución.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se abre `/register?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada. La solicitud de la fila se hace después del reinicio, con el correo nuevo.

## Criterios de aceptación
```gherkin
Característica: Reenvío de la verificación en la web

  Esquema del escenario: Cada reenvío muestra el aviso «Correo reenviado»
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register?tenant=alumno01 ha enviado los datos válidos de la fila con (correo nuevo) en «Correo corporativo» y ve «Solicitud enviada»
    Cuando pulsa «Reenviar correo de verificación» <veces> veces
    Entonces ve el aviso emergente correcto con el título «Correo reenviado» en cada pulsación
    Y sigue viendo «Solicitud enviada» con el mismo correo

    Ejemplos:
      | veces |
      | 1 |
      | 2 |

  Esquema del escenario: Volver al inicio de sesión desde la vista de la solicitud
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register?tenant=alumno01 ha enviado los datos válidos de la fila con <correo> en «Correo corporativo» y ve «Solicitud enviada»
    Cuando pulsa «Volver al inicio de sesión»
    Entonces llega a /login sin sesión iniciada

    Ejemplos:
      | correo |
      | (correo nuevo) |
```

## Fuera de alcance
- El envío real del correo de verificación, que hoy no sale: historia no-implementada de esta misma épica.
- La respuesta de la API al reenvío: historia de la API de esta misma épica.
- La solicitud y la vista «Solicitud enviada» que aparece antes del reenvío: historia de envío de la web de esta misma épica.

## Decisiones pendientes
- Si el aviso «Correo reenviado» debe salir también cuando la petición de reenvío falla. Hoy sale siempre, igual que en la app móvil: así lo documenta el proyecto, que el móvil sigue a la web.
- Cuántos reenvíos se permiten y con qué espera entre ellos. Hoy no hay límite ni espera.
- Qué debe decir el aviso «Correo reenviado» mientras ningún correo sale. Ver la misma duda en la vista «Solicitud enviada».
