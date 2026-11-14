---
id: US-LOGIN-013
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Cerrar sesión desde el perfil"
etiquetas: [movil]
relacionadas: [US-LOGIN-004, US-LOGIN-008, US-LOGIN-014, US-LOGIN-016]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona que ha iniciado sesión en la app móvil, quiero cerrar sesión desde mi perfil,
para dejar el móvil sin mi sesión abierta.

## Reglas
- «Cerrar sesión» está en la página Perfil, a la que se llega desde la pestaña «Más».
- Al cerrar sesión se llega a /login y **la app descarta la sesión guardada en el dispositivo**: ninguna pantalla privada se abre sin volver a iniciar sesión, tampoco al cerrar la app y volver a abrirla.
- El servidor no revoca los tokens que ya se emitieron; lo que garantiza el cierre es que el dispositivo ya no los tiene.
- Preparación de cada fila: la app está sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y la cuenta de la fila inicia sesión en la propia fila con su contraseña de demostración (`Gestor1234!`, `Consul1234!`, `Audit1234!`). Cerrar sesión no cambia ningún dato del tenant, así que no hace falta reiniciarlo.

## Criterios de aceptación
```gherkin
Característica: Cierre de sesión en la app móvil

  Esquema del escenario: Cerrar sesión descarta la sesión del dispositivo
    Dado que <correo> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo»
    Y está en la página Perfil
    Cuando pulsa «Cerrar sesión»
    Entonces en menos de 5 segundos llega a /login
    Y <despues>

    Ejemplos:
      | correo | despues |
      | consultor@sigpro.test | al abrir /programs llega a /login |
      | gestor@sigpro.test | al cerrar la app y volver a abrirla ve /login |
      | auditor@sigpro.test | al abrir /nc llega a /login |
```

## Fuera de alcance
- El aviso «Sesión cerrada correctamente.» tras cerrar sesión, que la web tiene: historia `no-implementada` de paridad del móvil en esta épica.
- El botón atrás de Android tras cerrar sesión: historia de Android de esta épica.
- Lo que el servidor hace con los tokens al cerrar sesión: historia de cierre de sesión de la API.
