---
id: US-DOC-VERSIONES-008
tipo: historia
epica: EP-DOC-VERSIONES
titulo: "[Web] Subir un archivo como nueva versión, en lugar de escribir su contenido"
etiquetas: [web, no-implementada]
relacionadas: [US-DOC-VERSIONES-005, US-DOC-VERSIONES-009]
verificacion: no-ejecutable
permisos: [document.publish]
---

## Historia
Como gestor de un programa o administrador que publica una versión, quiero elegir el archivo de la nueva versión desde mi equipo,
para no tener que copiar su contenido línea a línea en el formulario.

## Reglas
- Hoy la nueva versión se publica escribiendo su contenido como texto, línea a línea. En la ficha no hay ningún control para elegir un archivo, y tampoco en la app móvil.
- Solo quien puede publicar una versión (roles `admin` y `program_manager`, permiso `document.publish`) puede publicarla con un archivo. Un `consultant` o un `auditor` no publica ninguna versión.
- Los nombres y tamaños de archivo de los ejemplos son ilustrativos: no fijan los tipos admitidos ni el tamaño máximo, que están en Decisiones pendientes.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, se abre `/login?tenant=alumno01` en un navegador sin sesiones de SIGPRO guardadas, y la cuenta de la fila inicia sesión con su contraseña del seed (`gestor@sigpro.test` con `Gestor1234!`, `consultor@sigpro.test` con `Consul1234!`, `auditor@sigpro.test` con `Audit1234!`).
- Estado del seed, sin pasos previos, en el tenant `alumno01`: `DOC-001` («Plan de verificación PRG-001», público, versión 3).

## Criterios de aceptación
```gherkin
Característica: Subir un archivo como nueva versión en la web

  Esquema del escenario: Quien puede publicar elige un archivo para la nueva versión
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /documents/DOC-001
    Cuando elige el archivo <archivo> para la nueva versión y la publica
    Entonces DOC-001 queda con una versión nueva que corresponde a ese archivo

    Ejemplos:
      | archivo |
      | plan-DOC-001.pdf, un PDF de 200 KB |

  Esquema del escenario: Quien no puede publicar no publica una versión con archivo
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en /login?tenant=alumno01 y está en /documents/DOC-001
    Cuando intenta publicar una versión nueva con el archivo plan-DOC-001.pdf, un PDF de 200 KB
    Entonces no se publica ninguna versión y DOC-001 sigue en la versión 3

    Ejemplos:
      | cuenta |
      | consultor@sigpro.test |
      | auditor@sigpro.test |
```

## Decisiones pendientes
- Qué tipos de archivo se admiten (PDF, texto, documentos de ofimática, imágenes) y cómo se comprueba el tipo.
- Tamaño máximo del archivo y cómo se comprueba.
- Si el archivo se guarda tal cual como versión, o se convierte en el contenido por líneas que usan el visor y la descarga en PDF.
- Qué mensaje ve la persona cuando el archivo no se admite o pesa demasiado. El catálogo de textos de la interfaz no tiene ninguno.
- Si el archivo sustituye al contenido escrito o convive con él, y si la versión nueva lleva el número siguiente, como hoy.
- Si el contenido escrito como texto sigue disponible cuando existe la subida de archivos.

## Fuera de alcance
- La ficha, el visor y la descarga de la versión subida: EP-DOC-LISTA.
- La publicación de una versión escrita como texto, que ya describe la historia de la web: EP-DOC-VERSIONES, otra historia de esta épica.
- La subida de archivos desde la app móvil: no se describe hasta que la web la tenga.
