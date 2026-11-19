---
id: US-PROG-METRICAS-004
tipo: historia
epica: EP-PROG-METRICAS
titulo: "[Web] NC abiertas al día: eventos en vivo y eliminación de un programa"
etiquetas: [web]
relacionadas: [US-PROG-METRICAS-002, US-PROG-METRICAS-003, US-PROG-METRICAS-005]
verificacion: ejecutada
cubre: ["/programs"]
---

## Historia
Como gestor de programas que tiene la lista abierta en la web, quiero que la tarjeta «NC abiertas» cambie cuando alguien del tenant registra, cambia o elimina una no conformidad,
para ver la cifra real sin tener que recargar la página.

## Reglas
- La tarjeta «NC abiertas» sigue en vivo las no conformidades del tenant. Cuando se registra una no conformidad nueva en el tenant, nace abierta y la cifra sube en 1, sin recargar la página, sea cual sea su gravedad.
- Cambiar la gravedad de una no conformidad que sigue abierta no cambia la cifra.
- Cerrar o rechazar una no conformidad abierta la saca de la cifra, también sin recargar la página.
- Eliminar un programa elimina con él todas sus no conformidades. La cifra baja hasta el número de no conformidades abiertas que quedan en el tenant, y la línea auxiliar muestra el total que queda.
- Las no conformidades abiertas por programa, con el reinicio del tenant, son: `PRG-001` tiene 3 (`NC-001`, `NC-002` y `NC-003`), `PRG-002` tiene 3 (`NC-006`, `NC-007` y `NC-008`), y `PRG-003` tiene 2 (`NC-009` y `NC-012`).
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin sesión, se inicia sesión con la cuenta de la fila y se abre `/programs`. Las no conformidades nuevas se registran con `POST /api/nc`, con el token de `alumno01@sigpro.lab`, en un programa del tenant, con una descripción de texto real de al menos 10 caracteres. Los cambios de estado de una NC se hacen con `POST /api/nc/:code/transition` y el mismo token; cerrar una NC exige un comentario de cierre de al menos 20 caracteres. Antes de cada fila, el caos del tenant debe estar apagado.
- Con el reinicio, el tenant `alumno01` tiene 12 no conformidades (`NC-001` a `NC-012`) de las que 8 están abiertas, y 24 programas (`PRG-001` a `PRG-024`).

## Criterios de aceptación
```gherkin
Característica: NC abiertas al día en la lista de programas en la web

  Esquema del escenario: Una no conformidad nueva en el tenant sube la cifra sin recargar la página
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01 y tiene abierta la lista de programas con 8 NC abiertas
    Cuando alumno01@sigpro.lab registra con POST /api/nc una no conformidad en PRG-002 con severidad <gravedad> y la descripción `Desviación de prueba en la ejecución`
    Entonces, sin recargar la página, la tarjeta «NC abiertas» muestra 9

    Ejemplos:
      | gravedad |
      | minor |
      | major |
      | critical |

  Esquema del escenario: Cambiar la gravedad de una no conformidad abierta no cambia la cifra
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01 y tiene abierta la lista de programas con 8 NC abiertas
    Cuando alumno01@sigpro.lab cambia con PATCH /api/nc/:code la gravedad de <nc> a <gravedad>
    Entonces, sin recargar la página, la tarjeta «NC abiertas» sigue mostrando 8

    Ejemplos:
      | nc | gravedad |
      | NC-001 | critical |
      | NC-006 | minor |

  Esquema del escenario: Eliminar un programa quita sus no conformidades abiertas de la cifra
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la web con el tenant alumno01 y tiene abierta la lista de programas con 8 NC abiertas
    Cuando busca <programa> en «Búsqueda global», elige «Eliminar» en el menú de acciones de su fila y confirma con «Eliminar»
    Entonces, sin recargar la página, la tarjeta «NC abiertas» muestra <nc_abiertas> y su línea auxiliar dice «de 8 registradas»

    Ejemplos:
      | programa | nc_abiertas |
      | PRG-001 | 5 |
      | PRG-002 | 5 |
      | PRG-003 | 6 |

  Esquema del escenario: Cerrar o rechazar una NC abierta baja la cifra sin recargar la página
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con el tenant alumno01 y tiene abierta la lista de programas con 8 NC abiertas
    Cuando alumno01@sigpro.lab envía POST /api/nc/<nc>/transition con el cuerpo <cuerpo>
    Entonces, sin recargar la página, la tarjeta «NC abiertas» muestra 7

    Ejemplos:
      | nc | cuerpo |
      | NC-003 | `{"to": "closed", "comment": "Acción correctiva verificada por calidad"}` |
      | NC-002 | `{"to": "rejected"}` |
```

## Fuera de alcance
- Registrar, editar, cambiar de estado o comentar una no conformidad: la épica de no conformidades.
- El panel de misión y su propio indicador de NC abiertas: la épica del panel de misión.
- El alta y la edición de un programa: EP-PROG-ALTA. Eliminar un programa en sí: EP-PROG-GESTION.

## Decisiones pendientes
- Si la línea «de N registradas» también debe seguir en vivo cuando llega una no conformidad nueva. Hoy la cifra de NC abiertas se actualiza en vivo, pero el total de la línea se queda con el que tenía la última carga de la lista.
