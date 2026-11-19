---
id: US-VER-INFORME-004
tipo: historia
epica: EP-VER-INFORME
titulo: "[Web] Descargar el informe desde «Verificación»: cabecera, selección y menú de fila"
etiquetas: [web]
relacionadas: [US-VER-CASOS-004, US-VER-CASOS-005, US-VER-INFORME-002, US-VER-INFORME-005, US-VER-INFORME-006]
verificacion: codigo
cubre: ["/verification"]
---

## Historia
Como persona que verifica el sistema desde el escritorio, quiero descargar desde /verification el informe del programa que tengo filtrado o de todos los casos, o el de los casos que marco,
para entregar el estado del plan o revisar una selección sin salir de la lista.

## Reglas
- «Descargar informe PDF» está en la cabecera de la pantalla, a la derecha del título. Pulsarlo descarga el informe del programa elegido en el filtro «Programa» o, con «Todos los programas», el de todos los casos. La búsqueda y el filtro de «Último resultado» no cambian el alcance del informe.
- El botón está deshabilitado mientras la lista carga, si la carga falla y si la vista no tiene ningún caso. Su explicación es «No hay casos de prueba para el informe».
- Al descargar, el archivo se guarda con el nombre que indica el servidor: `informe-verificacion.pdf` para todos los casos, `informe-verificacion-prg-002.pdf` para el programa PRG-002 (en general, `informe-verificacion-<código del programa en minúsculas>.pdf`) y `informe-verificacion-seleccion.pdf` para una selección. Aparece el aviso «Informe generado» con ese nombre. Si la petición falla, aparece el aviso «No se pudo generar el informe» con la traza de la API; si no hubo respuesta del servidor, con «No se pudo contactar con el servidor».
- En escritorio, cada fila tiene una casilla «Seleccionar <código>», con el código del caso, y la cabecera de la tabla tiene la casilla «Seleccionar todos los casos de la página», que marca los casos de la página actual.
- Con uno o más casos marcados aparece una barra con «<n> seleccionados», el botón «Informe de la selección» y el botón «Quitar selección». «Informe de la selección» descarga el informe solo de los casos marcados, con el nombre de la selección. «Quitar selección» vacía la marca.
- Cada fila de la tabla tiene un botón de menú «Acciones para <código>» con las opciones «Ver detalle», «Registrar ejecución» e «Informe PDF». «Informe PDF» descarga el informe de ese caso con el nombre de la selección.
- Cambiar el filtro de programa, el de resultado, la búsqueda, el orden o la página vacía la selección marcada.
- Por debajo de 1024 px de ancho, la lista son tarjetas sin casillas, sin barra de selección y sin menú de fila. En ese ancho solo queda el botón de la cabecera.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin sesión de SIGPRO guardada, se escribe `gestor@sigpro.test` con `Gestor1234!`, se pulsa «Entrar» y se llega a /programs. Después se abre /verification con la lista cargada.

## Criterios de aceptación
```gherkin
Característica: Informe de verificación desde la lista en la web

  Esquema del escenario: El botón de la cabecera descarga el informe del programa filtrado o de todos los casos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification con la lista cargada
    Cuando elige <programa> en el filtro «Programa» y pulsa «Descargar informe PDF»
    Entonces se descarga el archivo <nombre>
    Y ve el aviso «Informe generado» con el nombre <nombre>

    Ejemplos:
      | programa | nombre |
      | «Todos los programas» | informe-verificacion.pdf |
      | PRG-002 | informe-verificacion-prg-002.pdf |

  Esquema del escenario: La búsqueda y el filtro de resultado no cambian el alcance del informe
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification con la lista cargada
    Cuando escribe <busqueda> en «Buscar casos de prueba», elige <resultado> en «Último resultado» y pulsa «Descargar informe PDF»
    Entonces la lista muestra <casos_visibles> casos de prueba
    Y se descarga el archivo informe-verificacion.pdf con el resumen «Casos de prueba: 25 · Ejecutados: 25 · Sin ejecutar: 0»

    Ejemplos:
      | busqueda | resultado | casos_visibles |
      | Latencia | «Fallido» | 1 |
      | Latencia | «Superado» | 2 |
      | Latencia | «Todos los resultados» | 3 |

  Esquema del escenario: Sin casos en la vista, «Descargar informe PDF» está deshabilitado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification con la lista cargada
    Cuando <condicion>
    Entonces «Descargar informe PDF» está deshabilitado con la explicación «No hay casos de prueba para el informe»

    Ejemplos:
      | condicion |
      | elige PRG-004 en el filtro «Programa» |

  Esquema del escenario: Si la petición del informe falla, aparece el aviso de error
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification con la lista cargada, y la prueba hace que la siguiente petición de GET /api/verification/report <fallo>
    Cuando pulsa «Descargar informe PDF»
    Entonces ve el aviso «No se pudo generar el informe» con <detalle>
    Y no se descarga ningún archivo

    Ejemplos:
      | fallo | detalle |
      | responda con error 500 | la traza de la petición fallida |
      | no obtenga respuesta del servidor | el texto «No se pudo contactar con el servidor» |

  Esquema del escenario: El informe de una fila o de la selección cubre solo los casos elegidos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con una ventana de 1440 px de ancho y está en /verification con la lista cargada
    Cuando <accion>
    Entonces se descarga el archivo informe-verificacion-seleccion.pdf
    Y el resumen dice «Casos de prueba: <casos> · Ejecutados: <casos> · Sin ejecutar: 0»
    Y ve el aviso «Informe generado» con el nombre informe-verificacion-seleccion.pdf

    Ejemplos:
      | accion | casos |
      | abre el menú «Acciones para TC-002» y pulsa «Informe PDF» | 1 |
      | marca «Seleccionar TC-001» y «Seleccionar TC-010» y pulsa «Informe de la selección» | 2 |
      | marca «Seleccionar todos los casos de la página» y pulsa «Informe de la selección» | 10 |

  Esquema del escenario: Las casillas y el menú de fila dependen del ancho de la ventana
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con una ventana de <ancho> px de ancho y está en /verification
    Cuando la lista se muestra con sus casos
    Entonces <presentacion>
    Y «Descargar informe PDF» está en la cabecera de la pantalla

    Ejemplos:
      | ancho | presentacion |
      | 1023 | no hay casillas de selección ni menú en las tarjetas de los casos |
      | 1024 | cada fila tiene la casilla «Seleccionar TC-001» y el botón «Acciones para TC-001» |
```

## Fuera de alcance
- La ficha de un caso y su botón de informe: EP-VER-INFORME, en su historia de la web para el detalle.
- La lista, sus filtros, su orden y su paginación: EP-VER-CASOS.
- Las opciones «Ver detalle» y «Registrar ejecución» del menú de fila: EP-VER-CASOS y EP-VER-EJECUCION.
- El contenido del PDF: EP-VER-INFORME, en su historia de la API para el contenido.

## Decisiones pendientes
- Si «Descargar informe PDF» debe quedar deshabilitado cuando la búsqueda o el filtro de resultado dejan la lista vacía, aunque el informe no use esos filtros. Hoy sí queda deshabilitado. No está decidido.
- Qué explicación debe dar el botón mientras la lista carga o si la carga falla. Hoy es la misma que cuando no hay casos, «No hay casos de prueba para el informe», aunque el motivo sea otro. No está decidido qué debe decir en cada caso.
