---
id: US-REGISTRO-011
tipo: historia
epica: EP-REGISTRO
titulo: "[Web] Enviar la solicitud: aviso de correo ya registrado y vista «Solicitud enviada»"
etiquetas: [web]
relacionadas: [US-REGISTRO-001, US-REGISTRO-005, US-REGISTRO-015, US-LOGIN-007]
verificacion: codigo
cubre: ["/register"]
---

## Historia
Como persona que ha completado la solicitud de acceso, quiero que SIGPRO me diga si mi correo ya tiene cuenta o, si no lo tiene, que mi solicitud está enviada y pendiente de aprobación,
para saber qué hacer después sin tener que adivinarlo.

## Reglas
- **Datos válidos de la fila.** Ana en «Nombre», Prueba en «Apellidos», Unidad de pruebas en «Organización / Unidad», consultant en «Rol solicitado», Abcdefghij1! en «Contraseña» y en «Confirmar contraseña», y la casilla de condiciones marcada. La fila indica el correo y, si hace falta, el rol.
- Al pulsar «Enviar solicitud» la solicitud se envía una vez. Mientras espera la respuesta, el formulario está ocupado y «Enviar solicitud» queda deshabilitado con la explicación «Procesando…».
- Si el correo ya tiene cuenta en el tenant, no se crea ninguna solicitud. Encima de los campos aparece el aviso «Ya existe una cuenta con ese correo.», el formulario sigue visible y conserva lo escrito.
- Si la solicitud es correcta, la vista del formulario cambia a «Solicitud enviada». Muestra el texto «Hemos enviado un correo de verificación a» seguido del correo de la solicitud en minúsculas, el estado «Pendiente de aprobación», el rol pedido y un identificador de solicitud que empieza por `REQ-`, seguido del año en curso y de cuatro cifras.
- En la vista «Solicitud enviada» la dirección sigue siendo /register y no hay sesión iniciada.
- Además aparece un aviso emergente correcto con el título «Solicitud enviada».
- **Correo nuevo.** En los ejemplos, `(correo nuevo)` es un correo que no existe en el tenant de la fila: `nueva-` seguido de una marca de tiempo y `@organizacion.es`. Es distinto en cada fila y en cada ejecución.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se abre `/register?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada. Si la fila necesita un correo que ya tiene cuenta, la cuenta es una de las del seed del tenant.

## Criterios de aceptación
```gherkin
Característica: Envío de la solicitud en la web

  Esquema del escenario: Un correo que ya tiene cuenta en el tenant muestra el aviso y conserva lo escrito
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register?tenant=alumno01 ha escrito los datos válidos de la fila con <correo> en «Correo corporativo»
    Cuando pulsa «Enviar solicitud»
    Entonces ve encima de los campos el aviso «Ya existe una cuenta con ese correo.»
    Y sigue en /register sin sesión iniciada, con los datos escritos

    Ejemplos:
      | correo |
      | admin@sigpro.test |
      | (GESTOR@sigpro.test con un espacio delante y otro detrás) |
      | pendiente@sigpro.test |

  Esquema del escenario: Una solicitud correcta muestra «Solicitud enviada» con su estado
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register?tenant=alumno01 ha escrito los datos válidos de la fila con (correo nuevo) en «Correo corporativo» y <rol> en «Rol solicitado»
    Cuando pulsa «Enviar solicitud»
    Entonces ve el título «Solicitud enviada» y el texto «Hemos enviado un correo de verificación a» seguido del correo de la solicitud
    Y ve el estado «Pendiente de aprobación» y el rol <rol>
    Y ve un identificador de solicitud con la forma REQ-AAAA-NNNN: REQ-, el año en curso, un guion y cuatro cifras
    Y sigue en /register sin sesión iniciada
    Y aparece un aviso emergente correcto con el título «Solicitud enviada»

    Ejemplos:
      | rol |
      | consultant |
      | program_manager |
      | auditor |

  Esquema del escenario: Mientras espera la respuesta no se puede volver a enviar
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register?tenant=alumno01 ha escrito los datos válidos de la fila y la prueba retrasa <espera> la respuesta de POST /api/auth/register en el navegador
    Cuando pulsa «Enviar solicitud»
    Entonces durante la espera el formulario está ocupado y «Enviar solicitud» está deshabilitado con la explicación «Procesando…»
    Y al llegar la respuesta ve el título «Solicitud enviada»

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |
```

## Fuera de alcance
- El reenvío del correo de verificación desde la vista «Solicitud enviada»: historia de reenvío de la web de esta misma épica.
- El envío real del correo de verificación: historia no-implementada de esta misma épica.
- El acceso con la cuenta pendiente y su aviso al iniciar sesión: épica de inicio de sesión (EP-LOGIN).
- La aprobación de la cuenta por un administrador: épica de Administración de usuarios (EP-ADMIN-USUARIOS).

## Decisiones pendientes
- La vista «Solicitud enviada» dice «Hemos enviado un correo de verificación a» la dirección, aunque hoy ningún correo sale. Qué debe decir la vista mientras el envío no exista.
- Cómo se numera el identificador de la solicitud: hoy depende de las cuentas pendientes del tenant. La historia solo fija su forma.
- **Línea de detalle técnico visible.** Hoy los avisos de Acceso muestran, bajo el mensaje, una línea con la petición HTTP real (método, ruta y código de estado, con algún dato más según el caso). Está pendiente de decisión de producto si esa línea forma parte del producto y qué debe contener. Hasta que se decida, ningún ejemplo de esta historia la afirma ni la excluye, y las pruebas no deben depender de ella.
