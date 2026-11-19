---
id: US-DOC-LISTA-007
tipo: historia
epica: EP-DOC-LISTA
titulo: "[Web] Buscar y filtrar la lista de documentos"
etiquetas: [web]
relacionadas: [US-DOC-LISTA-002, US-DOC-LISTA-006, US-DOC-LISTA-013]
verificacion: codigo
cubre: ["/documents"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero buscar un documento por su código o su título y acotar la lista por programa y por clasificación,
para encontrar los documentos de un programa o de una clasificación sin recorrer toda la lista.

## Reglas
- Encima de la lista hay tres controles: el buscador «Buscar documentos», con el texto de ayuda «Buscar código o título…»; el desplegable «Programa», cuya primera opción es «Todos los programas» y después los códigos de los programas del tenant, de PRG-001 en adelante; y el desplegable «Clasificación», con las opciones «Todas las clasificaciones», «Público» y «Restringido».
- El buscador busca el texto dentro del código y del título de cada documento, sin distinguir mayúsculas y sin contar los espacios del principio y del final. No busca en el nombre del programa.
- Los tres controles se combinan con las mismas reglas que la API: un documento aparece solo si cumple todos los que están puestos.
- La lista se actualiza sola cuando cambia el texto o cuando se elige una opción de un desplegable. El recuento «N documentos» muestra cuántos documentos hay en la lista que se ve.
- «Limpiar filtros» aparece solo cuando hay un texto o un desplegable puesto. Al pulsarlo, el buscador queda vacío, «Programa» vuelve a «Todos los programas», «Clasificación» vuelve a «Todas las clasificaciones» y la lista vuelve a mostrar todos los documentos que el rol puede ver.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada; `gestor@sigpro.test` (contraseña `Gestor1234!`) entra, llega a `/programs` y abre `/documents` con un diseño de escritorio.
- Datos del seed que citan los ejemplos: en cada tenant hay doce documentos, `DOC-001` a `DOC-012`, dos por programa de `PRG-001` a `PRG-006`. Son restringidos `DOC-003`, `DOC-006`, `DOC-009` y `DOC-012`.

## Criterios de aceptación
```gherkin
Característica: Búsqueda y filtros de la lista de documentos en la web

  Esquema del escenario: El buscador deja los documentos cuyo código o título contiene el texto
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /documents con un diseño de escritorio
    Cuando escribe <texto> en «Buscar documentos»
    Entonces la lista muestra <codigos> y el recuento dice <recuento>

    Ejemplos:
      | texto | codigos | recuento |
      | plan | DOC-001, DOC-003, DOC-005, DOC-007, DOC-009 y DOC-011 | «6 documentos» |
      | PRG-004 | DOC-007 y DOC-008 | «2 documentos» |
      | Ártemis | ningún documento | «0 documentos» |

  Esquema del escenario: Los desplegables acotan la lista por programa y por clasificación
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /documents con un diseño de escritorio
    Cuando elige <programa> en «Programa» y <clasificacion> en «Clasificación»
    Entonces la lista muestra <codigos> y el recuento dice <recuento>

    Ejemplos:
      | programa | clasificacion | codigos | recuento |
      | «PRG-002» | «Todas las clasificaciones» | DOC-003 y DOC-004 | «2 documentos» |
      | «Todos los programas» | «Restringido» | DOC-003, DOC-006, DOC-009 y DOC-012 | «4 documentos» |
      | «PRG-001» | «Restringido» | ningún documento | «0 documentos» |

  Esquema del escenario: «Limpiar filtros» quita el texto y los dos desplegables a la vez
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /documents con un diseño de escritorio, ha escrito <texto> en «Buscar documentos», ha elegido <programa> en «Programa» y <clasificacion> en «Clasificación»
    Cuando pulsa «Limpiar filtros»
    Entonces el buscador queda vacío, «Programa» muestra «Todos los programas», «Clasificación» muestra «Todas las clasificaciones» y la lista vuelve a mostrar 12 documentos con el recuento «12 documentos»

    Ejemplos:
      | texto | programa | clasificacion |
      | plan | «PRG-002» | «Restringido» |
      | PRG-004 | «Todos los programas» | «Público» |
```

## Decisiones pendientes
- Los filtros no se guardan en la dirección de la página: hoy, al recargarla, la lista vuelve sin filtros. En Programas y en Verificación sí se guardan; no está decidido si Documentos debe hacerlo igual.
- Cómo se escribe el recuento cuando la lista tiene un solo documento. Hoy el texto del catálogo dice «1 documentos», porque no distingue el singular; no está decidido si debe decir «1 documento». Ningún ejemplo de esta historia cuenta un solo documento.

## Fuera de alcance
- Los estados de carga, vacío y error de la lista, y el mensaje «Ningún documento coincide con los filtros aplicados.»: historia de estados de la lista de esta épica.
- Filtrar la lista de la API: historia de la API de esta épica.
- La lista en la app móvil: historias de móvil de esta épica.
