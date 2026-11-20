---
id: US-DOC-RESTRINGIDOS-005
tipo: historia
epica: EP-DOC-RESTRINGIDOS
titulo: "[Web] Lista de documentos: el consultor no ve los restringidos y lee cuántos hay ocultos"
etiquetas: [web]
relacionadas: [US-DOC-RESTRINGIDOS-001, US-DOC-RESTRINGIDOS-004, US-DOC-RESTRINGIDOS-006, US-DOC-RESTRINGIDOS-007, US-LOGIN-007]
verificacion: ejecutada
cubre: ["/documents"]
permisos: [document.viewRestricted]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero ver en Documentos los documentos que mi rol puede ver, cada uno con su clasificación, y un aviso con cuántos restringidos quedan ocultos,
para saber qué documentos puedo abrir y por qué no aparecen otros.

## Reglas
- Con admin, gestor de programa o auditor, la lista muestra los 12 documentos del tenant. Cada restringido lleva la insignia «Restringido» y cada público, la insignia «Público». No aparece ningún aviso de ocultos.
- Con el consultor, la lista muestra 8 documentos y ninguno restringido (`DOC-003`, `DOC-006`, `DOC-009` ni `DOC-012`). Encima de la tabla aparece el aviso «4 documentos restringidos no son visibles para tu rol.»
- El recuento de la cabecera de la página y el del pie de la lista son el número de documentos que se muestran: «12 documentos» para los roles que ven todos, «8 documentos» para el consultor.
- El campo «Buscar documentos» filtra la lista por código o título: lo escrito determina las filas que se muestran y el recuento.
- El aviso de ocultos aparece con el recuento que devuelve la API y no aparece cuando el rol no tiene ningún restringido oculto.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada. La persona escribe la cuenta de su ejemplo y su contraseña y pulsa «Entrar». Para `admin@sigpro.test`, la pantalla «Verificación en dos pasos» se completa con el código `123456` en «Código de verificación» y «Verificar». Cada fila empieza con su propio reinicio.

## Criterios de aceptación
```gherkin
Característica: Documentos restringidos en la lista de la web

  Esquema del escenario: Cada rol ve el recuento de los documentos que puede ver
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en /login?tenant=alumno01
    Cuando abre «Documentos» en el menú
    Entonces ve el recuento <recuento>
    Y el aviso de ocultos <aviso>

    Ejemplos:
      | cuenta | recuento | aviso |
      | admin@sigpro.test | «12 documentos» | no aparece |
      | gestor@sigpro.test | «12 documentos» | no aparece |
      | auditor@sigpro.test | «12 documentos» | no aparece |
      | consultor@sigpro.test | «8 documentos» | aparece con el texto «4 documentos restringidos no son visibles para tu rol.» |

  Esquema del escenario: La clasificación de cada fila es la que se ve a cada rol
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en /login?tenant=alumno01 y ha abierto «Documentos»
    Cuando mira la lista de documentos
    Entonces la fila de <documento> <fila>
    Y la insignia de clasificación de esa fila es <insignia>

    Ejemplos:
      | cuenta | documento | fila | insignia |
      | admin@sigpro.test | DOC-003 | está en la lista | «Restringido» |
      | admin@sigpro.test | DOC-002 | está en la lista | «Público» |
      | auditor@sigpro.test | DOC-006 | está en la lista | «Restringido» |
      | consultor@sigpro.test | DOC-002 | está en la lista | «Público» |
      | consultor@sigpro.test | DOC-003 | no está en la lista | (ninguna) |

  Esquema del escenario: Buscar un restringido como consultor no devuelve su fila
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y ha abierto «Documentos»
    Cuando escribe <texto> en «Buscar documentos»
    Entonces no ve ninguna fila de documento
    Y el recuento dice «0 documentos»

    Ejemplos:
      | texto |
      | DOC-003 |
      | Plan de verificación PRG-002 |
      | Especificación técnica PRG-006 |
```

## Fuera de alcance
- La ficha de un restringido y la página que aparece al abrirla sin permiso: EP-DOC-RESTRINGIDOS, historia 006.
- Los filtros «Programa» y «Clasificación», el orden de las filas, el menú de acciones y la descarga de cada fila: EP-DOC-LISTA.
- La búsqueda global de la cabecera de la web: EP-NAVEGACION.

## Decisiones pendientes
- Si el aviso de ocultos debe contar solo los restringidos ocultos que cumplen los filtros de la lista. Hoy cuenta todos los restringidos del tenant que el rol no puede ver, también cuando la lista está filtrada: con el filtro «Programa» en `PRG-002`, el consultor ve el aviso con «4» aunque en ese programa solo esté oculto `DOC-003`.
