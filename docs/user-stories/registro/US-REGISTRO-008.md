---
id: US-REGISTRO-008
tipo: historia
epica: EP-REGISTRO
titulo: "[Web] Formulario de solicitud: elementos, ayudas y salidas"
etiquetas: [web]
relacionadas: [US-LOGIN-006, US-REGISTRO-013]
verificacion: ejecutada
cubre: ["/register"]
---

## Historia
Como persona sin cuenta en SIGPRO, quiero en /register un formulario que me explique qué pide cada campo y que me diga que un administrador revisará la solicitud,
para pedir acceso con el rol que necesito sin dudas sobre lo que me van a preguntar.

## Reglas
- /register muestra el título «Solicitar acceso» y el texto «Un administrador revisará la solicitud antes de activar la cuenta.».
- Los campos van en este orden: «Nombre», «Apellidos», «Correo corporativo», «Organización / Unidad», «Rol solicitado», «Contraseña» y «Confirmar contraseña». Después están el medidor de fuerza de la contraseña, la casilla de condiciones y los botones «Volver al inicio de sesión» y «Enviar solicitud».
- Ayudas visibles: bajo «Correo corporativo», «Debe pertenecer a un dominio autorizado.»; bajo «Rol solicitado», «El rol admin solo se asigna manualmente.».
- «Rol solicitado» ofrece tres roles: consultant, program_manager y auditor. Al abrir la página viene seleccionado consultant.
- Al abrir la página todos los campos están vacíos, el foco está en «Nombre», «Contraseña» y «Confirmar contraseña» ocultan lo que se escribe, la casilla de condiciones está desmarcada y «Enviar solicitud» está habilitado.
- El botón de la contraseña tiene el texto «Mostrar» y el nombre «Mostrar contraseña» mientras la contraseña está oculta. Al pulsarlo, «Contraseña» y «Confirmar contraseña» se ven en claro a la vez, el botón pasa a tener el texto «Ocultar» y el nombre «Ocultar contraseña», y queda marcado como pulsado. Mostrar u ocultar no cambia lo escrito ni envía el formulario.
- La casilla lleva la frase «He leído y acepto las condiciones de uso y la política de privacidad.». «condiciones de uso» y «política de privacidad» son enlaces que abren /legal/terms y /legal/privacy en otra pestaña, y la solicitud no pierde lo escrito.
- «Volver al inicio de sesión» lleva a /login sin enviar nada.
- Con una sesión iniciada en el navegador, /register lleva a /programs sin mostrar el formulario.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se abre `/register?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada. Lo que la fila necesita de antemano (una sesión iniciada) se crea después del reinicio, en la propia fila.

## Criterios de aceptación
```gherkin
Característica: Formulario de solicitud en la web

  Esquema del escenario: Estado inicial de cada elemento del formulario
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada abre /register?tenant=alumno01
    Cuando mira el formulario
    Entonces <elemento> <estado>

    Ejemplos:
      | elemento | estado |
      | «Solicitar acceso» | es el título de la página, con el texto «Un administrador revisará la solicitud antes de activar la cuenta.» |
      | «Nombre» | está vacío y tiene el foco |
      | «Correo corporativo» | está vacío y muestra la ayuda «Debe pertenecer a un dominio autorizado.» |
      | «Rol solicitado» | tiene seleccionado consultant |
      | «Contraseña» | está vacía y oculta lo que se escribe |
      | «Confirmar contraseña» | está vacía y oculta lo que se escribe |
      | la casilla de condiciones | está desmarcada |
      | «Enviar solicitud» | está habilitado |

  Esquema del escenario: El botón de la contraseña alterna la visibilidad de las dos contraseñas
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /register?tenant=alumno01 y ha escrito Abcdefghij1! en «Contraseña» y en «Confirmar contraseña»
    Cuando pulsa el botón de la contraseña <veces> veces
    Entonces «Contraseña» y «Confirmar contraseña» se ven <visibilidad>
    Y el botón muestra <texto> y se llama <nombre>
    Y el botón <pulsado>
    Y los dos campos siguen conteniendo Abcdefghij1! y no se ha enviado nada

    Ejemplos:
      | veces | visibilidad | texto | nombre | pulsado |
      | 0 | ocultas | «Mostrar» | «Mostrar contraseña» | no está marcado como pulsado |
      | 1 | en claro | «Ocultar» | «Ocultar contraseña» | está marcado como pulsado |
      | 2 | ocultas | «Mostrar» | «Mostrar contraseña» | no está marcado como pulsado |

  Esquema del escenario: Volver al inicio de sesión no envía la solicitud
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /register?tenant=alumno01 con <situacion>
    Cuando pulsa «Volver al inicio de sesión»
    Entonces llega a /login sin sesión iniciada
    Y no se ha enviado ninguna solicitud

    Ejemplos:
      | situacion |
      | el formulario vacío |
      | Ana escrita en «Nombre» y gestor@sigpro.test escrito en «Correo corporativo» |

  Esquema del escenario: Los enlaces legales abren su página en otra pestaña
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /register?tenant=alumno01 con Ana escrita en «Nombre»
    Cuando pulsa el enlace <enlace>
    Entonces se abre <ruta> en otra pestaña
    Y en /register sigue escrito Ana en «Nombre»

    Ejemplos:
      | enlace | ruta |
      | «condiciones de uso» | /legal/terms |
      | «política de privacidad» | /legal/privacy |

  Esquema del escenario: Con una sesión iniciada no se pide acceso
    Dado que el tenant alumno01 está recién reiniciado y en este navegador <sesion> ha iniciado sesión en alumno01 con Gestor1234!
    Cuando abre /register?tenant=alumno01
    Entonces llega a /programs sin ver el formulario de solicitud

    Ejemplos:
      | sesion |
      | gestor@sigpro.test |
```

## Fuera de alcance
- La validación antes de enviar, el medidor de fuerza y el envío de la solicitud: historias de esta misma épica en la web.
- El contenido de las páginas legales: épica transversal de páginas legales y ayuda.
- El panel «Usuarios de prueba» de la pantalla de acceso: épica de la API de plataforma y configuración.
- El idioma y el tema de la cabecera: épicas transversales de idioma y de tema.

## Decisiones pendientes
- Si las opciones de «Rol solicitado» se muestran con su código, como hoy (`consultant`, `program_manager`, `auditor`), o con un nombre legible.
- Qué dominios cuentan como autorizados y si la solicitud se comprueba contra ellos. Hoy la ayuda se muestra y ninguna comprobación la aplica.
- Si el aviso «Validación servidor: un correo ya registrado (p. ej. admin@sigpro.test) devuelve 409.», que la pantalla muestra al pie del formulario, forma parte del producto o es texto de prototipo. Hoy aparece también en la app móvil.
