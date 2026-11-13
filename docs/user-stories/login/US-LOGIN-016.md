---
id: US-LOGIN-016
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Avisar de una cuenta pendiente de aprobación"
etiquetas: [web]
relacionadas: [US-LOGIN-006, US-LOGIN-017, US-LOGIN-029]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona que ha solicitado acceso, quiero saber al intentar entrar que mi cuenta aún no está aprobada,
para esperar la aprobación en lugar de pensar que me he equivocado de contraseña.

## Reglas
- Una cuenta pendiente de aprobación con la contraseña correcta muestra el aviso de error «Cuenta pendiente de aprobación. Revisa tu correo.» con el detalle «POST /api/auth/login → 403 Forbidden · reason=pending_approval», y no entra.
- Con una contraseña incorrecta se ve el aviso de credenciales incorrectas con su número de intento (US-LOGIN-014): el estado de la cuenta solo se muestra con la contraseña correcta.
- Toda cuenta recién solicitada desde «Solicitar acceso» está pendiente de aprobación.
- En los ejemplos, `(cuenta recién solicitada)` es una solicitud de acceso hecha en la prueba con un correo que nunca se ha usado en ese tenant (como `nueva-` seguido de una marca de tiempo y `@organizacion.es`) y la contraseña `Abcdefghij1!`.

## Criterios de aceptación
```gherkin
Característica: Aviso de cuenta pendiente de aprobación en la web

  Esquema del escenario: Una cuenta pendiente no entra
    Dado que la cuenta <correo> está pendiente de aprobación
    Cuando en /login escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces ve el aviso de error <mensaje>
    Y el detalle <detalle>
    Y sigue en /login sin sesión

    Ejemplos:
      | correo | contraseña | mensaje | detalle |
      | pendiente@sigpro.test | Pend1234! | «Cuenta pendiente de aprobación. Revisa tu correo.» | «POST /api/auth/login → 403 Forbidden · reason=pending_approval» |
      | pendiente@sigpro.test | incorrecta | «Correo o contraseña incorrectos» | «POST /api/auth/login → 401 Unauthorized · attempts=1» |
      | (cuenta recién solicitada) | Abcdefghij1! | «Cuenta pendiente de aprobación. Revisa tu correo.» | «POST /api/auth/login → 403 Forbidden · reason=pending_approval» |
```

## Fuera de alcance
- La aprobación de la cuenta (épica de Usuarios y roles) y la solicitud de acceso (épica de Registro).
