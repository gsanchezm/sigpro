---
id: US-LOGIN-008
tipo: historia
epica: EP-LOGIN
titulo: "[API] Iniciar sesión en el tenant que corresponde"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-LOGIN-024]
verificacion: codigo
cubre: ["POST /api/auth/login"]
---

## Historia
Como cliente de la API, quiero indicar en qué tenant inicio sesión,
para entrar en los datos de mi organización aunque el mismo correo exista en otros tenants.

## Reglas
- El tenant se indica con la cabecera `x-tenant`. Los usuarios de demostración existen en todos los tenants (`demo` y `alumno01` … `alumno25`), así que el correo y la contraseña solos no identifican el tenant.
- Sin cabecera, el tenant es el único que tiene ese correo; si el correo está en varios tenants o en ninguno, el tenant es `demo`.
- Un tenant que no existe responde 404 con `code: "tenant_not_found"` y no cuenta como intento fallido.
- La sesión pertenece al tenant en el que se inició: el campo `tenant` del usuario de la respuesta lo indica.
- Una cuenta solo existe en su tenant: el correo de otro tenant responde 401 `invalid_credentials`.
- Cada tenant `alumnoNN` tiene además su propia cuenta de administración, `alumnoNN@sigpro.lab` con la contraseña `Alumno1234!` y sin segundo factor.

## Criterios de aceptación
```gherkin
Característica: Tenant del inicio de sesión

  Esquema del escenario: El inicio de sesión ocurre en el tenant indicado o deducido
    Dado que la petición lleva la cabecera x-tenant <cabecera>
    Cuando envía POST /api/auth/login con el correo <correo> y la contraseña <contraseña>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cabecera | correo | contraseña | respuesta |
      | alumno01 | gestor@sigpro.test | Gestor1234! | 200 con el usuario del tenant alumno01 |
      | alumno02 | gestor@sigpro.test | Gestor1234! | 200 con el usuario del tenant alumno02 |
      | (sin cabecera) | gestor@sigpro.test | Gestor1234! | 200 con el usuario del tenant demo |
      | (sin cabecera) | alumno01@sigpro.lab | Alumno1234! | 200 con el usuario del tenant alumno01 y el rol admin |
      | alumno01 | alumno01@sigpro.lab | Alumno1234! | 200 con el usuario del tenant alumno01 y el rol admin |
      | alumno02 | alumno01@sigpro.lab | Alumno1234! | 401 invalid_credentials |
      | noexiste | gestor@sigpro.test | Gestor1234! | 404 tenant_not_found |
```

## Fuera de alcance
- El aislamiento de los datos entre tenants una vez iniciada la sesión (épica transversal de multi-tenant).
