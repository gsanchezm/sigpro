---
id: US-LOGIN-017
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Avisar de una cuenta desactivada"
etiquetas: [web]
relacionadas: [US-LOGIN-007, US-LOGIN-016, US-LOGIN-030]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona cuya cuenta ha desactivado un administrador, quiero que el aviso me diga que mi cuenta está desactivada,
para dirigirme a un administrador en lugar de esperar una aprobación o volver a probar la contraseña.

## Reglas
- Una cuenta desactivada con la contraseña correcta muestra el aviso de error «Cuenta desactivada. Contacta con un administrador.» con el detalle «POST /api/auth/login → 403 Forbidden», y no entra.
- Con una contraseña incorrecta se ve el aviso de credenciales incorrectas con su número de intento (US-LOGIN-014).
- Al reactivar la cuenta, la persona vuelve a entrar con su contraseña.

## Criterios de aceptación
```gherkin
Característica: Aviso de cuenta desactivada en la web

  Esquema del escenario: Una cuenta desactivada no entra
    Dado que un administrador ha <accion> la cuenta "auditor@sigpro.test"
    Cuando en /login escribe ese correo y la contraseña "<contraseña>"
    Y pulsa "Entrar"
    Entonces ve "<mensaje>"
    Y <resultado>

    Ejemplos:
      | accion | contraseña | mensaje | resultado |
      | desactivado | Audit1234! | Cuenta desactivada. Contacta con un administrador. | ve el detalle "POST /api/auth/login → 403 Forbidden" y sigue en /login sin sesión |
      | desactivado | incorrecta | Correo o contraseña incorrectos | ve el detalle "POST /api/auth/login → 401 Unauthorized · attempts=1" y sigue en /login sin sesión |
      | desactivado y vuelto a activar | Audit1234! | Sesión iniciada. Redirigiendo a Programas… | llega a /programs |
```

## Fuera de alcance
- La desactivación y la reactivación de la cuenta (épica de Usuarios y roles).
