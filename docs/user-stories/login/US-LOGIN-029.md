---
id: US-LOGIN-029
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Avisar de una cuenta pendiente de aprobación"
etiquetas: [movil]
relacionadas: [US-LOGIN-006, US-LOGIN-016, US-LOGIN-030]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona que ha solicitado acceso desde el móvil, quiero saber al intentar entrar que mi cuenta aún no está aprobada,
para esperar la aprobación en lugar de pensar que me he equivocado de contraseña.

## Reglas
- Una cuenta pendiente de aprobación con la contraseña correcta muestra el aviso de error «Cuenta pendiente de aprobación. Revisa tu correo.» con el detalle «POST /api/auth/login → 403 Forbidden · reason=pending_approval», y no entra.
- Con una contraseña incorrecta se ve el aviso de credenciales incorrectas con su número de intento (US-LOGIN-027).
- Toda cuenta recién solicitada desde «Solicitar acceso» está pendiente de aprobación.

## Criterios de aceptación
```gherkin
Característica: Aviso de cuenta pendiente de aprobación en la app móvil

  Esquema del escenario: Una cuenta pendiente no entra
    Dado que la cuenta "<correo>" está pendiente de aprobación
    Cuando en /login escribe ese correo y la contraseña "<contraseña>"
    Y pulsa "Entrar"
    Entonces ve el aviso de error "<mensaje>"
    Y el detalle "<detalle>"
    Y sigue en /login sin sesión

    Ejemplos:
      | correo | contraseña | mensaje | detalle |
      | pendiente@sigpro.test | Pend1234! | Cuenta pendiente de aprobación. Revisa tu correo. | POST /api/auth/login → 403 Forbidden · reason=pending_approval |
      | pendiente@sigpro.test | incorrecta | Correo o contraseña incorrectos | POST /api/auth/login → 401 Unauthorized · attempts=1 |
      | nueva@organizacion.es (recién solicitada desde el móvil con la contraseña Abcdefghij1!) | Abcdefghij1! | Cuenta pendiente de aprobación. Revisa tu correo. | POST /api/auth/login → 403 Forbidden · reason=pending_approval |
```

## Fuera de alcance
- La aprobación de la cuenta (épica de Usuarios y roles) y la solicitud de acceso (épica de Registro).
