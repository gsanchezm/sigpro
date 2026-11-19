---
id: US-REQ-EDICION-002
tipo: historia
epica: EP-REQ-EDICION
titulo: "[API] Rechazar un alta con sus motivos"
etiquetas: [api]
relacionadas: [US-REQ-EDICION-001, US-REQ-EDICION-008, US-REQ-EDICION-012]
verificacion: ejecutada
cubre: ["POST /api/requirements"]
---

## Historia
Como cliente de la API que da de alta requisitos, quiero que un cuerpo no válido se rechace con un motivo por campo,
para corregir el dato que falla sin adivinar la regla incumplida y sin que quede un requisito a medias.

## Reglas
- Un cuerpo no válido responde 422 con `code: "validation_failed"` y un objeto `errors` con un motivo por campo. La validación ocurre antes de buscar el programa y el padre: un programa inexistente con un título no válido responde 422, no 404.
- `title`: se recortan los espacios del principio y del final, y debe quedar entre 3 y 120 caracteres. Con menos de 3, el motivo es `titleShort` (también si está vacío o solo tiene espacios); con más de 120, `titleLong`. Si el campo falta, el motivo es `required`.
- `programCode` es obligatorio: si falta, el motivo es `required`.
- `description`: se sanea con una lista blanca (negrita, cursiva, subrayado, párrafos, saltos de línea y listas, sin atributos). El texto de las demás etiquetas se conserva y el contenido de `script`, `style`, `iframe` y `object` se elimina. Después de sanear no puede superar 4000 caracteres, y el texto recibido no puede superar 12000: si lo supera, el motivo es `descLong`.
- `priority` debe ser `low`, `medium` o `high`. Cualquier otro valor responde 422 con un motivo para `priority`.
- `tags` solo admite las etiquetas del catálogo (`safety`, `security`, `performance`, `interface`, `regulatory`, `maintainability`, `availability`, `usability`) y quita las repetidas. Una etiqueta fuera del catálogo responde 422 con un motivo para `tags`.
- Un alta rechazada no consume código: la siguiente alta correcta recibe el mismo código, y una alta rechazada no deja evento de auditoría.
- Convenciones de los ejemplos: `(sin el campo)` es un campo que no se envía; `(vacío)` es un valor vacío; `(tres espacios)` son tres espacios; `(dos espacios, abc y un espacio)` es el texto `  abc `; `(N letras a)` es un texto de N letras «a» seguidas; `(párrafo con un script)` es `<p>Hola<script>alert(1)</script></p>`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). El token de `gestor@sigpro.test` (contraseña `Gestor1234!`) se obtiene con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Motivos de rechazo del alta de requisitos

  Esquema del escenario: El título se valida después de recortar sus espacios
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/requirements con x-tenant alumno01 y el cuerpo con programCode PRG-001 y title <titulo>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | titulo | respuesta |
      | (vacío) | 422 validation_failed con errors.title igual a titleShort |
      | (tres espacios) | 422 validation_failed con errors.title igual a titleShort |
      | ab | 422 validation_failed con errors.title igual a titleShort |
      | (dos espacios, abc y un espacio) | 201 con title abc |
      | (120 letras a) | 201 con un título de 120 caracteres |
      | (121 letras a) | 422 validation_failed con errors.title igual a titleLong |

  Esquema del escenario: Un campo obligatorio que falta devuelve el motivo required
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/requirements con x-tenant alumno01 y el cuerpo con programCode <programa> y title <titulo>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | programa | titulo | respuesta |
      | PRG-001 | (sin el campo) | 422 validation_failed con errors.title igual a required |
      | (sin el campo) | Requisito de prueba | 422 validation_failed con errors.programCode igual a required |

  Esquema del escenario: La prioridad, las etiquetas y la descripción se validan o se sanean
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/requirements con x-tenant alumno01 y el cuerpo con programCode PRG-001, title Requisito de prueba, priority <prioridad>, tags <etiquetas> y description <descripcion>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | prioridad | etiquetas | descripcion | respuesta |
      | urgent | (sin el campo) | (sin el campo) | 422 validation_failed con un motivo para priority |
      | (sin el campo) | (sin el campo) | (sin el campo) | 201 con priority medium, tags vacías y description vacía |
      | high | (sin el campo) | (sin el campo) | 201 con priority high |
      | (sin el campo) | nope | (sin el campo) | 422 validation_failed con un motivo para tags |
      | (sin el campo) | security, security | (sin el campo) | 201 con tags igual a security |
      | (sin el campo) | (sin el campo) | (4000 letras a) | 201 con la descripción recibida |
      | (sin el campo) | (sin el campo) | (4001 letras a) | 422 validation_failed con errors.description igual a descLong |
      | (sin el campo) | (sin el campo) | (párrafo con un script) | 201 con description igual a <p>Hola</p> |
```

## Decisiones pendientes
- Qué clave de motivo llevan `priority` y `tags` cuando el valor no está en su lista. Hoy el motivo es el mensaje por defecto de la validación y no una clave del catálogo de textos; las filas solo exigen que haya un motivo para ese campo.

## Fuera de alcance
- El código, la posición y el estado de un alta correcta: la historia de la API de alta de esta misma épica.
- Los avisos que muestran la web y la app móvil ante estos motivos: las historias web y móvil de alta de esta misma épica.
