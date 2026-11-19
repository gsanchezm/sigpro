---
id: US-DOC-LISTA-015
tipo: historia
epica: EP-DOC-LISTA
titulo: "[Android] Entregar el PDF de un documento a la hoja de compartir de Android"
etiquetas: [android]
relacionadas: [US-DOC-LISTA-011, US-DOC-LISTA-012, US-DOC-LISTA-014]
verificacion: pendiente-nativo
cubre: ["/documents/:id"]
---

## Historia
Como persona que consulta documentos desde un móvil Android, quiero que descargar el PDF de un documento abra la hoja de compartir de Android con el archivo,
para guardarlo o enviarlo con las apps que tengo instaladas.

## Reglas
- En Android no hay una carpeta de descargas a la que la app pueda escribir sin permisos. Por eso «Descargar PDF» guarda una copia temporal del PDF con su nombre (`<código>-v<versión>.pdf`) y abre la hoja de compartir de Android con esa copia, como archivo PDF.
- Lo que se descarga es la versión marcada en la ficha, o la última si la descarga se pide desde el menú ⋯ de la tarjeta en la lista.
- La descarga no abre ninguna pestaña del navegador.
- Mientras se prepara la copia, el botón «Descargar PDF» queda ocupado y no se puede volver a pulsar.
- Si el dispositivo no puede compartir archivos, aparece el aviso «No se pudo descargar el documento» con el motivo que da la plataforma.
- Preparación de cada fila: la prueba se hace en un dispositivo o en un emulador de Android con la app instalada. Se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y `gestor@sigpro.test` (contraseña `Gestor1234!`) entra en ella.

## Criterios de aceptación
```gherkin
Característica: Entrega del PDF a la hoja de compartir en Android

  Esquema del escenario: La descarga abre la hoja de compartir de Android con el PDF de la versión pedida
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app de Android y está en /documents
    Cuando <accion>
    Entonces se abre la hoja de compartir de Android con el archivo <archivo> de tipo PDF

    Ejemplos:
      | accion | archivo |
      | abre la ficha de DOC-001, toca la versión 2 en el selector de versiones y pulsa «Descargar PDF» | DOC-001-v2.pdf |
      | abre la ficha de DOC-001 y pulsa «Descargar PDF» con la última versión marcada | DOC-001-v3.pdf |
      | abre el menú ⋯ de la tarjeta de DOC-001 y elige «Descargar PDF» | DOC-001-v3.pdf |
```

## Decisiones pendientes
- Si el título de la hoja de compartir de Android debe ser el nombre del archivo, como pide hoy el código, o un texto propio. No está decidido, y la historia solo fija el nombre del archivo.

## Fuera de alcance
- La misma entrega en iOS: historia de iOS de esta épica.
- La descarga desde el navegador de la web: historias de la web de esta épica.
- La ficha y la lista de documentos de la app, de las que se llega a la descarga: historias de móvil de esta épica.
