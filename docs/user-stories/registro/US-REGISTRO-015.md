---
id: US-REGISTRO-015
tipo: historia
epica: EP-REGISTRO
titulo: "[Móvil] Enviar la solicitud: aviso de correo ya registrado, «Solicitud enviada» y reenvío de la verificación"
etiquetas: [movil]
relacionadas: [US-REGISTRO-001, US-REGISTRO-005, US-REGISTRO-011, US-REGISTRO-012, US-LOGIN-012]
verificacion: codigo
cubre: ["/register"]
---

## Historia
Como persona que ha completado la solicitud de acceso desde el móvil, quiero saber si mi correo ya tiene cuenta o, si no lo tiene, ver que mi solicitud está pendiente de aprobación y poder reenviar el correo de verificación,
para saber qué hacer después sin volver a rellenar el formulario.

## Reglas
- **Datos válidos de la fila.** Ana en «Nombre», Prueba en «Apellidos», Unidad de pruebas en «Organización / Unidad», consultant en «Rol solicitado», Abcdefghij1! en «Contraseña» y en «Confirmar contraseña», y la casilla de condiciones marcada. La fila indica el correo y, si hace falta, el rol.
- Al pulsar «Enviar solicitud» la solicitud se envía una vez. Mientras espera la respuesta, «Enviar solicitud» muestra que está ocupado y no se puede volver a pulsar.
- Si el correo ya tiene cuenta en el tenant, no se crea ninguna solicitud. Encima de los campos aparece el aviso «Ya existe una cuenta con ese correo.» y la pantalla sigue con lo escrito.
- Si la solicitud es correcta, la pantalla muestra la vista «Solicitud enviada»: el texto «Hemos enviado un correo de verificación a» seguido del correo de la solicitud en minúsculas; el estado «Pendiente de aprobación»; el rol pedido; y un identificador de solicitud que empieza por `REQ-`, seguido del año en curso y de cuatro cifras. Además aparece un aviso emergente correcto con el título «Solicitud enviada». No hay sesión iniciada.
- En la vista «Solicitud enviada», «Reenviar correo de verificación» pide el reenvío para el correo de la solicitud y muestra un aviso emergente correcto con el título «Correo reenviado». La vista sigue mostrando la solicitud.
- «Volver al inicio de sesión» en la vista «Solicitud enviada» vuelve a la pantalla anterior si la hay. Si la pantalla se abrió directamente, lleva a /login. En los dos casos no hay sesión iniciada.
- **Correo nuevo.** En los ejemplos, `(correo nuevo)` es un correo que no existe en el tenant de la fila: `nueva-` seguido de una marca de tiempo y `@organizacion.es`. Es distinto en cada fila y en cada ejecución.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); se abre la app sin ninguna sesión de SIGPRO guardada en el dispositivo (en Expo web, en el navegador), se va a /login, se escribe `alumno01` en «Tenant de trabajo» y se pulsa «Solicitar acceso» para llegar a /register. Si la fila necesita un correo que ya tiene cuenta, la cuenta es una de las del seed del tenant.

## Criterios de aceptación
```gherkin
Característica: Envío de la solicitud en la app móvil

  Esquema del escenario: Un correo que ya tiene cuenta en el tenant muestra el aviso y conserva lo escrito
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register con alumno01 en «Tenant de trabajo» ha escrito los datos válidos de la fila con <correo> en «Correo corporativo»
    Cuando pulsa «Enviar solicitud»
    Entonces ve encima de los campos el aviso «Ya existe una cuenta con ese correo.»
    Y sigue en /register sin sesión iniciada, con los datos escritos

    Ejemplos:
      | correo |
      | admin@sigpro.test |
      | pendiente@sigpro.test |

  Esquema del escenario: Una solicitud correcta muestra «Solicitud enviada» con su estado
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register con alumno01 en «Tenant de trabajo» ha escrito los datos válidos de la fila con (correo nuevo) en «Correo corporativo» y <rol> en «Rol solicitado»
    Cuando pulsa «Enviar solicitud»
    Entonces ve el título «Solicitud enviada» y el texto «Hemos enviado un correo de verificación a» seguido del correo de la solicitud
    Y ve el estado «Pendiente de aprobación» y el rol <rol>
    Y ve un identificador de solicitud con la forma REQ-AAAA-NNNN: REQ-, el año en curso, un guion y cuatro cifras
    Y aparece un aviso emergente correcto con el título «Solicitud enviada»
    Y no hay sesión iniciada

    Ejemplos:
      | rol |
      | consultant |
      | program_manager |
      | auditor |

  Esquema del escenario: Mientras espera la respuesta no se puede volver a enviar
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register con alumno01 en «Tenant de trabajo» ha escrito los datos válidos de la fila y la prueba retrasa <espera> la respuesta de POST /api/auth/register
    Cuando pulsa «Enviar solicitud»
    Entonces durante la espera «Enviar solicitud» muestra que está ocupado y no se puede volver a pulsar
    Y al llegar la respuesta ve el título «Solicitud enviada»

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Reenviar el correo de verificación muestra el aviso «Correo reenviado»
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register con alumno01 en «Tenant de trabajo» ha enviado los datos válidos de la fila con (correo nuevo) en «Correo corporativo» y ve «Solicitud enviada»
    Cuando pulsa «Reenviar correo de verificación» <veces> veces
    Entonces ve el aviso emergente correcto con el título «Correo reenviado» en cada pulsación
    Y sigue viendo «Solicitud enviada» con el mismo correo

    Ejemplos:
      | veces |
      | 1 |
      | 2 |

  Esquema del escenario: Volver al inicio de sesión desde la vista de la solicitud
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada ha llegado a /register <llegada> y ha enviado los datos válidos de la fila con (correo nuevo) en «Correo corporativo»
    Cuando pulsa «Volver al inicio de sesión»
    Entonces llega a /login sin sesión iniciada

    Ejemplos:
      | llegada |
      | desde /login |
      | con un enlace directo a /register y alumno01 ya guardado en «Tenant de trabajo» |
```

## Fuera de alcance
- El envío real del correo de verificación, que hoy no sale: historia no-implementada de esta misma épica.
- La respuesta de la API al envío y al reenvío: historias de la API de esta misma épica.
- El acceso con la cuenta pendiente y su aviso al iniciar sesión: épica de inicio de sesión (EP-LOGIN).
- La aprobación de la cuenta por un administrador: épica de Administración de usuarios (EP-ADMIN-USUARIOS).

## Decisiones pendientes
- La vista «Solicitud enviada» dice «Hemos enviado un correo de verificación a» la dirección, y el aviso «Correo reenviado» afirma un reenvío, aunque hoy ningún correo sale. Qué debe decir la pantalla mientras el envío no exista.
- Cómo se numera el identificador de la solicitud: hoy depende de las cuentas pendientes del tenant. La historia solo fija su forma.
- **Línea de detalle técnico visible.** Hoy los avisos de Acceso muestran, bajo el mensaje, una línea con la petición HTTP real. Está pendiente de decisión de producto si esa línea forma parte del producto y qué debe contener. Hasta que se decida, ningún ejemplo de esta historia la afirma ni la excluye, y las pruebas no deben depender de ella.
