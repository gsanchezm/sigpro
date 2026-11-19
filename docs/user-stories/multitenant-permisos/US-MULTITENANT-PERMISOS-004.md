---
id: US-MULTITENANT-PERMISOS-004
tipo: historia
epica: EP-MULTITENANT-PERMISOS
titulo: "[API] La cabecera x-tenant no cambia el tenant de un token"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-CAOS-RESET-005, US-MULTITENANT-PERMISOS-002, US-MULTITENANT-PERMISOS-003]
verificacion: codigo
cubre: ["GET /api/programs/:code", "GET /api/auth/me", "GET /api/audit", "POST /api/admin/reset"]
---

## Historia
Como cliente de la API que envía a la vez un token y una cabecera `x-tenant`, quiero que el tenant lo fije el token y que la cabecera no lo cambie, ni para leer ni para reiniciar datos,
para que una cabecera equivocada o malintencionada no me dé acceso a los datos de otro alumno.

## Reglas
- En cualquier ruta protegida, el tenant de una petición es el del token. La cabecera `x-tenant` no cambia lo que se lee, lo que se escribe ni lo que se reinicia. Un valor desconocido en la cabecera se ignora igual que uno válido.
- Sin token, la cabecera `x-tenant` no abre nada: la respuesta es 401 `missing_token`, con cualquier valor de la cabecera.
- `POST /api/admin/reset` reinicia el tenant del token. La cabecera `x-tenant` no elige el tenant reiniciado.
- La clave de administración del reinicio nocturno (`X-Admin-Key`) no es un token de usuario y no se describe aquí.
- Preparación de cada fila: se reinician `alumno01` y `alumno02` con `POST /api/admin/reset`, cada uno con el token de su administrador (`alumno01@sigpro.lab` y `alumno02@sigpro.lab`, contraseña `Alumno1234!`) y la cabecera `x-tenant` de su tenant, con el caos apagado. Cada administrador inicia sesión con `POST /api/auth/login`, su cabecera `x-tenant` y su contraseña, y usa el `accessToken` que recibe. Después `alumno02@sigpro.lab`, con su token, renombra `PRG-001` a «Programa de aislamiento» y crea el programa `PRG-025` «Programa de aislamiento nuevo» (responsable `u1`, inicio `2026-03-01`, fin `2026-12-31`, presupuesto `150000`). `alumno01` no recibe ninguna otra operación.

## Criterios de aceptación
```gherkin
Característica: La cabecera x-tenant no cambia el tenant de un token

  Esquema del escenario: Con un token de alumno01, la cabecera x-tenant no cambia la lectura
    Dado que en los tenants alumno01 y alumno02, recién reiniciados y con la preparación de la regla, la cuenta de administración de alumno01 tiene su accessToken
    Cuando envía GET <ruta> con ese accessToken y la cabecera x-tenant <cabecera>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | ruta | cabecera | respuesta |
      | /api/programs/PRG-025 | alumno02 | 404 program_not_found |
      | /api/programs/PRG-001 | alumno02 | 200 con el nombre «Sistema de mando táctico Ártemis» |
      | /api/programs/PRG-001 | noexiste | 200 con el nombre «Sistema de mando táctico Ártemis» |
      | /api/auth/me | alumno02 | 200 con el correo alumno01@sigpro.lab y el tenant alumno01 |
      | /api/audit?q=PRG-025 | alumno02 | 200 con total 0 |

  Esquema del escenario: Sin token, la cabecera x-tenant no abre datos
    Dado que en los tenants alumno01 y alumno02, recién reiniciados y con la preparación de la regla
    Cuando envía <operacion> sin cabecera Authorization y con la cabecera x-tenant alumno02
    Entonces la respuesta es 401 missing_token
    Y el tenant alumno02 no se ha reiniciado: PRG-025 sigue existiendo con su nombre

    Ejemplos:
      | operacion |
      | GET /api/programs/PRG-025 |
      | GET /api/audit |
      | POST /api/admin/reset |

  Esquema del escenario: El reinicio con un token de alumno01 reinicia solo alumno01
    Dado que en los tenants alumno01 y alumno02, recién reiniciados y con la preparación de la regla, la cuenta de administración de alumno01 tiene su accessToken
    Cuando envía POST /api/admin/reset con ese accessToken y la cabecera x-tenant <cabecera>
    Entonces la respuesta es 200 con el tenant alumno01
    Y en alumno01, GET /api/programs/PRG-025 responde 404 program_not_found y PRG-001 vuelve a «Sistema de mando táctico Ártemis»
    Y en alumno02, PRG-025 sigue existiendo con el nombre «Programa de aislamiento nuevo» y PRG-001 sigue con el nombre «Programa de aislamiento»

    Ejemplos:
      | cabecera |
      | alumno02 |
      | (sin cabecera) |
      | noexiste |
```

## Fuera de alcance
- Cómo se resuelve el tenant en el inicio de sesión sin token, con la cabecera o deducido del correo: US-LOGIN-001.
- El reinicio del tenant como operación, su duración y el caos: EP-CAOS-RESET.
- Las lecturas y escrituras de cada módulo dentro del tenant: US-MULTITENANT-PERMISOS-002 y US-MULTITENANT-PERMISOS-003.
- La comprobación de permisos por rol en el reinicio y en el resto de operaciones: US-MULTITENANT-PERMISOS-005.
