---
id: US-PROG-DETALLE-006
tipo: historia
epica: EP-PROG-DETALLE
titulo: "[Móvil] Mostrar la carga, el aviso de no encontrado y el error de la ficha, y volver a Programas"
etiquetas: [movil]
relacionadas: [US-PROG-DETALLE-003, US-PROG-DETALLE-005]
verificacion: ejecutada
cubre: ["/programs/:code"]
---

## Historia
Como persona que abre la ficha de un programa desde el móvil, quiero ver qué ocurre mientras se carga, si el código no corresponde a ningún programa, si falla el servidor y cómo volver a la lista,
para saber si debo esperar, reintentar, corregir el código o volver a Programas.

## Reglas
- Mientras llega la respuesta, la pantalla muestra «Cargando…» y no muestra el nombre del programa.
- Si la API responde 404, el título de la pantalla es «Detalle del programa» y debajo aparece el código pedido. Después se ve el aviso «Programa no encontrado». No hay datos del programa.
- Si la API responde con otro error, la pantalla muestra «No se pudo cargar el programa» y el botón «Reintentar». Pulsar «Reintentar» vuelve a pedir el programa: si la respuesta llega bien, la pantalla muestra el programa.
- El botón «Volver a Programas» está al pie de la pantalla, también cuando el programa existe, y lleva a la lista de Programas (`/programs`).
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app móvil se deja en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y `gestor@sigpro.test` (contraseña `Gestor1234!`) inicia sesión. Cada fila parte de un contexto nuevo. Para la carga, la prueba retrasa la respuesta de `GET /api/programs/PRG-001` el tiempo que indica la fila. Para el error, la prueba hace que la primera respuesta de esa petición tenga el código HTTP que indica la fila, y que las siguientes respondan con normalidad. Para la vuelta, la fila indica desde dónde se abre la ficha.

## Criterios de aceptación
```gherkin
Característica: Carga, no encontrado y error de la ficha en la app móvil

  Esquema del escenario: La ficha muestra Cargando hasta que llega el programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y la prueba retrasa <espera> la respuesta de GET /api/programs/PRG-001
    Cuando abre la ruta /programs/PRG-001
    Entonces mientras espera ve «Cargando…» y no ve el nombre del programa
    Y al llegar la respuesta ve el nombre Sistema de mando táctico Ártemis

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Un código que no es un programa del tenant muestra el aviso de no encontrado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo»
    Cuando abre la ruta /programs/<codigo>
    Entonces ve el título «Detalle del programa» con el código <codigo> debajo
    Y ve «Programa no encontrado»
    Y no ve datos de ningún programa

    Ejemplos:
      | codigo |
      | PRG-000 |
      | PRG-025 |
      | REQ-001 |

  Esquema del escenario: Un fallo del servidor se puede reintentar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», y la prueba hace que la primera respuesta de GET /api/programs/PRG-001 tenga el código <codigo_http>, y en la pantalla ve «No se pudo cargar el programa» y el botón «Reintentar»
    Cuando pulsa «Reintentar»
    Entonces ve el nombre Sistema de mando táctico Ártemis

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |

  Esquema del escenario: El botón Volver a Programas lleva a la lista de Programas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y ha abierto la ruta /programs/PRG-001 desde <origen>
    Cuando pulsa «Volver a Programas»
    Entonces llega a /programs

    Ejemplos:
      | origen |
      | la lista de Programas |
      | la búsqueda global, con el resultado del programa PRG-001 |

## Fuera de alcance
- La lista de Programas: EP-PROG-LISTA.
- La búsqueda global y sus resultados: EP-NAVEGACION.
- El inicio de sesión: EP-LOGIN.
- La cabecera, los datos, las opciones y el botón «Editar programa» cuando el programa existe: EP-PROG-DETALLE, en su historia móvil de la ficha.

## Decisiones pendientes
- La línea de detalle técnico (la traza de la petición fallida) que la pantalla muestra bajo el aviso. Hoy la muestra; no está decidido si forma parte del producto ni qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.
