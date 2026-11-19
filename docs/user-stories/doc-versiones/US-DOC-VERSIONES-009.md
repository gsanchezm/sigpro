---
id: US-DOC-VERSIONES-009
tipo: historia
epica: EP-DOC-VERSIONES
titulo: "[Móvil] Publicar una versión nueva desde la ficha"
etiquetas: [movil]
relacionadas: [US-DOC-VERSIONES-001, US-DOC-VERSIONES-002, US-DOC-VERSIONES-005, US-DOC-VERSIONES-006]
verificacion: codigo
cubre: ["/documents/:id"]
permisos: [document.publish]
---

## Historia
Como persona que trabaja desde el móvil, quiero publicar una versión nueva de un documento desde su ficha, partiendo del contenido de su última versión,
para hacer el mismo cambio que en la web sin tener que abrir el ordenador.

## Reglas
- «Publicar nueva versión» está habilitado para los roles `admin` y `program_manager`. Para `consultant` y `auditor` no se puede pulsar, y debajo de los botones se lee «Solo admin y gestor pueden publicar versiones».
- Al pulsarlo se abre el diálogo «Nueva versión de DOC-001». «Contenido (una línea por fila)» muestra el contenido de la última versión, una línea por fila, y «Nota de cambios» empieza vacía. Mientras llega el contenido se lee «Cargando…» y «Publicar versión» no se puede pulsar.
- Los límites y los avisos son los de la web: de 1 a 80 líneas de hasta 200 caracteres y una nota de hasta 200 caracteres sin contar los espacios de los extremos. Los avisos aparecen bajo el campo que falla: «El contenido no puede estar vacío», «Máximo 80 líneas» o «Cada línea admite hasta 200 caracteres» bajo el contenido, y «La nota admite hasta 200 caracteres» bajo «Nota de cambios». Al corregir el campo, su aviso desaparece.
- Al publicar con éxito, el diálogo se cierra, aparece el aviso «Versión publicada» con el texto «DOC-001 → versión 4», y la ficha muestra la versión 4 como elegida, con el texto «Versión 4 · última».
- En los ejemplos, `(N letras a)` es un texto de N letras «a» seguidas.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo»; la cuenta de la fila inicia sesión con su contraseña del seed (`gestor@sigpro.test` con `Gestor1234!`, `alumno01@sigpro.lab` con `Alumno1234!`, `consultor@sigpro.test` con `Consul1234!`, `auditor@sigpro.test` con `Audit1234!`) y abre la ficha del documento de la fila.
- Estado del seed, sin pasos previos, en el tenant `alumno01`: `DOC-001` («Plan de verificación PRG-001», público, versiones 1 a 3) y `DOC-002` («Especificación técnica PRG-001», público, versión 1).

## Criterios de aceptación
```gherkin
Característica: Publicar una versión nueva desde la app móvil

  Esquema del escenario: Publicar desde la ficha móvil deja la versión nueva elegida
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login, con alumno01 en «Tenant de trabajo», ha iniciado sesión con <cuenta> y está en /documents/DOC-001
    Cuando pulsa «Publicar nueva versión», <nota> y pulsa «Publicar versión»
    Entonces ve el aviso «Versión publicada» con el texto «DOC-001 → versión 4»
    Y la ficha muestra la opción «Versión 4 · última» elegida

    Ejemplos:
      | cuenta | nota |
      | gestor@sigpro.test | escribe «Revisión de alcance» en «Nota de cambios» |
      | alumno01@sigpro.lab | no escribe nada en «Nota de cambios» |

  Esquema del escenario: Un rol sin permiso para publicar ve el motivo bajo los botones
    Dado que el tenant alumno01 está recién reiniciado y una persona ha iniciado sesión en la app móvil con <cuenta>, con alumno01 en «Tenant de trabajo», y está en /documents/DOC-001
    Cuando mira los botones de la ficha
    Entonces «Publicar nueva versión» no se puede pulsar
    Y debajo de los botones se lee «Solo admin y gestor pueden publicar versiones»

    Ejemplos:
      | cuenta |
      | consultor@sigpro.test |
      | auditor@sigpro.test |

  Esquema del escenario: Un contenido o una nota que no cumplen los límites no se envían
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», está en /documents/DOC-002 y ha pulsado «Publicar nueva versión»
    Cuando <cambio> y pulsa «Publicar versión»
    Entonces ve el aviso <aviso> bajo <campo>
    Y DOC-002 sigue en la versión 1

    Ejemplos:
      | cambio | campo | aviso |
      | borra todo el contenido | «Contenido (una línea por fila)» | «El contenido no puede estar vacío» |
      | escribe 81 líneas de texto en el contenido | «Contenido (una línea por fila)» | «Máximo 80 líneas» |
      | escribe una línea de 201 letras a en el contenido | «Contenido (una línea por fila)» | «Cada línea admite hasta 200 caracteres» |
      | escribe 201 letras a en «Nota de cambios» | «Nota de cambios» | «La nota admite hasta 200 caracteres» |
```

## Fuera de alcance
- La lista de documentos y la ficha como visor del contenido de una versión: EP-DOC-LISTA.
- El historial de versiones de la ficha y la elección de una versión en la app móvil, con su autor, su fecha y su nota: EP-DOC-LISTA.
- La descarga del PDF desde la ficha: EP-DOC-LISTA.
- La comparación entre versiones en la app móvil: EP-DOC-VERSIONES, otra historia de esta épica.
- Los límites del contenido y de la nota vistos desde la API, con sus motivos de 422: EP-DOC-VERSIONES, otra historia de esta épica.
- La subida de un archivo como versión: EP-DOC-VERSIONES, otra historia de esta épica (no implementada).
