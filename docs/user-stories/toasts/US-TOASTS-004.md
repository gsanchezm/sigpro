---
id: US-TOASTS-004
tipo: historia
epica: EP-TOASTS
titulo: "[Web] Avisos emergentes: esquina inferior derecha, cierre con «Cerrar» y rol de cada tono"
etiquetas: [web]
relacionadas: [US-TOASTS-001, US-TOASTS-003, US-TOASTS-005, US-TOASTS-006]
verificacion: ejecutada
---

## Historia
Como persona que usa SIGPRO en el navegador de un ordenador o en una ventana estrecha, quiero que los avisos aparezcan en la parte inferior de la ventana y poder cerrar uno con su botón «Cerrar»,
para leerlos mientras sigo trabajando y quitar el que ya no me interesa.

## Reglas
- Los avisos aparecen en la esquina inferior derecha de la ventana, a 16 px del borde derecho y a 16 px del borde inferior, por encima del contenido de la página.
- Cada aviso mide como máximo 360 px de ancho. En una ventana más estrecha ocupa el ancho de la ventana menos 16 px a cada lado.
- Los avisos quedan en su sitio aunque la página se desplace.
- Cada aviso muestra la franja y el punto del color de su tono, el título, el cuerpo si lo tiene y, a la derecha, un botón con el nombre «Cerrar».
- Al pulsar «Cerrar» del aviso, ese aviso desaparece. Los demás siguen visibles hasta su propio plazo de 3 segundos.
- Cada tono se anuncia con su rol: el aviso de error con rol de alerta, y los de éxito, informativo y advertencia con rol de estado.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` inicia sesión con `Gestor1234!` en `/login?tenant=alumno01`, como indica la épica de inicio de sesión (EP-LOGIN), hasta llegar a /programs. Antes de cada fila el caos del tenant está apagado (`GET /api/config` devuelve latencia 0 y tasa de error 0; si no, se apaga con `PATCH /api/admin/chaos` y el token de `alumno01@sigpro.lab`). Si la fila fija una tasa de error del 100 %, se hace con ese mismo `PATCH` y `errorRate` 1; el caos solo falla las escrituras de la aplicación. Al terminar la fila se apaga de nuevo.

## Criterios de aceptación
```gherkin
Característica: Avisos emergentes en la web

  Esquema del escenario: El aviso aparece en la parte inferior de la ventana
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs con la ventana de <ancho> px de ancho
    Cuando abre las acciones de PRG-001 y pulsa «Archivar»
    Entonces el aviso «PRG-001 archivado» está en la parte inferior de la ventana
    Y <posicion>

    Ejemplos:
      | ancho | posicion |
      | 1440 | queda a 16 px del borde derecho y a 16 px del borde inferior, y mide como máximo 360 px de ancho |
      | 390 | ocupa el ancho de la ventana menos 16 px a cada lado y queda a 16 px del borde inferior |

  Esquema del escenario: El botón «Cerrar» retira solo el aviso al que pertenece
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs
    Y abre las acciones de PRG-001 y pulsa «Archivar»
    Y, mientras el aviso «PRG-001 archivado» sigue a la vista, abre las acciones de PRG-002 y pulsa «Archivar»
    Cuando pulsa «Cerrar» del aviso <aviso>
    Entonces el aviso <aviso> deja de estar en la pantalla
    Y el aviso <otro> sigue a la vista

    Ejemplos:
      | aviso | otro |
      | «PRG-001 archivado» | «PRG-002 archivado» |
      | «PRG-002 archivado» | «PRG-001 archivado» |

  Esquema del escenario: Cada tono se anuncia con el rol que le corresponde
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs y la tasa de error de las escrituras es del <tasa> %
    Cuando abre las acciones de PRG-001 y pulsa «Archivar»
    Entonces el aviso <titulo> se anuncia con el rol de <rol>

    Ejemplos:
      | tasa | titulo | rol |
      | 0 | «PRG-001 archivado» | estado |
      | 100 | «Ha ocurrido un error inesperado» | alerta |
```

## Fuera de alcance
- El tono informativo y el de advertencia, con sus textos: la historia web de avisos informativos y de advertencia de esta épica.
- El texto de cada aviso concreto y la acción que lo produce: las épicas de cada pantalla.
- El cierre a mano en la app móvil: la historia móvil de cierre de esta épica.

## Decisiones pendientes
- Línea de detalle técnico. Hoy el aviso de error de la web lleva, bajo el título, una línea de detalle técnico con la petición HTTP real. Está pendiente de decisión de producto si esa línea forma parte del producto y qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.
