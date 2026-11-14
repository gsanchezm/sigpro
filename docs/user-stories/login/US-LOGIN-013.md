---
id: US-LOGIN-013
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Mantener la sesión al cerrar la app y cerrarla desde el perfil"
etiquetas: [movil]
relacionadas: [US-LOGIN-004, US-LOGIN-008, US-LOGIN-014, US-LOGIN-016]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona que ha iniciado sesión en la app móvil, quiero que la sesión siga al cerrar la app y volver a abrirla, y poder cerrarla desde mi perfil,
para no escribir la contraseña cada vez que abro la app en mi móvil y poder dejarlo sin mi sesión abierta cuando quiera.

## Reglas
- Tras iniciar sesión, la sesión se guarda en el dispositivo: al cerrar la app y volver a abrirla se entra en /programs sin volver a iniciar sesión.
- «Cerrar sesión» está en la página «Perfil», a la que se llega desde la pestaña «Más».
- Al cerrar sesión se llega a /login y **la app descarta la sesión guardada en el dispositivo**: ninguna pantalla privada se abre sin volver a iniciar sesión, tampoco al cerrar la app y volver a abrirla.
- El servidor no revoca los tokens que ya se emitieron (decisión de diseño del laboratorio: los tokens son sin estado y no hay registro de sesiones en el servidor); lo que garantiza el cierre es que el dispositivo ya no los tiene.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); después la app está sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y la cuenta de la fila inicia sesión en la propia fila con su contraseña de demostración (`Gestor1234!`, `Consul1234!`, `Audit1234!`).

## Criterios de aceptación
```gherkin
Característica: Sesión de la app móvil y su cierre

  Esquema del escenario: La sesión sigue al cerrar la app y volver a abrirla
    Dado que el tenant alumno01 está recién reiniciado y <correo> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y está en /programs
    Cuando cierra la app y la vuelve a abrir
    Entonces en menos de 5 segundos ve /programs sin volver a iniciar sesión

    Ejemplos:
      | correo |
      | gestor@sigpro.test |
      | auditor@sigpro.test |

  Esquema del escenario: Cerrar sesión descarta la sesión del dispositivo
    Dado que el tenant alumno01 está recién reiniciado y <correo> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo»
    Y está en la página «Perfil»
    Cuando pulsa «Cerrar sesión»
    Entonces en menos de 5 segundos llega a /login
    Y <despues>

    Ejemplos:
      | correo | despues |
      | consultor@sigpro.test | al abrir /programs, en menos de 5 segundos llega a /login |
      | gestor@sigpro.test | al cerrar la app y volver a abrirla, en menos de 5 segundos ve /login |
      | auditor@sigpro.test | al abrir /nc, en menos de 5 segundos llega a /login |
```

## Fuera de alcance
- La casilla «Mantener la sesión en este equipo» y el aviso «Sesión cerrada correctamente.», que la web tiene: historia `no-implementada` de paridad del móvil en esta épica.
- El botón atrás de Android tras cerrar sesión: historia de Android de esta épica.
- Cuánto dura la sesión guardada y su renovación: épica de Sesión y renovación de token.
