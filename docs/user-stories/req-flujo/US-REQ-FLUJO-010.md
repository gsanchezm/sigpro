---
id: US-REQ-FLUJO-010
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[Móvil] Mostrar en la hoja del requisito los botones de transición y sus motivos"
etiquetas: [movil]
relacionadas: [US-REQ-FLUJO-006, US-REQ-FLUJO-011, US-REQ-FLUJO-012, US-REQ-ARBOL-010]
verificacion: ejecutada
cubre: ["/programs/:code/requirements"]
permisos: [requirement.approve, requirement.verify, requirement.validate]
---

## Historia
Como persona que trabaja con requisitos desde el móvil, quiero que la hoja de un requisito me ofrezca solo el paso que sigue a su estado, y que me diga en pantalla por qué un botón no se puede pulsar,
para avanzar un requisito desde el móvil con la misma claridad que en la web.

## Reglas
- La hoja del requisito, que se abre al pulsar su fila en `/programs/<programa>/requirements`, muestra el flujo de aprobación en sus cuatro pasos: Redacción, Aprobación, Verificación y Validación. Solo el paso que corresponde al estado actual contiene botones de transición, con los mismos textos que en la web.
- Botones de cada paso:
  - Redacción (estado `draft`): «Aprobar».
  - Aprobación (estado `approved`): «Marcar como verificado» y «Volver a borrador».
  - Verificación (estado `verified`): «Validar» y «Volver a borrador».
  - Validación (estado `validated`): «Volver a borrador».
- Un botón que el rol no puede pulsar está deshabilitado y, debajo de él, se lee su motivo, siempre visible: «Solo el gestor de programa o el admin pueden aprobar», «Solo el consultor o el admin pueden verificar», «Solo el auditor o el admin pueden validar» o «Solo el gestor de programa o el admin pueden devolver a borrador», según el paso al que lleva.
- Un botón habilitado no lleva motivo debajo.
- Permisos que deciden cada botón: «Aprobar» y «Volver a borrador» exigen `requirement.approve`; «Marcar como verificado» exige `requirement.verify`; «Validar» exige `requirement.validate`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la app está en /login sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo», y la persona se identifica con su cuenta y su contraseña: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o `alumno01@sigpro.lab` (`Alumno1234!`). Tras el reinicio, `REQ-001` está en Aprobado, `REQ-002` en Verificado y `REQ-003` en Validado (en `PRG-001`), y `REQ-017` en Borrador (en `PRG-002`).

## Criterios de aceptación
```gherkin
Característica: Botones de transición en la hoja del requisito en la app móvil

  Esquema del escenario: Solo el paso actual de la hoja contiene los botones de transición
    Dado que el tenant alumno01 está recién reiniciado y una persona ha iniciado sesión en la app como alumno01@sigpro.lab con alumno01 en «Tenant de trabajo» y tiene abierta la hoja de <requisito> en /programs/<programa>/requirements
    Cuando mira el flujo de aprobación de la hoja
    Entonces el paso actual es <paso> y contiene los botones <botones>
    Y ningún otro paso contiene botones de transición

    Ejemplos:
      | requisito | programa | paso | botones |
      | REQ-017 | PRG-002 | Redacción | «Aprobar» |
      | REQ-001 | PRG-001 | Aprobación | «Marcar como verificado» y «Volver a borrador» |
      | REQ-002 | PRG-001 | Verificación | «Validar» y «Volver a borrador» |
      | REQ-003 | PRG-001 | Validación | «Volver a borrador» |

  Esquema del escenario: Un botón que el rol no puede pulsar queda deshabilitado con su motivo a la vista
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierta la hoja de <requisito> en /programs/<programa>/requirements
    Cuando mira el botón <boton> del paso actual
    Entonces el botón <habilitado>
    Y el motivo visible debajo del botón es <motivo>

    Ejemplos:
      | cuenta | requisito | programa | boton | habilitado | motivo |
      | gestor@sigpro.test | REQ-017 | PRG-002 | «Aprobar» | está habilitado | (ninguno) |
      | auditor@sigpro.test | REQ-017 | PRG-002 | «Aprobar» | está deshabilitado | «Solo el gestor de programa o el admin pueden aprobar» |
      | gestor@sigpro.test | REQ-001 | PRG-001 | «Marcar como verificado» | está deshabilitado | «Solo el consultor o el admin pueden verificar» |
      | consultor@sigpro.test | REQ-001 | PRG-001 | «Volver a borrador» | está deshabilitado | «Solo el gestor de programa o el admin pueden devolver a borrador» |
      | auditor@sigpro.test | REQ-002 | PRG-001 | «Validar» | está habilitado | (ninguno) |
      | consultor@sigpro.test | REQ-002 | PRG-001 | «Validar» | está deshabilitado | «Solo el auditor o el admin pueden validar» |
```

## Fuera de alcance
- La lectura de la hoja del requisito: EP-REQ-ARBOL.
- La confirmación del cambio y su aviso de éxito o de error: en esta misma épica, en las historias de la confirmación de la app móvil.
- La edición, el borrado y el movimiento de un requisito desde la hoja: EP-REQ-EDICION.
- Los casos de prueba enlazados y la matriz de trazabilidad: EP-REQ-TRAZA.
