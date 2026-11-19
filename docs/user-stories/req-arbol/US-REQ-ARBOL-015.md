---
id: US-REQ-ARBOL-015
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Móvil] Abrir desde un requisito sus casos de prueba y sus no conformidades, y cambiar de programa"
etiquetas: [movil, no-implementada]
relacionadas: [US-REQ-ARBOL-005, US-REQ-ARBOL-010, US-REQ-ARBOL-003]
verificacion: no-ejecutable
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero pasar desde un requisito a sus casos de prueba y a sus no conformidades, y cambiar al árbol de otro programa sin volver a la lista de programas,
para seguir la trazabilidad de un requisito y revisar otro programa desde la app, igual que en la web.

## Reglas
- Esta historia describe lo que la web ya hace y la app móvil todavía no tiene. La paridad con la web es el requisito; el comportamiento de la web está en las historias de la web que figuran en «relacionadas».
- En la hoja de detalle de un requisito, cada código de caso de prueba de «Casos de prueba enlazados» abre la ficha de ese caso. Cada código de no conformidad de «No conformidades» abre la ficha de esa no conformidad.
- En la pantalla de Requisitos hay un desplegable «Programa», con los programas del tenant, con el mismo formato que en la web («PRG-001 · Sistema de mando táctico Ártemis»). Al elegir otro programa, la pantalla muestra el árbol de ese programa, con la búsqueda vacía y todo el árbol desplegado.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app está en /login, sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo»; se escriben el correo y la contraseña de `gestor@sigpro.test` (`Gestor1234!`), se pulsa «Entrar» y se llega a Programas. Cada fila parte de un contexto nuevo.
- Tras un reinicio, `REQ-008` (en `PRG-001`) tiene enlazados los casos `TC-001` y `TC-008`. `PRG-002` tiene 14 requisitos.

## Criterios de aceptación
```gherkin
Característica: Navegación desde un requisito y cambio de programa en la app móvil

  Esquema del escenario: Un caso de prueba enlazado abre su ficha desde el detalle del requisito
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil, abre /programs/PRG-001/requirements y tiene abierta la hoja de <requisito>
    Cuando pulsa el código <caso> en «Casos de prueba enlazados»
    Entonces llega a /verification/<caso>

    Ejemplos:
      | requisito | caso |
      | REQ-008 | TC-008 |

  Esquema del escenario: Cambiar de programa muestra el árbol del programa elegido con la búsqueda vacía
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil, abre /programs/PRG-001/requirements y ha escrito 005 en «Buscar requisitos»
    Cuando elige <programa> en el desplegable «Programa»
    Entonces llega a /programs/<codigo>/requirements
    Y el campo «Buscar requisitos» está vacío
    Y el contador dice «14 de 14 requisitos»

    Ejemplos:
      | programa | codigo |
      | «PRG-002 · Radar de vigilancia costera RVC-2» | PRG-002 |
```

## Decisiones pendientes
- Cómo se elige otro programa en la app móvil: con un desplegable como en la web, con una lista o volviendo a Programas. No está decidido.
- Si el código del caso de prueba y el de la no conformidad son el enlace en sí, o si lo es un botón que los acompaña. No está decidido.
- Qué ficha de no conformidad se abre desde la hoja de detalle en el móvil, y por qué ruta. No está decidido.

## Fuera de alcance
- Los casos de prueba, sus ejecuciones y sus evidencias, y las no conformidades en su propia pantalla: las épicas EP-VER-CASOS, EP-VER-EJECUCION y EP-VER-INFORME (Verificación) y EP-NC-TABLERO y EP-NC-GESTION (No conformidades).
- Enlazar o desenlazar casos desde el requisito, y la matriz de trazabilidad: EP-REQ-TRAZA.
- La lista de programas y la ficha del programa: EP-PROG-LISTA y EP-PROG-DETALLE.
- Los enlaces desde la pantalla de requisitos de la web: esta misma épica (EP-REQ-ARBOL), en la historia de la web sobre el detalle.
