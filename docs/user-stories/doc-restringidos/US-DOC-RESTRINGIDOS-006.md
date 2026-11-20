---
id: US-DOC-RESTRINGIDOS-006
tipo: historia
epica: EP-DOC-RESTRINGIDOS
titulo: "[Web] Ficha y visor de un restringido: aviso de «No tienes permiso» o documento con su marca"
etiquetas: [web]
relacionadas: [US-DOC-RESTRINGIDOS-002, US-DOC-RESTRINGIDOS-005, US-DOC-RESTRINGIDOS-007, US-LOGIN-007, US-MFA-003]
verificacion: ejecutada
cubre: ["/documents/:id", "/documents/:id/view"]
permisos: [document.viewRestricted, document.publish]
---

## Historia
Como persona que abre un documento por su código, quiero ver el documento con su clasificación si mi rol puede verlo, o un aviso claro de que no tengo permiso si no puedo,
para entender por qué no veo su contenido sin tener que adivinarlo.

## Reglas
- Un consultor que abre la ficha de un restringido escribiendo su dirección (la lista no lo muestra) ve el título «No tienes permiso para ver este documento», debajo el texto «Los documentos restringidos solo los ven admin, gestores de programa y auditores.» y el enlace «Volver a Documentos». No ve el título del documento, ni sus versiones, ni los botones de descarga o de publicación.
- El visor del mismo documento (la página que se abre sin el menú de la aplicación) muestra ese mismo título y ese mismo texto, y ningún contenido del documento.
- Quien tiene el permiso ve la ficha del restringido con su título, la insignia «Restringido» y el selector de versión en «Versión 2 (última)» para `DOC-003`. Su visor muestra la insignia «Restringido», la versión y el título del documento.
- El auditor ve la ficha de `DOC-003` con el botón «Publicar nueva versión» deshabilitado. Admin y gestor de programa lo tienen habilitado.
- Un documento público se ve en la ficha de cualquier rol: el consultor abre `DOC-004` y ve su título con la insignia «Público».
- Hoy, bajo el aviso de «No tienes permiso», la página muestra también una línea técnica con la petición y su código (ver «Decisiones pendientes»).
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada. La persona escribe la cuenta de su ejemplo y su contraseña y pulsa «Entrar». Para `admin@sigpro.test`, la pantalla «Verificación en dos pasos» se completa con el código `123456`. Después abre la ruta de la fila en la misma pestaña.

## Criterios de aceptación
```gherkin
Característica: Ficha y visor de un restringido en la web

  Esquema del escenario: La ficha y el visor de un restringido se abren solo a quien tiene el permiso
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en /login?tenant=alumno01
    Cuando abre <ruta> en la misma pestaña
    Entonces ve <resultado>

    Ejemplos:
      | cuenta | ruta | resultado |
      | consultor@sigpro.test | /documents/DOC-003 | el título «No tienes permiso para ver este documento», el texto «Los documentos restringidos solo los ven admin, gestores de programa y auditores.» y el enlace «Volver a Documentos», y no ve el título del documento |
      | consultor@sigpro.test | /documents/DOC-003/view | el mismo título y el mismo texto, y no ve ningún contenido del documento |
      | consultor@sigpro.test | /documents/DOC-004 | el título «Especificación técnica PRG-002» con la insignia «Público» |
      | admin@sigpro.test | /documents/DOC-003 | el título «Plan de verificación PRG-002», la insignia «Restringido» y el selector de versión en «Versión 2 (última)» |
      | admin@sigpro.test | /documents/DOC-003/view | el título «Plan de verificación PRG-002», la insignia «Restringido» y «Versión 2» |
      | gestor@sigpro.test | /documents/DOC-003 | el título «Plan de verificación PRG-002», la insignia «Restringido» y el selector de versión en «Versión 2 (última)» |
      | auditor@sigpro.test | /documents/DOC-003 | el título «Plan de verificación PRG-002», la insignia «Restringido» y el botón «Publicar nueva versión» deshabilitado |
```

## Fuera de alcance
- La lista de documentos y su aviso de ocultos: EP-DOC-RESTRINGIDOS, historia 005.
- La ficha, el visor y la descarga de los documentos públicos, y el enlace «Abrir en nueva pestaña»: EP-DOC-LISTA.
- El historial de versiones, la comparación y el diálogo «Publicar nueva versión» con su contenido: EP-DOC-VERSIONES.
- El inicio de sesión y el segundo factor con los que se llega a la ficha: EP-LOGIN y EP-MFA.

## Decisiones pendientes
- Hoy la página «No tienes permiso para ver este documento» muestra, bajo el aviso, una línea técnica con la petición HTTP y su código 403. No está decidido si esa línea forma parte del producto ni qué debe contener; ningún ejemplo de esta historia la afirma ni la excluye.
