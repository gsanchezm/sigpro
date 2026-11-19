---
id: US-VER-INFORME-003
tipo: historia
epica: EP-VER-INFORME
titulo: "[API] Contenido del PDF: resumen por resultado y una ficha por caso"
etiquetas: [api]
relacionadas: [US-VER-INFORME-001, US-VER-INFORME-002, US-VER-CASOS-001]
verificacion: ejecutada
cubre: ["GET /api/verification/report"]
---

## Historia
Como persona que audita el plan de verificación, quiero que el informe PDF empiece por un resumen de cuántos casos hay, cuántos se han ejecutado y cuál es su último resultado, y que cada caso tenga su ficha,
para revisar el estado del plan sin abrir la aplicación.

## Reglas
- El PDF empieza por el encabezado «SIGPRO - Informe del plan de verificación», la línea de alcance («Todos los programas», «Programa <código>» o «Selección de <n> caso(s)», según la consulta), la línea «Generado el» con la fecha del día de la descarga, el título «Resumen» y dos líneas de recuento.
- Las dos líneas de recuento son «Casos de prueba: N · Ejecutados: E · Sin ejecutar: S» y «Último resultado - Superados: X · Fallidos: Y · Bloqueados: Z». N es el número de casos del alcance, E los que tienen al menos una ejecución y S es N menos E. X, Y y Z cuentan los casos cuyo último resultado es superado, fallido o bloqueado. Un caso sin ejecuciones no cuenta en X, Y ni Z.
- Después del resumen hay una ficha por caso, ordenadas por código ascendente. Cada ficha tiene, en este orden: «<código> · <título>»; «Programa <código de programa> · <nombre del programa>»; «Requisitos verificados: <códigos separados por coma, en orden ascendente>»; los pasos del caso numerados desde 1; «Esperado: <resultado esperado>»; y «Último resultado: <etiqueta> (<fecha>) · Ejecuciones: <número>».
- Las etiquetas del último resultado son «Superado», «Fallido», «Bloqueado» y «Sin ejecutar». La fecha es el día de la última ejecución, en formato AAAA-MM-DD. Un caso sin ejecuciones muestra un guion (-) en lugar de la fecha.
- Las fechas de «Generado el» y de las ejecuciones se calculan en UTC.
- Los pasos de los casos del seed son, en este orden: «Preparar el entorno de pruebas», «Ejecutar el escenario nominal» y «Registrar las mediciones». Su resultado esperado es «Los valores medidos cumplen el umbral definido en el requisito.».
- En el seed, cada caso tiene entre uno y dos requisitos enlazados, todos del mismo programa. Ningún caso del seed carece de requisitos.
- Tras reiniciar el tenant, el seed tiene 50 ejecuciones (entre una y tres por caso). Por programa, el último resultado es: `PRG-001`, 9 casos con 4 superados, 2 fallidos y 3 bloqueados; `PRG-002`, 9 casos con 6 superados, 2 fallidos y 1 bloqueado; `PRG-003`, 7 casos con 4 superados, 1 fallido y 2 bloqueados.
- Las líneas del informe son texto del documento, no imágenes: se pueden leer al extraer el texto del PDF.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y ese mismo token pide el informe con la consulta de la fila.

## Criterios de aceptación
```gherkin
Característica: Contenido del informe de verificación en PDF

  Esquema del escenario: El resumen cuenta los casos, las ejecuciones y los últimos resultados del alcance
    Dado que en el tenant alumno01, recién reiniciado, existen los casos de prueba del seed con sus ejecuciones
    Cuando envía GET /api/verification/report con <consulta> y el accessToken de alumno01@sigpro.lab
    Entonces el resumen dice «Casos de prueba: <casos> · Ejecutados: <ejecutados> · Sin ejecutar: <sin_ejecutar>»
    Y el resumen dice «Último resultado - Superados: <superados> · Fallidos: <fallidos> · Bloqueados: <bloqueados>»

    Ejemplos:
      | consulta | casos | ejecutados | sin_ejecutar | superados | fallidos | bloqueados |
      | (sin parámetros) | 25 | 25 | 0 | 14 | 5 | 6 |
      | program=PRG-001 | 9 | 9 | 0 | 4 | 2 | 3 |
      | program=PRG-002 | 9 | 9 | 0 | 6 | 2 | 1 |
      | program=PRG-003 | 7 | 7 | 0 | 4 | 1 | 2 |
      | codes=TC-002 | 1 | 1 | 0 | 0 | 1 | 0 |

  Esquema del escenario: Cada caso tiene su ficha con sus datos y su último resultado
    Dado que en el tenant alumno01, recién reiniciado, existen los casos de prueba del seed con sus ejecuciones
    Cuando envía GET /api/verification/report con codes=<caso> y el accessToken de alumno01@sigpro.lab
    Entonces el PDF tiene la ficha «<caso> · <titulo>»
    Y la ficha dice «Programa <programa> · <nombre_programa>» y «Requisitos verificados: <requisitos>»
    Y la ficha dice «Último resultado: <resultado> (<fecha>) · Ejecuciones: <ejecuciones>»

    Ejemplos:
      | caso | titulo | programa | nombre_programa | requisitos | resultado | fecha | ejecuciones |
      | TC-001 | Verificar disponibilidad (caso 001) | PRG-001 | Sistema de mando táctico Ártemis | REQ-001, REQ-008 | Bloqueado | 2026-02-05 | 2 |
      | TC-002 | Verificar latencia (caso 002) | PRG-001 | Sistema de mando táctico Ártemis | REQ-002, REQ-009 | Fallido | 2026-02-08 | 3 |
      | TC-019 | Verificar cifrado (caso 019) | PRG-003 | Enlace de datos seguro LD-9 | REQ-029, REQ-036 | Superado | 2026-03-13 | 2 |
      | TC-023 | Verificar registro de eventos (caso 023) | PRG-003 | Enlace de datos seguro LD-9 | REQ-033 | Superado | 2026-03-22 | 3 |
```

## Fuera de alcance
- El alcance del informe y el nombre del archivo: EP-VER-INFORME, en su historia de la API para el alcance.
- El detalle de un caso dentro de la aplicación (pasos, requisitos e historial): EP-VER-CASOS.
- La cobertura de requisitos en forma de cifra (cuántos requisitos tienen algún caso): el informe no la incluye hoy; ver «Decisiones pendientes».

## Decisiones pendientes
- Cobertura de requisitos. El informe enumera los requisitos enlazados a cada caso, pero no dice cuántos requisitos del programa tienen algún caso, ni en número ni en porcentaje. No está decidido si debe incluirlo. Esta historia no lo afirma.
- Zona horaria de las fechas. Hoy «Generado el» y las fechas de las ejecuciones se calculan en UTC. No está decidido si deben mostrarse en la hora local del usuario o del tenant.
