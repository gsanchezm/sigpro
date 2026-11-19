---
id: US-NC-TABLERO-008
tipo: historia
epica: EP-NC-TABLERO
titulo: "[Web] Cambiar el estado de una no conformidad desde el tablero"
etiquetas: [web]
relacionadas: [US-NC-TABLERO-003, US-NC-TABLERO-004, US-NC-TABLERO-006, US-NC-TABLERO-009]
verificacion: codigo
cubre: ["/nc"]
permisos: [nc.transition]
---

## Historia
Como persona con permiso para mover no conformidades, quiero cambiar el estado de una no conformidad arrastrando su tarjeta a otra columna o con «Mover a…», sin abrir su detalle,
para avanzar su ciclo en cuanto sé que ha cambiado y ver de inmediato dónde ha quedado.

## Reglas
- Con 1024 px o más de ancho, la tarjeta se arrastra a otra columna. Mientras se arrastra, las columnas que la máquina de estados admite desde el estado actual de la tarjeta se marcan como destino válido. El servidor decide siempre si el paso se acepta.
- La tarjeta también se mueve desde su menú de acciones, con una opción «Mover a «<estado>»» por cada paso que la máquina admite desde su estado. El menú tiene siempre «Abrir detalle» y «Comentario rápido…». Una no conformidad sin pasos no tiene ninguna opción «Mover a».
- Con menos de 1024 px, la tarjeta no se arrastra. Su botón «Mover a… (<código>)» abre una hoja con los pasos permitidos, y elegir uno mueve la tarjeta a la pestaña de su nuevo estado.
- Un paso aceptado coloca la tarjeta en su nueva columna en el momento, actualiza los dos contadores y muestra el aviso «<código> pasó a «<estado>»».
- Un paso que el servidor rechaza con 409, porque la máquina de estados no lo admite, devuelve la tarjeta a su columna y muestra el aviso de error «<código>: no se puede pasar de «<estado de origen>» a «<estado de destino>»».
- Si el servidor responde con otro fallo, la tarjeta vuelve a su columna y el aviso de error dice «No se pudo mover <código>».
- Quien solo lee (`auditor`, sin `nc.transition`) no puede mover tarjetas: no se arrastran, y en su menú la opción «Mover a…» aparece deshabilitada con el motivo «Tu rol no permite mover no conformidades».
- Arrastrar una tarjeta hasta «Cerrada» o elegir «Cerrada» en su menú es el cierre de la no conformidad, que pide un comentario y se describe en EP-NC-GESTION. Esta historia no lo prueba.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga. Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, la cuenta de la fila inicia sesión y se abre /nc. Las cuentas son `consultor@sigpro.test` (`Consul1234!`), que mueve, y `auditor@sigpro.test` (`Audit1234!`), que solo lee.
- Para los fallos del servidor, la prueba hace que la petición `POST /api/nc/<código>/transition` responda con el código HTTP de la fila.

## Criterios de aceptación
```gherkin
Característica: Cambio de estado desde el tablero en la web

  Esquema del escenario: Arrastrar una tarjeta a una columna que admite el paso la mueve y avisa
    Dado que el tenant alumno01 está recién reiniciado, consultor@sigpro.test ha iniciado sesión en la web y abre /nc
    Cuando arrastra <codigo> desde la columna «<origen>» hasta la columna «<destino>»
    Entonces ve el aviso «<aviso>»
    Y la columna «<origen>» muestra el contador <contador_origen> y la columna «<destino>» muestra el contador <contador_destino>

    Ejemplos:
      | codigo | origen | destino | aviso | contador_origen | contador_destino |
      | NC-001 | Abierta | En análisis | NC-001 pasó a «En análisis» | 3 | 3 |
      | NC-002 | En análisis | Acción correctiva | NC-002 pasó a «Acción correctiva» | 1 | 3 |
      | NC-003 | Acción correctiva | En análisis | NC-003 pasó a «En análisis» | 1 | 3 |
      | NC-005 | Rechazada | Abierta | NC-005 pasó a «Abierta» | 1 | 5 |

  Esquema del escenario: Arrastrar una tarjeta a una columna que la máquina no admite la devuelve a su columna
    Dado que el tenant alumno01 está recién reiniciado, consultor@sigpro.test ha iniciado sesión en la web y abre /nc
    Cuando arrastra <codigo> desde la columna «Abierta» hasta la columna «<destino>»
    Entonces ve el aviso de error «<aviso>»
    Y la tarjeta <codigo> sigue en la columna «Abierta» con el contador 4

    Ejemplos:
      | codigo | destino | aviso |
      | NC-001 | Acción correctiva | NC-001: no se puede pasar de «Abierta» a «Acción correctiva» |
      | NC-001 | Rechazada | NC-001: no se puede pasar de «Abierta» a «Rechazada» |

  Esquema del escenario: El menú de la tarjeta ofrece solo los pasos que la máquina admite desde su estado
    Dado que el tenant alumno01 está recién reiniciado, consultor@sigpro.test ha iniciado sesión en la web y abre /nc
    Cuando abre el menú de acciones de <codigo>
    Entonces las opciones del menú son «Abrir detalle», «Comentario rápido…» y <pasos>

    Ejemplos:
      | codigo | pasos |
      | NC-001 | «Mover a «En análisis»» |
      | NC-002 | «Mover a «Acción correctiva»», «Mover a «Rechazada»» y «Mover a «Abierta»» |
      | NC-004 | ninguna más |

  Esquema del escenario: Quien solo lee no puede mover una tarjeta
    Dado que el tenant alumno01 está recién reiniciado, auditor@sigpro.test ha iniciado sesión en la web y abre /nc
    Cuando intenta arrastrar <codigo> hasta la columna «<destino>»
    Entonces la tarjeta <codigo> sigue en la columna «Abierta» con el contador 4
    Y la opción «Mover a «<destino>»» del menú de <codigo> está deshabilitada con el motivo «Tu rol no permite mover no conformidades»

    Ejemplos:
      | codigo | destino |
      | NC-001 | En análisis |

  Esquema del escenario: Con menos de 1024 px «Mover a…» elige el paso en una hoja
    Dado que el tenant alumno01 está recién reiniciado, consultor@sigpro.test ha iniciado sesión en la web y la ventana mide 390 px de ancho
    Cuando abre /nc, pulsa «Mover a… (<codigo>)» y elige «Mover a «<destino>»» en la hoja
    Entonces ve el aviso «<codigo> pasó a «<destino>»» y la tarjeta <codigo> está en la pestaña «<destino>»

    Ejemplos:
      | codigo | destino |
      | NC-001 | En análisis |

  Esquema del escenario: Un fallo del servidor al mover deja la tarjeta en su columna
    Dado que el tenant alumno01 está recién reiniciado, consultor@sigpro.test ha iniciado sesión en la web, abre /nc y la prueba hace que la petición POST /api/nc/NC-001/transition responda <codigo_http>
    Cuando arrastra NC-001 desde la columna «Abierta» hasta la columna «En análisis»
    Entonces ve el aviso de error «No se pudo mover NC-001» y la tarjeta NC-001 sigue en la columna «Abierta»

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |
```

## Decisiones pendientes
- Ninguna.

## Fuera de alcance
- Cerrar una no conformidad, arrastrándola a «Cerrada» o desde su menú: EP-NC-GESTION, con su comentario de cierre.
- Cambiar el estado desde el detalle de la no conformidad en `/nc/:code`: US-NC-TABLERO-009.
- Los pasos que la máquina admite y los que rechaza, y el permiso por rol en la API: US-NC-TABLERO-003 y US-NC-TABLERO-004.
- El tablero, sus columnas y sus avisos de carga y de error: US-NC-TABLERO-006.
