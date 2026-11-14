---
id: US-LOGIN-001
tipo: historia
epica: EP-LOGIN
titulo: "[API] Iniciar sesión con correo y contraseña en un tenant"
etiquetas: [api]
relacionadas: [US-LOGIN-002, US-LOGIN-003, US-LOGIN-006, US-LOGIN-007, US-LOGIN-011, US-LOGIN-012]
verificacion: codigo
cubre: ["POST /api/auth/login"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero canjear el correo y la contraseña de una cuenta activa de un tenant por una sesión,
para llamar después a los endpoints protegidos en nombre de esa persona y con los datos de su organización.

## Reglas
- `POST /api/auth/login` es público: no necesita cabecera `Authorization`.
- El cuerpo lleva `email`, `password` y, opcionalmente, `remember` (booleano; `true` si no se envía).
- El correo se compara sin los espacios del principio y del final y sin distinguir mayúsculas de minúsculas; la contraseña se compara tal cual.
- Con credenciales válidas y una cuenta sin segundo factor, la respuesta es 200 con `mfaRequired: false`, el usuario (`id`, `name`, `email`, `role`, `mfa`, `tenant`), `accessToken`, `refreshToken` y `expiresIn: 900` (segundos de vida del `accessToken`).
- Con credenciales válidas y una cuenta con segundo factor, la respuesta es 200 con `mfaRequired: true`, un `mfaToken` temporal y el `email`, y **no** incluye `accessToken` ni `refreshToken`: la sesión empieza tras el segundo paso.
- El correo de la respuesta es siempre el de la cuenta, en minúsculas.
- **Validación del cuerpo.** Ocurre antes de buscar la cuenta, con las mismas reglas que la web y la app móvil, y una petición rechazada aquí no cuenta como intento fallido. Un cuerpo no válido responde 422 con `code: "validation_failed"` y un objeto `errors` con un motivo por campo: `required` (obligatorio) o `badEmail` (correo con formato no válido).
  - `email` es obligatorio; se recortan los espacios del principio y del final y, si no queda nada, el motivo es `required`. Debe tener la forma `texto@dominio.extensión`, sin espacios y con una sola `@`; si no, `badEmail`.
  - `password` es obligatoria y basta con un carácter; no se recorta, así que una contraseña de un solo espacio no es un campo vacío.
  - Un campo que falta en el cuerpo se trata igual que un campo vacío: motivo `required`.
  - `remember`, si se envía, debe ser un booleano.
- **Tenant.** Se indica con la cabecera `x-tenant`. Las cuentas de demostración existen en todos los tenants (`demo` y `alumno01` … `alumno25`), así que el correo y la contraseña solos no identifican el tenant. Sin cabecera, el tenant es el único que tiene ese correo; si el correo está en varios tenants o en ninguno, el tenant es `demo` (esta última regla no lleva ejemplo: `demo` es compartido y las pruebas no lo usan). Un tenant que no existe responde 404 `tenant_not_found` y no cuenta como intento fallido. La sesión pertenece al tenant en el que se inició (campo `tenant` del usuario), y una cuenta solo existe en su tenant.
- Cada tenant `alumnoNN` tiene además su propia cuenta de administración, `alumnoNN@sigpro.lab`, con la contraseña `Alumno1234!` y sin segundo factor.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y también el tenant `alumno02`, con el token de `alumno02@sigpro.lab`, cuando la fila lo usa. Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa.
- En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución: `nadie-` seguido de una marca de tiempo y `@sigpro.test`. `(cuenta recién solicitada en alumno01)` es una cuenta creada en la propia fila con `POST /api/auth/register`, la cabecera `x-tenant: alumno01` y el cuerpo `first` Ana, `last` Prueba, `email` un correo nuevo (`nueva-` seguido de una marca de tiempo y `@organizacion.es`), `org` Unidad de pruebas, `role` consultant, `password` y `confirm` Abcdefghij1! y `terms` true.

## Criterios de aceptación
```gherkin
Característica: Inicio de sesión por la API

  Esquema del escenario: Una cuenta activa recibe una sesión o el paso del segundo factor
    Dado que en el tenant alumno01, recién reiniciado, existe la cuenta de demostración <cuenta> con la contraseña <contraseña>
    Cuando envía POST /api/auth/login con x-tenant alumno01, el correo <correo_enviado> y esa contraseña
    Entonces la respuesta es 200
    Y mfaRequired vale <mfa>
    Y la respuesta <tokens>
    Y el correo de la respuesta es <cuenta>

    Ejemplos:
      | cuenta | contraseña | correo_enviado | mfa | tokens |
      | gestor@sigpro.test | Gestor1234! | gestor@sigpro.test | false | trae accessToken, refreshToken, expiresIn 900 y el usuario con el rol program_manager y el tenant alumno01 |
      | consultor@sigpro.test | Consul1234! | consultor@sigpro.test | false | trae accessToken, refreshToken, expiresIn 900 y el usuario con el rol consultant y el tenant alumno01 |
      | auditor@sigpro.test | Audit1234! | auditor@sigpro.test | false | trae accessToken, refreshToken, expiresIn 900 y el usuario con el rol auditor y el tenant alumno01 |
      | gestor@sigpro.test | Gestor1234! | (Gestor@SIGPRO.test con un espacio delante y otro detrás) | false | trae accessToken, refreshToken, expiresIn 900 y el usuario con el rol program_manager y el tenant alumno01 |
      | admin@sigpro.test | Admin1234! | admin@sigpro.test | true | trae un mfaToken y no trae accessToken ni refreshToken |

  Esquema del escenario: La contraseña se compara exactamente
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test no tiene intentos fallidos
    Cuando envía POST /api/auth/login con x-tenant alumno01, ese correo y la contraseña <contraseña_enviada>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | contraseña_enviada | respuesta |
      | Gestor1234! | 200 con accessToken y refreshToken |
      | gestor1234! | 401 invalid_credentials con attempts 1 |
      | Gestor1234 | 401 invalid_credentials con attempts 1 |
      | Gestor1234!! | 401 invalid_credentials con attempts 1 |

  Esquema del escenario: Cada campo no válido del cuerpo devuelve su motivo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test no tiene intentos fallidos
    Cuando envía POST /api/auth/login con x-tenant alumno01, el correo <correo> y la contraseña <contraseña>
    Entonces la respuesta es <respuesta>
    Y el motivo del correo es <motivo_correo>
    Y el motivo de la contraseña es <motivo_contraseña>

    Ejemplos:
      | correo | contraseña | respuesta | motivo_correo | motivo_contraseña |
      | (vacío) | (vacío) | 422 validation_failed | required | required |
      | (sin el campo) | (sin el campo) | 422 validation_failed | required | required |
      | (sin el campo) | Gestor1234! | 422 validation_failed | required | (ninguno) |
      | gestor@sigpro.test | (sin el campo) | 422 validation_failed | (ninguno) | required |
      | (tres espacios) | Gestor1234! | 422 validation_failed | required | (ninguno) |
      | no-es-un-correo | Gestor1234! | 422 validation_failed | badEmail | (ninguno) |
      | ana@sigpro | Gestor1234! | 422 validation_failed | badEmail | (ninguno) |
      | @sigpro.test | Gestor1234! | 422 validation_failed | badEmail | (ninguno) |
      | (ana @sigpro.test, con un espacio antes de la arroba) | Gestor1234! | 422 validation_failed | badEmail | (ninguno) |
      | gestor@sigpro.test | (vacío) | 422 validation_failed | (ninguno) | required |
      | (correo sin cuenta) | x | 401 invalid_credentials con attempts 1 | (ninguno) | (ninguno) |
      | gestor@sigpro.test | (un espacio) | 401 invalid_credentials con attempts 1 | (ninguno) | (ninguno) |

  Esquema del escenario: Una petición rechazada por validación no cuenta como intento fallido
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test no tiene intentos fallidos
    Cuando envía <rechazadas> peticiones POST /api/auth/login con x-tenant alumno01, ese correo y la contraseña (vacío)
    Y después envía ese correo con la contraseña incorrecta
    Entonces la última respuesta es 401 invalid_credentials con attempts 1

    Ejemplos:
      | rechazadas |
      | 1 |
      | 5 |
      | 6 |

  Esquema del escenario: El indicador de mantener la sesión debe ser un booleano
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test no tiene intentos fallidos
    Cuando envía POST /api/auth/login con x-tenant alumno01, ese correo, la contraseña Gestor1234! y remember <remember>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | remember | respuesta |
      | true | 200 con accessToken y refreshToken |
      | false | 200 con accessToken y refreshToken |
      | (sin el campo) | 200 con accessToken y refreshToken |
      | (el texto si) | 422 validation_failed con un motivo para remember |

  Esquema del escenario: El inicio de sesión ocurre en el tenant indicado o deducido
    Dado que los tenants alumno01 y alumno02 están recién reiniciados
    Cuando envía POST /api/auth/login con la cabecera x-tenant <cabecera>, el correo <correo> y la contraseña <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cabecera | correo | contraseña | respuesta |
      | alumno01 | gestor@sigpro.test | Gestor1234! | 200 con el usuario del tenant alumno01 |
      | alumno02 | gestor@sigpro.test | Gestor1234! | 200 con el usuario del tenant alumno02 |
      | (sin cabecera) | alumno01@sigpro.lab | Alumno1234! | 200 con el usuario del tenant alumno01 y el rol admin |
      | alumno01 | alumno01@sigpro.lab | Alumno1234! | 200 con el usuario del tenant alumno01 y el rol admin |
      | noexiste | gestor@sigpro.test | Gestor1234! | 404 tenant_not_found |

  Esquema del escenario: Una cuenta solo existe en su tenant
    Dado que los tenants alumno01 y alumno02 están recién reiniciados y en alumno01 existe (cuenta recién solicitada en alumno01)
    Cuando envía POST /api/auth/login con la cabecera x-tenant <cabecera>, ese correo y la contraseña Abcdefghij1!
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cabecera | respuesta |
      | alumno01 | 403 pending_approval |
      | alumno02 | 401 invalid_credentials con attempts 1 |
```

## Fuera de alcance
- El canje del `mfaToken` por la sesión: épica del segundo factor (MFA).
- La duración del `refreshToken` según `remember` y su renovación: épica de Sesión y renovación de token.
- El aislamiento de los datos entre tenants una vez iniciada la sesión: épica transversal de multi-tenant.
