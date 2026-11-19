---
id: US-API-PLATAFORMA-001
tipo: historia
epica: EP-API-PLATAFORMA
titulo: "[API] Comprobar que el servicio responde sin autenticación"
etiquetas: [api]
verificacion: codigo
cubre: ["GET /api/health"]
---

## Historia
Como cliente de la API (la web, la app móvil o una herramienta que vigila el servicio), quiero pedir el estado de la API sin iniciar sesión,
para saber si el servicio responde antes de usarlo.

## Reglas
- `GET /api/health` es público: no necesita la cabecera `Authorization`, y un token que no es válido no cambia la respuesta.
- La respuesta trae el campo `status`, que vale `ok`, y el campo `uptime`: el número entero de segundos que lleva en marcha el proceso de la API. `uptime` no es negativo y no baja entre dos peticiones seguidas.
- La respuesta no depende del tenant: con la cabecera `x-tenant` o sin ella, trae los mismos campos.
- El caos del tenant no retrasa esta ruta ni la hace fallar.
- Todas las rutas de la API cuelgan del prefijo `/api`. Sin ese prefijo, la misma ruta no existe y responde 404.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Como el reinicio no apaga el caos, antes de cada fila se comprueba con `GET /api/config` (cabecera `x-tenant: alumno01`) que `chaos` tiene latencia 0, tasa de error 0 y etiquetas no variables; si no es así, se apaga con `PATCH /api/admin/chaos` y ese mismo token.

## Criterios de aceptación
```gherkin
Característica: Estado del servicio de la API

  Esquema del escenario: El servicio responde sin autenticación ni tenant
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado
    Cuando envía GET /api/health con <cabecera>
    Entonces la respuesta es 200 con status ok y uptime entero no negativo

    Ejemplos:
      | cabecera |
      | (sin cabeceras) |
      | Authorization Bearer token-inventado |
      | x-tenant noexiste |

  Esquema del escenario: Sin el prefijo /api la ruta no existe
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado
    Cuando envía GET <ruta>
    Entonces la respuesta es 404 con error Not Found

    Ejemplos:
      | ruta |
      | /health |
      | /api/salud |
```

## Fuera de alcance
- El reinicio del tenant (`POST /api/admin/reset`) y el modo caos (`PATCH /api/admin/chaos`): épica EP-CAOS-RESET.
- El resto de los endpoints de la API: cada una de sus épicas.
