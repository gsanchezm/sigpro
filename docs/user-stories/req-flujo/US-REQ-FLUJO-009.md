---
id: US-REQ-FLUJO-009
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[Web] Leer el estado con su nombre y el flujo de aprobación en sus cuatro pasos"
etiquetas: [web]
relacionadas: [US-REQ-FLUJO-006, US-REQ-FLUJO-007]
verificacion: ejecutada
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona que revisa el avance de los requisitos en la web, quiero leer el estado de un requisito con su nombre y ver de un vistazo en qué paso del flujo de aprobación está,
para saber qué falta para que se considere validado sin abrir ningún otro dato.

## Reglas
- El detalle de un requisito muestra su estado con el nombre en texto visible: Borrador para `draft`, Aprobado para `approved`, Verificado para `verified` y Validado para `validated`.
- El flujo de aprobación tiene cuatro pasos, en este orden: Redacción, Aprobación, Verificación y Validación. Redacción corresponde a Borrador, Aprobación a Aprobado, Verificación a Verificado y Validación a Validado.
- Los pasos anteriores al estado actual figuran como hechos, con ✓ en el punto del paso, en lugar de su número. El paso del estado actual figura como paso actual. Los posteriores figuran como pendientes.
- Un requisito en Borrador tiene el primer paso como actual; uno en Validado tiene todos los pasos anteriores hechos y el último como actual. No hay ningún estado en el que el flujo quede sin paso actual.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada y se identifica como `gestor@sigpro.test` (`Gestor1234!`). Tras el reinicio, `REQ-017` está en Borrador (en `PRG-002`), `REQ-001` en Aprobado, `REQ-002` en Verificado y `REQ-003` en Validado (estos tres en `PRG-001`).

## Criterios de aceptación
```gherkin
Característica: Estado con su nombre y flujo de aprobación en el detalle de la web

  Esquema del escenario: El estado y los cuatro pasos del flujo muestran el avance del requisito
    Dado que el tenant alumno01 está recién reiniciado, una persona ha iniciado sesión como gestor@sigpro.test en /login?tenant=alumno01 y tiene abierto el detalle de <requisito> en /programs/<programa>/requirements
    Cuando mira el estado y el flujo de aprobación del detalle
    Entonces el estado se lee <estado>
    Y los cuatro pasos del flujo figuran así: Redacción <redaccion>, Aprobación <aprobacion>, Verificación <verificacion> y Validación <validacion>

    Ejemplos:
      | requisito | programa | estado | redaccion | aprobacion | verificacion | validacion |
      | REQ-017 | PRG-002 | Borrador | paso actual | pendiente | pendiente | pendiente |
      | REQ-001 | PRG-001 | Aprobado | hecho | paso actual | pendiente | pendiente |
      | REQ-002 | PRG-001 | Verificado | hecho | hecho | paso actual | pendiente |
      | REQ-003 | PRG-001 | Validado | hecho | hecho | hecho | paso actual |
```

## Fuera de alcance
- Los botones de transición de cada paso y sus explicaciones: en esta misma épica, en la historia de los botones de la web.
- El cambio de estado y su aviso: en esta misma épica, en la historia de la confirmación de la web.
- Las cifras del programa, el árbol y la columna de estado de la lista: EP-REQ-ARBOL.
