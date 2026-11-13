---
id: US-LOGIN-010
tipo: historia
epica: EP-LOGIN
titulo: "[API] Responder que el acceso con SSO no está disponible"
etiquetas: [api]
relacionadas: [US-LOGIN-021, US-LOGIN-022, US-LOGIN-035]
verificacion: codigo
cubre: ["GET /api/auth/sso"]
---

## Historia
Como cliente de la API, quiero que el acceso con certificado digital o SSO responda de forma explícita que no está disponible,
para mostrar un aviso claro en lugar de un error inesperado.

## Reglas
- `GET /api/auth/sso` es público y responde siempre 501 con `code: "sso_not_available"`.
- La respuesta tiene el mismo formato que el resto de errores de la API: `statusCode: 501`, `error: "Not Implemented"`, `message`, `code` y un `traceId`.
- La respuesta no depende de la sesión ni del tenant, y no inicia ninguna sesión.

## Criterios de aceptación
```gherkin
Característica: Contrato del acceso con SSO

  Esquema del escenario: El SSO no está disponible en ningún caso
    Dado un cliente de la API <sesion> y la cabecera x-tenant <tenant>
    Cuando envía GET /api/auth/sso
    Entonces la respuesta es 501 con el código sso_not_available
    Y el cuerpo lleva "error" igual a "Not Implemented" y un traceId
    Y la respuesta no incluye ningún token

    Ejemplos:
      | sesion | tenant |
      | sin sesión | (sin cabecera) |
      | sin sesión | alumno01 |
      | con la sesión de gestor@sigpro.test | alumno01 |
```

## Fuera de alcance
- El acceso con SSO que se debió construir (US-LOGIN-022 y US-LOGIN-035).
