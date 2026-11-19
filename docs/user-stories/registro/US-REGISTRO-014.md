---
id: US-REGISTRO-014
tipo: historia
epica: EP-REGISTRO
titulo: "[Móvil] Validar la solicitud antes de enviarla: avisos por campo y borrado al editar"
etiquetas: [movil]
relacionadas: [US-REGISTRO-002, US-REGISTRO-003, US-REGISTRO-009, US-REGISTRO-016]
verificacion: codigo
cubre: ["/register"]
---

## Historia
Como persona que pide acceso desde el móvil, quiero que el formulario me diga bajo cada campo qué está mal antes de enviarlo,
para corregirlo sin perder lo que ya he escrito y sin gastar un envío que no va a prosperar.

## Reglas
- Al pulsar «Enviar solicitud», si algún campo no es válido, la solicitud no se envía al servidor. Cada campo con problema muestra su aviso debajo, en texto de error.
- «Nombre», «Apellidos» y «Organización / Unidad» son obligatorios: vacíos o con solo espacios muestran «Campo obligatorio».
- «Correo corporativo» es obligatorio («Campo obligatorio»). Debe tener la forma `texto@dominio.extensión`, sin espacios y con una sola `@`; si no, muestra «Introduce un correo válido». Los espacios del principio y del final se ignoran.
- «Contraseña» es obligatoria («Campo obligatorio»). Con menos de diez caracteres muestra «Mínimo 10 caracteres». Con diez o más caracteres pero sin alguna de las otras reglas, la solicitud no se envía y bajo «Contraseña» aparece un aviso; su texto no está decidido (ver «Decisiones pendientes»).
- «Confirmar contraseña» debe ser igual que «Contraseña»; si no lo es, muestra «Las contraseñas no coinciden». Esto ocurre también cuando «Confirmar contraseña» está vacía y «Contraseña» no.
- Si la casilla de condiciones está sin marcar, bajo la casilla aparece «Debes aceptar las condiciones».
- Al cambiar el contenido de cualquier campo desaparecen todos los avisos de los campos.
- **Datos válidos de la fila.** Ana en «Nombre», Prueba en «Apellidos», Unidad de pruebas en «Organización / Unidad», (correo nuevo) en «Correo corporativo», consultant en «Rol solicitado», Abcdefghij1! en «Contraseña» y en «Confirmar contraseña», y la casilla marcada. Cada fila cambia solo lo que indica.
- **Correo nuevo.** En los ejemplos, `(correo nuevo)` es un correo que no existe en el tenant de la fila: `nueva-` seguido de una marca de tiempo y `@organizacion.es`. Es distinto en cada fila y en cada ejecución.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); se abre la app sin ninguna sesión de SIGPRO guardada en el dispositivo (en Expo web, en el navegador), se va a /login, se escribe `alumno01` en «Tenant de trabajo» y se pulsa «Solicitar acceso» para llegar a /register.

## Criterios de aceptación
```gherkin
Característica: Validación de la solicitud en la app móvil

  Esquema del escenario: Cada campo no válido muestra su aviso y no se envía nada
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /register con alumno01 en «Tenant de trabajo» y con los datos válidos de la fila
    Cuando pone <valor> en <campo> y pulsa «Enviar solicitud»
    Entonces bajo <campo> ve <aviso>
    Y no se envía la solicitud

    Ejemplos:
      | campo | valor | aviso |
      | «Nombre» | (vacío) | «Campo obligatorio» |
      | «Organización / Unidad» | (tres espacios) | «Campo obligatorio» |
      | «Correo corporativo» | (vacío) | «Campo obligatorio» |
      | «Correo corporativo» | no-es-un-correo | «Introduce un correo válido» |
      | «Correo corporativo» | (ana @sigpro.test, con un espacio antes de la arroba) | «Introduce un correo válido» |

  Esquema del escenario: La contraseña y su confirmación se validan juntas
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /register con alumno01 en «Tenant de trabajo» y con los datos válidos de la fila
    Cuando pone <contraseña> en «Contraseña», pone <confirmacion> en «Confirmar contraseña» y pulsa «Enviar solicitud»
    Entonces bajo «Contraseña» ve <aviso_contraseña>
    Y bajo «Confirmar contraseña» ve <aviso_confirmacion>
    Y no se envía la solicitud

    Ejemplos:
      | contraseña | confirmacion | aviso_contraseña | aviso_confirmacion |
      | Abcdefg1! | Abcdefg1! | «Mínimo 10 caracteres» | (ninguno) |
      | Abcdefghij1! | Abcdefghij1? | (ninguno) | «Las contraseñas no coinciden» |
      | (vacío) | Abcdefghij1! | «Campo obligatorio» | «Las contraseñas no coinciden» |

  Esquema del escenario: Una contraseña de diez caracteres que no cumple otra regla no se envía
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /register con alumno01 en «Tenant de trabajo» y con los datos válidos de la fila
    Cuando pone <contraseña> en «Contraseña» y en «Confirmar contraseña» y pulsa «Enviar solicitud»
    Entonces no se envía la solicitud
    Y bajo «Contraseña» ve un aviso
    Y la regla <regla> del medidor aparece sin marcar

    Ejemplos:
      | contraseña | regla |
      | abcdefghi1! | «Una mayúscula y una minúscula» |
      | Abcdefghij! | «Un número» |

  Esquema del escenario: Sin aceptar las condiciones la solicitud no se envía
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /register con alumno01 en «Tenant de trabajo» y con los datos válidos de la fila, salvo la casilla de condiciones
    Cuando pulsa «Enviar solicitud» con la casilla <casilla>
    Entonces bajo la casilla ve «Debes aceptar las condiciones»
    Y no se envía la solicitud

    Ejemplos:
      | casilla |
      | desmarcada |

  Esquema del escenario: Editar un campo borra los avisos de todos los campos
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register con alumno01 en «Tenant de trabajo» ha pulsado «Enviar solicitud» con todos los campos vacíos y ve avisos bajo ellos
    Cuando escribe <texto> en <campo>
    Entonces ya no ve ningún aviso bajo los campos

    Ejemplos:
      | campo | texto |
      | «Nombre» | Ana |
      | «Contraseña» | Abcdefghij1! |
```

## Fuera de alcance
- El medidor de fuerza y las reglas que muestra mientras se escribe: historia móvil de esta misma épica sobre el formulario.
- El envío de la solicitud, el aviso de correo ya registrado y la vista «Solicitud enviada»: historia móvil de esta misma épica.
- El foco al primer campo con aviso: historia no-implementada de esta misma épica.

## Decisiones pendientes
- Qué aviso ve quien no cumple una regla distinta de la longitud. Hoy la contraseña muestra «Mínimo 10 caracteres» para cualquier regla que falte, aunque tenga diez o más caracteres. Hasta que se decida, la historia solo fija que la solicitud no se envía y que bajo «Contraseña» hay un aviso.
