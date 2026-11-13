---
id: US-LOGIN-009
tipo: historia
epica: EP-LOGIN
titulo: "[API] Cerrar sesión"
etiquetas: [api]
relacionadas: [US-LOGIN-020, US-LOGIN-031]
verificacion: codigo
cubre: ["POST /api/auth/logout"]
---

## Historia
Como cliente de la API, quiero avisar al servidor de que la persona cierra su sesión,
para terminarla de forma explícita aunque el cliente ya no tenga un token de acceso vigente.

## Reglas
- `POST /api/auth/logout` es público: no necesita cabecera `Authorization`, porque se puede cerrar una sesión cuyo token de acceso ya caducó.
- El cuerpo es opcional; el único campo que se tiene en cuenta es `refreshToken`, que puede ser un texto o `null`.
- La respuesta es 204, sin cuerpo, también si el `refreshToken` ya no es válido o no se envía: cerrar sesión dos veces no es un error.
- Un `refreshToken` que no es texto ni `null` responde 422 `validation_failed`.

## Criterios de aceptación
```gherkin
Característica: Cierre de sesión por la API

  Esquema del escenario: El cierre de sesión responde 204 sin cuerpo
    Dado que un cliente de la API está <sesion>
    Cuando envía POST /api/auth/logout con el cuerpo <cuerpo>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | sesion | cuerpo | respuesta |
      | con la sesión de gestor@sigpro.test | (su refreshToken) | 204 sin cuerpo |
      | con la sesión de gestor@sigpro.test, que ya cerró antes | (el mismo refreshToken) | 204 sin cuerpo |
      | sin sesión | refreshToken null | 204 sin cuerpo |
      | sin sesión | (vacío) | 204 sin cuerpo |
      | sin sesión | refreshToken no-es-un-token | 204 sin cuerpo |
      | sin sesión | refreshToken 123 (un número) | 422 validation_failed |
```

## Fuera de alcance
- Si el `refreshToken` sigue sirviendo para renovar la sesión después de cerrarla (épica de Sesión y renovación de token).
