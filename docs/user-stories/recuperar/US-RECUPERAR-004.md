---
id: US-RECUPERAR-004
tipo: historia
epica: EP-RECUPERAR
titulo: "[Web] Recuperar contraseña: correo del acceso, validación y salidas de la pantalla"
etiquetas: [web]
relacionadas: [US-RECUPERAR-001, US-RECUPERAR-005, US-RECUPERAR-006, US-LOGIN-007]
verificacion: ejecutada
cubre: ["/forgot"]
---

## Historia
Como persona con una cuenta en SIGPRO que no recuerda su contraseña, quiero una pantalla propia de «Recuperar contraseña» con el correo que ya había escrito en el acceso,
para pedir el enlace de recuperación sin escribir otra vez mi correo y sin que la pantalla me pida nada más.

## Reglas
- `/forgot` es pública y solo está disponible sin sesión iniciada: con sesión iniciada, abrirla lleva a /programs.
- La pantalla muestra el título «Recuperar contraseña» y el texto «Te enviaremos un enlace de un solo uso válido durante 30 minutos.». El formulario tiene, en este orden, el campo «Correo electrónico», el botón «Enviar enlace» y el botón «Volver al inicio de sesión». No pide la contraseña y no muestra la casilla «Mantener la sesión en este equipo».
- El campo «Correo electrónico» de /forgot es el mismo que el de /login: el correo escrito en una de las dos pantallas aparece en la otra. Así, al pulsar «¿Olvidaste la contraseña?» en /login, el campo trae el correo ya escrito.
- **Validación antes de enviar.** Al pulsar «Enviar enlace», un correo vacío o con solo espacios muestra «Campo obligatorio» bajo el campo, y un correo que no tiene forma de dirección muestra «Introduce un correo válido». Un correo válido tiene la forma `texto@dominio.extensión`, sin espacios y con una sola `@`. Los espacios del principio y del final no cuentan. Si hay un aviso de validación, no se envía ninguna petición.
- El aviso de validación desaparece al cambiar el contenido del campo.
- «Volver al inicio de sesión» y la tecla Esc llevan a /login sin sesión iniciada. La tecla Esc no hace nada mientras se espera la respuesta de una petición.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y el navegador se abre sin ninguna sesión de SIGPRO guardada. La pantalla se abre en `/forgot?tenant=alumno01`; la fila de precarga empieza en `/login?tenant=alumno01`.

## Criterios de aceptación
```gherkin
Característica: Pantalla de recuperación de la contraseña en la web

  Esquema del escenario: El correo escrito en el acceso llega a la pantalla de recuperación
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /login?tenant=alumno01 y ha escrito <correo_acceso> en «Correo electrónico»
    Cuando pulsa «¿Olvidaste la contraseña?»
    Entonces llega a /forgot
    Y ve en «Correo electrónico» <correo_recuperacion>

    Ejemplos:
      | correo_acceso | correo_recuperacion |
      | gestor@sigpro.test | gestor@sigpro.test |
      | (vacío) | (vacío) |

  Esquema del escenario: Un correo no válido se avisa antes de enviar
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /forgot?tenant=alumno01 y todavía no ha enviado ninguna petición
    Cuando escribe <correo> en «Correo electrónico» y pulsa «Enviar enlace»
    Entonces ve bajo el campo el aviso <aviso>
    Y no ve el aviso «Si el correo existe, recibirás un enlace en breve.»
    Y no se envía ninguna petición a POST /api/auth/forgot

    Ejemplos:
      | correo | aviso |
      | (vacío) | «Campo obligatorio» |
      | (tres espacios) | «Campo obligatorio» |
      | no-es-un-correo | «Introduce un correo válido» |
      | ana@sigpro | «Introduce un correo válido» |
      | @sigpro.test | «Introduce un correo válido» |
      | a@b | «Introduce un correo válido» |

  Esquema del escenario: El aviso de validación desaparece al escribir en el campo
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /forgot?tenant=alumno01 y ha pulsado «Enviar enlace» con el campo vacío, y ve «Campo obligatorio» bajo el campo
    Cuando escribe <correo> en «Correo electrónico»
    Entonces deja de ver el aviso «Campo obligatorio»

    Ejemplos:
      | correo |
      | gestor@sigpro.test |

  Esquema del escenario: Volver al inicio de sesión lleva a /login sin sesión iniciada
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada ha abierto /forgot?tenant=alumno01 con gestor@sigpro.test escrito en «Correo electrónico»
    Cuando <salida>
    Entonces llega a /login sin sesión iniciada
    Y ve en «Correo electrónico» gestor@sigpro.test

    Ejemplos:
      | salida |
      | pulsa «Volver al inicio de sesión» |
      | pulsa la tecla Esc |

  Esquema del escenario: Con sesión iniciada, /forgot lleva a Programas
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión con <contraseña> en /login?tenant=alumno01 en la propia prueba
    Cuando abre /forgot
    Entonces llega a /programs

    Ejemplos:
      | cuenta | contraseña |
      | gestor@sigpro.test | Gestor1234! |
      | consultor@sigpro.test | Consul1234! |
```

## Fuera de alcance
- El envío de la petición y su aviso de éxito: la historia de la web «Enviar la petición» de esta misma épica.
- La respuesta de la API a la petición y la validación del correo en el servidor: la historia de la API de esta misma épica.
- El enlace «¿Olvidaste la contraseña?» de la pantalla de acceso y lo que hace al pulsarlo: épica de inicio de sesión (EP-LOGIN).
- El idioma, el tema y los enlaces del pie de la pantalla de acceso: épicas transversales de idioma, tema y páginas legales.
