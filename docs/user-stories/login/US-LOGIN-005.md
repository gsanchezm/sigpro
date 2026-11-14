---
id: US-LOGIN-005
tipo: historia
epica: EP-LOGIN
titulo: "[API] Responder que el acceso con certificado digital o SSO no está disponible"
etiquetas: [api]
relacionadas: [US-LOGIN-009, US-LOGIN-010, US-LOGIN-015]
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
- Preparación: la petición no cambia ningún dato, así que no hace falta reiniciar. Para la fila con sesión, `gestor@sigpro.test` inicia sesión en la propia fila con `POST /api/auth/login`, la cabecera `x-tenant: alumno01` y la contraseña `Gestor1234!`, y la petición lleva su `accessToken` en `Authorization: Bearer`.

## Criterios de aceptación
```gherkin
Característica: Contrato del acceso con SSO

  Esquema del escenario: El SSO no está disponible en ningún caso
    Dado que el cliente de la API <autorizacion> y envía la cabecera x-tenant <tenant>
    Cuando envía GET /api/auth/sso
    Entonces la respuesta es 501 sso_not_available
    Y el cuerpo lleva error igual a Not Implemented y un traceId
    Y la respuesta no incluye ningún token

    Ejemplos:
      | autorizacion | tenant |
      | no envía Authorization | (sin cabecera) |
      | no envía Authorization | alumno01 |
      | envía el accessToken de gestor@sigpro.test en alumno01 | alumno01 |
```

## Fuera de alcance
- El acceso con certificado digital o SSO como capacidad futura: historias `no-implementada` de esta épica.
