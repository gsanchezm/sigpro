---
id: US-DOC-VERSIONES-006
tipo: historia
epica: EP-DOC-VERSIONES
titulo: "[Web] Tras publicar, el historial de la ficha muestra la versión nueva primera"
etiquetas: [web]
relacionadas: [US-DOC-VERSIONES-001, US-DOC-VERSIONES-005, US-DOC-VERSIONES-009]
verificacion: codigo
cubre: ["/documents/:id"]
---

## Historia
Como gestor de un programa o administrador que publica una versión desde la web, quiero ver la versión recién publicada como primera fila del historial de la ficha, con su nota y con mi nombre como autor,
para comprobar que queda registrado lo que he publicado.

## Reglas
- Tras publicar desde la ficha, la sección «Historial de versiones» muestra primero la versión nueva: «v» seguido de su número, la nota de cambios (o «—» si la nota está vacía) y «por» seguido del nombre de quien la publicó.
- Las filas siguientes son las versiones anteriores, de la más nueva a la más antigua. El formato de cada fila y el historial de un documento que no acaba de cambiar los describe EP-DOC-LISTA.
- En los ejemplos, `(vacía)` es una nota sin texto y `(N letras a)` es un texto de N letras «a» seguidas.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, se abre `/login?tenant=alumno01` en un navegador sin sesiones de SIGPRO guardadas, y la cuenta de la fila inicia sesión con su contraseña del seed (`gestor@sigpro.test` con `Gestor1234!`, `alumno01@sigpro.lab` con `Alumno1234!`).
- Estado del seed, sin pasos previos, en el tenant `alumno01`: `DOC-001` («Plan de verificación PRG-001», público, versiones 1 a 3). La versión 3 tiene la nota «Nuevos criterios de aceptación y anexos» y la publicó «Javier Ortega», que es el nombre de `gestor@sigpro.test`.

## Criterios de aceptación
```gherkin
Característica: Historial de la ficha tras publicar una versión

  Esquema del escenario: La versión publicada desde la ficha aparece primera en el historial
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en /login?tenant=alumno01 y está en /documents/DOC-001, que está en la versión 3
    Cuando pulsa «Publicar nueva versión», <nota> y pulsa «Publicar versión»
    Entonces la primera fila del historial es <primera_fila>
    Y la segunda fila es «v3», la nota «Nuevos criterios de aceptación y anexos» y «por Javier Ortega»

    Ejemplos:
      | cuenta | nota | primera_fila |
      | gestor@sigpro.test | escribe «Revisión de alcance» en «Nota de cambios» | «v4», la nota «Revisión de alcance» y «por Javier Ortega» |
      | alumno01@sigpro.lab | no escribe nada en «Nota de cambios» | «v4», la nota «—» y «por Alumno 01» |
```

## Fuera de alcance
- El formato de cada fila del historial, el historial de un documento sin publicaciones recientes y las versiones del seed: EP-DOC-LISTA.
- El diálogo «Publicar nueva versión», sus avisos y su botón: EP-DOC-VERSIONES, otra historia de esta épica.
- El visor de cada versión y la descarga del PDF: EP-DOC-LISTA.
