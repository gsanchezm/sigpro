---
id: US-NC-TABLERO-009
tipo: historia
epica: EP-NC-TABLERO
titulo: "[Web] Abrir el detalle de una no conformidad en /nc/:code y cambiar su estado desde ahí"
etiquetas: [web]
relacionadas: [US-NC-TABLERO-002, US-NC-TABLERO-004, US-NC-TABLERO-006, US-NC-TABLERO-008]
verificacion: ejecutada
cubre: ["/nc/:code"]
permisos: [nc.transition]
---

## Historia
Como persona que revisa una no conformidad, quiero abrir su detalle desde el tablero o con su dirección directa /nc/:code, y cambiar su estado desde ese detalle si mi rol me lo permite,
para ver sus datos completos y avanzarla sin volver al tablero.

## Reglas
- El detalle se abre encima del tablero, en la dirección /nc/<código>, con el título «Detalle de <código>». Se abre al pulsar el código de una tarjeta, con su opción «Abrir detalle» o al cargar directamente la dirección /nc/<código>.
- El detalle muestra el estado y la severidad como texto, el programa (con un enlace a su ficha), la descripción, el responsable o «Sin asignar», y la lista de comentarios.
- La sección «Cambiar estado» tiene un botón «Pasar a «<estado>»» por cada paso que la máquina admite desde el estado actual. Si no hay pasos, muestra el texto «Sin más cambios de estado posibles».
- Pulsar «Pasar a «<estado>»» cambia la no conformidad: el detalle muestra el nuevo estado, el tablero que queda detrás coloca la tarjeta en su columna y aparece el aviso «<código> pasó a «<estado>»».
- Quien no puede mover no conformidades (`auditor`) ve los botones «Pasar a…» deshabilitados, con el motivo «Tu rol no permite mover no conformidades».
- «Cerrar el detalle» y la tecla Esc cierran el detalle y devuelven a /nc, con el tablero como estaba.
- Si el código no existe en el tenant, el detalle muestra el aviso «No se encontró la no conformidad» y el tablero queda detrás.
- Si el servidor no devuelve el detalle, el aviso dice «No se pudo cargar la no conformidad» y ofrece el botón «Reintentar».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga. Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, la cuenta de la fila inicia sesión y se abre la dirección de la fila. Las cuentas son `gestor@sigpro.test` (`Gestor1234!`) y `auditor@sigpro.test` (`Audit1234!`).
- Para los fallos, la prueba hace que la primera petición de `GET /api/nc/NC-001` responda con el código HTTP de la fila; las siguientes llegan al servidor.

## Criterios de aceptación
```gherkin
Característica: Detalle de una no conformidad en la web

  Esquema del escenario: El detalle muestra el estado, la severidad y solo los pasos que la máquina admite
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre /nc/<codigo>
    Entonces el detalle «Detalle de <codigo>» muestra el estado «<estado>» y la severidad «<severidad>»
    Y en «Cambiar estado» ve <pasos>

    Ejemplos:
      | codigo | estado | severidad | pasos |
      | NC-001 | Abierta | Menor | el botón «Pasar a «En análisis»» |
      | NC-002 | En análisis | Mayor | los botones «Pasar a «Acción correctiva»», «Pasar a «Rechazada»» y «Pasar a «Abierta»» |
      | NC-005 | Rechazada | Mayor | el botón «Pasar a «Abierta»» |
      | NC-004 | Cerrada | Menor | el texto «Sin más cambios de estado posibles» y ningún botón |

  Esquema del escenario: Un código que no existe muestra el aviso de no encontrada sobre el tablero
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre /nc/<codigo>
    Entonces ve el aviso «No se encontró la no conformidad» y el tablero queda detrás

    Ejemplos:
      | codigo |
      | NC-013 |

  Esquema del escenario: Un paso desde el detalle cambia el estado mostrado y avisa
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /nc/<codigo>
    Cuando pulsa «Pasar a «<destino>»»
    Entonces ve el aviso «<aviso>» y el detalle muestra el estado «<estado_nuevo>»
    Y el tablero muestra la tarjeta <codigo> en la columna «<estado_nuevo>»

    Ejemplos:
      | codigo | destino | aviso | estado_nuevo |
      | NC-001 | En análisis | NC-001 pasó a «En análisis» | En análisis |
      | NC-005 | Abierta | NC-005 pasó a «Abierta» | Abierta |

  Esquema del escenario: Quien solo lee ve los pasos deshabilitados con su motivo
    Dado que el tenant alumno01 está recién reiniciado, auditor@sigpro.test ha iniciado sesión en la web y abre /nc/<codigo>
    Cuando mira la sección «Cambiar estado»
    Entonces el botón «Pasar a «<destino>»» está deshabilitado con el motivo «Tu rol no permite mover no conformidades»

    Ejemplos:
      | codigo | destino |
      | NC-001 | En análisis |

  Esquema del escenario: Un fallo al cargar el detalle muestra el aviso con «Reintentar»
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la prueba hace que la primera petición de GET /api/nc/NC-001 responda <codigo_http>
    Cuando abre /nc/NC-001
    Entonces ve el aviso «No se pudo cargar la no conformidad» con el botón «Reintentar»
    Y al pulsar «Reintentar» ve el detalle de NC-001

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |

  Esquema del escenario: El detalle se cierra y vuelve al tablero
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /nc/NC-002
    Cuando <forma_de_cerrar>
    Entonces la dirección es /nc y el tablero muestra las cinco columnas con sus 12 tarjetas

    Ejemplos:
      | forma_de_cerrar |
      | pulsa «Cerrar el detalle» |
      | pulsa la tecla Esc |
```

## Decisiones pendientes
- Ninguna.

## Fuera de alcance
- Editar la no conformidad, asignarla, comentarla y cerrarla con su comentario de cierre: EP-NC-GESTION.
- Los pasos que la máquina admite y el permiso por rol en la API: US-NC-TABLERO-002, US-NC-TABLERO-003 y US-NC-TABLERO-004.
- El tablero, sus filtros y el cambio de estado desde las tarjetas: US-NC-TABLERO-006, US-NC-TABLERO-007 y US-NC-TABLERO-008.
