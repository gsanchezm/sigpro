---
id: US-DOC-LISTA-014
tipo: historia
epica: EP-DOC-LISTA
titulo: "[iOS] Entregar el PDF de un documento a la hoja de compartir de iOS"
etiquetas: [ios]
relacionadas: [US-DOC-LISTA-011, US-DOC-LISTA-012, US-DOC-LISTA-015]
verificacion: pendiente-nativo
cubre: ["/documents/:id"]
---

## Historia
Como persona que consulta documentos desde un iPhone, quiero que descargar el PDF de un documento abra la hoja de compartir de iOS con el archivo,
para guardarlo o enviarlo con las apps que tengo en el teléfono.

## Reglas
- En iOS no hay una carpeta de descargas a la que la app pueda escribir. Por eso «Descargar PDF» guarda una copia temporal del PDF con su nombre (`<código>-v<versión>.pdf`) y abre la hoja de compartir de iOS con esa copia, como archivo PDF.
- Lo que se descarga es la versión marcada en la ficha, o la última si la descarga se pide desde el menú ⋯ de la tarjeta en la lista.
- La descarga no abre ninguna pestaña del navegador.
- Mientras se prepara la copia, el botón «Descargar PDF» queda ocupado y no se puede volver a pulsar.
- Si el dispositivo no puede compartir archivos, aparece el aviso «No se pudo descargar el documento» con el motivo que da la plataforma.
- Preparación de cada fila: la prueba se hace en un iPhone o en un Simulador de iOS con la app instalada. Se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y `gestor@sigpro.test` (contraseña `Gestor1234!`) entra en ella.

## Criterios de aceptación
```gherkin
Característica: Entrega del PDF a la hoja de compartir en iOS

  Esquema del escenario: La descarga abre la hoja de compartir de iOS con el PDF de la versión pedida
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app de iOS y está en /documents
    Cuando <accion>
    Entonces se abre la hoja de compartir de iOS con el archivo <archivo>, de tipo PDF

    Ejemplos:
      | accion | archivo |
      | abre la ficha de DOC-001, toca la versión 2 en el selector de versiones y pulsa «Descargar PDF» | DOC-001-v2.pdf |
      | abre la ficha de DOC-001 y pulsa «Descargar PDF» con la última versión marcada | DOC-001-v3.pdf |
      | abre el menú ⋯ de la tarjeta de DOC-001 y elige «Descargar PDF» | DOC-001-v3.pdf |
```

## Decisiones pendientes
- Si el nombre del archivo debe verse en la hoja de compartir de iOS. El código pide un título de diálogo para la hoja, que la plataforma puede no mostrar en iOS; hoy solo se garantiza que el archivo se entrega con su nombre.

## Fuera de alcance
- La misma entrega en Android: historia de Android de esta épica.
- La descarga desde el navegador de la web: historias de la web de esta épica.
- La ficha y la lista de documentos de la app, de las que se llega a la descarga: historias de móvil de esta épica.
