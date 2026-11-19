---
id: US-DOC-VERSIONES-005
tipo: historia
epica: EP-DOC-VERSIONES
titulo: "[Web] Publicar una versión nueva desde la ficha"
etiquetas: [web]
relacionadas: [US-DOC-VERSIONES-001, US-DOC-VERSIONES-002, US-DOC-VERSIONES-003, US-DOC-VERSIONES-006, US-DOC-VERSIONES-008, US-DOC-VERSIONES-009]
verificacion: codigo
cubre: ["/documents/:id"]
permisos: [document.publish]
---

## Historia
Como gestor de un programa o administrador que trabaja en la web, quiero publicar una versión nueva desde la ficha de un documento, partiendo del contenido de su última versión,
para cambiar solo las líneas que cambian y dejar una nota con el motivo del cambio.

## Reglas
- En la ficha de un documento, «Publicar nueva versión» está habilitado para los roles `admin` y `program_manager`. Para `consultant` y `auditor` está deshabilitado, y al pasar el puntero sobre él aparece la explicación «Solo admin y gestor pueden publicar versiones».
- Al pulsarlo se abre el diálogo «Nueva versión de DOC-001». El campo «Contenido (una línea por fila)» muestra el contenido de la última versión, una línea por fila. «Nota de cambios» empieza vacío y su texto de ayuda es «Qué cambia en esta versión…».
- Mientras llega el contenido de la última versión, el campo de contenido y «Publicar versión» están deshabilitados.
- Antes de enviar, el diálogo comprueba los mismos límites que la API: de 1 a 80 líneas de hasta 200 caracteres, y una nota de hasta 200 caracteres sin contar los espacios de los extremos. Las filas vacías del final del contenido no cuentan. Si no se cumplen, no se envía nada, el diálogo sigue abierto y el aviso aparece bajo el campo que falla: «El contenido no puede estar vacío», «Máximo 80 líneas» o «Cada línea admite hasta 200 caracteres» bajo el contenido, y «La nota admite hasta 200 caracteres» bajo «Nota de cambios». Al cambiar el contenido, su aviso desaparece.
- Al publicar con éxito, el diálogo se cierra y aparece el aviso «Versión publicada» con el texto «DOC-001 → versión 4». En la ficha, el selector «Versión» pasa a mostrar «Versión 4 (última)».
- Al volver a la lista de documentos, la fila de DOC-001 muestra «v4».
- «Cancelar» cierra el diálogo sin publicar nada: la ficha sigue con la versión anterior como la última y no aparece ningún aviso de publicación.
- En los ejemplos, `(vacía)` es una nota sin texto, y `(N letras a)` es un texto de N letras «a» seguidas.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, se abre `/login?tenant=alumno01` en un navegador sin sesiones de SIGPRO guardadas, la cuenta de la fila inicia sesión con su contraseña del seed (`gestor@sigpro.test` con `Gestor1234!`, `alumno01@sigpro.lab` con `Alumno1234!`, `consultor@sigpro.test` con `Consul1234!`, `auditor@sigpro.test` con `Audit1234!`) y se abre la ficha del documento de la fila (`DOC-001` o `DOC-002`).
- Estado del seed, sin pasos previos, en el tenant `alumno01`: `DOC-001` («Plan de verificación PRG-001», público, versión 3) y `DOC-002` («Especificación técnica PRG-001», público, versión 1).

## Criterios de aceptación
```gherkin
Característica: Publicar una versión nueva en la web

  Esquema del escenario: Publicar desde la ficha deja la versión nueva como la última
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en /login?tenant=alumno01 y está en /documents/DOC-001, que está en la versión 3
    Cuando pulsa «Publicar nueva versión», <nota> y pulsa «Publicar versión»
    Entonces ve el aviso «Versión publicada» con el texto «DOC-001 → versión 4»
    Y en la ficha, el selector «Versión» muestra «Versión 4 (última)»
    Y al volver a /documents, la fila de DOC-001 muestra «v4»

    Ejemplos:
      | cuenta | nota |
      | gestor@sigpro.test | escribe «Revisión de alcance» en «Nota de cambios» |
      | alumno01@sigpro.lab | no escribe nada en «Nota de cambios» |

  Esquema del escenario: El contenido y la nota se comprueban antes de enviar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, está en /documents/DOC-002, que está en la versión 1, y ha pulsado «Publicar nueva versión»
    Cuando <cambio> y pulsa «Publicar versión»
    Entonces ve el aviso <aviso> bajo <campo>
    Y DOC-002 sigue en la versión 1

    Ejemplos:
      | cambio | campo | aviso |
      | borra todo el contenido | «Contenido (una línea por fila)» | «El contenido no puede estar vacío» |
      | escribe 81 líneas de texto en el contenido | «Contenido (una línea por fila)» | «Máximo 80 líneas» |
      | escribe una línea de 201 letras a en el contenido | «Contenido (una línea por fila)» | «Cada línea admite hasta 200 caracteres» |
      | escribe 201 letras a en «Nota de cambios» | «Nota de cambios» | «La nota admite hasta 200 caracteres» |

  Esquema del escenario: El botón de publicar solo está habilitado para admin y gestor de programa
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en /login?tenant=alumno01 y está en /documents/DOC-001
    Cuando mira el botón «Publicar nueva versión»
    Entonces el botón <estado>

    Ejemplos:
      | cuenta | estado |
      | gestor@sigpro.test | está habilitado |
      | alumno01@sigpro.lab | está habilitado |
      | consultor@sigpro.test | está deshabilitado, con la explicación «Solo admin y gestor pueden publicar versiones» |
      | auditor@sigpro.test | está deshabilitado, con la explicación «Solo admin y gestor pueden publicar versiones» |

  Esquema del escenario: Cancelar el diálogo no publica nada
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, está en /documents/DOC-001 y tiene abierto el diálogo «Nueva versión de DOC-001»
    Cuando <cambio> y pulsa «Cancelar»
    Entonces el diálogo se cierra sin aviso de publicación
    Y la ficha sigue mostrando la versión 3 como la última

    Ejemplos:
      | cambio |
      | cambia la primera línea del contenido |
```

## Fuera de alcance
- El historial de versiones que muestra la ficha después de publicar: EP-DOC-VERSIONES, otra historia de esta épica.
- La comparación de la versión publicada con la anterior: EP-DOC-VERSIONES, otra historia de esta épica.
- La subida de un archivo en lugar del contenido escrito: EP-DOC-VERSIONES, otra historia de esta épica (no implementada).
- La lista de documentos y el visor de cada versión: EP-DOC-LISTA.
