---
id: US-TOASTS-001
tipo: historia
epica: EP-TOASTS
titulo: "[Transversal] Cuatro tonos de aviso: qué indica cada uno, su título y su cuerpo"
etiquetas: [transversal]
relacionadas: [US-TOASTS-004, US-TOASTS-006]
verificacion: ejecutada
---

## Historia
Como persona que usa SIGPRO desde la web o desde la app móvil, quiero que cada aviso emergente me diga con su tono si la acción salió bien, falló, es informativa o no se pudo intentar, y que lleve un título que se entienda sin abrir nada más,
para saber de un vistazo qué ha pasado y qué debo hacer después.

## Reglas
- Hay cuatro tonos: de éxito, de error, informativo y de advertencia. El tono se ve en la franja del borde izquierdo del aviso, pintada con el color del tono.
- **De éxito:** la acción se completó y el servidor confirmó el cambio. Ejemplo: «PRG-001 archivado», al archivar un programa.
- **De error:** la acción no se completó porque el servidor respondió con un fallo o no respondió. Ejemplo: «Ha ocurrido un error inesperado».
- **Informativo:** algo está listo o ha empezado, sin cambiar ningún dato. Ejemplo: «Descarga iniciada», con el nombre del archivo debajo.
- **De advertencia:** la acción no se intenta porque el rol de la persona no la permite o porque falta un dato, y por eso no se envía nada al servidor. Ejemplo: «El comentario rápido no puede estar vacío».
- Cada aviso tiene un título, que es el texto que da la pantalla. El cuerpo es opcional: va debajo del título, con letra más pequeña, y solo aparece si la pantalla lo da. Un aviso sin cuerpo tiene solo el título.
- El aviso no bloquea la pantalla: mientras está visible, lo que hay debajo sigue pudiendo usarse.
- Los textos son los del catálogo de la interfaz en español. Cada fila de los Ejemplos dice la acción que produce el aviso y la pantalla donde se hace.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` inicia sesión con `Gestor1234!` en el tenant `alumno01`, como indica la épica de inicio de sesión (EP-LOGIN), hasta llegar a /programs o a /documents según la fila. Antes de cada fila el caos del tenant está apagado: `GET /api/config` devuelve latencia 0 y tasa de error 0; si no, se apaga con `PATCH /api/admin/chaos` y el token de `alumno01@sigpro.lab`.

## Criterios de aceptación
```gherkin
Característica: Tonos de los avisos emergentes

  Esquema del escenario: Una acción que sale bien muestra un aviso de éxito con su título y su cuerpo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs
    Cuando <accion>
    Entonces ve un aviso de éxito con el título <titulo>
    Y el aviso tiene el cuerpo <cuerpo>

    Ejemplos:
      | accion | titulo | cuerpo |
      | abre las acciones de PRG-001 y pulsa «Archivar» | «PRG-001 archivado» | (sin cuerpo) |
      | abre las acciones de PRG-001 y pulsa «Duplicar» | «PRG-025 programa creado» | «Copia creada como borrador» |

  Esquema del escenario: Una acción informativa muestra el aviso con el nombre del archivo que se descarga
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /documents
    Cuando <accion>
    Entonces ve un aviso informativo con el título <titulo>
    Y el aviso tiene el cuerpo <cuerpo>

    Ejemplos:
      | accion | titulo | cuerpo |
      | abre las acciones de DOC-001 y pulsa «Descargar PDF» | «Descarga iniciada» | DOC-001-v3.pdf |
      | abre las acciones de DOC-002 y pulsa «Descargar PDF» | «Descarga iniciada» | DOC-002-v1.pdf |
```

## Fuera de alcance
- El rol con el que se anuncia el aviso de error: la historia de error del servidor de esta épica.
- El texto de cada aviso concreto y la acción que lo produce: las épicas de cada pantalla (EP-PROG-GESTION, EP-NC-TABLERO, EP-DOC-LISTA).
- El cierre a mano con «Cerrar» y la posición del aviso: las historias de web y de móvil de esta épica.

## Decisiones pendientes
- Si el tono se indica también con texto o con un icono, y no solo con el color de la franja. Hoy solo se indica con el color.
