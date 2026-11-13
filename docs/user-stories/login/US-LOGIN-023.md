---
id: US-LOGIN-023
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Mostrar el formulario de acceso y sus enlaces"
etiquetas: [movil]
relacionadas: [US-LOGIN-011]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona sin sesión en la app móvil, quiero ver un formulario de acceso claro con las otras opciones de acceso a mano,
para entrar o encontrar enseguida cómo recuperar la contraseña o pedir una cuenta.

## Reglas
- La pantalla de acceso muestra el título «Iniciar sesión» y el texto «Accede con tu cuenta corporativa de SIGPRO.».
- El formulario tiene, en este orden: «Correo electrónico» (con el ejemplo «nombre@organizacion.es» mientras está vacío), «Contraseña», «Tenant de trabajo» (US-LOGIN-024), el botón «Entrar», «¿Olvidaste la contraseña?» y la línea «¿Sin cuenta?» con «Solicitar acceso».
- El campo de correo abre el teclado de correo electrónico, sin mayúscula inicial ni autocorrección; la contraseña se escribe oculta.
- «¿Olvidaste la contraseña?» lleva a /forgot con el correo ya escrito, si lo hay; «Solicitar acceso» lleva a /register. Desde las dos, «Volver al inicio de sesión» regresa a /login.
- Con una sesión ya iniciada, abrir /login lleva directamente a /programs.

## Criterios de aceptación
```gherkin
Característica: Formulario de acceso en la app móvil

  Esquema del escenario: Las opciones del formulario llevan a su pantalla
    Dado una persona sin sesión en /login que ha escrito el correo <correo>
    Cuando pulsa "<opcion>"
    Entonces llega a <ruta> y ve el título "<titulo>"
    Y <correo_destino>

    Ejemplos:
      | correo | opcion | ruta | titulo | correo_destino |
      | (vacío) | ¿Olvidaste la contraseña? | /forgot | Recuperar contraseña | el campo de correo está vacío |
      | gestor@sigpro.test | ¿Olvidaste la contraseña? | /forgot | Recuperar contraseña | el campo de correo contiene "gestor@sigpro.test" |
      | (vacío) | Solicitar acceso | /register | Solicitar acceso | el formulario de solicitud está vacío |

  Esquema del escenario: Con sesión no se vuelve a pedir el acceso
    Dado <situacion>
    Cuando abre /login
    Entonces <resultado>

    Ejemplos:
      | situacion | resultado |
      | una persona sin sesión | ve el título "Iniciar sesión" con el formulario de acceso |
      | "gestor@sigpro.test" con la sesión iniciada | llega a /programs sin ver el formulario |
```

## Fuera de alcance
- El panel «Usuarios de prueba», el idioma y el tema de la cabecera y los enlaces del pie.
