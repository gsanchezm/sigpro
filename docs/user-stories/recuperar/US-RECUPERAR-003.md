---
id: US-RECUPERAR-003
tipo: historia
epica: EP-RECUPERAR
titulo: "[Transversal] Restablecer la contraseña con el enlace de un solo uso"
etiquetas: [transversal, no-implementada]
relacionadas: [US-RECUPERAR-002, US-RECUPERAR-005, US-RECUPERAR-007, US-LOGIN-001]
verificacion: no-ejecutable
---

## Historia
Como persona que ha recibido el enlace de recuperación de su cuenta, quiero establecer una contraseña nueva con ese enlace,
para volver a entrar en SIGPRO con la contraseña que elijo.

## Reglas
- Lo mínimo acordado: con el enlace de recuperación de su cuenta, la persona puede establecer una contraseña nueva para esa cuenta.
- El enlace es de un solo uso: una vez usado para establecer una contraseña, no vuelve a permitir establecer otra.
- El enlace vale 30 minutos desde su envío, como anuncia la pantalla «Recuperar contraseña».
- Hoy no existe ninguna pantalla, ruta ni endpoint para usar el enlace. Lo que la persona ve, los campos, las reglas de la contraseña nueva y el estado final no están decididos: ver «Decisiones pendientes».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se pide la recuperación de `gestor@sigpro.test` con `POST /api/auth/forgot` y la cabecera `x-tenant: alumno01`. El enlace de esa petición es el de su fila y no se reutiliza en otra.
- La columna `minutos` indica cuánto tiempo ha pasado desde el envío del enlace cuando la persona lo usa.

## Criterios de aceptación
```gherkin
Característica: Restablecimiento de la contraseña con el enlace de un solo uso

  Esquema del escenario: El enlace permite establecer una contraseña nueva dentro de su plazo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha pedido la recuperación y su enlace se envió hace <minutos> minutos
    Cuando la persona usa ese enlace por primera vez para establecer la contraseña Nueva1234!
    Entonces el enlace <resultado>

    Ejemplos:
      | minutos | resultado |
      | 29 | permite establecer la contraseña nueva |
      | 31 | no permite establecer la contraseña nueva |

  Esquema del escenario: Un enlace ya usado no permite establecer otra contraseña
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha pedido la recuperación y ya ha establecido la contraseña Nueva1234! con su enlace dentro de su plazo
    Cuando la persona vuelve a usar ese mismo enlace para establecer la contraseña <contraseña_nueva>
    Entonces el enlace no permite establecer otra contraseña

    Ejemplos:
      | contraseña_nueva |
      | Abcdefghij1! |
      | Otra12345! |
```

## Fuera de alcance
- El envío del correo con el enlace: la historia de la API no-implementada de esta misma épica.
- La respuesta de la API a la petición de recuperación: la historia de la API de esta misma épica.
- El inicio de sesión con la contraseña nueva: épica de inicio de sesión (EP-LOGIN).

## Decisiones pendientes
- Qué plataforma describe esta capacidad. Se marca como transversal porque hoy no hay pantalla ni endpoint. Si se decide una pantalla o un endpoint, la historia se divide por plataforma.
- Qué pantalla o ruta recibe el enlace, en la web, en la app móvil o en ambas, y qué ve la persona al abrirlo.
- Qué campos pide el formulario (la contraseña nueva y su confirmación, por ejemplo) y qué reglas cumple la contraseña nueva: las del registro u otras.
- Si el enlace vale o no en el minuto 30 exacto. La historia solo fija los casos de 29 y 31 minutos.
- Qué ve la persona cuando el enlace ya se ha usado, ha caducado o no existe.
- Qué endpoint recibe la contraseña nueva, con qué método y ruta, y qué código HTTP responde en cada caso.
- Si al establecer la contraseña la persona queda con sesión iniciada o vuelve a `/login` sin sesión.
- Qué pasa con las sesiones y los tokens ya emitidos para la cuenta al cambiar la contraseña.
- Si una cuenta bloqueada puede restablecer su contraseña, y si el restablecimiento desbloquea la cuenta o pone a cero sus intentos fallidos.
- Si una cuenta con segundo factor debe pasar después por la verificación en dos pasos.
