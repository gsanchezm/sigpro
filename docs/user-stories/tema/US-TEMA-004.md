---
id: US-TEMA-004
tipo: historia
epica: EP-TEMA
titulo: "[Móvil] Cambiar el tema con «Cambiar tema» en Acceso y en las páginas legales"
etiquetas: [movil]
relacionadas: [US-TEMA-001, US-TEMA-003, US-LOGIN-012, US-PERFIL-004]
verificacion: ejecutada
---

## Historia
Como persona que usa SIGPRO en el móvil, quiero cambiar entre el tema claro y el oscuro con el botón «Cambiar tema» de la cabecera de Acceso y de las páginas legales,
para leer las condiciones y la ayuda con el tema que prefiero, también antes de iniciar sesión.

## Reglas
- El botón «Cambiar tema» está en la cabecera de `/login`, `/register`, `/forgot`, `/legal/terms`, `/legal/privacy` y `/help`, con su texto visible.
- Cada pulsación cambia entre el tema claro y el oscuro, y la pantalla se ve con el nuevo tema sin salir de ella.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app se abre sin sesión de SIGPRO guardada y sin preferencia de tema guardada, con el tema del sistema en claro. En `/login`, `alumno01` está escrito en «Tenant de trabajo».

## Criterios de aceptación
```gherkin
Característica: Cambio de tema desde Acceso y las páginas legales en la app móvil

  Esquema del escenario: El botón «Cambiar tema» pasa al tema oscuro en cada pantalla pública
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada abre <ruta> en un dispositivo sin preferencia de tema guardada, con el tema del sistema en claro
    Cuando pulsa «Cambiar tema»
    Entonces el tema es oscuro
    Y el fondo de la pantalla es #141017

    Ejemplos:
      | ruta |
      | /login |
      | /register |
      | /forgot |
      | /legal/terms |
      | /legal/privacy |
      | /help |

  Esquema del escenario: El botón alterna el tema en cada pulsación
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada abre /login con alumno01 en «Tenant de trabajo» en un dispositivo sin preferencia de tema guardada, con el tema del sistema en claro
    Cuando pulsa «Cambiar tema» <pulsaciones>
    Entonces el tema es <tema>
    Y el fondo de la pantalla es <fondo>

    Ejemplos:
      | pulsaciones | tema | fondo |
      | una vez | oscuro | #141017 |
      | dos veces | claro | #faf8fb |
      | tres veces | oscuro | #141017 |
```

## Fuera de alcance
- El tema inicial de la app y lo que se conserva al volver a abrirla: US-TEMA-003.
- El grupo «Tema» de «Perfil» y su «Guardar»: US-PERFIL-004, de EP-PERFIL.
- El inicio de sesión y su formulario: EP-LOGIN.
- El contenido de las páginas legales y de ayuda: EP-LEGAL-AYUDA.

## Decisiones pendientes
- Si el botón de Acceso y de las páginas legales debe mostrar solo un icono, como en la web, o su texto «Cambiar tema», como hoy.
- Si la zona con sesión iniciada de la app móvil debe tener un control de tema fuera de «Perfil», como la cabecera de la web. Hoy el tema con sesión iniciada solo se cambia desde «Perfil».
