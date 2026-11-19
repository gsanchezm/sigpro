---
id: US-VER-INFORME-002
tipo: historia
epica: EP-VER-INFORME
titulo: "[API] Elegir el alcance del informe: selección, programa o todos los casos"
etiquetas: [api]
relacionadas: [US-VER-INFORME-001, US-VER-INFORME-003]
verificacion: codigo
cubre: ["GET /api/verification/report"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero pedir el informe de una selección de casos, de un programa o de todo el tenant,
para revisar solo lo que me interesa y saber por el nombre del archivo y por su línea de alcance qué abarca.

## Reglas
- La consulta admite dos parámetros, `codes` (códigos de casos separados por comas) y `program` (código de programa). Ninguno es obligatorio.
- Si `codes` trae al menos un código, el alcance es esa selección y `program` se ignora.
- Si `codes` falta o está vacío y `program` trae un código, el alcance es ese programa.
- Si no hay ni `codes` ni `program`, el alcance es todo el tenant.
- Los espacios alrededor de cada código o del programa no cuentan. Los códigos se comparan tal cual: `tc-001` no es `TC-001`.
- La línea de alcance del PDF es «Todos los programas» para todo el tenant, «Programa <código>» para un programa (por ejemplo, «Programa PRG-002») y «Selección de <n> caso(s)» para una selección, con el número de casos que de verdad entran en ella.
- La cabecera `Content-Disposition` de la respuesta es `attachment` y lleva el nombre del archivo: `informe-verificacion.pdf` para todo el tenant, `informe-verificacion-<programa en minúsculas>.pdf` para un programa (por ejemplo, `informe-verificacion-prg-002.pdf`) y `informe-verificacion-seleccion.pdf` para cualquier selección, tenga uno o varios casos.
- Si el alcance no tiene ningún caso, la respuesta es 404 `test_cases_not_found` y no hay PDF. Eso ocurre cuando el programa no existe o no tiene casos, y cuando ninguno de los códigos de `codes` existe en el tenant.
- La consulta no se valida: ninguna combinación de estos parámetros responde 422.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y ese mismo token pide el informe. El seed tiene 25 casos (`TC-001` a `TC-025`) repartidos en los programas `PRG-001` (9 casos), `PRG-002` (9) y `PRG-003` (7). El programa `PRG-004` existe, pero no tiene casos.

## Criterios de aceptación
```gherkin
Característica: Alcance del informe de verificación por la API

  Esquema del escenario: La consulta elige el alcance, la línea de alcance y el nombre del archivo
    Dado que en el tenant alumno01, recién reiniciado, existen los 25 casos de prueba del seed
    Cuando envía GET /api/verification/report con <consulta> y el accessToken de alumno01@sigpro.lab
    Entonces la respuesta es 200 con un PDF llamado <nombre>
    Y su resumen dice «Casos de prueba: <casos> · Ejecutados: <casos> · Sin ejecutar: 0»
    Y la línea de alcance es «<linea>»

    Ejemplos:
      | consulta | casos | linea | nombre |
      | (sin parámetros) | 25 | Todos los programas | informe-verificacion.pdf |
      | (program vacío) | 25 | Todos los programas | informe-verificacion.pdf |
      | program=PRG-002 | 9 | Programa PRG-002 | informe-verificacion-prg-002.pdf |
      | program=PRG-003 | 7 | Programa PRG-003 | informe-verificacion-prg-003.pdf |
      | (codes vacío) y program=PRG-002 | 9 | Programa PRG-002 | informe-verificacion-prg-002.pdf |
      | codes=TC-001 | 1 | Selección de 1 caso(s) | informe-verificacion-seleccion.pdf |
      | codes=TC-001, TC-010 | 2 | Selección de 2 caso(s) | informe-verificacion-seleccion.pdf |
      | codes=TC-001,TC-010,TC-020 | 3 | Selección de 3 caso(s) | informe-verificacion-seleccion.pdf |
      | codes=TC-001 y program=PRG-002 | 1 | Selección de 1 caso(s) | informe-verificacion-seleccion.pdf |

  Esquema del escenario: Un alcance sin casos responde 404 y no trae PDF
    Dado que en el tenant alumno01, recién reiniciado, existen los 25 casos de prueba del seed
    Cuando envía GET /api/verification/report con <consulta> y el accessToken de alumno01@sigpro.lab
    Entonces la respuesta es 404 test_cases_not_found
    Y el tipo de contenido de la respuesta es application/json, no application/pdf

    Ejemplos:
      | consulta |
      | program=PRG-004 |
      | program=PRG-999 |
      | codes=TC-999 |
      | codes=tc-001 |
      | codes=TC-999 y program=PRG-002 |
```

## Fuera de alcance
- La selección que se elige en la pantalla de Verificación (casillas, barra y menús), en la web y en la app móvil: EP-VER-INFORME, en sus historias de la web y de la app móvil.
- El contenido del PDF, con su resumen y sus fichas: EP-VER-INFORME, en su historia de la API para el contenido.
- La sesión y el tenant del token: EP-VER-INFORME, en su historia de la API para la sesión.

## Decisiones pendientes
- Un código de `codes` que no existe en el tenant. Hoy se ignora cuando hay otros códigos válidos, y solo da 404 cuando ninguno existe. No está decidido si debe responder con un error de validación en cualquier caso. Esta historia no lo afirma.
- El nombre de la selección. Hoy es `informe-verificacion-seleccion.pdf` tanto para un caso como para varios. No está decidido si la selección de un solo caso debe llevar su código en el nombre del archivo.
