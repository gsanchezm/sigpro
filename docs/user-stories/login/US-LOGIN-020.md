---
id: US-LOGIN-020
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Cerrar sesión y ver el aviso de sesión cerrada"
etiquetas: [web]
relacionadas: [US-LOGIN-009, US-LOGIN-031, US-LOGIN-034]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona con la sesión iniciada, quiero cerrar sesión desde cualquier pantalla y ver que se ha cerrado,
para dejar el equipo sin mi sesión abierta y estar segura de ello.

## Reglas
- «Cerrar sesión» está en el «Menú de usuario» de la cabecera (escritorio), en el menú de navegación (diseño responsive) y en la página Perfil.
- Al cerrar sesión se llega a /login y se ve el aviso de confirmación «Sesión cerrada correctamente.».
- Tras cerrar sesión, ninguna pantalla privada se abre sin volver a iniciar sesión, tampoco con «Mantener la sesión en este equipo» marcada.
- El aviso desaparece cuando se vuelve a intentar entrar con un correo y una contraseña que pasan la validación del formulario, o al ir a otra pantalla de Acceso.
- Abrir /login sin haber cerrado sesión no muestra el aviso.

## Criterios de aceptación
```gherkin
Característica: Cierre de sesión en la web

  Esquema del escenario: Cerrar sesión desde cada punto lleva al acceso con el aviso
    Dado que "<correo>" tiene la sesión iniciada y está en <pantalla> con una ventana de <ancho>
    Cuando pulsa "Cerrar sesión" en <lugar>
    Entonces llega a /login
    Y ve el aviso "Sesión cerrada correctamente."
    Y al abrir /programs vuelve a /login

    Ejemplos:
      | correo | pantalla | ancho | lugar |
      | gestor@sigpro.test | /programs | 1440 px | el Menú de usuario de la cabecera |
      | admin@sigpro.test | /nc | 390 px | el menú de navegación |
      | consultor@sigpro.test | /profile | 1440 px | la página Perfil |

  Esquema del escenario: El aviso solo acompaña al cierre de sesión
    Dado <situacion>
    Cuando <accion>
    Entonces <aviso>

    Ejemplos:
      | situacion | accion | aviso |
      | que "gestor@sigpro.test" acaba de cerrar sesión | mira /login | ve "Sesión cerrada correctamente." |
      | que "gestor@sigpro.test" acaba de cerrar sesión | pulsa "Entrar" con la contraseña "incorrecta" | ya no ve "Sesión cerrada correctamente." y ve "Correo o contraseña incorrectos" |
      | que "gestor@sigpro.test" acaba de cerrar sesión | pulsa "¿Olvidaste la contraseña?" y vuelve con "Volver al inicio de sesión" | ya no ve "Sesión cerrada correctamente." |
      | una persona que no ha iniciado sesión | abre /login | no ve "Sesión cerrada correctamente." |
```

## Fuera de alcance
- Lo que el servidor hace con el token de renovación al cerrar sesión (épica de Sesión y renovación de token).
