---
id: US-REQ-FLUJO-006
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[Web] Mostrar en el paso actual los botones de transición, habilitados o con su motivo"
etiquetas: [web]
relacionadas: [US-REQ-FLUJO-001, US-REQ-FLUJO-007, US-REQ-FLUJO-009, US-REQ-ARBOL-005]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
permisos: [requirement.approve, requirement.verify, requirement.validate]
---

## Historia
Como persona que trabaja con requisitos en la web, quiero ver en el detalle de un requisito solo los botones que llevan al siguiente paso de su estado, y saber por qué un botón no me deja pulsarlo,
para avanzar un requisito sin tener que adivinar qué le toca a mi rol.

## Reglas
- El detalle de un requisito muestra el flujo de aprobación en sus cuatro pasos: Redacción, Aprobación, Verificación y Validación. Solo el paso que corresponde al estado actual contiene botones de transición: Redacción para `draft`, Aprobación para `approved`, Verificación para `verified` y Validación para `validated`.
- Botones de cada paso:
  - Redacción (estado `draft`): «Aprobar».
  - Aprobación (estado `approved`): «Marcar como verificado» y «Volver a borrador».
  - Verificación (estado `verified`): «Validar» y «Volver a borrador».
  - Validación (estado `validated`): «Volver a borrador».
- Un botón que el rol no puede pulsar está deshabilitado. Al pasar el puntero sobre él aparece su explicación, según el paso al que lleva: «Solo el gestor de programa o el admin pueden aprobar», «Solo el consultor o el admin pueden verificar», «Solo el auditor o el admin pueden validar» o «Solo el gestor de programa o el admin pueden devolver a borrador».
- Un botón habilitado no lleva explicación.
- Permisos que deciden cada botón: «Aprobar» y «Volver a borrador» exigen `requirement.approve`; «Marcar como verificado» exige `requirement.verify`; «Validar» exige `requirement.validate`. Los roles con cada permiso son los de `PERMISSIONS`: `admin` y `program_manager` para aprobar, `admin` y `consultant` para verificar, y `admin` y `auditor` para validar.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, escribe la cuenta y su contraseña y pulsa «Entrar». Las cuentas son las del seed: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y `alumno01@sigpro.lab` (`Alumno1234!`). Tras el reinicio, `REQ-001` está en Aprobado, `REQ-002` en Verificado y `REQ-003` en Validado (en `PRG-001`), y `REQ-017` en Borrador (en `PRG-002`). Se abre el detalle del requisito desde su fila en `/programs/<programa>/requirements`.

## Criterios de aceptación
```gherkin
Característica: Botones de transición en el detalle de un requisito en la web

  Esquema del escenario: Solo el paso actual del flujo contiene los botones de transición
    Dado que el tenant alumno01 está recién reiniciado y una persona ha iniciado sesión como alumno01@sigpro.lab en /login?tenant=alumno01 y tiene abierto el detalle de <requisito> en /programs/<programa>/requirements
    Cuando mira el flujo de aprobación del detalle
    Entonces el paso actual es <paso> y contiene los botones <botones>
    Y ningún otro paso contiene botones de transición

    Ejemplos:
      | requisito | programa | paso | botones |
      | REQ-017 | PRG-002 | Redacción | «Aprobar» |
      | REQ-001 | PRG-001 | Aprobación | «Marcar como verificado» y «Volver a borrador» |
      | REQ-002 | PRG-001 | Verificación | «Validar» y «Volver a borrador» |
      | REQ-003 | PRG-001 | Validación | «Volver a borrador» |

  Esquema del escenario: Un botón que el rol no puede pulsar queda deshabilitado con su explicación
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de <requisito> en /programs/<programa>/requirements
    Cuando mira el botón <boton> del paso actual
    Entonces el botón <habilitado>
    Y la explicación del botón es <explicacion>

    Ejemplos:
      | cuenta | requisito | programa | boton | habilitado | explicacion |
      | gestor@sigpro.test | REQ-017 | PRG-002 | «Aprobar» | está habilitado | (ninguna) |
      | auditor@sigpro.test | REQ-017 | PRG-002 | «Aprobar» | está deshabilitado | «Solo el gestor de programa o el admin pueden aprobar» |
      | gestor@sigpro.test | REQ-001 | PRG-001 | «Marcar como verificado» | está deshabilitado | «Solo el consultor o el admin pueden verificar» |
      | consultor@sigpro.test | REQ-001 | PRG-001 | «Volver a borrador» | está deshabilitado | «Solo el gestor de programa o el admin pueden devolver a borrador» |
      | auditor@sigpro.test | REQ-002 | PRG-001 | «Validar» | está habilitado | (ninguna) |
      | consultor@sigpro.test | REQ-002 | PRG-001 | «Validar» | está deshabilitado | «Solo el auditor o el admin pueden validar» |
```

## Fuera de alcance
- La lectura del árbol, el detalle y las cifras de los requisitos, sin sus botones: EP-REQ-ARBOL.
- Qué ocurre al confirmar el cambio y el aviso de éxito: en esta misma épica, en la parte de la web dedicada a la confirmación.
- El error del servidor al confirmar: en esta misma épica, en la parte de la web dedicada a los errores.
- La matriz de trazabilidad: EP-REQ-TRAZA.
