---
id: US-MISION-KPI-003
tipo: historia
epica: EP-MISION-KPI
titulo: "[API] Resumen de misión: verificación superada por caso de prueba"
etiquetas: [api]
relacionadas: [US-MISION-KPI-006, US-MISION-KPI-010]
verificacion: ejecutada
cubre: ["GET /api/mission/summary"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero que el resumen de misión indique qué parte de los casos de prueba con ejecuciones tiene como último resultado «Superado»,
para mostrar en el panel la verificación superada del tenant.

## Reglas
- `verificationPass` es el porcentaje de los casos con ejecuciones cuyo último resultado es `pass` («Superado»), redondeado al entero más próximo (0,5 se redondea hacia arriba). Sin casos con ejecuciones, vale 0.
- El último resultado de un caso es el de su ejecución más reciente por fecha de ejecución y, si dos empatan, por identificador de ejecución mayor.
- `casesWithRuns` cuenta los casos que tienen al menos una ejecución, sea cual sea su último resultado. Un resultado `fail` o `blocked` cuenta como no superado.
- Con el reinicio, el tenant tiene 25 casos de prueba (`TC-001` a `TC-025`), todos con ejecuciones, y 14 de ellos tienen como último resultado «Superado»: `verificationPass` vale 56 y `casesWithRuns` vale 25. Los casos `TC-001`, `TC-002` y `TC-003` tienen como último resultado `blocked`, `fail` y `pass`, en ese orden.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`, obtenido con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`). Antes de cada fila, el caos del tenant debe estar apagado. Cada ejecución nueva se registra con `POST /api/test-cases/<código>/runs` con ese mismo token, como formulario multipart con el campo `result`.

## Criterios de aceptación
```gherkin
Característica: Verificación superada en el resumen de misión

  Esquema del escenario: La verificación superada cuenta el último resultado de cada caso
    Dado que en el tenant alumno01, recién reiniciado, <cambio>
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant alumno01
    Entonces en kpis verificationPass vale <porcentaje> y casesWithRuns vale <casos>

    Ejemplos:
      | cambio | porcentaje | casos |
      | no hay ningún cambio en las ejecuciones | 56 | 25 |
      | alumno01@sigpro.lab ejecuta TC-001 con POST /api/test-cases/TC-001/runs y el resultado `pass` | 60 | 25 |
      | alumno01@sigpro.lab ejecuta TC-002 con POST /api/test-cases/TC-002/runs y el resultado `blocked` | 56 | 25 |
      | alumno01@sigpro.lab ejecuta TC-003 con POST /api/test-cases/TC-003/runs y el resultado `fail` | 52 | 25 |
```

## Fuera de alcance
- La pantalla de casos de prueba, su detalle y el informe de verificación: EP-VER-CASOS y EP-VER-INFORME.
- Registrar ejecuciones y subir sus evidencias: EP-VER-EJECUCION.
- El aspecto de la cifra en las tarjetas: US-MISION-KPI-006 (web) y US-MISION-KPI-010 (móvil), de esta misma épica.
