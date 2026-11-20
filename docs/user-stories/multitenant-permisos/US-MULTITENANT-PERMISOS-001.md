---
id: US-MULTITENANT-PERMISOS-001
tipo: historia
epica: EP-MULTITENANT-PERMISOS
titulo: "[API] Las cuentas de demostración existen en cada tenant y la de alumnoNN solo en el suyo"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-REGISTRO-001, US-API-PLATAFORMA-003]
verificacion: ejecutada
cubre: ["POST /api/auth/login"]
---

## Historia
Como cliente de la API que trabaja con varios tenants (la web, la app móvil o una suite de pruebas), quiero que cada tenant tenga sus propias cuentas de demostración y que la cuenta de administración de un alumno no exista fuera de su tenant,
para entrar en cada tenant con sus usuarios y no confundir sus datos con los de otro.

## Reglas
- Los tenants `alumno01` a `alumno25` existen y `alumno26` no. Un inicio de sesión con la cabecera `x-tenant: alumno26` responde 404 `tenant_not_found`. La regla general de la cabecera y del tenant deducido está en US-LOGIN-001; aquí solo se comprueba que las cuentas de cada tenant son las del seed.
- En cada tenant `alumnoNN` existen `gestor@sigpro.test` (contraseña `Gestor1234!`, rol `program_manager`), `consultor@sigpro.test` (`Consul1234!`, rol `consultant`), `auditor@sigpro.test` (`Audit1234!`, rol `auditor`) y `admin@sigpro.test` (`Admin1234!`, rol `admin`). Esta última pide segundo factor: con sus datos correctos, la respuesta es 200 con `mfaRequired` verdadero y un `mfaToken`, y sin tokens de sesión.
- La cuenta `alumnoNN@sigpro.lab` (contraseña `Alumno1234!`, rol `admin`, sin segundo factor) existe solo en su tenant. Con la cabecera de otro tenant, la respuesta es 401 `invalid_credentials`, igual que una contraseña incorrecta, y no revela que la cuenta exista en otro tenant.
- El tenant `demo` es compartido y ninguna fila de esta historia lo usa.
- Preparación de cada fila: se reinicia cada tenant que la fila usa, con `POST /api/admin/reset`, la cabecera `x-tenant` de ese tenant y el token de su administrador (`alumnoNN@sigpro.lab`, contraseña `Alumno1234!`), con el caos del tenant apagado, como dice la convención de preparación del README.

## Criterios de aceptación
```gherkin
Característica: Cuentas de demostración por tenant en el inicio de sesión

  Esquema del escenario: Una cuenta de demostración entra en el tenant que indica la cabecera
    Dado que en los tenants alumno01, alumno02 y alumno25, recién reiniciados,
    Cuando envía POST /api/auth/login con la cabecera x-tenant <tenant>, el correo <correo> y la contraseña <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | tenant | correo | contraseña | respuesta |
      | alumno01 | gestor@sigpro.test | Gestor1234! | 200 con el usuario del tenant alumno01 y el rol program_manager |
      | alumno25 | consultor@sigpro.test | Consul1234! | 200 con el usuario del tenant alumno25 y el rol consultant |
      | alumno02 | auditor@sigpro.test | Audit1234! | 200 con el usuario del tenant alumno02 y el rol auditor |
      | alumno02 | admin@sigpro.test | Admin1234! | 200 con mfaRequired verdadero y un mfaToken, sin accessToken |
      | alumno26 | gestor@sigpro.test | Gestor1234! | 404 tenant_not_found |

  Esquema del escenario: La cuenta de administración de un alumno solo entra en su tenant
    Dado que en los tenants alumno01 y alumno02, recién reiniciados,
    Cuando envía POST /api/auth/login con la cabecera x-tenant <tenant>, el correo <correo> y la contraseña Alumno1234!
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | tenant | correo | respuesta |
      | alumno01 | alumno01@sigpro.lab | 200 con el usuario del tenant alumno01 y el rol admin |
      | alumno02 | alumno02@sigpro.lab | 200 con el usuario del tenant alumno02 y el rol admin |
      | alumno02 | alumno01@sigpro.lab | 401 invalid_credentials, sin tokens de sesión |
      | alumno01 | alumno02@sigpro.lab | 401 invalid_credentials, sin tokens de sesión |
```

## Fuera de alcance
- La resolución del tenant cuando falta la cabecera, el bloqueo de cuentas y el inicio de sesión completo: EP-LOGIN (US-LOGIN-001).
- El registro de una cuenta nueva en un tenant y su `tenant_not_found`: EP-REGISTRO (US-REGISTRO-001).
- La lista de tenants y de usuarios de prueba de la pantalla de acceso: EP-API-PLATAFORMA (US-API-PLATAFORMA-003).
- El segundo paso con el código de seis dígitos: EP-MFA.
