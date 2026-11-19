---
id: US-REQ-FLUJO-003
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[API] Rechazar con 403 forbidden un paso válido que el rol no puede dar"
etiquetas: [api]
relacionadas: [US-REQ-FLUJO-001, US-REQ-FLUJO-002, US-REQ-FLUJO-004, US-REQ-FLUJO-005]
verificacion: ejecutada
cubre: ["POST /api/requirements/:code/transition"]
permisos: [requirement.approve, requirement.verify, requirement.validate]
---

## Historia
Como responsable de que cada paso lo dé quien corresponde, quiero que una cuenta que no tiene el permiso de un paso válido reciba un rechazo claro,
para que la aprobación, la verificación y la validación de un requisito no las pueda hacer quien no debe.

## Reglas
- Cada paso válido exige un permiso: `draft` → `approved` exige `requirement.approve`; `approved` → `verified` exige `requirement.verify`; `verified` → `validated` exige `requirement.validate`; y volver a `draft` desde `approved`, `verified` o `validated` exige `requirement.approve`.
- Quien no tiene ese permiso recibe 403 con el código `forbidden`, y el requisito no cambia.
- Por rol, en la matriz de `PERMISSIONS`: `consultant` no aprueba, no valida y no vuelve a borrador; `program_manager` no verifica y no valida; `auditor` no aprueba, no verifica y no vuelve a borrador.
- Un rol con el permiso del paso no recibe 403 en él. La cuenta `alumno01@sigpro.lab` (`admin`) tiene los tres permisos.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la cuenta de la fila inicia sesión en `alumno01` con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken`. Las cuentas son las del seed: `gestor@sigpro.test` (`Gestor1234!`, `program_manager`), `consultor@sigpro.test` (`Consul1234!`, `consultant`) y `auditor@sigpro.test` (`Audit1234!`, `auditor`). Tras el reinicio, `REQ-001` está en `approved`, `REQ-002` en `verified` y `REQ-003` en `validated` (en `PRG-001`), y `REQ-017` en `draft` (en `PRG-002`).

## Criterios de aceptación
```gherkin
Característica: Permisos por paso del flujo de estados por la API

  Esquema del escenario: Un rol sin el permiso del paso recibe 403 y el estado no cambia
    Dado que en el tenant alumno01, recién reiniciado, <requisito> está en estado <desde> y <cuenta> ha iniciado sesión en ese tenant
    Cuando envía POST /api/requirements/<requisito>/transition con el cuerpo {"to": "<hasta>"}
    Entonces la respuesta es 403 con el código forbidden
    Y una lectura posterior de <requisito> devuelve el estado <desde>

    Ejemplos:
      | requisito | desde | cuenta | hasta |
      | REQ-017 | draft | consultor@sigpro.test | approved |
      | REQ-017 | draft | auditor@sigpro.test | approved |
      | REQ-001 | approved | gestor@sigpro.test | verified |
      | REQ-001 | approved | auditor@sigpro.test | verified |
      | REQ-002 | verified | gestor@sigpro.test | validated |
      | REQ-002 | verified | consultor@sigpro.test | validated |
      | REQ-001 | approved | consultor@sigpro.test | draft |
      | REQ-002 | verified | auditor@sigpro.test | draft |
      | REQ-003 | validated | consultor@sigpro.test | draft |
```

## Fuera de alcance
- Los pasos que el flujo no tiene (409) y el orden entre ambas comprobaciones: en esta misma épica, en sus historias de la API.
- Los permisos de alta, edición, reordenación y borrado de requisitos: EP-REQ-EDICION.
- Los botones que un rol ve deshabilitados en la pantalla: en esta misma épica, en sus historias de la web y de la app móvil.
