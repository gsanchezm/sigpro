---
id: US-NC-TABLERO-003
tipo: historia
epica: EP-NC-TABLERO
titulo: "[API] Dar un paso permitido por la máquina de estados y rechazar los no admitidos con 409"
etiquetas: [api]
relacionadas: [US-NC-TABLERO-002, US-NC-TABLERO-004, US-NC-TABLERO-005, US-NC-TABLERO-008]
verificacion: ejecutada
cubre: ["POST /api/nc/:code/transition"]
permisos: [nc.transition]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero mover una no conformidad de un estado a otro con un solo paso,
para que avance por su ciclo de análisis y de acción correctiva, y recibir un 409 claro cuando el paso no está permitido, sin que la no conformidad cambie.

## Reglas
- `POST /api/nc/:code/transition` recibe `to` (uno de los cinco estados) y, opcionalmente, `comment`. Un paso admitido responde 200 con el detalle de la no conformidad ya en el estado nuevo, con sus `transitions` desde ese estado.
- La máquina de estados admite siete pasos entre los cinco estados: `open` a `in_analysis`; `in_analysis` a `corrective_action`, `rejected` u `open`; `corrective_action` a `in_analysis` y a `closed`; y `rejected` a `open`. `closed` no admite ningún paso.
- El paso de `corrective_action` a `closed` es el cierre de la no conformidad: su comentario y sus avisos están en EP-NC-GESTION. Esta historia no prueba ese paso válido y no escribe ningún ejemplo de cierre con comentario.
- Cualquier otro paso responde 409 `invalid_transition`. Eso incluye el paso al mismo estado en que ya está, y `open` a `rejected`: el rechazo solo se admite desde `in_analysis`.
- Un paso rechazado con 409 no cambia la no conformidad: sigue en el estado que tenía.
- Un paso admitido solo cambia la no conformidad que se indica en la ruta.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token del administrador del tenant. Después, `alumno01@sigpro.lab` (rol admin, sin segundo factor) inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken` en todas las peticiones de la fila.

## Criterios de aceptación
```gherkin
Característica: Pasos de una no conformidad por la API

  Esquema del escenario: Un paso admitido por la máquina de estados cambia el estado
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab tiene un accessToken y <codigo> está en <estado_inicial>
    Cuando envía POST /api/nc/<codigo>/transition con x-tenant alumno01, ese accessToken, to <destino> y sin el campo comment
    Entonces la respuesta es 200 con state <destino>
    Y GET /api/nc/<codigo> devuelve state <destino>

    Ejemplos:
      | codigo | estado_inicial | destino |
      | NC-001 | open | in_analysis |
      | NC-002 | in_analysis | corrective_action |
      | NC-002 | in_analysis | rejected |
      | NC-002 | in_analysis | open |
      | NC-003 | corrective_action | in_analysis |
      | NC-005 | rejected | open |

  Esquema del escenario: Un paso que la máquina de estados no admite responde 409 y no cambia la no conformidad
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab tiene un accessToken y <codigo> está en <estado_inicial>
    Cuando envía POST /api/nc/<codigo>/transition con x-tenant alumno01, ese accessToken, to <destino> y sin el campo comment
    Entonces la respuesta es 409 invalid_transition
    Y GET /api/nc/<codigo> sigue con state <estado_inicial>

    Ejemplos:
      | codigo | estado_inicial | destino |
      | NC-001 | open | corrective_action |
      | NC-001 | open | rejected |
      | NC-001 | open | closed |
      | NC-001 | open | open |
      | NC-002 | in_analysis | closed |
      | NC-002 | in_analysis | in_analysis |
      | NC-003 | corrective_action | rejected |
      | NC-003 | corrective_action | open |
      | NC-003 | corrective_action | corrective_action |
      | NC-004 | closed | open |
      | NC-004 | closed | in_analysis |
      | NC-004 | closed | corrective_action |
      | NC-004 | closed | rejected |
      | NC-004 | closed | closed |
      | NC-005 | rejected | in_analysis |
      | NC-005 | rejected | corrective_action |
      | NC-005 | rejected | closed |
      | NC-005 | rejected | rejected |

  Esquema del escenario: Un paso en un tenant no cambia la no conformidad del otro
    Dado que los tenants alumno01 y alumno02 están recién reiniciados y alumno02@sigpro.lab tiene un accessToken
    Cuando alumno01@sigpro.lab envía POST /api/nc/NC-001/transition con x-tenant alumno01 y to in_analysis
    Entonces GET /api/nc/NC-001 con x-tenant alumno02 y el accessToken de alumno02@sigpro.lab devuelve state <estado>

    Ejemplos:
      | estado |
      | open |
```

## Decisiones pendientes
- Ninguna.

## Fuera de alcance
- El cierre de una no conformidad (`corrective_action` a `closed`) con su comentario de cierre: EP-NC-GESTION.
- Qué roles pueden dar cada paso y el orden entre el permiso y la máquina de estados: US-NC-TABLERO-004.
- Los cuerpos no válidos y las no conformidades inexistentes: US-NC-TABLERO-005.
- El detalle que devuelve la lista de pasos: US-NC-TABLERO-002.
