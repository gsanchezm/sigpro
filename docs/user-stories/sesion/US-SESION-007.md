---
id: US-SESION-007
tipo: historia
epica: EP-SESION
titulo: "[Web] Llevar al acceso cuando no hay sesión o no se puede renovar"
etiquetas: [web]
relacionadas: [US-SESION-002, US-SESION-006, US-SESION-008, US-SESION-010, US-LOGIN-007, US-LOGIN-008]
verificacion: ejecutada
cubre: ["/programs", "/programs/:code", "/nc", "/profile"]
---

## Historia
Como persona que abre SIGPRO en el navegador sin sesión o con una sesión que ya no se puede renovar, quiero que las pantallas privadas me lleven al acceso,
para no ver datos de una cuenta que ya no puede usar SIGPRO y poder entrar otra vez con mi contraseña.

## Reglas
- Sin sesión iniciada, una pantalla privada no muestra datos: la web lleva a `/login`.
- Al abrir la web o recargar la pestaña con una sesión guardada, la web pide primero una renovación. Si la renovación falla porque la cuenta está bloqueada o desactivada, o porque el token no sirve, la sesión termina en esa pestaña y la pantalla privada lleva a `/login` sin sesión iniciada.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las filas que dicen «sin sesión» abren la web en un navegador sin ninguna sesión de SIGPRO guardada. Las filas con sesión inician sesión en la propia fila con `gestor@sigpro.test`, `Gestor1234!`, en `/login?tenant=alumno01`, con la casilla «Mantener la sesión en este equipo» marcada, y después van a `/programs`. Los fallos de una fila son `POST /api/auth/login` con la cabecera `x-tenant: alumno01`, ese correo y una contraseña incorrecta.

## Criterios de aceptación
```gherkin
Característica: Paso al acceso desde las pantallas privadas en la web

  Esquema del escenario: Sin sesión iniciada, una pantalla privada lleva al acceso
    Dado que el tenant alumno01 está recién reiniciado y en este navegador no hay ninguna sesión de SIGPRO iniciada
    Cuando abre <ruta> en la misma pestaña
    Entonces llega a /login
    Y ve el formulario «Iniciar sesión»

    Ejemplos:
      | ruta |
      | /programs |
      | /programs/PRG-001 |
      | /nc |
      | /profile |

  Esquema del escenario: Una sesión que no se puede renovar al recargar lleva al acceso
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 con la casilla «Mantener la sesión en este equipo» marcada y está en /programs
    Y <cambio>
    Cuando recarga la pestaña en /programs
    Entonces llega a /login
    Y ve el formulario «Iniciar sesión» sin sesión iniciada

    Ejemplos:
      | cambio |
      | alumno01@sigpro.lab desactiva la cuenta gestor@sigpro.test con PATCH /api/admin/users/u2 y active false |
      | envía cinco veces POST /api/auth/login con x-tenant alumno01, el correo gestor@sigpro.test y una contraseña incorrecta, y la cuenta queda bloqueada |
```

## Fuera de alcance
- La renovación cuando el acceso caduca en una pantalla abierta: US-SESION-006 de esta épica.
- El aviso que dice por qué la sesión ha terminado: US-SESION-008 de esta épica.
- La respuesta de la API a una renovación rechazada: US-SESION-002 y US-SESION-003 de esta épica.
- Cerrar sesión y el aviso de sesión cerrada: EP-LOGIN (US-LOGIN-008).
