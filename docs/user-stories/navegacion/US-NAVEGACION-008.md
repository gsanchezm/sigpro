---
id: US-NAVEGACION-008
tipo: historia
epica: EP-NAVEGACION
titulo: "[Web] Ver los avisos sin leer en la campana y leerlos en su panel"
etiquetas: [web]
relacionadas: [US-NAVEGACION-015, US-MISION-FEED-006, US-MISION-FEED-008, US-LOGIN-008]
verificacion: codigo
---

## Historia
Como persona que trabaja en SIGPRO mientras otros cambian datos, quiero ver en la cabecera cuántos avisos nuevos han llegado y leerlos desde cualquier pantalla,
para enterarme de los problemas de mis programas sin tener que abrir el panel de misión.

## Reglas
- La campana está en la cabecera de todas las pantallas autenticadas, en escritorio y en responsive, también en Programas.
- Cuenta solo los eventos de misión de gravedad aviso o peligro. En el simulador son los de térmica y los de pérdida de enlace. Los demás eventos no entran en la campana.
- Cuenta solo los avisos que llegan a la pestaña mientras la cuenta de la sesión iniciada en ella sigue dentro de SIGPRO. Los avisos que ya existían antes de iniciar la sesión no cuentan. Al cerrar la sesión, la lista de avisos se vacía.
- La insignia muestra el número de avisos sin leer. Con 10 o más, muestra «9+». Sin avisos sin leer, no hay insignia.
- El texto que describe la campana es «Notificaciones» cuando no hay avisos sin leer, y «Notificaciones, N sin leer» cuando los hay.
- Al pulsar la campana se abre el panel «Notificaciones» con la lista de avisos, el más reciente primero. Cada aviso muestra su texto y su hora, con horas, minutos y segundos. Sin avisos, el panel dice «Sin notificaciones» y no tiene lista.
- «Marcar leídas», en el panel, deja el número de avisos sin leer a cero, quita la insignia y cierra el panel. La lista de avisos se conserva y sigue visible al volver a abrir el panel.
- El panel se cierra con la tecla Esc, con un clic fuera de él o pulsando otra vez la campana.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se inicia sesión con `gestor@sigpro.test` y `Gestor1234!` en `/login?tenant=alumno01`, en un navegador sin ninguna sesión de SIGPRO guardada, y se abre `/programs` en una ventana de 1440 px. Los avisos se provocan con `POST /api/mission/tick` y el token de `alumno01@sigpro.lab`, que es administrador. Cada pulsación emite el siguiente evento de la secuencia fija del simulador (EP-MISION-FEED). Tras el reinicio, la primera pulsación da el evento número 7 de la secuencia. Con 5 pulsaciones llega el primer aviso, con 8 el segundo, con 37 el noveno y con 40 el décimo.

## Criterios de aceptación
```gherkin
Característica: Campana de avisos en la web

  Esquema del escenario: La campana cuenta los avisos sin leer que llegan a la pestaña después de iniciar la sesión
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs en la web de escritorio
    Y alumno01@sigpro.lab ha provocado <pulsaciones> eventos de misión con POST /api/mission/tick
    Cuando mira la campana
    Entonces ve la insignia <insignia>
    Y el texto que la describe es <nombre>

    Ejemplos:
      | pulsaciones | insignia | nombre |
      | 4 | (ninguna) | «Notificaciones» |
      | 5 | 1 | «Notificaciones, 1 sin leer» |
      | 8 | 2 | «Notificaciones, 2 sin leer» |
      | 37 | 9 | «Notificaciones, 9 sin leer» |
      | 40 | 9+ | «Notificaciones, 10 sin leer» |

  Esquema del escenario: El panel muestra la lista de avisos o el aviso de que no hay ninguno
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs en la web de escritorio
    Y alumno01@sigpro.lab ha provocado <pulsaciones> eventos de misión con POST /api/mission/tick
    Cuando abre la campana
    Entonces ve <contenido>

    Ejemplos:
      | pulsaciones | contenido |
      | 4 | el aviso «Sin notificaciones» y ninguna lista |
      | 8 | una lista de 2 avisos, el más reciente primero, cada uno con su texto y su hora |

  Esquema del escenario: «Marcar leídas» deja la campana sin avisos sin leer y conserva la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs en la web de escritorio
    Y alumno01@sigpro.lab ha provocado <pulsaciones> eventos de misión con POST /api/mission/tick
    Cuando abre la campana y pulsa «Marcar leídas»
    Entonces la campana no muestra ninguna insignia y el panel se cierra
    Y al volver a abrir la campana ve los <avisos> avisos en la lista

    Ejemplos:
      | pulsaciones | avisos |
      | 5 | 1 |
      | 8 | 2 |

  Esquema del escenario: La preferencia de avisos en tiempo real decide si la campana cuenta los avisos nuevos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs en la web de escritorio y la preferencia «Notificaciones en tiempo real» de su Perfil está <preferencia>
    Y alumno01@sigpro.lab ha provocado 5 eventos de misión con POST /api/mission/tick
    Cuando mira la campana
    Entonces <resultado>

    Ejemplos:
      | preferencia | resultado |
      | activada | ve la insignia 1 |
      | desactivada | no ve ninguna insignia |

  Esquema del escenario: Cerrar la sesión vacía los avisos y al volver a entrar la campana empieza de cero
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs en la web de escritorio
    Y alumno01@sigpro.lab ha provocado <pulsaciones> eventos de misión con POST /api/mission/tick
    Cuando pulsa «Menú de usuario», después «Cerrar sesión» y vuelve a iniciar sesión con gestor@sigpro.test y Gestor1234! en /login?tenant=alumno01
    Entonces la campana no muestra ninguna insignia

    Ejemplos:
      | pulsaciones |
      | 5 |
```

## Fuera de alcance
- La preferencia «Notificaciones en tiempo real» y la página Perfil: EP-PERFIL.
- El panel de misión, su feed, su indicador de conexión y el orden de sus eventos: EP-MISION-FEED (US-MISION-FEED-006 y US-MISION-FEED-008).
- El endpoint `POST /api/mission/tick`, su permiso y su respuesta completa: EP-MISION-KPI.
- La campana de la app móvil: US-NAVEGACION-015.
- El cierre de sesión y su aviso en Acceso: EP-LOGIN (US-LOGIN-008).

## Decisiones pendientes
- Si la campana debe dejar marcar como leído un solo aviso. Hoy «Marcar leídas» marca todos a la vez.
- Si los avisos deben sobrevivir a una recarga de la página. Hoy no: solo cuentan los que llegan a la pestaña después de iniciar la sesión en ella.
- Si los eventos de gravedad informativa deben contar también en la campana. Hoy no cuentan.
