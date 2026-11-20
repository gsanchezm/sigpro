---
id: US-TEMA-003
tipo: historia
epica: EP-TEMA
titulo: "[Móvil] Tema inicial: el del sistema hasta que la persona elige uno"
etiquetas: [movil]
relacionadas: [US-TEMA-002, US-TEMA-004, US-TEMA-005, US-LOGIN-012]
verificacion: ejecutada
---

## Historia
Como persona que usa SIGPRO en el móvil, quiero que la app empiece con el mismo tema que tiene el sistema de mi dispositivo y que, si elijo otro, lo recuerde,
para no tener que ajustar la pantalla cada vez que abro la app.

## Reglas
- Mientras no se ha elegido un tema en la app, la app se ve con el tema del sistema: oscuro si el sistema está en oscuro y claro en cualquier otro caso.
- Un tema elegido en la app, con «Cambiar tema» en Acceso o con «Guardar» en «Perfil», gana al tema del sistema: la app se ve con el tema elegido aunque el sistema esté en el tema contrario.
- El tema elegido se conserva al cerrar la app y volver a abrirla.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Cada fila empieza en `/login` con `alumno01` en «Tenant de trabajo», sin sesión de SIGPRO guardada y sin preferencia de tema guardada en el dispositivo. El tema del sistema se fija en la prueba como indica la fila.

## Criterios de aceptación
```gherkin
Característica: Tema inicial de la app móvil

  Esquema del escenario: Sin tema elegido la app sigue el tema del sistema
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada abre /login con alumno01 en «Tenant de trabajo» en un dispositivo sin preferencia de tema guardada y con el tema del sistema en <tema_sistema>
    Entonces la pantalla se ve con el tema <tema>
    Y el fondo de la pantalla es <fondo>

    Ejemplos:
      | tema_sistema | tema | fondo |
      | claro | claro | #faf8fb |
      | oscuro | oscuro | #141017 |

  Esquema del escenario: Un tema elegido gana al del sistema y se conserva al volver a abrir la app
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /login con alumno01 en «Tenant de trabajo» en un dispositivo sin preferencia de tema guardada, con el tema del sistema en <tema_sistema>, y ha pulsado «Cambiar tema» una vez
    Cuando cierra la app y vuelve a abrirla
    Entonces la pantalla se ve con el tema <tema>
    Y el fondo de la pantalla es <fondo>

    Ejemplos:
      | tema_sistema | tema | fondo |
      | claro | oscuro | #141017 |
      | oscuro | claro | #faf8fb |
```

## Fuera de alcance
- El tema que muestra el grupo «Tema» de «Perfil» y su «Guardar»: US-PERFIL-004, de EP-PERFIL.
- El control «Cambiar tema» de Acceso y de las páginas legales: US-TEMA-004.
- El inicio de sesión y su formulario: US-LOGIN-012, de EP-LOGIN.

## Decisiones pendientes
- Cómo volver a seguir el tema del sistema después de elegir uno: la app no tiene una opción «Sistema» ni en «Perfil» ni en Acceso, así que una elección queda fijada hasta que la persona elige el otro tema.
- Si la app debe cambiar sola cuando el sistema cambia de tema mientras la app está abierta. No está decidido.
