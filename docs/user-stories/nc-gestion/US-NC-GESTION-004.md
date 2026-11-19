---
id: US-NC-GESTION-004
tipo: historia
epica: EP-NC-GESTION
titulo: "[API] Añadir un comentario a una no conformidad"
etiquetas: [api]
relacionadas: [US-NC-GESTION-008, US-NC-GESTION-012, US-NC-GESTION-005]
verificacion: ejecutada
cubre: ["POST /api/nc/:code/comments"]
permisos: [nc.comment]
---

## Historia
Como persona de un tenant que sigue una no conformidad, quiero añadirle un comentario con mi nombre y la hora,
para que el equipo tenga a la vista lo que se ha hecho y lo que queda pendiente.

## Reglas
- `POST /api/nc/:code/comments` lo pueden usar todos los roles, porque todos tienen el permiso `nc.comment`. Ningún rol recibe 403.
- El cuerpo lleva `body` y, opcionalmente, `kind`: `comment` (valor por defecto) o `quick` (comentario rápido).
- El texto se recorta de los espacios del principio y del final. Si no queda texto, responde 422 con el motivo `commentRequired` en `body`. Tras recortar, puede tener hasta 1000 caracteres; con más, responde 422 con el motivo `commentLong` en `body`.
- Un comentario no cambia ni el estado ni la severidad de la no conformidad.
- La respuesta es 201 con el comentario: `id`, `authorId`, `authorName` (el nombre de la persona que escribe), `body` (ya recortado), `kind` y `createdAt`.
- Si la no conformidad no existe en el tenant, responde 404 `nc_not_found`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, cada cuenta obtiene su token con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y `alumno01@sigpro.lab` (`Alumno1234!`, cuyo nombre es «Alumno 01»).
- En los ejemplos, `(N letras a)` es un texto de N letras `a` seguidas, sin espacios, y `(N espacios)` son N espacios seguidos.

## Criterios de aceptación
```gherkin
Característica: Comentarios de una no conformidad por la API

  Esquema del escenario: Cada rol añade un comentario con su nombre
    Dado que en el tenant alumno01, recién reiniciado, <correo> inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc/NC-003/comments con x-tenant alumno01, su token y el cuerpo {"body": "Revisión pendiente de la acción correctiva"}
    Entonces la respuesta es 201 con authorName <autor> y kind comment
    Y NC-003 pasa a tener 4 comentarios

    Ejemplos:
      | correo | autor |
      | alumno01@sigpro.lab | Alumno 01 |
      | gestor@sigpro.test | Javier Ortega |
      | consultor@sigpro.test | Lucía Fernández |
      | auditor@sigpro.test | Andrés Molina |

  Esquema del escenario: El texto del comentario tiene entre uno y mil caracteres tras recortar los espacios
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc/NC-003/comments con x-tenant alumno01, ese token y el texto <texto>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | texto | respuesta |
      | (vacío) | 422 validation_failed con el motivo commentRequired en body |
      | (3 espacios) | 422 validation_failed con el motivo commentRequired en body |
      | (1 letra a) | 201 con body a |
      | (999 letras a) | 201 |
      | (1000 letras a) | 201 |
      | (1001 letras a) | 422 validation_failed con el motivo commentLong en body |

  Esquema del escenario: El comentario rápido se registra como tal
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc/NC-003/comments con x-tenant alumno01, ese token y el cuerpo <cuerpo>
    Entonces la respuesta es 201 con kind <tipo>

    Ejemplos:
      | cuerpo | tipo |
      | {"body": "Comentario rápido de prueba"} | comment |
      | {"body": "Comentario rápido de prueba", "kind": "quick"} | quick |

  Esquema del escenario: Una no conformidad inexistente no admite comentarios
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc/<codigo>/comments con x-tenant alumno01, ese token y el cuerpo {"body": "Comentario de prueba"}
    Entonces la respuesta es 404 nc_not_found

    Ejemplos:
      | codigo |
      | NC-999 |
```

## Fuera de alcance
- El hilo de comentarios de la web y de la app móvil, con sus avisos bajo el campo: US-NC-GESTION-008 y US-NC-GESTION-012.
- El comentario de cierre, que es un comentario de tipo `closure` creado por el cierre: US-NC-GESTION-005.
- El comentario rápido que se escribe desde la tarjeta del tablero: EP-NC-TABLERO.

## Decisiones pendientes
- Si se puede comentar una no conformidad cerrada o rechazada. Hoy la API lo acepta y esta historia no lo afirma ni lo excluye.
