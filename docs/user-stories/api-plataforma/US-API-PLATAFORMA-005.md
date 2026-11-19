---
id: US-API-PLATAFORMA-005
tipo: historia
epica: EP-API-PLATAFORMA
titulo: "[API] Publicar la documentación OpenAPI en /api/docs"
etiquetas: [api]
verificacion: codigo
---

## Historia
Como alumno que escribe pruebas de la API, quiero una documentación interactiva y el documento OpenAPI de todas las rutas,
para encontrar cada ruta, su etiqueta y sus cabeceras sin leer el código.

## Reglas
- Sin credenciales de documentación configuradas, `/api/docs` (la página interactiva) y `/api/docs-json` (el documento OpenAPI en JSON) son públicos: no piden ninguna cabecera.
- El documento tiene como título `SIGPRO API` y como versión `0.1.0`. Su descripción general dice que cada alumno trabaja en su tenant con la cabecera `x-tenant`.
- Las rutas del documento llevan el prefijo `/api`, por ejemplo `/api/health` o `/api/programs`.
- Cada operación va agrupada por una etiqueta que nombra su área: `health` para `/api/health`, `config` para las rutas de `/api/config`, `auth` para las de `/api/auth` y `programs` para las de `/api/programs`.
- El parámetro de cabecera `x-tenant` aparece en las operaciones como opcional, con una ayuda que indica que el valor por defecto es `demo`.
- El documento describe dos esquemas de seguridad: `bearer` (el token de acceso en `Authorization`) y `admin-key` (la cabecera `X-Admin-Key`).
- Si el entorno define credenciales de documentación (la variable `DOCS_BASIC_AUTH`, con la forma `usuario:contraseña`), `/api/docs` y `/api/docs-json` piden esas credenciales por HTTP Basic. Sin ellas, o con otras, responden 401 con la cabecera `WWW-Authenticate` y el realm `SIGPRO API docs`; con las configuradas, responden 200.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Como el reinicio no apaga el caos, antes de cada fila se comprueba con `GET /api/config` (cabecera `x-tenant: alumno01`) que `chaos` tiene latencia 0, tasa de error 0 y etiquetas no variables; si no es así, se apaga con `PATCH /api/admin/chaos` y ese mismo token.

## Criterios de aceptación
```gherkin
Característica: Documentación OpenAPI de la API

  Esquema del escenario: La documentación es pública sin credenciales configuradas
    Dado que en el tenant alumno01, recién reiniciado, la API no tiene credenciales de documentación
    Cuando envía GET <ruta> sin credenciales
    Entonces la respuesta es 200 con <contenido>

    Ejemplos:
      | ruta | contenido |
      | /api/docs | la página de documentación interactiva |
      | /api/docs-json | el documento OpenAPI en JSON |

  Esquema del escenario: El documento identifica la API
    Dado que en el tenant alumno01, recién reiniciado, la API no tiene credenciales de documentación
    Cuando lee el documento de /api/docs-json
    Entonces el campo <campo> vale <valor>

    Ejemplos:
      | campo | valor |
      | info.title | SIGPRO API |
      | info.version | 0.1.0 |

  Esquema del escenario: El documento agrupa cada ruta por su etiqueta
    Dado que en el tenant alumno01, recién reiniciado, la API no tiene credenciales de documentación
    Cuando lee el documento de /api/docs-json
    Entonces contiene la operación GET <ruta> con la etiqueta <etiqueta>

    Ejemplos:
      | ruta | etiqueta |
      | /api/health | health |
      | /api/config | config |
      | /api/config/tenants | config |
      | /api/config/test-users | config |
      | /api/auth/me | auth |
      | /api/programs | programs |

  Esquema del escenario: Con credenciales de documentación configuradas, las rutas piden HTTP Basic
    Dado que en el tenant alumno01, recién reiniciado, la API tiene configuradas las credenciales de documentación
    Cuando envía GET <ruta> con <credenciales>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | ruta | credenciales | respuesta |
      | /api/docs | (sin credenciales) | 401 con la cabecera WWW-Authenticate y el texto Authentication required |
      | /api/docs-json | (sin credenciales) | 401 con la cabecera WWW-Authenticate y el texto Authentication required |
      | /api/docs | (credenciales incorrectas) | 401 con la cabecera WWW-Authenticate y el texto Authentication required |
      | /api/docs | (las credenciales configuradas) | 200 con la página de documentación interactiva |
```

## Fuera de alcance
- El contenido funcional de cada ruta, es decir, qué hace y qué devuelve: cada una de sus épicas.
- La lista de endpoints de la pantalla del instructor `/lab`: no se describe en esta épica.
