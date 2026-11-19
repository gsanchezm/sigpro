---
id: US-VER-CASOS-009
tipo: historia
epica: EP-VER-CASOS
titulo: "[Móvil] Abrir el detalle de un caso y volver a la lista"
etiquetas: [movil]
relacionadas: [US-LOGIN-012, US-VER-CASOS-003, US-VER-CASOS-006, US-VER-CASOS-007, US-VER-CASOS-008]
verificacion: codigo
cubre: ["/verification/:code"]
---

## Historia
Como persona con una cuenta en la app móvil, quiero abrir un caso de prueba y ver sus pasos, su resultado esperado, sus requisitos y su historial de ejecuciones, y volver después a la lista,
para consultar el caso desde el teléfono y seguir revisando la lista donde la dejé.

## Reglas
- Se abre tocando la tarjeta del caso en la lista, o con la dirección /verification/<código>.
- El título de la pantalla es el título del caso. Debajo se muestran el código, el último resultado con su etiqueta y el código del programa.
- «Pasos» es una lista numerada, 1., 2., 3., en el orden en que están guardados. Debajo, «Resultado esperado» con su texto.
- «Requisitos verificados» muestra cada requisito con su código y su título. Tocarlo abre `/programs/<código del programa>/requirements?select=<código del requisito>`. Sin requisitos enlazados, aparece «Sin requisitos enlazados».
- «Historial de ejecuciones» tiene una tarjeta por ejecución, de la más reciente a la más antigua, con el código de la ejecución, su fecha, su resultado con su etiqueta, sus notas (o «—»), sus evidencias (o «Sin evidencias») y «Ejecutado por» con el nombre de quien la registró.
- «Volver a Verificación» vuelve a la lista de Verificación con los filtros que tenía si el detalle se abrió desde esa lista. Si el detalle se abrió con una dirección directa, sin lista debajo, abre la lista de Verificación sin filtros, y nunca la pantalla de Programas.
- Si el código no existe en el tenant, la pantalla muestra «No se encontró el caso de prueba», con la traza de la petición y el botón «Volver a Verificación».
- Si la carga falla por otra causa, la pantalla muestra «Ha ocurrido un error inesperado» con el botón «Reintentar», que vuelve a pedir el caso.
- El formulario «Registrar ejecución», el botón de informe PDF del caso y el contenido de las evidencias se describen en otras épicas.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en /login sin ninguna sesión de SIGPRO guardada en el dispositivo, con `alumno01` en «Tenant de trabajo»; `gestor@sigpro.test` (`Gestor1234!`) inicia sesión y llega a /programs.

## Criterios de aceptación
```gherkin
Característica: Detalle de un caso de prueba en la app móvil

  Esquema del escenario: El detalle muestra el título, los requisitos y los pasos del caso
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha tocado el caso <codigo> en la lista de Verificación
    Cuando mira el detalle
    Entonces ve el título <titulo> y el programa <programa>
    Y ve los requisitos <requisitos> como enlaces
    Y ve los pasos «Preparar el entorno de pruebas», «Ejecutar el escenario nominal» y «Registrar las mediciones», numerados en ese orden, y el resultado esperado «Los valores medidos cumplen el umbral definido en el requisito.»

    Ejemplos:
      | codigo | programa | titulo | requisitos |
      | TC-001 | PRG-001 | Verificar disponibilidad (caso 001) | REQ-001, REQ-008 |
      | TC-024 | PRG-003 | Verificar autenticación (caso 024) | REQ-034 |

  Esquema del escenario: El historial de ejecuciones muestra la fecha, el resultado, las notas y quién la registró
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha abierto el caso TC-001
    Cuando mira el historial de ejecuciones
    Entonces la <posicion> ejecución es <ejecucion>, con la fecha <fecha>, el resultado <resultado>, las notas <notas> y <evidencias>
    Y «Ejecutado por» es Lucía Fernández

    Ejemplos:
      | posicion | ejecucion | fecha | resultado | notas | evidencias |
      | primera | RUN-002 | 05/02/2026 | «Bloqueado» | «Ejecución bloqueada: el entorno de pruebas no estaba disponible.» | «Sin evidencias» |
      | segunda | RUN-001 | 04/02/2026 | «Superado» | «Resultado conforme con el criterio de aceptación.» | una evidencia |

  Esquema del escenario: Tocar un requisito abre su programa con ese requisito seleccionado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha abierto el caso TC-001
    Cuando toca el requisito <requisito>
    Entonces llega a <ruta>

    Ejemplos:
      | requisito | ruta |
      | REQ-001 | /programs/PRG-001/requirements?select=REQ-001 |
      | REQ-008 | /programs/PRG-001/requirements?select=REQ-008 |

  Esquema del escenario: «Volver a Verificación» devuelve a la lista según cómo se llegó al detalle
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y <llegada>
    Cuando toca «Volver a Verificación»
    Entonces ve <vuelta>

    Ejemplos:
      | llegada | vuelta |
      | ha puesto el filtro «Último resultado» en «Bloqueado» y ha tocado el caso TC-001 en la lista | la lista de Verificación con ese filtro aplicado y el recuento «1–6 de 6» |
      | ha abierto /verification/TC-001 con una dirección directa, sin pasar por la lista | la lista de Verificación sin filtros y con el recuento «1–10 de 25», y no la pantalla de Programas |

  Esquema del escenario: Un código que no existe en el tenant muestra que el caso no se encontró
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil
    Cuando abre /verification/<codigo>
    Entonces ve el título «No se encontró el caso de prueba» y el botón «Volver a Verificación»
    Y no ve pasos ni historial de ejecuciones

    Ejemplos:
      | codigo |
      | TC-000 |
      | TC-026 |

  Esquema del escenario: Un fallo que no es de caso no encontrado muestra el aviso de error inesperado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y la petición GET /api/test-cases/<codigo> responde con error 500
    Cuando abre /verification/<codigo>
    Entonces ve el título «Ha ocurrido un error inesperado» y el botón «Reintentar»

    Ejemplos:
      | codigo |
      | TC-001 |

  Esquema del escenario: «Reintentar» vuelve a pedir el caso y lo muestra cuando llega
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil, la primera petición de GET /api/test-cases/<codigo> responde con error 500 y ha abierto /verification/<codigo>
    Cuando toca «Reintentar»
    Entonces ve el título <titulo> y los pasos del caso

    Ejemplos:
      | codigo | titulo |
      | TC-001 | Verificar disponibilidad (caso 001) |
```

## Fuera de alcance
- El formulario «Registrar ejecución» y las evidencias (subida, miniaturas, ampliación y descarga): EP-VER-EJECUCION.
- El informe PDF del caso y de la lista: EP-VER-INFORME.
- Lo que muestra la pantalla de requisitos al abrir un requisito desde el enlace: EP-REQ-ARBOL.
- La lista de casos, sus filtros y su orden: las historias de la lista de la app móvil de EP-VER-CASOS.

## Decisiones pendientes
- Si la hora de cada ejecución se muestra en la hora del teléfono o en UTC. Hoy la app muestra la hora de la fecha ISO del registro, en UTC, sin convertirla. Por eso estas filas no afirman la hora.
