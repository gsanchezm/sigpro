---
id: US-SESION-010
tipo: historia
epica: EP-SESION
titulo: "[Móvil] Llevar al acceso cuando no hay sesión o no se puede renovar"
etiquetas: [movil]
relacionadas: [US-SESION-007, US-SESION-009, US-SESION-011, US-LOGIN-013, US-LOGIN-016]
verificacion: codigo
cubre: ["/programs", "/programs/:code", "/nc", "/profile"]
---

## Historia
Como persona que abre la app en el móvil sin sesión o con una sesión guardada que ya no se puede renovar, quiero que la app me lleve a la pantalla de acceso,
para no ver datos de una cuenta que ya no puede usar SIGPRO y poder entrar otra vez con mi contraseña.

## Reglas
- Sin sesión iniciada, cualquier pantalla privada de la app lleva a `/login`.
- Al abrir la app con una sesión guardada, la app pide primero una renovación. Si la renovación falla porque la cuenta está bloqueada o desactivada, o porque el token no sirve, la app queda sin sesión y lleva a `/login`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las filas que dicen «sin sesión» abren la app sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo». Las filas con sesión inician sesión en la propia fila con `gestor@sigpro.test` y `Gestor1234!`, con `alumno01` en «Tenant de trabajo», y después están en `/programs`. Los fallos de una fila son `POST /api/auth/login` con la cabecera `x-tenant: alumno01`, ese correo y una contraseña incorrecta.

## Criterios de aceptación
```gherkin
Característica: Paso al acceso desde las pantallas privadas en la app móvil

  Esquema del escenario: Sin sesión iniciada, una pantalla privada lleva a /login
    Dado que el tenant alumno01 está recién reiniciado y la app no tiene ninguna sesión de SIGPRO guardada, con alumno01 en «Tenant de trabajo»
    Cuando abre <ruta> en la app
    Entonces llega a /login
    Y ve el título «Iniciar sesión»

    Ejemplos:
      | ruta |
      | /programs |
      | /programs/PRG-001 |
      | /nc |
      | /profile |

  Esquema del escenario: Una sesión que no se puede renovar al abrir la app lleva a /login
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y está en /programs
    Y <cambio>
    Cuando cierra la app y la vuelve a abrir
    Entonces llega a /login
    Y ve el título «Iniciar sesión»

    Ejemplos:
      | cambio |
      | alumno01@sigpro.lab desactiva la cuenta gestor@sigpro.test con PATCH /api/admin/users/u2 y active false |
      | envía cinco veces POST /api/auth/login con x-tenant alumno01, el correo gestor@sigpro.test y una contraseña incorrecta, y la cuenta queda bloqueada |
```

## Fuera de alcance
- La renovación cuando el acceso caduca en una pantalla abierta: US-SESION-009 de esta épica.
- El aviso de sesión caducada en el acceso: US-SESION-011 de esta épica.
- Cerrar sesión desde el perfil: EP-LOGIN (US-LOGIN-013).
- El botón atrás de Android tras cerrar sesión: EP-LOGIN (US-LOGIN-016).
