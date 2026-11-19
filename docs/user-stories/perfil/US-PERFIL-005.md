---
id: US-PERFIL-005
tipo: historia
epica: EP-PERFIL
titulo: "[Móvil] El botón «Guardar» del perfil alterna su texto con los textos alternos, como en la web"
etiquetas: [movil, no-implementada]
relacionadas: [US-PERFIL-002, US-PERFIL-004]
verificacion: no-ejecutable
---

## Historia
Como persona que prueba SIGPRO con los textos alternos del modo caos activados, quiero que el botón «Guardar» de «Perfil» en la app móvil cambie de texto como lo hace en la web,
para encontrar el mismo comportamiento en las dos plataformas al preparar mis pruebas.

## Reglas
- En la web, con los textos alternos del modo caos activados, el botón «Guardar» de «Perfil» alterna entre «Guardar» y «Guardar cambios» mientras el modo está activo. Con el modo desactivado, muestra siempre «Guardar».
- La app móvil debe hacer lo mismo en el mismo botón: con los textos alternos activados, alterna entre «Guardar» y «Guardar cambios», y con ellos desactivados muestra siempre «Guardar».
- Con el texto de cualquiera de los dos estados, pulsar el botón guarda las preferencias y muestra el aviso «Preferencias guardadas», igual que en la web.
- Esta historia no cubre los demás botones «Guardar» de la app móvil.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Los textos alternos se activan o se desactivan con `PATCH /api/admin/chaos` (`flakyLabels` en `true` o en `false`, con el token del administrador del tenant) antes de abrir «Perfil», y el resto del caos debe estar apagado. Después la app se abre sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y la cuenta `gestor@sigpro.test` inicia sesión con `Gestor1234!`.

## Criterios de aceptación
```gherkin
Característica: Textos alternos del botón Guardar del perfil en la app móvil

  Esquema del escenario: El botón «Guardar» del perfil alterna su texto según los textos alternos del modo caos
    Dado que el tenant alumno01 está recién reiniciado, con los textos alternos del modo caos <modo>, y gestor@sigpro.test ha iniciado sesión con Gestor1234! en la app, con alumno01 en «Tenant de trabajo», y ha cambiado «Tema» a «Oscuro» sin pulsar «Guardar» en «Perfil»
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | modo | accion | resultado |
      | activados | observa el botón «Guardar» durante el tiempo que elige la prueba | su texto alterna entre «Guardar» y «Guardar cambios» |
      | desactivados | observa el botón «Guardar» durante el tiempo que elige la prueba | su texto es siempre «Guardar» |
      | activados | pulsa el botón con el texto que tiene en ese momento | ve el aviso «Preferencias guardadas» |
```

## Fuera de alcance
- Activar y desactivar los textos alternos del modo caos, y sus demás efectos: la épica de Administración.
- Los textos alternos de los demás botones «Guardar» de la app móvil: la misma épica de Administración, cuando se escriba su paridad.
- Las preferencias del perfil que sí existen en la app móvil: US-PERFIL-004, de esta misma épica.

## Decisiones pendientes
- Si los demás botones «Guardar» de la app móvil (Programas, Requisitos y No conformidades) deben alternar sus textos igual que en la web. Hoy ninguno lo hace en la app móvil.
- Si el ritmo del cambio de texto debe ser el de la web o uno propio de la app móvil.
