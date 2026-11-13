---
id: US-LOGIN-034
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Ver el aviso de sesión cerrada"
etiquetas: [movil, no-implementada]
relacionadas: [US-LOGIN-020, US-LOGIN-031]
verificacion: no-ejecutable
---

## Historia
Como persona que cierra sesión en la app móvil, quiero ver que la sesión se ha cerrado,
para estar segura de que el móvil ya no tiene mi sesión abierta, como en la web.

## Reglas
- Tras «Cerrar sesión», la pantalla de acceso muestra el aviso de confirmación «Sesión cerrada correctamente.».
- El aviso desaparece al volver a intentar entrar o al ir a otra pantalla de Acceso.
- Abrir la app o la pantalla de acceso sin haber cerrado sesión no muestra el aviso.

## Criterios de aceptación
```gherkin
Característica: Aviso de sesión cerrada en la app móvil

  Esquema del escenario: El aviso solo acompaña al cierre de sesión
    Dado <situacion>
    Cuando <accion>
    Entonces <aviso>

    Ejemplos:
      | situacion | accion | aviso |
      | que "consultor@sigpro.test" tiene la sesión iniciada en Perfil | pulsa "Cerrar sesión" | llega a /login y ve "Sesión cerrada correctamente." |
      | que "consultor@sigpro.test" acaba de cerrar sesión | pulsa "Entrar" con la contraseña "incorrecta" | ya no ve "Sesión cerrada correctamente." y ve "Correo o contraseña incorrectos" |
      | que "consultor@sigpro.test" acaba de cerrar sesión | pulsa "¿Olvidaste la contraseña?" y vuelve con "Volver al inicio de sesión" | ya no ve "Sesión cerrada correctamente." |
      | una persona que no ha iniciado sesión | abre la app | no ve "Sesión cerrada correctamente." |
```
