---
id: US-LOGIN-015
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Entrar con «Acceder con certificado digital / SSO» sin la contraseña de SIGPRO"
etiquetas: [movil, no-implementada]
relacionadas: [US-LOGIN-005, US-LOGIN-010]
verificacion: no-ejecutable
---

## Historia
Como persona de una organización con identidad corporativa, quiero entrar en la app móvil identificándome en el proveedor de identidad de mi organización, como en la web,
para no tener que escribir en el móvil una contraseña de SIGPRO.

## Reglas
- El requisito es la paridad con la web: la pantalla de acceso de la app tiene el mismo control que /login de la web, el botón «Acceder con certificado digital / SSO», y un único control para esta opción.
- Tras pulsar el botón e identificarse en el proveedor con una identidad asociada a una cuenta activa de SIGPRO (cómo se asocia está pendiente), la persona tiene una sesión iniciada en la app sin haber escrito la contraseña de SIGPRO.
- Si no llega a identificarse en el proveedor, no tiene sesión iniciada.
- Todo lo demás está sin decidir, igual que en la web: ver «Decisiones pendientes». La historia no lo afirma.

## Criterios de aceptación
```gherkin
Característica: Acceso con certificado digital o SSO en la app móvil

  Esquema del escenario: Identificarse en el proveedor abre una sesión sin la contraseña de SIGPRO
    Dado que una persona sin sesión iniciada está en /login de la app con alumno01 en «Tenant de trabajo»
    Cuando pulsa «Acceder con certificado digital / SSO» y <resultado_proveedor> en el proveedor de identidad
    Entonces <resultado>
    Y no ha escrito la contraseña de SIGPRO en ningún momento

    Ejemplos:
      | resultado_proveedor | resultado |
      | se identifica con una identidad que está asociada a una cuenta activa de SIGPRO | tiene una sesión iniciada en la app |
      | cancela antes de identificarse | no tiene sesión iniciada |
```

## Decisiones pendientes
- Las mismas que en la web: qué proveedor de identidad se usa, si «certificado digital» y «SSO» son el mismo flujo, cómo se asocia la identidad con una cuenta (no está decidido que sea por el correo), en qué tenant entra la sesión, identidades sin cuenta o con varias, estados de la cuenta y qué ve la persona en cada caso.
- Si el tenant de la sesión es el de «Tenant de trabajo» o lo decide el proveedor.
- Cómo se abre el proveedor desde la app (navegador del sistema o una vista dentro de la app) y cómo vuelve a ella.
- Qué muestra la app mientras la opción no exista: si lleva ya el botón con un aviso de «no disponible», como la web («SSO no disponible en el prototipo»), o no lo muestra.

## Fuera de alcance
- La respuesta actual del servidor mientras esta capacidad no existe: historia vigente de la API en esta épica.
