---
id: US-TEMA-005
tipo: historia
epica: EP-TEMA
titulo: "[Transversal] La preferencia de tema es del navegador o del dispositivo, no de la cuenta"
etiquetas: [transversal]
relacionadas: [US-TEMA-002, US-TEMA-003, US-LOGIN-008, US-LOGIN-013, US-PERFIL-002, US-PERFIL-004]
verificacion: codigo
---

## Historia
Como persona que comparte un navegador o un dispositivo con otra cuenta de SIGPRO, quiero que el tema elegido siga igual al cerrar mi sesión y al entrar con otra cuenta,
para no tener que volver a ajustarlo cada vez que cambia quien usa el mismo equipo.

## Reglas
- El tema es una preferencia del navegador o del dispositivo, no de la cuenta: no va con el perfil de la persona usuaria y no cambia con la cuenta que inicia sesión.
- Cerrar sesión solo termina la sesión: no cambia el tema.
- El reinicio de datos del tenant (`POST /api/admin/reset`) no borra el tema del navegador o del dispositivo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Cada fila empieza en la pantalla de acceso de un navegador o dispositivo nuevo, sin preferencia de tema guardada y con el tema del sistema en claro. En la web el tenant se indica con `/login?tenant=alumno01`; en la app móvil, escribiendo `alumno01` en «Tenant de trabajo».

## Criterios de aceptación
```gherkin
Característica: Preferencia de tema por navegador o dispositivo

  Esquema del escenario: El tema elegido sigue al cerrar sesión y al entrar con otra cuenta
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en la pantalla de acceso de un navegador o dispositivo nuevo, sin preferencia de tema guardada y con el tema del sistema en claro, ha pulsado «Cambiar tema» <pulsaciones> y ha iniciado sesión con gestor@sigpro.test y Gestor1234!
    Cuando cierra sesión desde «Perfil» con «Cerrar sesión», escribe <correo> en «Correo electrónico» y <contraseña> en «Contraseña», y pulsa «Entrar»
    Entonces llega a /programs con el tema <tema>

    Ejemplos:
      | pulsaciones | correo | contraseña | tema |
      | una vez | consultor@sigpro.test | Consul1234! | oscuro |
      | dos veces | consultor@sigpro.test | Consul1234! | claro |
      | una vez | auditor@sigpro.test | Audit1234! | oscuro |

  Esquema del escenario: Recargar la pantalla o reiniciar los datos del tenant no cambia el tema del navegador
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en la pantalla de acceso de un navegador o dispositivo nuevo, sin preferencia de tema guardada y con el tema del sistema en claro, y ha pulsado «Cambiar tema» una vez
    Cuando <accion>
    Entonces el tema es oscuro

    Ejemplos:
      | accion |
      | se recarga la pantalla |
      | se reinicia el tenant con POST /api/admin/reset y se recarga la pantalla |
```

## Fuera de alcance
- Cerrar sesión y los avisos del cierre: US-LOGIN-008 (web) y US-LOGIN-013 (móvil), de EP-LOGIN.
- El tema con el que empieza la web: US-TEMA-002.
- El tema con el que empieza la app móvil: US-TEMA-003.
- Lo que se guarda de la cuenta en «Perfil»: EP-PERFIL.
