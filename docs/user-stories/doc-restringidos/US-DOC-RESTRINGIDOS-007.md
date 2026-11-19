---
id: US-DOC-RESTRINGIDOS-007
tipo: historia
epica: EP-DOC-RESTRINGIDOS
titulo: "[Móvil] Lista y ficha de un restringido: lo que ve cada rol en la app"
etiquetas: [movil]
relacionadas: [US-DOC-RESTRINGIDOS-001, US-DOC-RESTRINGIDOS-002, US-DOC-RESTRINGIDOS-005, US-DOC-RESTRINGIDOS-006, US-LOGIN-012]
verificacion: codigo
cubre: ["/documents", "/documents/:id"]
permisos: [document.viewRestricted, document.publish]
---

## Historia
Como persona con una cuenta en SIGPRO que usa la app móvil, quiero ver en Documentos solo lo que mi rol puede ver y, si abro un restringido que no puedo ver, un aviso claro,
para tener en el móvil las mismas reglas que en la web.

## Reglas
- En la app, Documentos se abre desde la pestaña «Más».
- Con admin, gestor de programa o auditor, la lista muestra el recuento «12 documentos», y cada restringido lleva la insignia «Restringido». No aparece ningún aviso de ocultos.
- Con el consultor, la lista muestra el recuento «8 documentos», ninguno restringido, y el aviso «4 documentos restringidos no son visibles para tu rol.»
- Un consultor que abre la ficha de `DOC-003` (por su dirección, porque la lista no lo muestra) ve el título «No tienes permiso para ver este documento», el texto «Los documentos restringidos solo los ven admin, gestores de programa y auditores.» y el enlace «Volver a Documentos». No ve el título del documento, ni sus versiones, ni las acciones de descarga o de publicación.
- Admin ve la ficha de `DOC-003` con la insignia «Restringido», el selector de versión, el botón «Descargar PDF» y el botón «Publicar nueva versión» habilitado.
- Auditor ve la ficha de `DOC-003` con el botón «Descargar PDF» habilitado y «Publicar nueva versión» deshabilitado, con el texto «Solo admin y gestor pueden publicar versiones» visible debajo del botón.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y la app está en /login sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo». La persona escribe la cuenta de su ejemplo y su contraseña y pulsa «Entrar». Para `admin@sigpro.test`, la pantalla «Verificación en dos pasos» se completa con el código `123456` en «Código de verificación» y «Verificar». Cada fila empieza con su propio reinicio.

## Criterios de aceptación
```gherkin
Característica: Documentos restringidos en la app móvil

  Esquema del escenario: La lista de la app muestra solo los documentos que el rol puede ver
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y ha abierto «Documentos» desde «Más»
    Cuando mira la lista de documentos
    Entonces ve el recuento <recuento>
    Y el aviso de ocultos <aviso>

    Ejemplos:
      | cuenta | recuento | aviso |
      | admin@sigpro.test | «12 documentos» | no aparece |
      | gestor@sigpro.test | «12 documentos» | no aparece |
      | auditor@sigpro.test | «12 documentos» | no aparece |
      | consultor@sigpro.test | «8 documentos» | aparece con el texto «4 documentos restringidos no son visibles para tu rol.» |

  Esquema del escenario: La ficha de un restringido se abre solo a quien tiene el permiso
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo»
    Cuando abre la ruta /documents/<documento>
    Entonces ve <resultado>

    Ejemplos:
      | cuenta | documento | resultado |
      | consultor@sigpro.test | DOC-003 | el título «No tienes permiso para ver este documento», el texto «Los documentos restringidos solo los ven admin, gestores de programa y auditores.» y el enlace «Volver a Documentos», y no ve el título del documento |
      | consultor@sigpro.test | DOC-004 | el título «Especificación técnica PRG-002» con la insignia «Público» |
      | admin@sigpro.test | DOC-003 | el título «Plan de verificación PRG-002», la insignia «Restringido», el botón «Descargar PDF» y el botón «Publicar nueva versión» habilitado |
      | auditor@sigpro.test | DOC-003 | el título «Plan de verificación PRG-002», la insignia «Restringido», el botón «Descargar PDF» habilitado y «Publicar nueva versión» deshabilitado con el texto «Solo admin y gestor pueden publicar versiones» |
```

## Fuera de alcance
- La lista de documentos públicos, el menú de acciones de cada fila y la descarga de los documentos públicos: EP-DOC-LISTA.
- El visor, el historial de versiones, la comparación y la publicación de una versión con su contenido: EP-DOC-VERSIONES.
- El inicio de sesión con «Tenant de trabajo» y el segundo factor: EP-LOGIN y EP-MFA.

## Decisiones pendientes
- Hoy la página «No tienes permiso para ver este documento» muestra, bajo el aviso, una línea técnica con la petición HTTP y su código 403. No está decidido si esa línea forma parte del producto ni qué debe contener; ningún ejemplo de esta historia la afirma ni la excluye.
