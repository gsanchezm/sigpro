---
id: US-CAOS-RESET-007
tipo: historia
epica: EP-CAOS-RESET
titulo: "[API] El modo caos retrasa y falla solo las peticiones de su tenant"
etiquetas: [api]
relacionadas: [US-CAOS-RESET-004, US-CAOS-RESET-006, US-CAOS-RESET-010, US-CAOS-RESET-011]
verificacion: ejecutada
---

## Historia
Como persona que practica la espera y los reintentos, quiero que el modo caos de mi tenant añada latencia y errores 500 en las escrituras de mi tenant, y que las rutas de administración y de sesión sigan respondiendo,
para practicar con fallos reales sin que el caos llegue a otros tenants ni me deje sin forma de apagarlo.

## Reglas
- Con `latencyMs` mayor que 0, cada petición del tenant recibe un retardo aleatorio entre 0 y `latencyMs` milisegundos, que se suma a su tiempo normal.
- Con `errorRate` mayor que 0, cada escritura del tenant (POST, PUT, PATCH o DELETE) puede responder 500 con el código `chaos_error`. Cuando responde así, la escritura no se ejecuta: no crea, no cambia y no borra nada. Con `errorRate` 1 fallan todas las escrituras; con 0, ninguna. Las lecturas (GET) nunca responden 500 por el caos.
- Las rutas que empiezan por `/api/admin`, `/api/auth`, `/api/health`, `/api/docs` y `/api/config` no reciben ni retardo ni error, para que el administrador siempre pueda apagar el caos y el acceso siga estable.
- Con solo `flakyLabels` activo (latencia 0 y tasa 0), la API no añade retardo ni errores: los textos variables son solo de la interfaz.
- El caos se aplica según el tenant del token. El caos de un tenant no altera las peticiones de otro.
- Esta historia usa también el tenant `alumno02` como segundo tenant. Se reinicia con el token de `alumno02@sigpro.lab` y se deja con el modo caos apagado al terminar. Su único ejemplo es una escritura sin datos válidos, que la API rechaza antes de crear nada.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos` y el cuerpo `{ "latencyMs": 0, "errorRate": 0, "flakyLabels": false }`. Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos.
- Alta de programa de los ejemplos: cuerpo base con `name` Programa de prueba alfa, `ownerId` u2, `startDate` 2027-03-01, `endDate` 2027-03-02 y `budget` 900000. Sin caos, la primera alta de la fila recibe el código `PRG-025`.

## Criterios de aceptación
```gherkin
Característica: Efectos del modo caos en las peticiones

  Esquema del escenario: El retardo añadido queda entre cero y el máximo fijado
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab mide tres veces la respuesta de GET /api/programs como referencia
    Cuando fija con PATCH latencyMs <latencia> y mide diez veces más la respuesta de GET /api/programs
    Entonces la media de las diez respuestas <resultado> a la media de la referencia en más de 1000 ms

    Ejemplos:
      | latencia | resultado |
      | 0 | no supera |
      | 5000 | supera |


  Esquema del escenario: Con errorRate 1 una escritura responde 500 y no crea el programa
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, gestor@sigpro.test tiene un token de acceso
    Cuando alumno01@sigpro.lab fija con PATCH errorRate 1 y gestor@sigpro.test envía <escritura> con x-tenant alumno01 y el cuerpo base
    Entonces la respuesta es 500 con el código chaos_error
    Y después de apagar el caos con PATCH, una nueva alta con el cuerpo base recibe el código PRG-025

    Ejemplos:
      | escritura |
      | POST /api/programs |

  Esquema del escenario: Con errorRate 1 las lecturas responden con normalidad
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, gestor@sigpro.test tiene un token de acceso
    Y alumno01@sigpro.lab ha fijado con PATCH errorRate 1
    Cuando envía <lectura> con x-tenant alumno01 y ese token
    Entonces la respuesta es 200

    Ejemplos:
      | lectura |
      | GET /api/programs |
      | GET /api/programs/PRG-001 |

  Esquema del escenario: Las rutas exentas responden con normalidad aunque las escrituras fallen
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab ha fijado con PATCH errorRate 1
    Cuando envía <peticion>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | peticion | respuesta |
      | POST /api/auth/login con x-tenant alumno01, alumno01@sigpro.lab y la contraseña Alumno1234! | 200 con accessToken |
      | POST /api/admin/reset con el token de alumno01@sigpro.lab | 200 |
      | PATCH /api/admin/chaos con el cuerpo { "errorRate": 0 } y el token de alumno01@sigpro.lab | 200 |
      | GET /api/config con x-tenant alumno01 | 200 |

  Esquema del escenario: El caos de alumno01 no altera las peticiones de alumno02
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, alumno01@sigpro.lab ha fijado con PATCH errorRate 1
    Y en el tenant alumno02, recién reiniciado con el token de alumno02@sigpro.lab y con el modo caos apagado, gestor@sigpro.test ha iniciado sesión con x-tenant alumno02
    Cuando gestor@sigpro.test envía <escritura> con x-tenant alumno02, su token y un cuerpo vacío
    Y alumno01@sigpro.lab envía <escritura> con x-tenant alumno01, su token y un cuerpo vacío
    Entonces la petición de alumno02 responde <respuesta_otro>
    Y la petición de alumno01 responde <respuesta_alumno>

    Ejemplos:
      | escritura | respuesta_otro | respuesta_alumno |
      | POST /api/programs | 422 validation_failed | 500 con el código chaos_error |
```

## Fuera de alcance
- El aislamiento de los datos entre tenants que no pasa por el caos: EP-MULTITENANT-PERMISOS.
- Los textos variables de cada pantalla: las historias web y móviles de esta épica y las épicas de cada módulo.
- La forma en que cada persona espera o reintenta sus peticiones: no es un requisito del producto.
