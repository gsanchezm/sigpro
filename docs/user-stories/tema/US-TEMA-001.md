---
id: US-TEMA-001
tipo: historia
epica: EP-TEMA
titulo: "[Web] Cambiar el tema con «Cambiar tema» en la aplicación, en Acceso y en las páginas legales"
etiquetas: [web]
relacionadas: [US-LOGIN-007, US-TEMA-002, US-TEMA-004, US-PERFIL-002]
verificacion: codigo
---

## Historia
Como persona que usa SIGPRO en el navegador, quiero cambiar entre el tema claro y el oscuro con el control «Cambiar tema» desde la aplicación, desde Acceso y desde las páginas legales,
para ver la pantalla en el tema que prefiero sin tener que entrar en Perfil.

## Reglas
- El control «Cambiar tema» no tiene texto visible: muestra un icono de luna mientras el tema es claro y un icono de sol mientras el tema es oscuro.
- El control está en la cabecera de la aplicación, tanto en el diseño de escritorio como en el responsive; en la cabecera de Acceso (`/login`, `/register` y `/forgot`), y en las páginas `/legal/terms`, `/legal/privacy` y `/help`.
- Cada pulsación cambia entre el tema claro y el oscuro, y el cambio se ve en la página sin recargarla.
- El elemento raíz del documento declara el tema activo: `light` en el tema claro y `dark` en el oscuro. El fondo de la página es `#faf8fb` en claro y `#141017` en oscuro.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). El reinicio no borra la preferencia de tema del navegador, así que cada fila empieza en un navegador nuevo, sin ninguna preferencia de tema guardada. Las filas que necesitan sesión la inician con `gestor@sigpro.test` y `Gestor1234!` en `/login?tenant=alumno01`.

## Criterios de aceptación
```gherkin
Característica: Cambio de tema desde el control «Cambiar tema» en la web

  Esquema del escenario: Cada pulsación cambia el tema de la aplicación en escritorio y en responsive
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión con Gestor1234! en /login?tenant=alumno01 y está en /programs en un navegador nuevo con una ventana de <ancho>
    Cuando <accion>
    Entonces el tema es <tema>
    Y el elemento raíz del documento declara el tema <valor>
    Y el fondo de la página es <fondo>

    Ejemplos:
      | ancho | accion | tema | valor | fondo |
      | 1440 px | no pulsa «Cambiar tema» | claro | light | #faf8fb |
      | 1440 px | pulsa «Cambiar tema» una vez | oscuro | dark | #141017 |
      | 1440 px | pulsa «Cambiar tema» dos veces | claro | light | #faf8fb |
      | 390 px | pulsa «Cambiar tema» una vez | oscuro | dark | #141017 |
      | 390 px | pulsa «Cambiar tema» dos veces | claro | light | #faf8fb |

  Esquema del escenario: El control alterna el tema en Acceso y en las páginas legales
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada abre <ruta> en un navegador nuevo
    Cuando pulsa «Cambiar tema»
    Entonces el tema es oscuro
    Y el elemento raíz del documento declara el tema dark
    Y el fondo de la página es #141017

    Ejemplos:
      | ruta |
      | /login?tenant=alumno01 |
      | /register?tenant=alumno01 |
      | /forgot?tenant=alumno01 |
      | /legal/terms |
      | /legal/privacy |
      | /help |

  Esquema del escenario: En escritorio el panel de marca de Acceso sigue oscuro en los dos temas
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada abre /login?tenant=alumno01 en un navegador nuevo con una ventana de 1440 px
    Cuando <accion>
    Entonces el tema es <tema>
    Y el panel de marca de la izquierda tiene fondo #141017
    Y el fondo de la columna del formulario es <fondo>

    Ejemplos:
      | accion | tema | fondo |
      | pulsa «Cambiar tema» una vez | oscuro | #141017 |
      | pulsa «Cambiar tema» dos veces | claro | #faf8fb |
```

## Fuera de alcance
- El grupo «Tema» de Perfil y el «Guardar» que lo aplica: US-PERFIL-002, de EP-PERFIL.
- Lo que se conserva del tema al recargar la página y al entrar en la aplicación: US-TEMA-002.
- El formulario de acceso, su envío y sus avisos: EP-LOGIN.
- El contenido de las páginas legales y de ayuda: EP-LEGAL-AYUDA.
