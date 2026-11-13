---
id: US-LOGIN-014
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Mostrar el error de credenciales con el número de intento"
etiquetas: [web]
relacionadas: [US-LOGIN-003, US-LOGIN-015, US-LOGIN-027]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona que se equivoca al escribir su contraseña, quiero ver que las credenciales no son correctas y cuántas veces he fallado,
para corregirlas antes de que mi cuenta se bloquee.

## Reglas
- Unas credenciales incorrectas muestran, encima de los campos, un aviso de error con el título «Correo o contraseña incorrectos» y el detalle «POST /api/auth/login → 401 Unauthorized · attempts=N», donde N es el número de intento fallido consecutivo.
- Un correo sin cuenta se trata igual que una cuenta existente con la contraseña incorrecta, también en el 5.º intento, que muestra el aviso de cuenta bloqueada (US-LOGIN-015): ningún aviso revela si hay una cuenta con ese correo.
- El aviso desaparece al cambiar el correo o la contraseña.
- El formulario conserva el correo y la contraseña escritos, para corregirlos.
- En los ejemplos, `(correo sin cuenta)` es un correo que nunca se ha usado en ese tenant, como `nadie-` seguido de una marca de tiempo y `@sigpro.test`.

## Criterios de aceptación
```gherkin
Característica: Error de credenciales en la web

  Esquema del escenario: El aviso indica el número de intento
    Dado que <correo> acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces ve el aviso de error «Correo o contraseña incorrectos»
    Y el detalle <detalle>
    Y sigue en /login con ese correo escrito

    Ejemplos:
      | correo | fallos_previos | contraseña | detalle |
      | gestor@sigpro.test | 0 | incorrecta | «POST /api/auth/login → 401 Unauthorized · attempts=1» |
      | gestor@sigpro.test | 1 | incorrecta | «POST /api/auth/login → 401 Unauthorized · attempts=2» |
      | gestor@sigpro.test | 3 | incorrecta | «POST /api/auth/login → 401 Unauthorized · attempts=4» |
      | (correo sin cuenta) | 0 | incorrecta | «POST /api/auth/login → 401 Unauthorized · attempts=1» |
      | (correo sin cuenta) | 1 | Gestor1234! | «POST /api/auth/login → 401 Unauthorized · attempts=2» |
      | (correo sin cuenta) | 3 | incorrecta | «POST /api/auth/login → 401 Unauthorized · attempts=4» |
      | pendiente@sigpro.test | 0 | incorrecta | «POST /api/auth/login → 401 Unauthorized · attempts=1» |

  Esquema del escenario: El aviso desaparece al corregir los datos
    Dado que en /login ve el aviso «Correo o contraseña incorrectos»
    Cuando cambia el contenido del campo <campo>
    Entonces deja de ver el aviso

    Ejemplos:
      | campo |
      | «Correo electrónico» |
      | «Contraseña» |
```
