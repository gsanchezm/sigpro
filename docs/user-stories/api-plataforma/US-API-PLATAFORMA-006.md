---
id: US-API-PLATAFORMA-006
tipo: historia
epica: EP-API-PLATAFORMA
titulo: "[API] Aceptar las peticiones de los orígenes permitidos del navegador"
etiquetas: [api]
verificacion: ejecutada
---

## Historia
Como persona que usa la web o la versión web de la app móvil en el navegador, quiero que la API acepte las peticiones de esos orígenes,
para que el navegador deje a la aplicación leer las respuestas y enviar sus cabeceras.

## Reglas
- Los orígenes permitidos son los de la variable `CORS_ORIGIN`. Con la configuración por defecto son `http://localhost:5173` (la web) y `http://localhost:8081` (la versión web de la app móvil). Un entorno desplegado declara los suyos.
- Desde un origen permitido, la respuesta trae `Access-Control-Allow-Origin` con ese mismo origen y `Access-Control-Expose-Headers` con `Content-Disposition`.
- Desde un origen que no está en la lista, la respuesta no trae `Access-Control-Allow-Origin`. La API atiende la petición igual: es el navegador quien la bloquea.
- Una petición previa (`OPTIONS`) de un origen permitido responde 204 y permite las cabeceras `Content-Type`, `Authorization`, `x-tenant` y `x-admin-key`, y los métodos GET, PUT, PATCH, POST y DELETE. Los nombres de las cabeceras se comparan sin distinguir mayúsculas.
- La app móvil nativa no usa CORS, así que esta historia no la describe.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Como el reinicio no apaga el caos, antes de cada fila se comprueba con `GET /api/config` (cabecera `x-tenant: alumno01`) que `chaos` tiene latencia 0, tasa de error 0 y etiquetas no variables; si no es así, se apaga con `PATCH /api/admin/chaos` y ese mismo token.

## Criterios de aceptación
```gherkin
Característica: Orígenes permitidos del navegador

  Esquema del escenario: Un origen permitido recibe permiso para leer la respuesta
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado y la API tiene los orígenes por defecto
    Cuando envía GET /api/health con la cabecera Origin <origen>
    Entonces la respuesta es 200 con Access-Control-Allow-Origin <origen> y Access-Control-Expose-Headers Content-Disposition

    Ejemplos:
      | origen |
      | http://localhost:5173 |
      | http://localhost:8081 |

  Esquema del escenario: Un origen que no está en la lista no recibe permiso, pero la petición se atiende
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado y la API tiene los orígenes por defecto
    Cuando envía GET /api/health con la cabecera Origin <origen>
    Entonces la respuesta es 200 y no trae Access-Control-Allow-Origin

    Ejemplos:
      | origen |
      | http://otro-origen.test |
      | http://localhost:4000 |

  Esquema del escenario: La petición previa acepta las cabeceras y los métodos de la aplicación
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado y la API tiene los orígenes por defecto
    Cuando envía OPTIONS /api/programs desde el origen http://localhost:5173 pidiendo el método <metodo> y las cabeceras <cabeceras>
    Entonces la respuesta es 204 y permite el origen http://localhost:5173, el método <metodo> y las cabeceras <cabeceras>

    Ejemplos:
      | metodo | cabeceras |
      | PATCH | authorization, content-type, x-tenant |
      | DELETE | x-admin-key |
```

## Fuera de alcance
- El contenido de cada respuesta, que depende de cada épica.
- El acceso desde la app móvil nativa, que no pasa por el navegador y no usa CORS.
