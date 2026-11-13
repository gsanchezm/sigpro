---
id: US-LOGIN-030
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Avisar de una cuenta desactivada"
etiquetas: [movil]
relacionadas: [US-LOGIN-007, US-LOGIN-017, US-LOGIN-029]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona cuya cuenta ha desactivado un administrador, quiero que el aviso del móvil me diga que mi cuenta está desactivada,
para dirigirme a un administrador en lugar de esperar una aprobación o volver a probar la contraseña.

## Reglas
- Una cuenta desactivada con la contraseña correcta no entra y muestra un aviso de error propio de la cuenta desactivada, con el detalle «POST /api/auth/login → 403 Forbidden».
- Ese aviso dice que la cuenta está desactivada (menciona «desactivada») y no es el de una cuenta pendiente: no menciona «pendiente de aprobación».
- Con una contraseña incorrecta se ve el aviso de credenciales incorrectas con su número de intento (US-LOGIN-027).
- Al reactivar la cuenta, la persona vuelve a entrar con su contraseña.

## Criterios de aceptación
```gherkin
Característica: Aviso de cuenta desactivada en la app móvil

  Esquema del escenario: Una cuenta desactivada no entra
    Dado que un administrador ha <accion> la cuenta auditor@sigpro.test
    Cuando en /login escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces <resultado>

    Ejemplos:
      | accion | contraseña | resultado |
      | desactivado | Audit1234! | ve un aviso de error que menciona «desactivada» y no menciona «pendiente de aprobación», con el detalle «POST /api/auth/login → 403 Forbidden», y sigue sin sesión |
      | desactivado | incorrecta | ve «Correo o contraseña incorrectos» con el detalle «POST /api/auth/login → 401 Unauthorized · attempts=1» |
      | desactivado y vuelto a activar | Audit1234! | llega a /programs |
```

## Fuera de alcance
- La desactivación y la reactivación de la cuenta (épica de Usuarios y roles).
