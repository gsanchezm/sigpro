---
id: US-LOGIN-024
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Elegir el tenant de trabajo al iniciar sesión"
etiquetas: [movil]
relacionadas: [US-LOGIN-008]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como alumna o alumno con un tenant propio, quiero indicar en la pantalla de acceso de la app en qué tenant trabajo,
para entrar en mis datos y no en los del tenant de demostración.

## Reglas
- El formulario de acceso tiene el campo «Tenant de trabajo», sin mayúscula inicial ni autocorrección.
- El inicio de sesión se hace en el tenant escrito en ese campo; una cuenta que solo existe en otro tenant no entra y se ve el aviso de credenciales incorrectas.
- El campo muestra el último tenant usado en la app, también después de cerrarla y volver a abrirla.
- Si el campo se deja vacío, se usa el tenant por defecto de la instalación (`demo`).

## Criterios de aceptación
```gherkin
Característica: Tenant de trabajo en la app móvil

  Esquema del escenario: El inicio de sesión ocurre en el tenant escrito
    Dado una persona sin sesión en /login que escribe "<tenant>" en "Tenant de trabajo"
    Cuando entra con el correo "<correo>" y la contraseña "<contraseña>"
    Entonces <resultado>

    Ejemplos:
      | tenant | correo | contraseña | resultado |
      | alumno01 | alumno01@sigpro.lab | Alumno1234! | llega a /programs con los datos del tenant alumno01 |
      | alumno01 | gestor@sigpro.test | Gestor1234! | llega a /programs con los datos del tenant alumno01 |
      | demo | gestor@sigpro.test | Gestor1234! | llega a /programs con los datos del tenant demo |
      | demo | alumno01@sigpro.lab | Alumno1234! | ve "Correo o contraseña incorrectos" y sigue sin sesión |
      | alumno02 | alumno01@sigpro.lab | Alumno1234! | ve "Correo o contraseña incorrectos" y sigue sin sesión |

  Esquema del escenario: La app recuerda el último tenant usado
    Dado que la última vez se entró en el tenant "<anterior>" y después se cerró sesión
    Cuando cierra la app y la vuelve a abrir en /login
    Entonces "Tenant de trabajo" contiene "<anterior>"

    Ejemplos:
      | anterior |
      | alumno01 |
      | alumno25 |
```

## Fuera de alcance
- El aislamiento de los datos entre tenants una vez iniciada la sesión (épica transversal de multi-tenant).
