---
id: US-NAVEGACION-002
tipo: historia
epica: EP-NAVEGACION
titulo: "[API] Exigir al menos dos caracteres en el texto de búsqueda"
etiquetas: [api]
relacionadas: [US-NAVEGACION-001, US-NAVEGACION-003]
verificacion: ejecutada
cubre: ["GET /api/search"]
---

## Historia
Como cliente de la API, quiero que una búsqueda con un solo carácter se rechace con un motivo claro,
para que una sola letra no traiga de golpe resultados de todo el tenant.

## Reglas
- Antes de contar los caracteres se quitan los espacios del principio y del final de `q`. Cuenta lo que queda.
- Con dos caracteres o más, la búsqueda se hace y la respuesta es 200, aunque no haya ninguna coincidencia.
- Con menos de dos caracteres, o sin texto, la respuesta es 422 con `code: "validation_failed"` y un objeto `errors` que trae `q: "minChars"`. No se busca nada.
- Si falta el parámetro `q`, o viene vacío o solo con espacios, la respuesta es el mismo 422.
- El campo `query` de la respuesta 200 es el texto ya recortado: `  ab  ` responde `query: "ab"`.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La cuenta de la fila obtiene su acceso con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Validación del texto de búsqueda en la API

  Esquema del escenario: El texto de búsqueda necesita dos caracteres tras quitar los espacios
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un acceso válido
    Cuando pide GET /api/search con q <q_enviada>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | q_enviada | respuesta |
      | (sin el parámetro) | 422 validation_failed con errors.q minChars |
      | (vacío) | 422 validation_failed con errors.q minChars |
      | a | 422 validation_failed con errors.q minChars |
      | (un espacio, a, un espacio) | 422 validation_failed con errors.q minChars |
      | ab | 200 con query ab |
      | (un espacio, ab, un espacio) | 200 con query ab |
      | zz | 200 con query zz y groups vacío |
```

## Fuera de alcance
- Los grupos, los campos buscados y los enlaces de cada resultado: US-NAVEGACION-001.
- El acceso válido exigido por la búsqueda y el aislamiento por tenant: US-NAVEGACION-003.
