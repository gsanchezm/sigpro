---
id: US-PROG-DETALLE-003
tipo: historia
epica: EP-PROG-DETALLE
titulo: "[Web] Mostrar la carga, el aviso de no encontrado y el error de la ficha, y volver a Programas"
etiquetas: [web]
relacionadas: [US-PROG-DETALLE-002, US-PROG-DETALLE-006]
verificacion: codigo
cubre: ["/programs/:code"]
---

## Historia
Como persona que abre la ficha de un programa en la web, quiero ver qué ocurre mientras se carga, si el código no corresponde a ningún programa o si el servidor falla, y cómo volver a la lista,
para saber si debo esperar, corregir el código o volver a Programas.

## Reglas
- Mientras llega la respuesta, la ficha muestra un indicador de carga y no muestra el código, el nombre ni ningún otro dato del programa.
- Si la API responde 404, la página muestra como título «No se encontró el programa». No hay datos del programa, y aparece el enlace «Volver a Programas».
- Si la API responde con cualquier otro error, la página muestra como título «Ha ocurrido un error inesperado», no muestra datos del programa y aparece el enlace «Volver a Programas».
- El enlace «Volver a Programas» lleva a `/programs`. Ese mismo enlace está también al pie de la ficha cuando el programa existe.
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, y `gestor@sigpro.test` (contraseña `Gestor1234!`) inicia sesión y llega a Programas. Cada fila parte de un contexto nuevo. Para la carga, la prueba retrasa la respuesta de `GET /api/programs/PRG-001` el tiempo que indica la fila. Para el error, la prueba hace que esa misma petición responda con el código HTTP que indica la fila.

## Criterios de aceptación
```gherkin
Característica: Carga, no encontrado y error de la ficha en la web

  Esquema del escenario: La ficha muestra la carga hasta que llega el programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la prueba retrasa <espera> la respuesta de GET /api/programs/PRG-001
    Cuando abre /programs/PRG-001
    Entonces mientras espera ve el indicador de carga y no ve el nombre del programa
    Y al llegar la respuesta ve el nombre Sistema de mando táctico Ártemis

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Un código que no es un programa del tenant muestra el aviso de no encontrado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre /programs/<codigo>
    Entonces ve el título «No se encontró el programa»
    Y no ve datos de ningún programa
    Y ve el enlace «Volver a Programas»

    Ejemplos:
      | codigo |
      | PRG-000 |
      | PRG-025 |
      | REQ-001 |

  Esquema del escenario: Un fallo del servidor muestra el aviso de error
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la prueba hace que GET /api/programs/PRG-001 responda <codigo_http>
    Cuando abre /programs/PRG-001
    Entonces ve el título «Ha ocurrido un error inesperado»
    Y no ve datos del programa
    Y ve el enlace «Volver a Programas»

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |

  Esquema del escenario: El enlace Volver a Programas lleva a la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y ha abierto <ficha>
    Cuando pulsa «Volver a Programas»
    Entonces llega a /programs

    Ejemplos:
      | ficha |
      | /programs/PRG-025, que muestra «No se encontró el programa» |
      | /programs/PRG-001, que muestra sus datos |
```

## Fuera de alcance
- La lista de programas a la que lleva el enlace «Volver a Programas»: EP-PROG-LISTA.
- El inicio de sesión con el que se llega a la ficha: EP-LOGIN.
- La cabecera, los datos, las pestañas y el botón «Editar programa» cuando el programa existe: EP-PROG-DETALLE, en su historia web de la ficha.

## Decisiones pendientes
- La línea de detalle técnico (la traza de la petición fallida) que la página muestra bajo el aviso. Hoy la muestra; no está decidido si forma parte del producto ni qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.
