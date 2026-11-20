---
id: US-TOASTS-003
tipo: historia
epica: EP-TOASTS
titulo: "[Transversal] Varios avisos a la vez y cierre automático a los 3 segundos"
etiquetas: [transversal]
relacionadas: [US-TOASTS-001, US-TOASTS-004, US-TOASTS-006, US-TOASTS-007]
verificacion: ejecutada
---

## Historia
Como persona que usa SIGPRO, quiero que cada acción deje su propio aviso aunque el anterior siga a la vista, y que cada aviso se retire solo a los 3 segundos,
para seguir trabajando sin que los avisos se tapen unos a otros y sin tener que cerrarlos uno a uno.

## Reglas
- Cada acción que produce un aviso añade el suyo. No sustituye al anterior, aunque el texto sea el mismo: cada acción muestra su aviso.
- Los avisos visibles a la vez se apilan: ninguno tapa a otro, y el más reciente queda debajo de los anteriores.
- Cada aviso se retira solo a los 3 segundos contados desde que aparece. Es el plazo de producto para todos los avisos emergentes y para los cuatro tonos: el plan de SIGPRO fija que los avisos desaparecen a los 3 segundos, y `docs/DECISIONS.md` lo fija en 3 segundos y no en los 4,5 segundos del prototipo de diseño.
- Cuando un aviso se retira, desaparece de la pantalla. Los demás siguen visibles hasta su propio plazo.
- Para comprobar el plazo, la prueba mira el aviso en el momento que indica la fila, contado en segundos desde que apareció. El instante de los 3 segundos no es una fila porque depende del reloj de la prueba: las filas miran antes (2 segundos) y después (4 segundos).
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` inicia sesión con `Gestor1234!` en el tenant `alumno01` hasta llegar a /programs, como indica la épica de inicio de sesión (EP-LOGIN). Antes de cada fila el caos del tenant está apagado (`GET /api/config` devuelve latencia 0 y tasa de error 0; si no, se apaga con `PATCH /api/admin/chaos` y el token de `alumno01@sigpro.lab`). Si la fila fija una tasa de error del 100 %, se hace con ese mismo `PATCH` y `errorRate` 1; el caos solo falla las escrituras de la aplicación, no el inicio de sesión ni la administración. Al terminar la fila se apaga de nuevo.

## Criterios de aceptación
```gherkin
Característica: Apilado de avisos y plazo de retirada

  Esquema del escenario: Cada acción muestra su propio aviso aunque el anterior siga a la vista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs
    Cuando abre las acciones de <primero> y pulsa «Archivar»
    Y, mientras el aviso <aviso_primero> sigue a la vista, abre las acciones de <segundo> y pulsa «Archivar»
    Entonces ve los avisos <aviso_primero> y <aviso_segundo> a la vez
    Y <aviso_segundo> está debajo de <aviso_primero>

    Ejemplos:
      | primero | aviso_primero | segundo | aviso_segundo |
      | PRG-001 | «PRG-001 archivado» | PRG-002 | «PRG-002 archivado» |
      | PRG-003 | «PRG-003 archivado» | PRG-001 | «PRG-001 archivado» |

  Esquema del escenario: Dos fallos seguidos muestran dos avisos de error aunque el texto sea el mismo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs y la tasa de error de las escrituras es del 100 %
    Cuando abre las acciones de <primero> y pulsa «Archivar»
    Y, mientras el primer aviso sigue a la vista, abre las acciones de <segundo> y pulsa «Archivar»
    Entonces ve dos avisos de error con el título «Ha ocurrido un error inesperado»

    Ejemplos:
      | primero | segundo |
      | PRG-001 | PRG-001 |
      | PRG-001 | PRG-002 |

  Esquema del escenario: El aviso se retira a los 3 segundos de aparecer
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs
    Y abre las acciones de PRG-001 y pulsa «Archivar» y aparece el aviso «PRG-001 archivado»
    Cuando pasan <segundos> segundos desde que apareció
    Entonces el aviso <estado>

    Ejemplos:
      | segundos | estado |
      | 2 | sigue a la vista |
      | 4 | ya no está en la pantalla |
```

## Fuera de alcance
- La posición de los avisos y el cierre con «Cerrar» en la web: las historias web de esta épica.
- La posición de los avisos y el cierre a mano en la app móvil: las historias móviles de esta épica.
- El texto de cada aviso concreto: las épicas de cada pantalla.

## Decisiones pendientes
- Si el plazo de un aviso se detiene mientras el ratón está encima de él o mientras tiene el foco del teclado. Hoy el plazo no se detiene en ningún caso, y no está decidido si debe hacerlo.
- Cuántos avisos pueden estar visibles a la vez. No hay un tope fijado por el producto.
- Línea de detalle técnico de los avisos de error. Hoy los avisos de error de esta historia la llevan bajo el título; está pendiente de decisión de producto si forma parte del producto. Ningún ejemplo de esta historia la afirma ni la excluye.
