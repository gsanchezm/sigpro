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
- El aviso desaparece cuando se vuelve a intentar entrar con un correo y una contraseña que pasan la validación del formulario, o al ir a otra pantalla de Acceso.
- Abrir la app o la pantalla de acceso sin haber cerrado sesión no muestra el aviso.

## Criterios de aceptación
```gherkin
Característica: Aviso de sesión cerrada en la app móvil

  Esquema del escenario: El aviso solo acompaña al cierre de sesión
    Dado que <situacion>
    Cuando <accion>
    Entonces <aviso>

    Ejemplos:
      | situacion | accion | aviso |
      | consultor@sigpro.test tiene la sesión iniciada en Perfil | pulsa «Cerrar sesión» | llega a /login y ve «Sesión cerrada correctamente.» |
      | consultor@sigpro.test acaba de cerrar sesión | escribe el correo consultor@sigpro.test y la contraseña incorrecta y pulsa «Entrar» | ya no ve «Sesión cerrada correctamente.» y ve «Correo o contraseña incorrectos» |
      | consultor@sigpro.test acaba de cerrar sesión | pulsa «¿Olvidaste la contraseña?» y vuelve con «Volver al inicio de sesión» | ya no ve «Sesión cerrada correctamente.» |
      | una persona no ha iniciado sesión | abre la app | no ve «Sesión cerrada correctamente.» |
```
