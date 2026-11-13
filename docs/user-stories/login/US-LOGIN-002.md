---
id: US-LOGIN-002
tipo: historia
epica: EP-LOGIN
titulo: "[API] Validar el cuerpo de la petición de inicio de sesión"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-LOGIN-012, US-LOGIN-025]
verificacion: codigo
cubre: ["POST /api/auth/login"]
---

## Historia
Como cliente de la API, quiero que un cuerpo de inicio de sesión incompleto o mal formado se rechace con el motivo de cada campo,
para mostrar el mismo aviso que la interfaz y no gastar un intento con datos que nunca podrían ser válidos.

## Reglas
- La validación usa las mismas reglas que la web y la app móvil, y ocurre antes de buscar la cuenta: una petición rechazada aquí no cuenta como intento fallido.
- La respuesta de un cuerpo no válido es 422 con `code: "validation_failed"` y un objeto `errors` con un motivo por campo.
- Los motivos son las claves de texto que traduce la interfaz: `required` (campo obligatorio) y `badEmail` (correo con formato no válido).
- `email` es obligatorio. Se recortan los espacios del principio y del final: si no queda nada, el motivo es `required`.
- `email` debe tener la forma `texto@dominio.extensión`, sin espacios y con una sola `@`; si no, el motivo es `badEmail`.
- `password` es obligatoria y basta con un carácter; no se recorta, así que una contraseña de un solo espacio no es un campo vacío.
- Un campo que falta en el cuerpo se trata igual que un campo vacío: motivo `required`.
- `remember`, si se envía, debe ser un booleano.

## Criterios de aceptación
```gherkin
Característica: Validación del cuerpo del inicio de sesión

  Esquema del escenario: Cada campo no válido devuelve su motivo
    Dado un cliente de la API sin sesión
    Cuando envía POST /api/auth/login con el correo <correo> y la contraseña <contraseña>
    Entonces la respuesta es <estado>
    Y el motivo del correo es <motivo_correo>
    Y el motivo de la contraseña es <motivo_contraseña>

    Ejemplos:
      | correo | contraseña | estado | motivo_correo | motivo_contraseña |
      | (vacío) | (vacía) | 422 validation_failed | required | required |
      | (sin el campo) | (sin el campo) | 422 validation_failed | required | required |
      | (sin el campo) | Gestor1234! | 422 validation_failed | required | (ninguno) |
      | gestor@sigpro.test | (sin el campo) | 422 validation_failed | (ninguno) | required |
      | (tres espacios) | Gestor1234! | 422 validation_failed | required | (ninguno) |
      | no-es-un-correo | Gestor1234! | 422 validation_failed | badEmail | (ninguno) |
      | ana@sigpro | Gestor1234! | 422 validation_failed | badEmail | (ninguno) |
      | @sigpro.test | Gestor1234! | 422 validation_failed | badEmail | (ninguno) |
      | ana @sigpro.test | Gestor1234! | 422 validation_failed | badEmail | (ninguno) |
      | gestor@sigpro.test | (vacía) | 422 validation_failed | (ninguno) | required |
      | a@b.c | x | 401 invalid_credentials | (ninguno) | (ninguno) |
      | gestor@sigpro.test | (un espacio) | 401 invalid_credentials | (ninguno) | (ninguno) |

  Esquema del escenario: Una petición rechazada por validación no cuenta como intento fallido
    Dado que "gestor@sigpro.test" no tiene intentos fallidos
    Cuando envía <rechazadas> peticiones con la contraseña vacía
    Y después envía la contraseña "incorrecta"
    Entonces la respuesta es 401 con "attempts" igual a 1

    Ejemplos:
      | rechazadas |
      | 1 |
      | 5 |
      | 6 |

  Esquema del escenario: El indicador de recordar la sesión debe ser un booleano
    Dado un cliente de la API sin sesión
    Cuando envía POST /api/auth/login como "gestor@sigpro.test" con "Gestor1234!" y remember <remember>
    Entonces la respuesta es <estado>

    Ejemplos:
      | remember | estado |
      | true | 200 |
      | false | 200 |
      | (sin el campo) | 200 |
      | "si" | 422 validation_failed con un motivo para remember |
```
