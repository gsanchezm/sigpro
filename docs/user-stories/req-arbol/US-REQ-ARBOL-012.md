---
id: US-REQ-ARBOL-012
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Móvil] Mostrar la carga, el estado vacío, el error y el programa no encontrado"
etiquetas: [movil]
relacionadas: [US-REQ-ARBOL-008, US-REQ-ARBOL-009]
verificacion: ejecutada
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero saber si la lista de requisitos está cargando, si el programa no tiene requisitos, si no se ha podido cargar o si el programa no existe,
para no confundir una pantalla vacía con un fallo y saber qué hacer en cada caso.

## Reglas
- Carga: mientras llega la lista del programa y todavía no hay datos, aparece el aviso «Cargando…» y no se ve ningún requisito.
- Estado vacío: un programa del tenant que no tiene requisitos muestra el título «Sin requisitos» y el texto «Este programa todavía no tiene requisitos.». El contador dice «0 de 0 requisitos». Si el rol puede crear requisitos, el estado vacío ofrece además el botón «Crear el primer requisito», que se describe en la épica de edición.
- Error: si la lista no llega, la pantalla muestra el título «No se pudieron cargar los requisitos», una línea con el detalle técnico de la respuesta y el botón «Reintentar». No se ve ningún requisito. Al pulsar «Reintentar», la app vuelve a pedir la lista; si llega bien, se muestra el árbol.
- Programa no encontrado: si el código de la dirección no corresponde a un programa del tenant, la pantalla muestra el título «No se encontró el programa», una línea con el detalle técnico de la respuesta y el enlace «Volver a Programas», que lleva a la lista de programas. No muestra el árbol ni las cifras.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app está en /login, sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo»; se escriben el correo y la contraseña de `gestor@sigpro.test` (`Gestor1234!`), se pulsa «Entrar» y se llega a Programas. Para el error, la prueba hace que la petición `GET /api/programs/PRG-001/requirements` responda con un error del servidor (código 500) solo en esa fila.
- Tras un reinicio, `PRG-004` no tiene requisitos, y `PRG-000` y `PRG-025` no existen en `alumno01`.

## Criterios de aceptación
```gherkin
Característica: Estados de la pantalla de requisitos en la app móvil

  Esquema del escenario: Un programa sin requisitos muestra el estado vacío
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/<programa>/requirements
    Cuando mira la lista de requisitos
    Entonces ve el título «Sin requisitos» y el texto «Este programa todavía no tiene requisitos.»
    Y el contador dice «0 de 0 requisitos»

    Ejemplos:
      | programa |
      | PRG-004 |

  Esquema del escenario: Mientras la lista llega, la pantalla muestra el aviso de carga
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y la respuesta de GET /api/programs/PRG-001/requirements tarda <espera> en llegar
    Cuando abre /programs/PRG-001/requirements
    Entonces mientras espera ve el aviso «Cargando…» y no ve ningún requisito
    Cuando llega la respuesta
    Entonces ve REQ-001 y el contador dice «14 de 14 requisitos»

    Ejemplos:
      | espera |
      | 3 segundos |

  Esquema del escenario: Si la lista no llega, la pantalla muestra el error con la opción de reintentar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y la petición GET /api/programs/PRG-001/requirements responde con un error del servidor
    Cuando abre /programs/PRG-001/requirements
    Entonces ve el título «No se pudieron cargar los requisitos» con una línea de detalle técnico
    Y ve el botón «Reintentar»
    Y no ve ningún requisito

    Ejemplos:
      | programa |
      | PRG-001 |

  Esquema del escenario: Reintentar vuelve a pedir la lista y muestra el árbol si llega
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y ve el error de la lista de <programa>
    Cuando la petición vuelve a responder bien y pulsa «Reintentar»
    Entonces ve REQ-001 y el contador dice «14 de 14 requisitos»

    Ejemplos:
      | programa |
      | PRG-001 |

  Esquema del escenario: Un programa que no es del tenant muestra el aviso de no encontrado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil
    Cuando abre /programs/<codigo>/requirements
    Entonces ve el título «No se encontró el programa» y el enlace «Volver a Programas»
    Y no ve ni las cifras ni el árbol de requisitos
    Cuando pulsa «Volver a Programas»
    Entonces llega a /programs

    Ejemplos:
      | codigo |
      | PRG-000 |
      | PRG-025 |
```

## Decisiones pendientes
- Qué debe contener la línea de detalle técnico que sale bajo el error y bajo el aviso de programa no encontrado (hoy es la petición HTTP real, con su método, su ruta y su código). No está decidido, y ninguna fila de esta historia lo afirma: quien ejecuta puede anotarla como dato aparte, pero no decide ningún veredicto con ella.

## Fuera de alcance
- El botón «Crear el primer requisito» del estado vacío y el alta que abre: EP-REQ-EDICION.
- El árbol, la búsqueda y las cifras que se ven cuando la lista llega: esta misma épica (EP-REQ-ARBOL), en sus historias de la app móvil.
- La lista de programas a la que lleva el enlace «Volver a Programas»: EP-PROG-LISTA.
- La versión web de estos mismos estados: esta misma épica, en la historia de la web sobre estados.
