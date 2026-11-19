---
id: US-REQ-FLUJO-012
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[Android] Cerrar la confirmación del cambio de estado con el botón atrás del sistema"
etiquetas: [android]
relacionadas: [US-REQ-FLUJO-010, US-REQ-FLUJO-011]
verificacion: pendiente-nativo
---

## Historia
Como persona que usa la app móvil en Android, quiero que el botón atrás del teléfono cierre la confirmación de un cambio de estado sin hacerlo,
para echarme atrás con el gesto habitual del sistema sin cambiar el requisito por error.

## Reglas
- En Android, el botón atrás del sistema cierra la confirmación del cambio de estado y el requisito conserva su estado, igual que «Cancelar».
- La confirmación se abre encima de la hoja del requisito. La primera pulsación del botón atrás cierra solo la confirmación, y la hoja del requisito sigue abierta con su estado.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la app está en /login sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y la persona se identifica como `gestor@sigpro.test` (`Gestor1234!`) o `consultor@sigpro.test` (`Consul1234!`). Tras el reinicio, `REQ-017` está en Borrador (en `PRG-002`) y `REQ-001` en Aprobado (en `PRG-001`).

## Criterios de aceptación
```gherkin
Característica: Botón atrás de Android en la confirmación del cambio de estado

  Esquema del escenario: El botón atrás cierra solo la confirmación y el requisito conserva su estado
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo», tiene abierta la hoja de <requisito> en /programs/<programa>/requirements, que muestra el estado <estado>, y ha pulsado <boton> para abrir la confirmación
    Cuando pulsa el botón atrás del sistema
    Entonces la confirmación se cierra y la hoja de <requisito> sigue abierta
    Y la hoja sigue mostrando el estado <estado>

    Ejemplos:
      | cuenta | requisito | programa | estado | boton |
      | gestor@sigpro.test | REQ-017 | PRG-002 | Borrador | «Aprobar» |
      | consultor@sigpro.test | REQ-001 | PRG-001 | Aprobado | «Marcar como verificado» |
```

## Fuera de alcance
- La confirmación y el aviso de éxito o de error fuera de Android: en esta misma épica, en las historias de la app móvil.
- Los botones de transición y sus motivos: en esta misma épica, en la historia de los botones de la app móvil.
