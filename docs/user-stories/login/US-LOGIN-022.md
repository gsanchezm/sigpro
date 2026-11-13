---
id: US-LOGIN-022
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Acceder con certificado digital o SSO"
etiquetas: [web, no-implementada]
relacionadas: [US-LOGIN-010, US-LOGIN-021, US-LOGIN-035]
verificacion: no-ejecutable
---

## Historia
Como persona de una organización con identidad corporativa, quiero entrar en SIGPRO con mi certificado digital o con el inicio de sesión único de mi organización,
para no tener una contraseña más que recordar.

## Reglas
- «Acceder con certificado digital / SSO» lleva al proveedor de identidad de la organización; al volver identificada, la persona entra en /programs sin escribir la contraseña de SIGPRO.
- La identidad del proveedor se asocia a la cuenta de SIGPRO con el mismo correo en el tenant de trabajo, y la sesión entra con el rol de esa cuenta.
- Los estados de la cuenta se respetan igual que con la contraseña: una cuenta bloqueada, pendiente de aprobación o desactivada no entra y ve su aviso de siempre.
- Si la persona cancela en el proveedor de identidad, vuelve a /login sin sesión y sin ningún aviso de error.

## Criterios de aceptación
```gherkin
Característica: Acceso con SSO en la web

  Esquema del escenario: La identidad corporativa abre la sesión de su cuenta
    Dado una persona sin sesión en /login cuya identidad corporativa es "<identidad>"
    Cuando pulsa "Acceder con certificado digital / SSO" y <accion> en el proveedor de identidad
    Entonces <resultado>

    Ejemplos:
      | identidad | accion | resultado |
      | gestor@sigpro.test | se identifica | llega a /programs con el rol program_manager |
      | consultor@sigpro.test | se identifica | llega a /programs con el rol consultant |
      | bloqueado@sigpro.test | se identifica | vuelve a /login y ve "Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador." |
      | pendiente@sigpro.test | se identifica | vuelve a /login y ve "Cuenta pendiente de aprobación. Revisa tu correo." |
      | gestor@sigpro.test | cancela | vuelve a /login sin sesión y sin ningún aviso de error |
```

## Fuera de alcance
- La configuración del proveedor de identidad de cada organización.
- La respuesta actual del servidor mientras el SSO no existe (US-LOGIN-010) y el aviso actual de la web (US-LOGIN-021).
