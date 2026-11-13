---
id: US-LOGIN-026
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Entrar con credenciales válidas"
etiquetas: [movil]
relacionadas: [US-LOGIN-001, US-LOGIN-013]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona con una cuenta activa, quiero entrar en la app móvil con mi correo y mi contraseña,
para trabajar desde el móvil con los permisos de mi rol.

## Reglas
- Con credenciales válidas y una cuenta sin segundo factor se entra en /programs, con las pestañas inferiores de la app.
- Con una cuenta con segundo factor, en lugar de entrar se pasa al paso «Verificación en dos pasos».
- Mientras se espera la respuesta, «Entrar» muestra que está ocupado y no se puede volver a pulsar.
- Pulsar la tecla de envío del teclado desde el campo «Contraseña» equivale a pulsar «Entrar».
- El correo se puede escribir con mayúsculas o con espacios al principio y al final.

## Criterios de aceptación
```gherkin
Característica: Inicio de sesión en la app móvil

  Esquema del escenario: Una cuenta activa entra en Programas
    Dado una persona sin sesión en /login
    Cuando escribe el correo <correo> y la contraseña "<contraseña>"
    Y <envia>
    Entonces <resultado>

    Ejemplos:
      | correo | contraseña | envia | resultado |
      | gestor@sigpro.test | Gestor1234! | pulsa "Entrar" | llega a /programs con las pestañas Programas, Verificación, No conformidades, Panel de misión y Más |
      | consultor@sigpro.test | Consul1234! | pulsa "Entrar" | llega a /programs |
      | auditor@sigpro.test | Audit1234! | pulsa la tecla de envío del teclado en la contraseña | llega a /programs |
      | « GESTOR@sigpro.test » (con un espacio delante y otro detrás) | Gestor1234! | pulsa "Entrar" | llega a /programs |
      | admin@sigpro.test | Admin1234! | pulsa "Entrar" | ve el título "Verificación en dos pasos" y sigue sin sesión |
```

## Fuera de alcance
- El paso «Verificación en dos pasos» (épica del segundo factor).
- Qué pestañas y opciones de «Más» ve cada rol (épica de navegación).
