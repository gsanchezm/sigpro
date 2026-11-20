---
id: US-DOC-RESTRINGIDOS-004
tipo: historia
epica: EP-DOC-RESTRINGIDOS
titulo: "[API] La búsqueda global no devuelve los restringidos a quien no los ve"
etiquetas: [api]
relacionadas: [US-DOC-RESTRINGIDOS-001, US-DOC-RESTRINGIDOS-005]
verificacion: ejecutada
cubre: ["GET /api/search"]
permisos: [document.viewRestricted]
---

## Historia
Como cliente de la API que usa la búsqueda global, quiero que el grupo de documentos reúna solo los documentos que mi rol puede ver,
para que una búsqueda no revele un restringido a quien no tiene el permiso y para que el total del grupo coincida con lo que muestra la lista.

## Reglas
- `GET /api/search?q=` busca el texto en el código y en el título de cada documento, sin distinguir mayúsculas. El grupo de documentos aparece solo si tiene resultados; trae su `total` (todas las coincidencias) y como mucho cinco ítems.
- Un restringido entra en el grupo de documentos solo si el rol tiene el permiso `document.viewRestricted` (admin, gestor de programa y auditor). Para el consultor no entra ni en los ítems ni en el `total`.
- Si el consultor no tiene ningún documento visible que coincida, la respuesta no trae el grupo de documentos.
- Cualquier rol con sesión puede buscar; no hace falta ningún permiso de documentos para pedir la búsqueda.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la fila obtiene el `accessToken` de la cuenta de su ejemplo con `POST /api/auth/login`, con la cabecera `x-tenant: alumno01`. La cuenta `admin@sigpro.test` (`Admin1234!`) completa además el segundo factor con el código `123456` (`POST /api/auth/mfa`) y usa el `accessToken` que recibe. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Datos del seed (`docs/GUIA-ALUMNO.md`): hay seis documentos cuyo título empieza por «Plan de verificación» (`DOC-001`, `DOC-003`, `DOC-005`, `DOC-007`, `DOC-009` y `DOC-011`), y dos de ellos son restringidos (`DOC-003` y `DOC-009`).

## Criterios de aceptación
```gherkin
Característica: Búsqueda global y documentos restringidos

  Esquema del escenario: El grupo de documentos incluye solo los que el rol puede ver
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene su accessToken
    Cuando busca <texto> con GET /api/search
    Entonces la respuesta trae <grupo>

    Ejemplos:
      | cuenta | texto | grupo |
      | admin@sigpro.test | DOC-003 | el grupo de documentos con total 1 y el ítem DOC-003 |
      | consultor@sigpro.test | DOC-003 | ningún grupo de documentos |
      | admin@sigpro.test | Plan de verificación | el grupo de documentos con total 6 y los ítems DOC-001, DOC-003, DOC-005, DOC-007 y DOC-009 |
      | consultor@sigpro.test | Plan de verificación | el grupo de documentos con total 4 y los ítems DOC-001, DOC-005, DOC-007 y DOC-011 |
```

## Fuera de alcance
- La lista de documentos y su aviso de ocultos: EP-DOC-RESTRINGIDOS, historias 001 y 005.
- El resto de la búsqueda global (grupos de programas, requisitos, casos de prueba y no conformidades, mínimo de caracteres, orden de los grupos, enlaces de cada resultado) y su pantalla en la web y en la app móvil: EP-NAVEGACION.
