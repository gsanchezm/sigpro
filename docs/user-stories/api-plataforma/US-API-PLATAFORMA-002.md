---
id: US-API-PLATAFORMA-002
tipo: historia
epica: EP-API-PLATAFORMA
titulo: "[API] Leer la configuración pública del tenant con la cabecera x-tenant"
etiquetas: [api]
relacionadas: [US-API-PLATAFORMA-003]
verificacion: codigo
cubre: ["GET /api/config"]
---

## Historia
Como cliente de la API (la web o la app móvil antes de iniciar sesión, o una suite de pruebas), quiero leer la configuración pública del tenant que indico con la cabecera `x-tenant`,
para saber en qué entorno y con qué versión trabajo, si la aplicación ofrece usuarios de prueba y qué caos tiene activo ese tenant.

## Reglas
- `GET /api/config` es público: no necesita la cabecera `Authorization`, y un token que no es válido no cambia la respuesta.
- `tenant` es el valor de la cabecera `x-tenant` sin los espacios del principio y del final. Sin cabecera, o con la cabecera vacía, es `demo`.
- Un tenant que no existe no da error: la respuesta es 200, `tenant` trae el valor recibido y el caos aparece en cero, igual que en un tenant sin caos.
- `env` es el valor de la variable `APP_ENV` del entorno, tal cual. Con la configuración local por defecto vale `dev`; en el entorno desplegado, `staging`.
- `version` vale `0.1.0`.
- `testUsers` vale `true`, salvo cuando `APP_ENV` vale `production`: entonces vale `false`.
- `chaos` trae `latencyMs` (entero de 0 a 5000), `errorRate` (número de 0 a 1) y `flakyLabels` (booleano), con los valores del tenant indicado. Sin caos activo, `latencyMs` y `errorRate` valen 0 y `flakyLabels` vale `false`.
- Las filas con caos fijan sus valores después del reinicio con `PATCH /api/admin/chaos` (campos `latencyMs`, `errorRate` y `flakyLabels`) y el token de `alumno01@sigpro.lab`.
- El caos no retrasa esta ruta ni la hace fallar, aunque el tenant tenga la latencia y la tasa de error al máximo.
- Además de los campos de esta historia, el cuerpo trae los demás campos, que no se describen aquí.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Como el reinicio no apaga el caos, antes de cada fila se comprueba con `GET /api/config` (cabecera `x-tenant: alumno01`) que `chaos` tiene latencia 0, tasa de error 0 y etiquetas no variables; si no es así, se apaga con `PATCH /api/admin/chaos` y ese mismo token. Al terminar cada fila, el caos del tenant vuelve a apagarse con ese mismo `PATCH`, porque el reinicio no lo apaga.
- Las filas con `APP_ENV` distinto de `dev` solo se ejecutan en una instancia de la API arrancada con ese valor; en el laboratorio compartido no se pueden fijar.

## Criterios de aceptación
```gherkin
Característica: Configuración pública del tenant

  Esquema del escenario: La configuración de un tenant sin caos
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado y la API tiene APP_ENV dev
    Cuando envía GET /api/config con la cabecera x-tenant <cabecera>
    Entonces la respuesta es 200 con tenant <tenant_devuelto>, env dev, version 0.1.0 y testUsers true

    Ejemplos:
      | cabecera | tenant_devuelto |
      | (sin cabecera) | demo |
      | (cabecera vacía) | demo |
      | alumno01 | alumno01 |
      | alumno02 | alumno02 |
      | (alumno01 con un espacio delante y otro detrás) | alumno01 |
      | noexiste | noexiste |

  Esquema del escenario: El caos del tenant aparece en la configuración
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant tiene latencia <latencia>, tasa de error <tasa> y etiquetas variables <etiquetas>
    Cuando envía GET /api/config con la cabecera x-tenant alumno01
    Entonces la respuesta es 200 con chaos latencyMs <latencia>, errorRate <tasa> y flakyLabels <etiquetas>

    Ejemplos:
      | latencia | tasa | etiquetas |
      | 0 | 0 | false |
      | 1500 | 0.25 | true |
      | 5000 | 1 | true |

  Esquema del escenario: La configuración es pública
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado
    Cuando envía GET /api/config con la cabecera x-tenant alumno01 y <autorizacion>
    Entonces la respuesta es 200 con tenant alumno01

    Ejemplos:
      | autorizacion |
      | (sin cabecera Authorization) |
      | Authorization Bearer token-inventado |

  Esquema del escenario: El entorno decide si la configuración anuncia usuarios de prueba
    Dado que en el tenant alumno01, recién reiniciado, el caos del tenant está apagado y la API tiene APP_ENV <entorno>
    Cuando envía GET /api/config con la cabecera x-tenant alumno01
    Entonces la respuesta es 200 con env <entorno> y testUsers <testUsers>

    Ejemplos:
      | entorno | testUsers |
      | dev | true |
      | staging | true |
      | production | false |

  Esquema del escenario: Un tenant que no existe tiene el caos apagado
    Dado que en el tenant alumno01, recién reiniciado, la API tiene APP_ENV dev
    Cuando envía GET /api/config con la cabecera x-tenant <cabecera>
    Entonces la respuesta es 200 con chaos latencyMs 0, errorRate 0 y flakyLabels false

    Ejemplos:
      | cabecera |
      | noexiste |
```

## Fuera de alcance
- El cambio del modo caos (`PATCH /api/admin/chaos`) y el reinicio del tenant: épica EP-CAOS-RESET.
- La lista de tenants y la de usuarios de prueba: otra historia de esta épica.
- El panel de marca de la pantalla de acceso, que muestra el entorno y la versión: no se describe en esta épica.
