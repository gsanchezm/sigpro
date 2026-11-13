---
id: US-LOGIN-011
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Mostrar el formulario de acceso y sus enlaces"
etiquetas: [web]
relacionadas: [US-LOGIN-023]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona sin sesión, quiero ver en /login un formulario claro con las otras opciones de acceso a mano,
para entrar o encontrar enseguida cómo recuperar la contraseña o pedir una cuenta.

## Reglas
- /login muestra el título «Iniciar sesión» y el texto «Accede con tu cuenta corporativa de SIGPRO.».
- El formulario tiene, en este orden: el campo «Correo electrónico», el campo «Contraseña» con «¿Olvidaste la contraseña?» junto a su etiqueta, la casilla «Mantener la sesión en este equipo», el botón «Entrar», un separador «o», el botón «Acceder con certificado digital / SSO» y la línea «¿Sin cuenta?» con «Solicitar acceso».
- Al abrir la página el foco está en «Correo electrónico».
- La contraseña se muestra oculta y la casilla «Mantener la sesión en este equipo» aparece marcada.
- «¿Olvidaste la contraseña?» lleva a /forgot y «Solicitar acceso» lleva a /register; desde las dos, «Volver al inicio de sesión» regresa a /login.
- Con una sesión ya iniciada, abrir /login lleva directamente a /programs sin mostrar el formulario.

## Criterios de aceptación
```gherkin
Característica: Formulario de acceso en la web

  Esquema del escenario: Estado inicial de cada elemento del formulario
    Dado que una persona sin sesión abre /login
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
    Dado que una persona sin sesión está en /login
    Cuando pulsa <opcion>
    Entonces llega a <ruta> y ve el título <titulo>
    Y al pulsar «Volver al inicio de sesión» regresa a /login

    Ejemplos:
      | opcion | ruta | titulo |
      | «¿Olvidaste la contraseña?» | /forgot | «Recuperar contraseña» |
      | «Solicitar acceso» | /register | «Solicitar acceso» |

  Esquema del escenario: Con sesión no se vuelve a pedir el acceso
    Dado que <situacion>
    Cuando abre /login
    Entonces <resultado>

    Ejemplos:
      | situacion | resultado |
      | una persona no tiene sesión | ve el formulario «Iniciar sesión» |
      | gestor@sigpro.test tiene la sesión iniciada | llega a /programs sin ver el formulario |
      | consultor@sigpro.test acaba de cerrar sesión | ve el formulario «Iniciar sesión» |
```

## Fuera de alcance
- El panel «Usuarios de prueba», el idioma y el tema de la cabecera y los enlaces del pie.
