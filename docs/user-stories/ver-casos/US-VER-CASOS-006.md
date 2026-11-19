---
id: US-VER-CASOS-006
tipo: historia
epica: EP-VER-CASOS
titulo: "[Web] Abrir el detalle de un caso: pasos, requisitos, historial y volver"
etiquetas: [web]
relacionadas: [US-VER-CASOS-003, US-VER-CASOS-004, US-VER-CASOS-005, US-VER-CASOS-009, US-LOGIN-007]
verificacion: codigo
cubre: ["/verification/:code"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero abrir un caso de prueba desde la lista o desde su dirección y ver sus pasos, su resultado esperado, los requisitos que verifica y el historial de sus ejecuciones,
para saber qué comprueba el caso, a qué requisitos responde y cómo le ha ido hasta ahora.

## Reglas
- Se abre desde el código del caso en la lista o escribiendo la dirección /verification/<código>.
- La cabecera muestra el código del caso, su último resultado con su etiqueta y el código de su programa. El título del caso es el título de la página.
- «Pasos» es una lista numerada, en el orden en que están guardados. Debajo, «Resultado esperado» con su texto.
- «Requisitos verificados» muestra cada requisito enlazado con su código y su título. El código es un enlace a `/programs/<código del programa>/requirements?select=<código del requisito>`. Sin requisitos enlazados, aparece «Sin requisitos enlazados».
- «Historial de ejecuciones» tiene una fila por ejecución, de la más reciente a la más antigua, con el código de la ejecución, su fecha en formato dd/mm/aaaa, su resultado con su etiqueta, sus notas (o «—» si no tiene), sus evidencias (o «Sin evidencias») y el nombre de quien la registró. Si el caso no tiene ejecuciones, aparece «Todavía no hay ejecuciones de este caso.».
- Al final, «Volver a Verificación» es un enlace a /verification.
- Si el código no existe en el tenant, el título de la página es «No se encontró el caso de prueba», con la traza de la petición y el enlace «Volver a Verificación».
- Si la carga falla por otra causa, el título de la página es «Ha ocurrido un error inesperado».
- El formulario «Registrar ejecución», el botón de informe PDF del caso y el contenido de las evidencias se describen en otras épicas.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe `gestor@sigpro.test` con `Gestor1234!`, se pulsa «Entrar», se llega a /programs y se abre /verification.
- Preparación del caso sin requisitos: además, en `alumno01`, con el token de `alumno01@sigpro.lab`, se quita el enlace entre REQ-007 y TC-007 con `DELETE /api/requirements/REQ-007/tests/TC-007`. Esa petición solo prepara el estado.

## Criterios de aceptación
```gherkin
Característica: Detalle de un caso de prueba en la web

  Esquema del escenario: El detalle muestra el título, el programa, los requisitos y los pasos del caso
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y ha abierto la lista de Verificación
    Cuando abre el caso <codigo> desde la lista
    Entonces ve el título <titulo> y el programa <programa>
    Y ve los requisitos <requisitos> como enlaces
    Y ve los pasos «Preparar el entorno de pruebas», «Ejecutar el escenario nominal» y «Registrar las mediciones», en ese orden, y el resultado esperado «Los valores medidos cumplen el umbral definido en el requisito.»

    Ejemplos:
      | codigo | programa | titulo | requisitos |
      | TC-001 | PRG-001 | Verificar disponibilidad (caso 001) | REQ-001, REQ-008 |
      | TC-010 | PRG-002 | Verificar latencia (caso 010) | REQ-015, REQ-022 |
      | TC-024 | PRG-003 | Verificar autenticación (caso 024) | REQ-034 |

  Esquema del escenario: El requisito enlazado abre su programa con ese requisito seleccionado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y ha abierto el caso <codigo>
    Cuando pulsa el código <requisito>
    Entonces llega a <ruta>

    Ejemplos:
      | codigo | requisito | ruta |
      | TC-001 | REQ-008 | /programs/PRG-001/requirements?select=REQ-008 |
      | TC-024 | REQ-034 | /programs/PRG-003/requirements?select=REQ-034 |

  Esquema del escenario: Cada ejecución del historial muestra su fecha, su resultado, sus notas y quién la registró
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y ha abierto el caso TC-001
    Cuando mira el historial de ejecuciones
    Entonces la <posicion> fila es <ejecucion>, con la fecha <fecha>, el resultado <resultado>, las notas <notas> y <evidencias>
    Y la ejecución la registró Lucía Fernández

    Ejemplos:
      | posicion | ejecucion | fecha | resultado | notas | evidencias |
      | primera | RUN-002 | 05/02/2026 | «Bloqueado» | «Ejecución bloqueada: el entorno de pruebas no estaba disponible.» | «Sin evidencias» |
      | segunda | RUN-001 | 04/02/2026 | «Superado» | «Resultado conforme con el criterio de aceptación.» | una evidencia |

  Esquema del escenario: Un código que no existe en el tenant muestra que el caso no se encontró
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre /verification/<codigo>
    Entonces ve el título «No se encontró el caso de prueba» y el enlace «Volver a Verificación»
    Y no ve pasos ni historial de ejecuciones

    Ejemplos:
      | codigo |
      | TC-000 |
      | tc-001 |

  Esquema del escenario: Un fallo que no es de caso no encontrado muestra el aviso de error inesperado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la petición GET /api/test-cases/TC-001 <fallo>
    Cuando abre /verification/TC-001
    Entonces ve el título «Ha ocurrido un error inesperado»

    Ejemplos:
      | fallo |
      | responde con error 500 |
      | no obtiene respuesta del servidor |

  Esquema del escenario: «Volver a Verificación» lleva a la lista de casos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification/<codigo>
    Cuando pulsa «Volver a Verificación»
    Entonces llega a /verification

    Ejemplos:
      | codigo |
      | TC-001 |
      | TC-026 |

  Esquema del escenario: Un caso sin requisitos enlazados lo dice en el lugar de los requisitos
    Dado que en el tenant alumno01, recién reiniciado y sin el enlace entre REQ-007 y TC-007, gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre el caso <codigo> desde la lista
    Entonces ve el texto «Sin requisitos enlazados» en el lugar de los requisitos

    Ejemplos:
      | codigo |
      | TC-007 |
```

## Fuera de alcance
- El formulario «Registrar ejecución», la opción de menú que lleva a él, y las evidencias (subida, miniaturas y descarga): EP-VER-EJECUCION.
- El informe PDF del caso y de la lista: EP-VER-INFORME.
- Lo que muestra la pantalla de requisitos al abrir un requisito desde el enlace: EP-REQ-ARBOL.
- Enlazar o quitar un caso desde un requisito: EP-REQ-TRAZA.
- La lista de casos, sus filtros y su orden: las historias de la lista web de EP-VER-CASOS.

## Decisiones pendientes
- Si la hora de cada ejecución se muestra en la hora del navegador o en UTC. Hoy la web muestra la hora de la fecha ISO del registro, en UTC, sin convertirla. Por eso estas filas no afirman la hora.
- Si «Volver a Verificación» debe recordar los filtros y la página de la lista. Hoy vuelve a /verification sin ellos; la app móvil los recuerda.
