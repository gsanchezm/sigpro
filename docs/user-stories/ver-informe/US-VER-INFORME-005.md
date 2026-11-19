---
id: US-VER-INFORME-005
tipo: historia
epica: EP-VER-INFORME
titulo: "[Web] Descargar el informe de un caso desde su detalle"
etiquetas: [web]
relacionadas: [US-VER-CASOS-006, US-VER-EJECUCION-006, US-VER-INFORME-003, US-VER-INFORME-004]
verificacion: ejecutada
cubre: ["/verification/:code"]
---

## Historia
Como persona que revisa un caso de prueba en la web, quiero descargar desde su detalle el informe de ese caso,
para tener su ficha y su último resultado en un PDF sin volver a la lista.

## Reglas
- En el detalle de un caso (/verification/<código>), el botón «Descargar informe PDF» está en la cabecera, junto al código del caso, su último resultado y su programa.
- El botón aparece cuando el caso ya se ha cargado, y entonces está habilitado.
- Al pulsarlo, se descarga el informe solo de ese caso, con el nombre `informe-verificacion-seleccion.pdf` (el que lleva cualquier selección), y aparece el aviso «Informe generado» con ese nombre.
- Si la petición falla, aparece el aviso «No se pudo generar el informe» con la traza de la API; si no hubo respuesta del servidor, con «No se pudo contactar con el servidor».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin sesión de SIGPRO guardada, se escribe `gestor@sigpro.test` con `Gestor1234!`, se pulsa «Entrar» y se llega a /programs. Después se abre el detalle del caso de la fila.

## Criterios de aceptación
```gherkin
Característica: Informe de un caso desde su detalle en la web

  Esquema del escenario: El botón del detalle descarga el informe de ese caso
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification/<caso> con el caso cargado
    Cuando pulsa «Descargar informe PDF»
    Entonces se descarga el archivo informe-verificacion-seleccion.pdf
    Y el resumen dice «Casos de prueba: 1 · Ejecutados: 1 · Sin ejecutar: 0»
    Y la ficha dice «Último resultado: <resultado> (<fecha>) · Ejecuciones: <ejecuciones>»
    Y ve el aviso «Informe generado» con el nombre informe-verificacion-seleccion.pdf

    Ejemplos:
      | caso | resultado | fecha | ejecuciones |
      | TC-002 | Fallido | 2026-02-08 | 3 |
      | TC-019 | Superado | 2026-03-13 | 2 |

  Esquema del escenario: Si la petición del informe falla, aparece el aviso de error
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification/TC-002 con el caso cargado, y la prueba hace que la siguiente petición de GET /api/verification/report <fallo>
    Cuando pulsa «Descargar informe PDF»
    Entonces ve el aviso «No se pudo generar el informe» con <detalle>
    Y no se descarga ningún archivo

    Ejemplos:
      | fallo | detalle |
      | responda con error 500 | la traza de la petición fallida |
      | no obtenga respuesta del servidor | el texto «No se pudo contactar con el servidor» |
```

## Fuera de alcance
- Los pasos, el resultado esperado, los requisitos y el historial del caso: EP-VER-CASOS.
- El informe de varios casos o de la lista: EP-VER-INFORME, en su historia de la web para la lista.
- El contenido completo del PDF (resumen y fichas): EP-VER-INFORME, en su historia de la API para el contenido.
