---
id: US-REQ-ARBOL-008
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Web] Mostrar la carga, el estado vacío, el error y el programa no encontrado"
etiquetas: [web]
relacionadas: [US-REQ-ARBOL-001, US-REQ-ARBOL-012, US-PROG-DETALLE-002]
verificacion: ejecutada
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero saber en cada momento si la lista de requisitos está cargando, si el programa no tiene requisitos, si no se ha podido cargar o si el programa no existe,
para no confundir una pantalla vacía con un fallo y saber qué hacer en cada caso.

## Reglas
- Carga: mientras llega la lista de requisitos, el área del árbol no muestra ningún requisito, el contador muestra «…» y las cifras muestran «…».
- Estado vacío: un programa del tenant que no tiene requisitos muestra en el área del árbol el título «Sin requisitos» y el texto «Este programa todavía no tiene requisitos.». El contador dice «0 de 0 requisitos», y los botones «Expandir todo» y «Contraer todo» están deshabilitados. La cabecera con el programa, el desplegable y el botón de exportar siguen visibles.
- Error: si la lista no llega, aparece sobre el área del árbol un aviso de alerta con el título «No se pudieron cargar los requisitos», una línea con el detalle técnico de la respuesta y el botón «Reintentar». No se ve ningún requisito. El contador muestra «…». Al pulsar «Reintentar», la página vuelve a pedir la lista; si llega bien, se muestra el árbol.
- Programa no encontrado: si el código de la dirección no corresponde a un programa del tenant, la página muestra solo el título «No se encontró el programa», una línea con el detalle técnico de la respuesta y el enlace «Volver a Programas». No muestra la cabecera del programa, ni las cifras, ni el árbol. Pulsar el enlace lleva a `/programs`.
- Sin ninguna sesión de SIGPRO guardada, abrir la pantalla lleva a `/login` y no muestra ningún dato de requisitos.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se inicia sesión con `gestor@sigpro.test` (`Gestor1234!`) y se llega a Programas. Cada fila parte de un contexto nuevo. Para el error, la prueba hace que la petición `GET /api/programs/PRG-001/requirements` responda con un error del servidor (código 500) solo en esa fila.
- Tras un reinicio, `PRG-004` y `PRG-024` no tienen requisitos y `PRG-000` y `PRG-025` no existen en `alumno01`.

## Criterios de aceptación
```gherkin
Característica: Estados de la pantalla de requisitos en la web

  Esquema del escenario: Un programa sin requisitos muestra el estado vacío
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/<programa>/requirements con una ventana de 1440 px
    Cuando mira el área de requisitos
    Entonces ve el título «Sin requisitos» y el texto «Este programa todavía no tiene requisitos.»
    Y el contador dice «0 de 0 requisitos»
    Y los botones «Expandir todo» y «Contraer todo» están deshabilitados

    Ejemplos:
      | programa |
      | PRG-004 |
      | PRG-024 |

  Esquema del escenario: Mientras la lista llega, el área del árbol no muestra requisitos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la respuesta de GET /api/programs/PRG-001/requirements tarda <espera> en llegar
    Cuando abre /programs/PRG-001/requirements con una ventana de 1440 px
    Entonces mientras espera ve el contador con «…» y las cifras con «…»
    Y no ve ningún requisito
    Cuando llega la respuesta
    Entonces ve REQ-001 y el contador dice «14 de 14 requisitos»

    Ejemplos:
      | espera |
      | 3 segundos |

  Esquema del escenario: Si la lista no llega, la pantalla muestra el error con la opción de reintentar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la petición GET /api/programs/PRG-001/requirements responde con un error del servidor
    Cuando abre /programs/PRG-001/requirements con una ventana de <ancho>
    Entonces ve el aviso de alerta «No se pudieron cargar los requisitos» con una línea de detalle técnico
    Y ve el botón «Reintentar»
    Y no ve ningún requisito

    Ejemplos:
      | ancho |
      | 1440 px |
      | 390 px |

  Esquema del escenario: Reintentar vuelve a pedir la lista y muestra el árbol si llega
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001/requirements con una ventana de 1440 px y ve el aviso de error porque la petición respondió con un error del servidor
    Cuando la petición vuelve a responder bien y pulsa «Reintentar»
    Entonces ve REQ-001 y el contador dice «14 de 14 requisitos»

    Ejemplos:
      | programa |
      | PRG-001 |

  Esquema del escenario: Un programa que no es del tenant muestra solo el aviso de no encontrado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre <ruta> con una ventana de 1440 px
    Entonces ve el título «No se encontró el programa» y el enlace «Volver a Programas»
    Y no ve ni las cifras ni el árbol de requisitos
    Cuando pulsa «Volver a Programas»
    Entonces llega a /programs

    Ejemplos:
      | ruta |
      | /programs/PRG-000/requirements |
      | /programs/PRG-025/requirements |

  Esquema del escenario: Sin una sesión de SIGPRO guardada, la pantalla lleva al acceso
    Dado que en el tenant alumno01, recién reiniciado, una persona sin ninguna sesión de SIGPRO guardada está en /login?tenant=alumno01
    Cuando abre <ruta>
    Entonces llega a /login
    Y no ve ningún requisito

    Ejemplos:
      | ruta |
      | /programs/PRG-001/requirements |
```

## Decisiones pendientes
- Qué debe contener la línea de detalle técnico que sale bajo el aviso de error y bajo el aviso de programa no encontrado (hoy es la petición HTTP real, con su método, su ruta y su código). No está decidido, y ninguna fila de esta historia lo afirma: quien ejecuta puede anotarla como dato aparte, pero no decide ningún veredicto con ella.
- Qué muestran las cifras cuando la lista no llega: hoy, en la web, quedan con «…» mientras dura el error.

## Fuera de alcance
- El botón «Crear el primer requisito» que aparece en el estado vacío a los roles que pueden crear requisitos, y el alta que abre: EP-REQ-EDICION.
- La forma del listado y del programa en la respuesta de la API: esta misma épica (EP-REQ-ARBOL), en su historia de la API sobre el listado.
- El árbol, la búsqueda y el detalle que se ven cuando la lista llega: esta misma épica, en sus historias de la web.
- La lista de programas a la que lleva el enlace «Volver a Programas»: EP-PROG-LISTA.
- El inicio de sesión al que lleva la pantalla sin sesión: EP-LOGIN.
