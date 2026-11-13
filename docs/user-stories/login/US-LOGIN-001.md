---
id: US-LOGIN-001
tipo: historia
epica: EP-LOGIN
titulo: "[API] Iniciar sesión con credenciales válidas"
etiquetas: [api]
relacionadas: [US-LOGIN-013, US-LOGIN-026, US-LOGIN-002, US-LOGIN-008]
verificacion: codigo
cubre: ["POST /api/auth/login"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero canjear el correo y la contraseña de una cuenta activa por una sesión,
para llamar después a los endpoints protegidos en nombre de esa persona.

## Reglas
- `POST /api/auth/login` es público: no necesita cabecera `Authorization`.
- El cuerpo lleva `email`, `password` y, opcionalmente, `remember` (booleano, `true` si no se envía).
- El correo se compara sin espacios al principio ni al final y sin distinguir mayúsculas de minúsculas; la contraseña se compara tal cual.
- Con credenciales válidas y una cuenta sin segundo factor, la respuesta es 200 con `mfaRequired: false`, el usuario (`id`, `name`, `email`, `role`, `mfa`, `tenant`), `accessToken`, `refreshToken` y `expiresIn: 900` (segundos de vida del `accessToken`).
- Con credenciales válidas y una cuenta con segundo factor, la respuesta es 200 con `mfaRequired: true`, un `mfaToken` temporal y el `email`, y **no** incluye `accessToken` ni `refreshToken`: la sesión empieza tras el segundo paso.
- El correo de la respuesta es siempre el de la cuenta, en minúsculas.
- Un inicio de sesión correcto pone a cero el contador de intentos fallidos de la cuenta.

## Criterios de aceptación
```gherkin
Característica: Inicio de sesión por la API

  Esquema del escenario: Una cuenta activa recibe una sesión o el paso del segundo factor
    Dado que existe el usuario de demostración <cuenta> con la contraseña <contraseña>
    Cuando envía POST /api/auth/login con el correo <correo_enviado> y esa contraseña
    Entonces la respuesta es 200
    Y mfaRequired vale <mfa>
    Y la respuesta <tokens>
    Y el correo de la respuesta es <cuenta>

    Ejemplos:
      | cuenta | contraseña | correo_enviado | mfa | tokens |
      | gestor@sigpro.test | Gestor1234! | gestor@sigpro.test | false | trae accessToken, refreshToken, expiresIn 900 y el usuario con el rol program_manager |
      | consultor@sigpro.test | Consul1234! | consultor@sigpro.test | false | trae accessToken, refreshToken, expiresIn 900 y el usuario con el rol consultant |
      | auditor@sigpro.test | Audit1234! | auditor@sigpro.test | false | trae accessToken, refreshToken, expiresIn 900 y el usuario con el rol auditor |
      | gestor@sigpro.test | Gestor1234! | (Gestor@SIGPRO.test con un espacio delante y otro detrás) | false | trae accessToken, refreshToken, expiresIn 900 y el usuario con el rol program_manager |
      | admin@sigpro.test | Admin1234! | admin@sigpro.test | true | trae un mfaToken y no trae accessToken ni refreshToken |

  Esquema del escenario: La contraseña se compara exactamente
    Dado que existe el usuario de demostración gestor@sigpro.test con la contraseña Gestor1234!
    Cuando envía POST /api/auth/login con ese correo y la contraseña <contraseña_enviada>
    Entonces la respuesta es <estado>

    Ejemplos:
      | contraseña_enviada | estado |
      | Gestor1234! | 200 |
      | gestor1234! | 401 invalid_credentials |
      | Gestor1234 | 401 invalid_credentials |
      | Gestor1234!! | 401 invalid_credentials |
```

## Fuera de alcance
- El canje del `mfaToken` por la sesión (épica del segundo factor).
- La duración del `refreshToken` según `remember` (épica de Sesión y renovación de token).
