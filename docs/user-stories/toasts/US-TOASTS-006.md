---
id: US-TOASTS-006
tipo: historia
epica: EP-TOASTS
titulo: "[Móvil] Avisos arriba de la pantalla, rol por tono y avisos de éxito, error e información"
etiquetas: [movil]
relacionadas: [US-TOASTS-001, US-TOASTS-003, US-TOASTS-004, US-TOASTS-007]
verificacion: ejecutada
---

## Historia
Como persona que usa la app móvil, quiero que los avisos aparezcan en la parte superior de la pantalla, a todo el ancho, con su título y su tono,
para leer el resultado de lo que acabo de hacer sin cambiar de pantalla.

## Reglas
- El aviso aparece en la parte superior de la pantalla, a 12 px del borde superior y a 12 px de cada lado, por encima del contenido de la pantalla.
- Cada aviso ocupa el ancho de la pantalla menos 12 px a cada lado.
- Cada aviso muestra la franja del borde izquierdo en el color de su tono y el título. El cuerpo, si lo tiene, va debajo del título con letra más pequeña.
- Un aviso de error se anuncia con rol de alerta. Los de éxito, informativo y advertencia se anuncian con rol de estado.
- Los avisos se retiran solos a los 3 segundos desde que aparecen, como en la regla común de los avisos de esta épica.
- Las acciones de la app móvil producen avisos de éxito, de error y de información. Ninguna acción de la app móvil produce hoy un aviso de advertencia (ver «Decisiones pendientes»).
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app está en /login con `alumno01` en «Tenant de trabajo», y `gestor@sigpro.test` inicia sesión con `Gestor1234!` como indica la épica de inicio de sesión de la app móvil (EP-LOGIN), hasta llegar a /programs o a /documents según la fila. Antes de cada fila el caos del tenant está apagado (`GET /api/config` devuelve latencia 0 y tasa de error 0; si no, se apaga con `PATCH /api/admin/chaos` y el token de `alumno01@sigpro.lab`). Si la fila fija una tasa de error del 100 %, se hace con ese mismo `PATCH` y `errorRate` 1; el caos solo falla las escrituras de la aplicación. Al terminar la fila se apaga de nuevo.

## Criterios de aceptación
```gherkin
Característica: Avisos emergentes en la app móvil

  Esquema del escenario: Una acción que sale bien muestra arriba de la pantalla un aviso de éxito
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil y está en /programs
    Cuando <accion>
    Entonces ve arriba de la pantalla un aviso de éxito con el título <titulo>
    Y el aviso se anuncia con el rol de estado
    Y el aviso tiene el cuerpo <cuerpo>

    Ejemplos:
      | accion | titulo | cuerpo |
      | abre las acciones de PRG-001 y pulsa «Archivar» | «PRG-001 archivado» | (sin cuerpo) |
      | abre las acciones de PRG-001 y pulsa «Duplicar» | «PRG-025 programa creado» | «Copia creada como borrador» |

  Esquema del escenario: Una descarga muestra arriba de la pantalla un aviso informativo con el nombre del archivo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil y está en /documents
    Cuando abre las acciones de <documento> y pulsa «Descargar PDF»
    Entonces ve arriba de la pantalla un aviso informativo con el título «Descarga iniciada»
    Y el aviso se anuncia con el rol de estado
    Y el aviso tiene el cuerpo <cuerpo>

    Ejemplos:
      | documento | cuerpo |
      | DOC-001 | DOC-001-v3.pdf |
      | DOC-002 | DOC-002-v1.pdf |

  Esquema del escenario: Un fallo del servidor muestra un aviso de error que se anuncia con rol de alerta
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil y está en /programs, y la tasa de error de las escrituras es del <tasa> %
    Cuando abre las acciones de PRG-001 y pulsa «Archivar»
    Entonces ve arriba de la pantalla un aviso de <tono> con el título <titulo>
    Y el aviso se anuncia con el rol de <rol>

    Ejemplos:
      | tasa | tono | titulo | rol |
      | 0 | éxito | «PRG-001 archivado» | estado |
      | 100 | error | «Ha ocurrido un error inesperado» | alerta |
```

## Fuera de alcance
- El cierre a mano de un aviso con «Cerrar»: la historia móvil de cierre de esta épica, marcada como no implementada.
- El aviso de advertencia y su texto en la web: la historia web de avisos informativos y de advertencia de esta épica.
- El texto de cada aviso concreto y la acción que lo produce: las épicas de cada pantalla.

## Decisiones pendientes
- Si alguna acción de la app móvil debe producir un aviso de advertencia, y cuál. Hoy el tono existe en el componente de avisos, pero ninguna acción móvil lo usa.
- Línea de detalle técnico. Hoy el aviso de error de la app móvil lleva, bajo el título, una línea de detalle técnico con la petición HTTP real. Está pendiente de decisión de producto si esa línea forma parte del producto y qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.
