---
id: US-LOGIN-010
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Entrar con «Acceder con certificado digital / SSO» sin la contraseña de SIGPRO"
etiquetas: [web, no-implementada]
relacionadas: [US-LOGIN-005, US-LOGIN-009, US-LOGIN-015]
verificacion: no-ejecutable
---

## Historia
Como persona de una organización con identidad corporativa, quiero entrar en SIGPRO identificándome en el proveedor de identidad de mi organización,
para no tener que escribir una contraseña de SIGPRO.

## Reglas
- Lo único que la app establece para esta opción es un control de /login, el botón «Acceder con certificado digital / SSO», y un endpoint, `GET /api/auth/sso`. Cómo se usan cuando la opción exista está en «Decisiones pendientes».
- Tras pulsar el botón e identificarse en el proveedor de identidad, la persona tiene una sesión iniciada en SIGPRO sin haber escrito la contraseña de SIGPRO.
- Si no llega a identificarse en el proveedor, no tiene sesión iniciada.
- Todo lo demás (qué proveedor, a qué cuenta y a qué tenant corresponde la identidad, qué se muestra en cada caso) está sin decidir: ver «Decisiones pendientes». La historia no lo afirma.

## Criterios de aceptación
```gherkin
Característica: Acceso con certificado digital o SSO en la web

  Esquema del escenario: Identificarse en el proveedor abre una sesión sin la contraseña de SIGPRO
    Dado que una persona sin sesión iniciada está en /login?tenant=alumno01
    Cuando pulsa «Acceder con certificado digital / SSO» y <resultado_proveedor> en el proveedor de identidad
    Entonces <resultado>
    Y no ha escrito la contraseña de SIGPRO en ningún momento

    Ejemplos:
      | resultado_proveedor | resultado |
      | se identifica | tiene una sesión iniciada en SIGPRO |
      | cancela antes de identificarse | no tiene sesión iniciada |
```

## Decisiones pendientes
- Qué proveedor o proveedores de identidad se usan, y si se configura uno por tenant.
- Si «certificado digital» y «SSO» son el mismo flujo o dos flujos distintos detrás del mismo botón.
- Cómo se asocia la identidad del proveedor con una cuenta de SIGPRO (no está decidido que sea por el correo) y en qué tenant entra la sesión.
- Qué ocurre con una identidad que no corresponde a ninguna cuenta de SIGPRO, o que corresponde a varias.
- Si las cuentas bloqueadas, pendientes de aprobación o desactivadas se tratan como en el acceso con contraseña, y qué aviso ve la persona en cada caso.
- A qué pantalla llega la persona tras identificarse y qué ve si cancela o si el proveedor falla.
- Qué otros endpoints necesita el flujo (por ejemplo, la vuelta desde el proveedor) y qué responde `GET /api/auth/sso` cuando la opción exista.

## Fuera de alcance
- La respuesta actual del servidor y el aviso actual de la web mientras esta capacidad no existe: historias vigentes de la API y de la web en esta épica.
