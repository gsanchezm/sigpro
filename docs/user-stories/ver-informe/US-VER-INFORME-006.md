---
id: US-VER-INFORME-006
tipo: historia
epica: EP-VER-INFORME
titulo: "[Móvil] Descargar el informe desde «Verificación» y desde el detalle, con selección y entrega"
etiquetas: [movil]
relacionadas: [US-VER-CASOS-007, US-VER-CASOS-008, US-VER-CASOS-009, US-VER-EJECUCION-009, US-VER-INFORME-004, US-VER-INFORME-005]
verificacion: ejecutada
cubre: ["/verification", "/verification/:code"]
---

## Historia
Como persona que verifica el sistema desde el móvil, quiero descargar el informe del programa filtrado o de todos los casos, el de los casos que marco o el de un caso concreto,
para tener el estado del plan en el teléfono y poder compartirlo.

## Reglas
- En /verification, «Descargar informe PDF» está encima de la lista. Pulsarlo descarga el informe del programa elegido en el filtro «Programa» o, con «Todos los programas», el de todos los casos. La búsqueda y el filtro de «Último resultado» no cambian el alcance del informe.
- Si la vista no tiene ningún caso, el botón está deshabilitado y, debajo de él, se lee «No hay casos de prueba para el informe».
- Mientras se prepara un informe, su botón está ocupado y no se lanza otro.
- «Seleccionar» activa el modo de selección de la lista. En ese modo, cada tarjeta tiene una casilla «Seleccionar <código>», y aparece «Seleccionar todos los casos de la página», que marca los casos que la lista tiene cargados.
- Con uno o más casos marcados aparece una barra con «<n> seleccionados», el botón «Informe de la selección» y el botón «Quitar selección». «Informe de la selección» descarga el informe solo de los casos marcados.
- Desactivar «Seleccionar», cambiar un filtro o el orden vacía la selección marcada.
- Cada tarjeta tiene el botón de menú «Acciones para <código>». Su opción «Informe PDF» descarga el informe de ese caso.
- En el detalle de un caso (/verification/<código>), el botón «Descargar informe PDF» descarga el informe de ese caso.
- Entrega del archivo. En la versión web de la app (Expo web), el PDF se abre en una pestaña nueva del navegador. En iOS y en Android, el archivo se guarda en el dispositivo con su nombre y se abre la hoja de compartir del sistema con ese archivo. En los dos casos aparece después el aviso «Informe generado» con el nombre del archivo.
- Si la petición falla, aparece el aviso «No se pudo generar el informe» con la traza de la API; si no hubo respuesta del servidor, con «No se pudo contactar con el servidor».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en /login sin sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo»; se escribe `gestor@sigpro.test` con `Gestor1234!`, se pulsa «Entrar» y se llega a /programs. Después se abre /verification con la lista cargada, o el detalle del caso que indique la fila.

## Criterios de aceptación
```gherkin
Característica: Informe de verificación en la app móvil

  Esquema del escenario: El botón de la lista descarga el informe del programa filtrado o de todos los casos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y está en /verification con la lista cargada
    Cuando elige <programa> en el filtro «Programa» y pulsa «Descargar informe PDF»
    Entonces se entrega el informe
    Y ve el aviso «Informe generado» con el nombre <nombre>

    Ejemplos:
      | programa | nombre |
      | «Todos los programas» | informe-verificacion.pdf |
      | PRG-002 | informe-verificacion-prg-002.pdf |

  Esquema del escenario: Sin casos en la vista, el botón de informe está deshabilitado y lo dice
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y está en /verification con la lista cargada
    Cuando <condicion>
    Entonces «Descargar informe PDF» está deshabilitado
    Y se lee «No hay casos de prueba para el informe»

    Ejemplos:
      | condicion |
      | elige PRG-004 en el filtro «Programa» |

  Esquema del escenario: La selección descarga el informe de los casos marcados
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y está en /verification con la lista cargada
    Cuando <seleccion> y pulsa «Informe de la selección»
    Entonces se entrega el informe de la selección
    Y el resumen dice «Casos de prueba: <casos> · Ejecutados: <casos> · Sin ejecutar: 0»
    Y ve el aviso «Informe generado» con el nombre informe-verificacion-seleccion.pdf

    Ejemplos:
      | seleccion | casos |
      | pulsa «Seleccionar», marca «Seleccionar TC-001» y «Seleccionar TC-010» | 2 |
      | pulsa «Seleccionar» y marca «Seleccionar todos los casos de la página» | 10 |

  Esquema del escenario: El menú de una tarjeta y el detalle descargan el informe de un caso
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y está en <pantalla> con el caso <caso> cargado
    Cuando <accion>
    Entonces se entrega el informe de ese caso
    Y el resumen dice «Casos de prueba: 1 · Ejecutados: 1 · Sin ejecutar: 0»
    Y ve el aviso «Informe generado» con el nombre informe-verificacion-seleccion.pdf

    Ejemplos:
      | pantalla | caso | accion |
      | /verification | TC-002 | abre el menú «Acciones para TC-002» y pulsa «Informe PDF» |
      | /verification/TC-019 | TC-019 | pulsa «Descargar informe PDF» |

  Esquema del escenario: Si la petición del informe falla, aparece el aviso de error
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y está en /verification con la lista cargada, y la prueba hace que la siguiente petición de GET /api/verification/report <fallo>
    Cuando pulsa «Descargar informe PDF»
    Entonces ve el aviso «No se pudo generar el informe» con <detalle>
    Y no se entrega ningún informe

    Ejemplos:
      | fallo | detalle |
      | responda con error 500 | la traza de la petición fallida |
      | no obtenga respuesta del servidor | el texto «No se pudo contactar con el servidor» |
```

## Fuera de alcance
- La lista de tarjetas, sus filtros, su orden y la carga de más casos: EP-VER-CASOS.
- El detalle de un caso con sus pasos, requisitos e historial, y la opción «Ver detalle» del menú: EP-VER-CASOS.
- La opción «Registrar ejecución» del menú de tarjeta: EP-VER-EJECUCION.
- El contenido del PDF (resumen y fichas): EP-VER-INFORME, en su historia de la API para el contenido.
- Lo que se ve dentro de la hoja de compartir del sistema en iOS y en Android: no se comprueba en esta historia, que se ejecuta en la versión web de la app; la regla de entrega describe el comportamiento esperado en esos sistemas.

## Decisiones pendientes
- Si «Descargar informe PDF» debe quedar deshabilitado cuando la búsqueda o el filtro de resultado dejan la lista vacía, aunque el informe no use esos filtros. Hoy sí queda deshabilitado. No está decidido.
- Qué debe mostrar el botón mientras la lista carga o si la carga falla. Hoy queda deshabilitado con el mismo texto que cuando no hay casos, «No hay casos de prueba para el informe». No está decidido qué debe decir en cada caso.
