---
id: US-SESION-011
tipo: historia
epica: EP-SESION
titulo: "[Móvil] Aviso de sesión caducada en el acceso"
etiquetas: [movil, no-implementada]
relacionadas: [US-SESION-008, US-SESION-010, US-LOGIN-014]
verificacion: no-ejecutable
---

## Historia
Como persona que vuelve a SIGPRO en el móvil con una sesión que ya no se puede renovar, quiero ver en el acceso por qué me pide otra vez la contraseña,
para no pensar que la app se ha roto ni que mi contraseña ha dejado de servir.

## Reglas
- Lo acordado es el texto del aviso, el mismo del catálogo común de textos que usa la web: «La sesión ha caducado. Vuelve a iniciar sesión.».
- Cuando una sesión guardada no se puede renovar y la app lleva a `/login`, ese aviso aparece en la pantalla de acceso.
- Hoy ningún camino de la app muestra este aviso: la historia describe lo que debe mostrar, no lo que muestra la aplicación.

## Criterios de aceptación
```gherkin
Característica: Aviso de sesión caducada en la app móvil

  Esquema del escenario: El acceso avisa de que la sesión ha caducado
    Dado que el tenant alumno01 está recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y está en /programs
    Y <cambio>
    Cuando cierra la app y la vuelve a abrir
    Entonces llega a /login
    Y ve el aviso «La sesión ha caducado. Vuelve a iniciar sesión.»

    Ejemplos:
      | cambio |
      | alumno01@sigpro.lab desactiva la cuenta gestor@sigpro.test con PATCH /api/admin/users/u2 y active false |
      | envía cinco veces POST /api/auth/login con x-tenant alumno01, el correo gestor@sigpro.test y una contraseña incorrecta, y la cuenta queda bloqueada |
```

## Decisiones pendientes
- Dónde se muestra el aviso en la pantalla de acceso (encima de los campos, como el aviso de error, u otro lugar) y si aparece también como aviso emergente.
- Si el aviso desaparece al cambiar el correo o la contraseña, como hace el aviso de error.
- Si la cuenta desactivada y la cuenta bloqueada muestran el mismo aviso o dos distintos: el catálogo tiene un único texto.
- Si el aviso aparece también cuando la sesión termina mientras la persona usa la app, y no solo al abrirla.

## Fuera de alcance
- El aviso de cierre de sesión «Sesión cerrada correctamente.» de la app: EP-LOGIN (US-LOGIN-014).
- Los avisos de error del acceso: EP-LOGIN.
