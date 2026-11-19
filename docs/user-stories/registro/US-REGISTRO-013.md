---
id: US-REGISTRO-013
tipo: historia
epica: EP-REGISTRO
titulo: "[Móvil] Formulario de solicitud: elementos, ayudas, medidor y mostrar la contraseña"
etiquetas: [movil]
relacionadas: [US-LOGIN-011, US-REGISTRO-008, US-REGISTRO-010]
verificacion: ejecutada
cubre: ["/register"]
---

## Historia
Como persona sin cuenta que pide acceso desde el móvil, quiero un formulario en /register con las mismas ayudas, el mismo medidor y el mismo control para ver la contraseña que en la web,
para completar la solicitud desde el teléfono sin tener que cambiar de dispositivo.

## Reglas
- /register muestra el título «Solicitar acceso» y el texto «Un administrador revisará la solicitud antes de activar la cuenta.».
- Los campos van en este orden: «Nombre», «Apellidos», «Correo corporativo» (con la ayuda «Debe pertenecer a un dominio autorizado.»), «Organización / Unidad», «Rol solicitado» (con la ayuda «El rol admin solo se asigna manualmente.»), «Contraseña» y «Confirmar contraseña». Después están el control de mostrar la contraseña, el medidor, la casilla de condiciones con la frase «He leído y acepto las condiciones de uso y la política de privacidad.», los enlaces «condiciones de uso» y «política de privacidad», y los botones «Enviar solicitud» y «Volver al inicio de sesión».
- «Rol solicitado» ofrece tres roles: consultant, program_manager y auditor. Al abrir la pantalla viene seleccionado consultant.
- Al abrir la pantalla todos los campos están vacíos, la contraseña está oculta, la casilla de condiciones está desmarcada y «Enviar solicitud» está habilitado.
- La pantalla no tiene campo de tenant: la solicitud va al tenant de trabajo, el que se eligió en «Tenant de trabajo» en /login.
- Mientras la contraseña está oculta, el control de mostrarla tiene el texto «Mostrar contraseña». Al pulsarlo, «Contraseña» y «Confirmar contraseña» se ven en claro, el control pasa a tener el texto «Ocultar contraseña» y queda marcado como pulsado. Mostrar u ocultar no cambia lo escrito ni envía el formulario.
- El medidor muestra las cuatro reglas, en este orden y con este texto: «Al menos 10 caracteres», «Una mayúscula y una minúscula», «Un número» y «Un símbolo». Una regla cumplida se marca con ✓; una que no se cumple, con ·. Rellena tantas de sus cuatro barras como reglas se cumplen.
- La fuerza depende de las reglas cumplidas: ninguna, sin texto; una, «Débil»; dos, «Aceptable»; tres, «Buena»; las cuatro, «Fuerte». Ese texto se ve en la pantalla.
- Los enlaces «condiciones de uso» y «política de privacidad» abren la página legal dentro de la app. Al volver a la pantalla anterior, el formulario conserva lo escrito.
- Con una sesión iniciada, /register lleva a /programs sin mostrar el formulario.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); se abre la app sin ninguna sesión de SIGPRO guardada en el dispositivo (en Expo web, en el navegador), se va a /login, se escribe `alumno01` en «Tenant de trabajo» y se pulsa «Solicitar acceso» para llegar a /register.

## Criterios de aceptación
```gherkin
Característica: Formulario de solicitud en la app móvil

  Esquema del escenario: Estado inicial de cada elemento del formulario
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /register con alumno01 en «Tenant de trabajo»
    Cuando mira el formulario
    Entonces <elemento> <estado>

    Ejemplos:
      | elemento | estado |
      | «Solicitar acceso» | es el título de la pantalla, con el texto «Un administrador revisará la solicitud antes de activar la cuenta.» |
      | «Nombre» | está vacío |
      | «Correo corporativo» | está vacío y muestra la ayuda «Debe pertenecer a un dominio autorizado.» |
      | «Rol solicitado» | tiene seleccionado consultant |
      | «Contraseña» | está vacía y oculta lo que se escribe |
      | la casilla de condiciones | está desmarcada |
      | «Enviar solicitud» | está habilitado |

  Esquema del escenario: El control de mostrar la contraseña alterna la visibilidad de las dos contraseñas
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register con alumno01 en «Tenant de trabajo» ha escrito Abcdefghij1! en «Contraseña» y en «Confirmar contraseña»
    Cuando pulsa el control de la contraseña <veces> veces
    Entonces «Contraseña» y «Confirmar contraseña» se ven <visibilidad>
    Y el control muestra <texto> y está <pulsado>
    Y los dos campos siguen conteniendo Abcdefghij1!

    Ejemplos:
      | veces | visibilidad | texto | pulsado |
      | 0 | ocultas | «Mostrar contraseña» | sin marcar como pulsado |
      | 1 | en claro | «Ocultar contraseña» | marcado como pulsado |
      | 2 | ocultas | «Mostrar contraseña» | sin marcar como pulsado |

  Esquema del escenario: El medidor cuenta las reglas cumplidas y muestra la fuerza
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /register con alumno01 en «Tenant de trabajo»
    Cuando escribe <contraseña> en «Contraseña»
    Entonces las reglas cumplidas son <reglas>
    Y la fuerza es <fuerza>
    Y el medidor rellena <barras> de sus cuatro barras

    Ejemplos:
      | contraseña | reglas | fuerza | barras |
      | (vacío) | (ninguna) | (ninguna) | 0 |
      | Abcdefghi | solo «Una mayúscula y una minúscula» | «Débil» | 1 |
      | Abcdefghij1 | «Al menos 10 caracteres», «Una mayúscula y una minúscula» y «Un número» | «Buena» | 3 |
      | Abcdefghij1! | las cuatro | «Fuerte» | 4 |

  Esquema del escenario: Los enlaces legales se abren dentro de la app sin perder lo escrito
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register con alumno01 en «Tenant de trabajo» ha escrito Ana en «Nombre»
    Cuando pulsa el enlace <enlace>
    Entonces llega a <ruta> dentro de la app
    Y al volver a la pantalla anterior ve el formulario con Ana escrita en «Nombre»

    Ejemplos:
      | enlace | ruta |
      | «condiciones de uso» | /legal/terms |
      | «política de privacidad» | /legal/privacy |

  Esquema del escenario: Con una sesión iniciada no se pide acceso
    Dado que el tenant alumno01 está recién reiniciado y en esta app <sesion> ha iniciado sesión en alumno01 con Gestor1234!
    Cuando abre /register
    Entonces llega a /programs sin ver el formulario de solicitud

    Ejemplos:
      | sesion |
      | gestor@sigpro.test |
```

## Fuera de alcance
- La validación antes de enviar y los avisos bajo cada campo: historia de validación móvil de esta misma épica.
- El envío de la solicitud, el aviso de correo ya registrado y la vista «Solicitud enviada»: historia de envío móvil de esta misma épica.
- Las páginas legales y su contenido: épica transversal de páginas legales y ayuda.
- Los controles del sistema, como el botón atrás de Android o el teclado: si cambian el comportamiento, necesitan sus propias historias por sistema.

## Decisiones pendientes
- Si la pantalla debe mostrar a qué tenant va la solicitud. Hoy no lo muestra: toma el de «Tenant de trabajo».
