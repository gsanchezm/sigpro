---
id: US-MISION-KPI-002
tipo: historia
epica: EP-MISION-KPI
titulo: "[API] Resumen de misión: datos de las gráficas de avance por programa y de NC por severidad"
etiquetas: [api]
relacionadas: [US-MISION-KPI-001, US-MISION-KPI-007, US-MISION-KPI-011]
verificacion: codigo
cubre: ["GET /api/mission/summary"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero recibir en el resumen de misión los hitos cumplidos de cada programa activo y las no conformidades abiertas por severidad,
para dibujar las dos gráficas del panel con los mismos números que sus indicadores.

## Reglas
- `milestonesByProgram` lista, por orden de código ascendente, como mucho ocho programas: los programas en estado activo que tienen al menos un hito. Un programa en borrador, en pausa, cerrado (también un programa archivado) o cancelado no aparece, aunque tenga hitos. Un programa activo sin hitos tampoco aparece.
- Cada elemento de `milestonesByProgram` trae `programCode` (código del programa), `programName` (nombre del programa), `done` (hitos cumplidos) y `total` (hitos del programa, cumplidos o no).
- `ncBySeverity` cuenta por severidad las no conformidades abiertas, es decir, las que no están cerradas ni rechazadas: `minor` (menor), `major` (mayor) y `critical` (crítica). La suma de las tres claves es igual a `kpis.ncOpen`.
- Cambiar la severidad de una no conformidad abierta la mueve de una clave a otra, y el número de la clave anterior baja en una unidad.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`, obtenido con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`). Antes de cada fila, el caos del tenant debe estar apagado. Los cambios de programas y de no conformidades de una fila se hacen con ese mismo token, que tiene el rol de administrador y no tiene segundo factor.
- Con el reinicio, el tenant tiene 24 programas (`PRG-001` a `PRG-024`), de los que 12 están activos, y 12 no conformidades (`NC-001` a `NC-012`), de las que 8 están abiertas: `NC-001` (menor, abierta), `NC-002` (mayor, en análisis), `NC-003` (crítica, con acción correctiva), `NC-006` (crítica, abierta), `NC-007` (menor, abierta), `NC-008` (mayor, en análisis), `NC-009` (crítica, con acción correctiva) y `NC-012` (crítica, abierta).

## Criterios de aceptación
```gherkin
Característica: Datos de las gráficas de misión en el resumen

  Esquema del escenario: Los ocho primeros programas activos con hitos, en orden de código
    Dado que en el tenant alumno01, recién reiniciado, existen los 24 programas del seed
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant alumno01
    Entonces el elemento <posicion> de milestonesByProgram tiene programCode <programa>, programName <nombre>, done <cumplidos> y total <total>

    Ejemplos:
      | posicion | programa | nombre | cumplidos | total |
      | 1 | PRG-001 | Sistema de mando táctico Ártemis | 1 | 9 |
      | 2 | PRG-002 | Radar de vigilancia costera RVC-2 | 3 | 6 |
      | 3 | PRG-005 | Centro de control de misión CCM | 3 | 5 |
      | 4 | PRG-007 | Sensor electroóptico EO-7 | 2 | 6 |
      | 5 | PRG-009 | Vehículo blindado modular VBM | 1 | 10 |
      | 6 | PRG-010 | Suite de guerra electrónica SGE | 4 | 9 |
      | 7 | PRG-013 | Sonar pasivo remolcado SPR-3 | 5 | 9 |
      | 8 | PRG-015 | Torre de control móvil TCM | 2 | 7 |

  Esquema del escenario: Un programa que deja de estar activo sale de la gráfica y entra el siguiente
    Dado que en el tenant alumno01, recién reiniciado, <cambio>
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant alumno01
    Entonces milestonesByProgram tiene <elementos> elementos, el primero es <primero> y el último es <ultimo> con done <cumplidos_ultimo> y total <total_ultimo>

    Ejemplos:
      | cambio | elementos | primero | ultimo | cumplidos_ultimo | total_ultimo |
      | no hay ningún cambio en los programas | 8 | PRG-001 | PRG-015 | 2 | 7 |
      | alumno01@sigpro.lab archiva PRG-001 con POST /api/programs/PRG-001/archive | 8 | PRG-002 | PRG-017 | 0 | 5 |

  Esquema del escenario: Un programa que no está activo no aparece en la gráfica, aunque tenga hitos
    Dado que en el tenant alumno01, recién reiniciado, <programa> tiene el estado <estado> y tiene hitos
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant alumno01
    Entonces <programa> no aparece en milestonesByProgram

    Ejemplos:
      | programa | estado |
      | PRG-003 | borrador |
      | PRG-006 | cerrado |

  Esquema del escenario: Las no conformidades abiertas se reparten por severidad
    Dado que en el tenant alumno01, recién reiniciado, <cambio>
    Cuando envía GET /api/mission/summary con el accessToken de alumno01@sigpro.lab y la cabecera x-tenant alumno01
    Entonces ncBySeverity tiene minor <menor>, major <mayor> y critical <critica>, y su suma es igual a kpis.ncOpen

    Ejemplos:
      | cambio | menor | mayor | critica |
      | no hay ningún cambio en las no conformidades | 2 | 2 | 4 |
      | alumno01@sigpro.lab cambia con PATCH /api/nc/NC-001 la severidad a `critical` | 1 | 2 | 5 |
      | alumno01@sigpro.lab pasa NC-002 a `rejected` con POST /api/nc/NC-002/transition | 2 | 1 | 4 |
      | alumno01@sigpro.lab pasa NC-003 a `closed` con POST /api/nc/NC-003/transition y el comentario `Acción correctiva verificada por calidad` | 2 | 2 | 3 |
      | alumno01@sigpro.lab registra con POST /api/nc una NC en PRG-002 con severidad `major` y la descripción `Desviación de prueba en la ejecución` | 2 | 3 | 4 |
```

## Fuera de alcance
- Las cifras de la cabecera del resumen (`kpis`) y las transiciones de las no conformidades: EP-MISION-KPI y EP-NC-TABLERO, respectivamente.
- Las cuatro tarjetas de la cabecera de la lista de programas: EP-PROG-METRICAS.
- El aspecto de las gráficas en pantalla: US-MISION-KPI-007 (web) y US-MISION-KPI-011 (móvil), de esta misma épica.
