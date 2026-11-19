---
id: US-PROG-GESTION-008
tipo: historia
epica: EP-PROG-GESTION
titulo: "[Web] Confirmar o cancelar el borrado de programas en un diálogo"
etiquetas: [web]
relacionadas: [US-LOGIN-007, US-PROG-GESTION-003, US-PROG-GESTION-006, US-PROG-GESTION-007, US-PROG-GESTION-011]
verificacion: codigo
cubre: ["/programs"]
permisos: [program.delete]
---

## Historia
Como administrador que va a borrar uno o varios programas, quiero un diálogo que diga qué se va a borrar y que me deje cancelar,
para no perder un programa por un clic sin querer.

## Reglas
- El diálogo se titula «Eliminar programa». Es un diálogo de confirmación: al abrirse, el foco está en el botón «Eliminar».
- El texto cambia con el número de programas. Con uno: «PRG-001 se eliminará de forma permanente junto con sus requisitos y documentos.». Con dos o más: «N programas se eliminarán de forma permanente.», donde N es el número.
- Los botones son «Cancelar» y «Eliminar». «Cancelar» y la tecla Esc cierran el diálogo sin borrar nada.
- Mientras se borra, el botón «Eliminar» queda deshabilitado, con el motivo «Procesando…» como texto de ayuda.
- Al confirmar y tener éxito, el diálogo se cierra y aparece el aviso de éxito de la acción.
- Si la API falla, el diálogo también se cierra y aparece el aviso de error con el título «Ha ocurrido un error inesperado» y la traza HTTP.
- El mismo diálogo sirve para un programa del menú de su fila (US-PROG-GESTION-006) y para varios de la barra de acciones masivas (US-PROG-GESTION-007).
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe `admin@sigpro.test` con `Admin1234!`, se completa el segundo paso con el código `123456` y se llega a `/programs`.

## Criterios de aceptación
```gherkin
Característica: Diálogo de confirmación del borrado de programas

  Esquema del escenario: El diálogo nombra lo que se va a borrar según el número de programas
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test, con el segundo factor completado, ha entrado en /programs sin filtros en escritorio y ha pedido eliminar <programas> con <via>
    Cuando el diálogo «Eliminar programa» está abierto
    Entonces el diálogo dice <texto>
    Y el foco está en «Eliminar»

    Ejemplos:
      | programas | via | texto |
      | PRG-001 | su menú de acciones | «PRG-001 se eliminará de forma permanente junto con sus requisitos y documentos.» |
      | PRG-001 y PRG-002 | la barra de acciones masivas, con esos dos programas marcados | «2 programas se eliminarán de forma permanente.» |

  Esquema del escenario: Cancelar o Esc cierran el diálogo sin borrar nada
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test, con el segundo factor completado, ha pedido eliminar PRG-001 desde su menú de acciones en /programs sin filtros en escritorio
    Cuando pulsa <salida>
    Entonces el diálogo se cierra
    Y PRG-001 sigue en la lista y el recuento dice «1–10 de 24»

    Ejemplos:
      | salida |
      | «Cancelar» |
      | la tecla Esc |

  Esquema del escenario: Eliminar en el diálogo borra el programa y avisa del resultado
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test, con el segundo factor completado, ha pedido eliminar PRG-001 desde su menú de acciones en /programs sin filtros en escritorio
    Cuando pulsa «Eliminar» en el diálogo
    Entonces el diálogo se cierra
    Y aparece el aviso de éxito <aviso> y el recuento dice <recuento>

    Ejemplos:
      | aviso | recuento |
      | «PRG-001 eliminado» | «1–10 de 23» |
```

## Decisiones pendientes
- Si el texto debe nombrar también lo que se borra en cascada además de los requisitos y los documentos (hitos, casos de prueba y no conformidades). Hoy el texto de un programa nombra solo requisitos y documentos, y el de varios no nombra nada de eso.

## Fuera de alcance
- Qué se borra exactamente en la API: US-PROG-GESTION-003.
- Las acciones que abren el diálogo: US-PROG-GESTION-006 y US-PROG-GESTION-007.
- La versión de la app móvil, con su hoja de confirmación: US-PROG-GESTION-011.
