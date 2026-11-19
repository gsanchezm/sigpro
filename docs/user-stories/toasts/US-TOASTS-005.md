---
id: US-TOASTS-005
tipo: historia
epica: EP-TOASTS
titulo: "[Web] Avisos informativos y de advertencia con su texto exacto"
etiquetas: [web]
relacionadas: [US-TOASTS-001, US-TOASTS-004]
verificacion: codigo
---

## Historia
Como persona que usa SIGPRO desde la web, quiero que un aviso informativo me enseñe lo que he pedido sin cambiar nada, y que un aviso de advertencia me diga por qué no se ha hecho lo que intenté,
para entender el resultado sin tener que revisar después los datos.

## Reglas
- Un aviso informativo muestra lo que se ha pedido o lo que ya está listo, y no cambia ningún dato. Con «Atajos de teclado», el cuerpo es la lista de atajos; con una descarga, el cuerpo es el nombre del archivo.
- Un aviso de advertencia dice por qué no se ha hecho la acción. Por eso no llega ninguna petición al servidor y el dato de la pantalla no cambia.
- Los textos de esta historia son exactos: «Atajos de teclado» con el cuerpo «N · nuevo programa — / · buscar — Esc · cerrar»; «Descarga iniciada»; «El comentario rápido no puede estar vacío».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` inicia sesión con `Gestor1234!` en `/login?tenant=alumno01`, como indica la épica de inicio de sesión (EP-LOGIN), hasta llegar a /programs. Antes de cada fila el caos del tenant está apagado (`GET /api/config` devuelve latencia 0 y tasa de error 0; si no, se apaga con `PATCH /api/admin/chaos` y el token de `alumno01@sigpro.lab`).

## Criterios de aceptación
```gherkin
Característica: Avisos informativos y de advertencia en la web

  Esquema del escenario: Una acción informativa muestra su aviso con el texto que corresponde
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs
    Cuando <accion>
    Entonces ve un aviso informativo con el título <titulo>
    Y el aviso tiene el cuerpo <cuerpo>

    Ejemplos:
      | accion | titulo | cuerpo |
      | abre el menú de su avatar y pulsa «Atajos de teclado» | «Atajos de teclado» | «N · nuevo programa — / · buscar — Esc · cerrar» |
      | va a la lista de documentos, abre las acciones de DOC-002 y pulsa «Descargar PDF» | «Descarga iniciada» | DOC-002-v1.pdf |

  Esquema del escenario: Un comentario rápido sin texto muestra un aviso de advertencia y no se guarda
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /nc
    Cuando abre las acciones de NC-001, pulsa «Comentario rápido…» y acepta el cuadro del navegador con <texto>
    Entonces ve un aviso de advertencia con el título «El comentario rápido no puede estar vacío»
    Y NC-001 no tiene ningún comentario nuevo

    Ejemplos:
      | texto |
      | (vacío) |
      | (tres espacios) |
```

## Fuera de alcance
- El aviso de éxito, de error y el cierre con «Cerrar»: las historias de esta épica para la web y las transversales.
- Los demás avisos informativos y de advertencia de la web, con su acción: las épicas de cada pantalla.
- La línea de detalle técnico de los avisos de error: decisión pendiente descrita en la historia de error del servidor.
