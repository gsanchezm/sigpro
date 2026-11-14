---
id: US-LOGIN-006
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Formulario de acceso: elementos, validación antes de enviar y mostrar la contraseña"
etiquetas: [web]
relacionadas: [US-LOGIN-001, US-LOGIN-007, US-LOGIN-011, US-LOGIN-014]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona sin sesión iniciada, quiero en /login un formulario claro que me diga qué campo está mal antes de enviarlo y me deje comprobar la contraseña,
para entrar sin gastar intentos o encontrar en la misma pantalla cómo recuperar la contraseña o pedir una cuenta.

## Reglas
- /login muestra el título «Iniciar sesión» y el texto «Accede con tu cuenta corporativa de SIGPRO.».
- El formulario tiene, en este orden: el campo «Correo electrónico», el campo «Contraseña» con «¿Olvidaste la contraseña?» junto a su etiqueta, la casilla «Mantener la sesión en este equipo», el botón «Entrar», un separador «o», el botón «Acceder con certificado digital / SSO» y la línea «¿Sin cuenta?» con «Solicitar acceso».
- Al abrir la página el foco está en «Correo electrónico», la contraseña se muestra oculta y la casilla «Mantener la sesión en este equipo» aparece marcada.
- «¿Olvidaste la contraseña?» lleva a /forgot y «Solicitar acceso» lleva a /register; desde las dos, «Volver al inicio de sesión» regresa a /login.
- Con una sesión ya iniciada en el navegador, abrir /login lleva directamente a /programs sin mostrar el formulario.
- **Validación antes de enviar.** Al pulsar «Entrar», si algún campo no es válido, el formulario no se envía y cada campo con problema muestra su aviso debajo y queda marcado como no válido. Son las mismas reglas que aplica el servidor:
  - «Correo electrónico» es obligatorio («Campo obligatorio»); se ignoran los espacios del principio y del final, así que un correo de solo espacios está vacío. Debe tener la forma `texto@dominio.extensión`, sin espacios y con una sola `@` («Introduce un correo válido»).
  - «Contraseña» es obligatoria («Campo obligatorio»); basta con un carácter, y un espacio cuenta como carácter.
  - Al cambiar el correo o la contraseña desaparecen los avisos de los campos.
- **Mostrar la contraseña.** Dentro del campo «Contraseña» hay un botón con el texto visible «Mostrar» y el nombre accesible «Mostrar contraseña». Al pulsarlo la contraseña se ve en claro, el botón pasa a «Ocultar» (nombre accesible «Ocultar contraseña») y queda marcado como pulsado; al pulsarlo otra vez vuelve a ocultarse. Mostrar u ocultar no cambia lo escrito ni envía el formulario.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada; si la fila dice que alguien ha iniciado sesión, lo hace después del reinicio, en la propia fila. Así cada fila es independiente: un envío con la contraseña incorrecta cuenta como intento fallido.
- En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución: `nadie-` seguido de una marca de tiempo y `@sigpro.test`.

## Criterios de aceptación
```gherkin
Característica: Formulario de acceso en la web

  Esquema del escenario: Estado inicial de cada elemento del formulario
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada abre /login?tenant=alumno01
    Cuando mira el formulario
    Entonces <elemento> <estado>

    Ejemplos:
      | elemento | estado |
      | «Iniciar sesión» | es el título de la página, con el texto «Accede con tu cuenta corporativa de SIGPRO.» |
      | «Correo electrónico» | está vacío y tiene el foco |
      | «Contraseña» | está vacía y oculta lo que se escribe |
      | «Mantener la sesión en este equipo» | está marcada |
      | «Entrar» | está habilitado |
      | «Acceder con certificado digital / SSO» | está habilitado |

  Esquema del escenario: Las opciones del formulario llevan a su pantalla
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /login?tenant=alumno01
    Cuando pulsa <opcion>
    Entonces en menos de 5 segundos llega a <ruta> y ve el título <titulo>
    Y al pulsar «Volver al inicio de sesión» en menos de 5 segundos regresa a /login

    Ejemplos:
      | opcion | ruta | titulo |
      | «¿Olvidaste la contraseña?» | /forgot | «Recuperar contraseña» |
      | «Solicitar acceso» | /register | «Solicitar acceso» |

  Esquema del escenario: Con una sesión iniciada no se vuelve a pedir el acceso
    Dado que el tenant alumno01 está recién reiniciado y en este navegador <situacion>
    Cuando abre /login?tenant=alumno01
    Entonces <resultado>

    Ejemplos:
      | situacion | resultado |
      | nadie ha iniciado sesión | en menos de 5 segundos ve el formulario «Iniciar sesión» |
      | gestor@sigpro.test ha iniciado sesión en alumno01 con Gestor1234! | en menos de 5 segundos llega a /programs sin ver el formulario |
      | consultor@sigpro.test ha iniciado sesión en alumno01 y después ha pulsado «Cerrar sesión» | en menos de 5 segundos ve el formulario «Iniciar sesión» |

  Esquema del escenario: Cada campo no válido muestra su aviso y no se envía nada
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /login?tenant=alumno01
    Cuando escribe el correo <correo> y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces en menos de 1 segundo, bajo el correo ve <aviso_correo>
    Y bajo la contraseña ve <aviso_contraseña>
    Y <envio>

    Ejemplos:
      | correo | contraseña | aviso_correo | aviso_contraseña | envio |
      | (vacío) | (vacío) | «Campo obligatorio» | «Campo obligatorio» | no se envía el formulario |
      | (tres espacios) | Gestor1234! | «Campo obligatorio» | (ninguno) | no se envía el formulario |
      | no-es-un-correo | Gestor1234! | «Introduce un correo válido» | (ninguno) | no se envía el formulario |
      | ana@sigpro | Gestor1234! | «Introduce un correo válido» | (ninguno) | no se envía el formulario |
      | @sigpro.test | Gestor1234! | «Introduce un correo válido» | (ninguno) | no se envía el formulario |
      | (ana @sigpro.test, con un espacio antes de la arroba) | Gestor1234! | «Introduce un correo válido» | (ninguno) | no se envía el formulario |
      | gestor@sigpro.test | (vacío) | (ninguno) | «Campo obligatorio» | no se envía el formulario |
      | gestor@sigpro.test | (un espacio) | (ninguno) | (ninguno) | se envía y en menos de 5 segundos ve el aviso «Correo o contraseña incorrectos» |
      | (correo sin cuenta) | x | (ninguno) | (ninguno) | se envía y en menos de 5 segundos ve el aviso «Correo o contraseña incorrectos» |
      | gestor@sigpro.test | Gestor1234! | (ninguno) | (ninguno) | se envía y en menos de 5 segundos llega a /programs |

  Esquema del escenario: Editar un campo borra los avisos de los campos
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login?tenant=alumno01 ha pulsado «Entrar» con los dos campos vacíos y ve «Campo obligatorio» bajo el correo y bajo la contraseña
    Cuando escribe <texto> en el campo <campo>
    Entonces en menos de 1 segundo ya no ve ningún aviso bajo los campos

    Ejemplos:
      | campo | texto |
      | «Correo electrónico» | g |
      | «Contraseña» | x |

  Esquema del escenario: El botón alterna la visibilidad de la contraseña
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login?tenant=alumno01 ha escrito Gestor1234! en el campo «Contraseña»
    Cuando pulsa el botón de la contraseña <veces> veces
    Entonces la contraseña se ve <visibilidad>
    Y el botón muestra <texto> y se llama <nombre>
    Y el botón <pulsado>
    Y el campo sigue conteniendo Gestor1234! y sigue en /login sin haber enviado nada

    Ejemplos:
      | veces | visibilidad | texto | nombre | pulsado |
      | 0 | oculta | «Mostrar» | «Mostrar contraseña» | no está marcado como pulsado |
      | 1 | en claro | «Ocultar» | «Ocultar contraseña» | está marcado como pulsado |
      | 2 | oculta | «Mostrar» | «Mostrar contraseña» | no está marcado como pulsado |
      | 3 | en claro | «Ocultar» | «Ocultar contraseña» | está marcado como pulsado |
```

## Fuera de alcance
- Lo que ocurre al enviar unas credenciales válidas o rechazadas: historia de inicio de sesión en la web de esta épica.
- El panel «Usuarios de prueba», el idioma y el tema de la cabecera y los enlaces del pie: épicas de configuración de la plataforma, idioma, tema y páginas legales.
