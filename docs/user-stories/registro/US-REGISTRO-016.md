---
id: US-REGISTRO-016
tipo: historia
epica: EP-REGISTRO
titulo: "[Móvil] Llevar el foco al primer campo con aviso al enviar la solicitud"
etiquetas: [movil, no-implementada]
relacionadas: [US-REGISTRO-009, US-REGISTRO-014]
verificacion: no-ejecutable
---

## Historia
Como persona que usa la app móvil con un teclado externo o con un lector de pantalla, quiero que al enviar la solicitud con campos incorrectos el foco vaya al primer campo con aviso,
para corregirlo sin tener que buscarlo en toda la pantalla.

## Reglas
- Lo mínimo acordado: al pulsar «Enviar solicitud» con algún campo no válido, el foco pasa al primer campo con aviso, en el orden del formulario, como en la web.
- Los avisos siguen apareciendo bajo cada campo con sus textos: «Campo obligatorio», «Introduce un correo válido», «Mínimo 10 caracteres», «Las contraseñas no coinciden» y «Debes aceptar las condiciones».
- Qué campo recibe el foco cuando hay un error del servidor y no un error de campo no está decidido: ver «Decisiones pendientes».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); se abre la app sin ninguna sesión de SIGPRO guardada en el dispositivo (en Expo web, en el navegador), se va a /login, se escribe `alumno01` en «Tenant de trabajo» y se pulsa «Solicitar acceso» para llegar a /register.

## Criterios de aceptación
```gherkin
Característica: Foco en la solicitud móvil

  Esquema del escenario: El foco va al primer campo con aviso, en el orden del formulario
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /register con alumno01 en «Tenant de trabajo» ha dejado <situacion>
    Cuando pulsa «Enviar solicitud»
    Entonces el foco está en <campo_enfocado>

    Ejemplos:
      | situacion | campo_enfocado |
      | todos los campos vacíos | «Nombre» |
      | Ana en «Nombre» y Prueba en «Apellidos», y el resto de campos vacío | «Correo corporativo» |
```

## Fuera de alcance
- Los avisos bajo cada campo y la validación antes de enviar: historia de validación móvil de esta misma épica.
- El foco en la web: historia de validación web de esta misma épica.

## Decisiones pendientes
- Si el foco debe ir a algún campo cuando el servidor rechaza la solicitud (por ejemplo, con el correo ya registrado), aviso que hoy se muestra arriba del formulario y no bajo un campo.
- Cómo debe anunciarse el aviso a quien usa un lector de pantalla además del foco.
