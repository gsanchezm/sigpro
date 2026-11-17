---
id: US-LOGIN-011
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Formulario de acceso: elementos, tenant de trabajo y validación antes de enviar"
etiquetas: [movil]
relacionadas: [US-LOGIN-001, US-LOGIN-006, US-LOGIN-012]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona sin sesión iniciada en la app móvil, quiero un formulario de acceso claro en el que indico mi tenant de trabajo y que me dice qué campo está mal antes de enviarlo,
para entrar en los datos de mi organización sin gastar intentos y encontrar en la misma pantalla cómo recuperar la contraseña o pedir una cuenta.

## Reglas
- La pantalla de acceso muestra el título «Iniciar sesión» y el texto «Accede con tu cuenta corporativa de SIGPRO.».
- El formulario tiene, en este orden: «Correo electrónico» (con el ejemplo «nombre@organizacion.es» mientras está vacío), «Contraseña», «Tenant de trabajo», el botón «Entrar», «¿Olvidaste la contraseña?» y la línea «¿Sin cuenta?» con «Solicitar acceso».
- El campo de correo abre el teclado de correo electrónico, sin mayúscula inicial ni autocorrección; la contraseña se escribe oculta.
- «¿Olvidaste la contraseña?» lleva a /forgot con el correo ya escrito, si lo hay; «Solicitar acceso» lleva a /register. Desde las dos, «Volver al inicio de sesión» regresa a /login.
- Con una sesión ya iniciada en la app, abrir /login lleva directamente a /programs.
- **Tenant de trabajo.** El campo no lleva mayúscula inicial ni autocorrección. El inicio de sesión se hace en el tenant escrito: una cuenta que solo existe en otro tenant no entra y se ve el aviso de credenciales incorrectas. El campo muestra el último tenant usado en la app, también después de cerrarla y volver a abrirla, y nunca queda vacío: al borrar todo su contenido pasa a mostrar el tenant por defecto de la instalación (`demo`).
- **Validación antes de enviar.** Son las mismas reglas que en la web y en el servidor. Al pulsar «Entrar», si algún campo no es válido, no se envía nada y cada campo con problema muestra su aviso debajo:
  - «Correo electrónico» es obligatorio («Campo obligatorio»); se ignoran los espacios del principio y del final. Debe tener la forma `texto@dominio.extensión`, sin espacios y con una sola `@` («Introduce un correo válido»).
  - «Contraseña» es obligatoria («Campo obligatorio»); basta con un carácter.
  - Al cambiar el correo o la contraseña desaparecen los avisos de los campos, como en la web.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y también `alumno02` o `alumno25` cuando la fila los usa, con el token de `alumno02@sigpro.lab` o `alumno25@sigpro.lab` (misma contraseña). Después la app está en /login sin ninguna sesión de SIGPRO guardada en el dispositivo (en Expo web, en el navegador) y con `alumno01` en «Tenant de trabajo», salvo que la fila diga otra cosa; si la fila dice que alguien ha iniciado sesión, lo hace en la propia fila.
- En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución (`nadie-` seguido de una marca de tiempo y `@sigpro.test`). `(cuenta recién solicitada en alumno01)` es una solicitud de acceso hecha en la propia fila en el tenant `alumno01` («Solicitar acceso» con `alumno01` en «Tenant de trabajo») con un correo nuevo (`nueva-` seguido de una marca de tiempo y `@organizacion.es`) y la contraseña `Abcdefghij1!`.

## Criterios de aceptación
```gherkin
Característica: Formulario de acceso en la app móvil

  Esquema del escenario: Las opciones del formulario llevan a su pantalla
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login, con alumno01 en «Tenant de trabajo», ha escrito el correo <correo>
    Cuando pulsa <opcion>
    Entonces llega a <ruta> y ve el título <titulo>
    Y <correo_destino>

    Ejemplos:
      | correo | opcion | ruta | titulo | correo_destino |
      | (vacío) | «¿Olvidaste la contraseña?» | /forgot | «Recuperar contraseña» | el campo de correo está vacío |
      | gestor@sigpro.test | «¿Olvidaste la contraseña?» | /forgot | «Recuperar contraseña» | el campo de correo contiene gestor@sigpro.test |
      | (vacío) | «Solicitar acceso» | /register | «Solicitar acceso» | el formulario de solicitud está vacío |

  Esquema del escenario: Con una sesión iniciada no se vuelve a pedir el acceso
    Dado que el tenant alumno01 está recién reiniciado y en la app <situacion>
    Cuando abre /login
    Entonces <resultado>

    Ejemplos:
      | situacion | resultado |
      | nadie ha iniciado sesión | ve el título «Iniciar sesión» con el formulario de acceso |
      | gestor@sigpro.test ha iniciado sesión en alumno01 con Gestor1234! | llega a /programs sin ver el formulario |

  Esquema del escenario: El inicio de sesión ocurre en el tenant escrito
    Dado que los tenants alumno01 y alumno02 están recién reiniciados y una persona sin sesión iniciada en /login escribe <tenant> en «Tenant de trabajo»
    Cuando escribe el correo <correo> y la contraseña <contraseña> y pulsa «Entrar»
    Entonces <resultado>

    Ejemplos:
      | tenant | correo | contraseña | resultado |
      | alumno01 | alumno01@sigpro.lab | Alumno1234! | llega a /programs y la página «Perfil» muestra el tenant alumno01 |
      | alumno01 | gestor@sigpro.test | Gestor1234! | llega a /programs y la página «Perfil» muestra el tenant alumno01 |
      | alumno02 | gestor@sigpro.test | Gestor1234! | llega a /programs y la página «Perfil» muestra el tenant alumno02 |
      | alumno02 | (cuenta recién solicitada en alumno01) | Abcdefghij1! | ve «Correo o contraseña incorrectos» y sigue sin sesión |

  Esquema del escenario: La app recuerda el último tenant usado
    Dado que el tenant <anterior> está recién reiniciado y en la app gestor@sigpro.test ha iniciado sesión con Gestor1234! y <anterior> en «Tenant de trabajo», y después ha pulsado «Cerrar sesión» en la página «Perfil»
    Cuando cierra la app y la vuelve a abrir en /login
    Entonces «Tenant de trabajo» contiene <anterior>

    Ejemplos:
      | anterior |
      | alumno01 |
      | alumno25 |

  Esquema del escenario: El campo de tenant no se queda vacío
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login tiene <tenant> en «Tenant de trabajo»
    Cuando borra todo el contenido del campo
    Entonces el campo muestra demo

    Ejemplos:
      | tenant |
      | alumno01 |
      | demo |

  Esquema del escenario: Cada campo no válido muestra su aviso y no se envía nada
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /login con alumno01 en «Tenant de trabajo»
    Cuando escribe el correo <correo> y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces bajo el correo ve <aviso_correo>
    Y bajo la contraseña ve <aviso_contraseña>
    Y <envio>

    Ejemplos:
      | correo | contraseña | aviso_correo | aviso_contraseña | envio |
      | (vacío) | (vacío) | «Campo obligatorio» | «Campo obligatorio» | no se envía nada |
      | (tres espacios) | Gestor1234! | «Campo obligatorio» | (ninguno) | no se envía nada |
      | no-es-un-correo | Gestor1234! | «Introduce un correo válido» | (ninguno) | no se envía nada |
      | ana@sigpro | Gestor1234! | «Introduce un correo válido» | (ninguno) | no se envía nada |
      | gestor@sigpro.test | (vacío) | (ninguno) | «Campo obligatorio» | no se envía nada |
      | (correo sin cuenta) | x | (ninguno) | (ninguno) | se envía y ve «Correo o contraseña incorrectos» |
      | gestor@sigpro.test | Gestor1234! | (ninguno) | (ninguno) | se envía y llega a /programs |

  Esquema del escenario: Editar un campo borra los avisos de los campos
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login, con alumno01 en «Tenant de trabajo», ha pulsado «Entrar» con los dos campos vacíos y ve «Campo obligatorio» bajo el correo y bajo la contraseña
    Cuando escribe <texto> en el campo <campo>
    Entonces ya no ve ningún aviso bajo los campos

    Ejemplos:
      | campo | texto |
      | «Correo electrónico» | g |
      | «Contraseña» | x |
```

## Fuera de alcance
- Lo que ocurre al enviar unas credenciales válidas o rechazadas: historia de inicio de sesión en el móvil de esta épica.
- El panel «Usuarios de prueba», el idioma y el tema de la cabecera y los enlaces del pie: épicas de configuración de la plataforma, idioma, tema y páginas legales.
- El aislamiento de los datos entre tenants una vez iniciada la sesión: épica transversal de multi-tenant.
