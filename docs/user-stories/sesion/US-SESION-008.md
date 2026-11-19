---
id: US-SESION-008
tipo: historia
epica: EP-SESION
titulo: "[Web] Aviso de sesión caducada en el acceso"
etiquetas: [web, no-implementada]
relacionadas: [US-SESION-007, US-SESION-011, US-LOGIN-008]
verificacion: no-ejecutable
---

## Historia
Como persona que vuelve a SIGPRO con una sesión que ya no se puede renovar, quiero ver en el acceso por qué me pide otra vez la contraseña,
para no pensar que la aplicación se ha roto ni que mi contraseña ha dejado de servir.

## Reglas
- Lo acordado es el texto del aviso, que el catálogo de textos comunes de la interfaz ya tiene: «La sesión ha caducado. Vuelve a iniciar sesión.».
- Cuando una sesión guardada no se puede renovar y la web lleva a `/login`, ese aviso aparece en el formulario de acceso.
- El aviso es distinto del de cierre de sesión, «Sesión cerrada correctamente.», que solo aparece después de cerrar sesión (EP-LOGIN).
- Hoy ningún camino de la web muestra este aviso: la historia describe lo que debe mostrar, no lo que muestra la aplicación.

## Criterios de aceptación
```gherkin
Característica: Aviso de sesión caducada en la web

  Esquema del escenario: El acceso avisa de que la sesión ha caducado
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 con la casilla «Mantener la sesión en este equipo» marcada y está en /programs
    Y <cambio>
    Cuando recarga la pestaña en /programs
    Entonces llega a /login
    Y ve el aviso «La sesión ha caducado. Vuelve a iniciar sesión.»

    Ejemplos:
      | cambio |
      | alumno01@sigpro.lab desactiva la cuenta gestor@sigpro.test con PATCH /api/admin/users/u2 y active false |
      | envía cinco veces POST /api/auth/login con x-tenant alumno01, el correo gestor@sigpro.test y una contraseña incorrecta, y la cuenta queda bloqueada |
```

## Decisiones pendientes
- Dónde se muestra el aviso en el formulario de acceso (encima de los campos, como el aviso de error, u otro lugar) y si aparece también como aviso emergente.
- Si el aviso desaparece al cambiar el correo o la contraseña, como hace el aviso de error.
- Si la cuenta desactivada y la cuenta bloqueada muestran el mismo aviso o dos distintos: el catálogo tiene un único texto.
- Si el aviso aparece también cuando la sesión termina mientras la persona usa una pantalla, y no solo al recargar la pestaña.

## Fuera de alcance
- El aviso de cierre de sesión «Sesión cerrada correctamente.»: EP-LOGIN (US-LOGIN-008).
- Los avisos de error del acceso: EP-LOGIN.
