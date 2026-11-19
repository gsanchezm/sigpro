---
id: US-NAVEGACION-009
tipo: historia
epica: EP-NAVEGACION
titulo: "[Web] Abrir el menú de usuario: Perfil, atajos de teclado y Cerrar sesión"
etiquetas: [web]
relacionadas: [US-NAVEGACION-005, US-NAVEGACION-006, US-LOGIN-008]
verificacion: codigo
cubre: ["/profile"]
---

## Historia
Como persona con una sesión iniciada, quiero un menú con mi nombre y mi rol desde el que abrir mi perfil, ver los atajos de teclado o cerrar la sesión,
para tener a mano lo que hago con mi cuenta desde cualquier pantalla.

## Reglas
- En escritorio, el botón «Menú de usuario» está al final de la cabecera. Muestra un avatar con la inicial del nombre, el nombre de la persona y, debajo, su rol con el nombre del catálogo: «Admin», «Gestor de programas», «Consultor» o «Auditor».
- Al pulsarlo se abre un menú con tres opciones, en este orden: «Perfil», «Atajos de teclado», con la marca «?» a su derecha, y, separada por una línea, «Cerrar sesión».
- «Perfil» lleva a `/profile`.
- «Atajos de teclado» no cambia de página. Muestra un aviso informativo con el título «Atajos de teclado» y el texto «N · nuevo programa — / · buscar — Esc · cerrar», y el menú se cierra.
- «Cerrar sesión» cierra la sesión y lleva a `/login`, donde aparece el aviso «Sesión cerrada correctamente.».
- La tecla Esc y un clic fuera del menú lo cierran sin cambiar de página.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); después se inicia sesión con la cuenta de la fila en `/login?tenant=alumno01`, en un navegador sin ninguna sesión de SIGPRO guardada, y se abre la página indicada en una ventana de 1440 px.

## Criterios de aceptación
```gherkin
Característica: Menú de usuario de la web de escritorio

  Esquema del escenario: El botón del menú de usuario muestra el nombre y el rol de la sesión
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene sesión iniciada en /programs en la web de escritorio
    Cuando pulsa «Menú de usuario»
    Entonces ve el nombre <nombre> y el rol <rol>
    Y ve las opciones «Perfil», «Atajos de teclado» y «Cerrar sesión», en ese orden

    Ejemplos:
      | cuenta | nombre | rol |
      | gestor@sigpro.test | Javier Ortega | Gestor de programas |
      | consultor@sigpro.test | Lucía Fernández | Consultor |
      | alumno01@sigpro.lab | Alumno 01 | Admin |

  Esquema del escenario: Cada opción del menú de usuario hace lo suyo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /nc en la web de escritorio y ha abierto «Menú de usuario»
    Cuando pulsa <opcion>
    Entonces <resultado>

    Ejemplos:
      | opcion | resultado |
      | «Perfil» | llega a /profile y ve la página «Perfil» |
      | «Atajos de teclado» | sigue en /nc, ve el aviso «Atajos de teclado» con el texto «N · nuevo programa — / · buscar — Esc · cerrar» y el menú se cierra |
      | «Cerrar sesión» | llega a /login y ve el aviso «Sesión cerrada correctamente.» |

  Esquema del escenario: La tecla Esc o un clic fuera cierran el menú sin cambiar de página
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /nc en la web de escritorio y ha abierto «Menú de usuario»
    Cuando <accion>
    Entonces el menú se cierra y sigue en /nc

    Ejemplos:
      | accion |
      | pulsa la tecla Esc |
      | pulsa en una zona vacía de la página |
```

## Fuera de alcance
- El contenido de la página «Perfil» y la preferencia de avisos: EP-PERFIL.
- El cierre de sesión en sí, su aviso y lo que garantiza: EP-LOGIN (US-LOGIN-008).
- El menú de usuario del diseño responsive, que está al pie del cajón: US-NAVEGACION-006.
- Los selectores de idioma y de tema de la cabecera: épicas transversales de idioma y de tema.

## Decisiones pendientes
- Si el aviso «Atajos de teclado» debe listar solo los atajos que funcionan en todas las pantallas. Hoy «N» funciona solo en Programas y en Requisitos, y «/» también solo en esas dos pantallas.
