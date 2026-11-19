---
id: US-REQ-FLUJO-001
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[API] Dar un paso válido de la máquina de estados con el rol que lo puede dar"
etiquetas: [api]
relacionadas: [US-REQ-FLUJO-002, US-REQ-FLUJO-003, US-REQ-FLUJO-004, US-REQ-FLUJO-005, US-REQ-FLUJO-006, US-REQ-EDICION-003]
verificacion: ejecutada
cubre: ["POST /api/requirements/:code/transition"]
permisos: [requirement.approve, requirement.verify, requirement.validate]
---

## Historia
Como cliente de la API con una cuenta de gestión de requisitos, quiero pedir el paso siguiente de un requisito, o devolverlo a borrador, con el permiso que corresponde a mi rol,
para que avance por sus estados y reciba el requisito con su estado nuevo.

## Reglas
- `POST /api/requirements/:code/transition` exige una sesión de acceso y recibe `to`, con uno de los cuatro estados: `draft`, `approved`, `verified` o `validated`.
- La escalera de estados es `draft` → `approved` → `verified` → `validated`. Hay seis pasos válidos: cada estado al siguiente y volver a `draft` desde cualquiera de los otros tres.
- Cada paso exige un permiso de `PERMISSIONS` (`packages/shared/src/permissions.ts`):
  - `draft` → `approved`: `requirement.approve`, que tienen `admin` y `program_manager`.
  - `approved` → `verified`: `requirement.verify`, que tienen `admin` y `consultant`.
  - `verified` → `validated`: `requirement.validate`, que tienen `admin` y `auditor`.
  - Volver a `draft` (`approved`, `verified` o `validated` → `draft`): `requirement.approve`, que tienen `admin` y `program_manager`.
- Con un paso válido y un rol que lo puede dar, la respuesta es 200 con el requisito completo: mismo código, mismo programa, mismo padre, mismo título, descripción, prioridad, etiquetas y posición, y el campo `state` con el estado nuevo.
- La cuenta `alumno01@sigpro.lab` (rol `admin`, sin segundo factor) puede dar los seis pasos. Las cuentas de la fila son las del seed: `gestor@sigpro.test` (`Gestor1234!`, `program_manager`), `consultor@sigpro.test` (`Consul1234!`, `consultant`), `auditor@sigpro.test` (`Audit1234!`, `auditor`) y `alumno01@sigpro.lab` (`Alumno1234!`). `admin@sigpro.test` tiene segundo factor y no se usa en este flujo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab`. Después, la cuenta de la fila inicia sesión en `alumno01` con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa el `accessToken` que recibe. Tras el reinicio, los estados de partida son los del seed: `REQ-001` en `approved`, `REQ-002` en `verified` y `REQ-003` en `validated` (en `PRG-001`), y `REQ-017` en `draft` (en `PRG-002`).

## Criterios de aceptación
```gherkin
Característica: Pasos válidos del flujo de estados por la API

  Esquema del escenario: Un paso válido cambia el estado del requisito y responde 200
    Dado que en el tenant alumno01, recién reiniciado, <requisito> está en estado <desde> y <cuenta> ha iniciado sesión en ese tenant
    Cuando envía POST /api/requirements/<requisito>/transition con el cuerpo {"to": "<hasta>"}
    Entonces la respuesta es 200 y trae el requisito <requisito> con el estado <hasta>
    Y una lectura posterior de <requisito> devuelve el estado <hasta>

    Ejemplos:
      | requisito | desde | cuenta | hasta |
      | REQ-017 | draft | gestor@sigpro.test | approved |
      | REQ-001 | approved | consultor@sigpro.test | verified |
      | REQ-002 | verified | auditor@sigpro.test | validated |
      | REQ-001 | approved | gestor@sigpro.test | draft |
      | REQ-002 | verified | gestor@sigpro.test | draft |
      | REQ-003 | validated | gestor@sigpro.test | draft |
      | REQ-017 | draft | alumno01@sigpro.lab | approved |
      | REQ-001 | approved | alumno01@sigpro.lab | draft |
```

## Fuera de alcance
- Los pasos que no existen (409) y los que el rol no puede dar (403): en esta misma épica, en sus historias de la API.
- Los datos del requisito que se leen en el árbol y en el detalle: EP-REQ-ARBOL.
- Editar el título o la descripción, que devuelve el requisito a borrador por otra vía: EP-REQ-EDICION.
- El registro de auditoría como pantalla: EP-AUDITORIA.

## Decisiones pendientes
- Si un programa archivado (estado «Cerrado») admite pasos de estado de sus requisitos. Hoy la API no lo comprueba: el paso se acepta igual que en un programa activo. Ni el plan ni las decisiones del proyecto lo fijan, así que ningún ejemplo de esta historia lo afirma ni lo excluye.
