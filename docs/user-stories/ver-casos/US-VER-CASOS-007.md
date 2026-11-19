---
id: US-VER-CASOS-007
tipo: historia
epica: EP-VER-CASOS
titulo: "[Móvil] Ver la lista de casos en tarjetas con «Cargar más» y sus estados"
etiquetas: [movil]
relacionadas: [US-LOGIN-012, US-VER-CASOS-001, US-VER-CASOS-004, US-VER-CASOS-008, US-VER-CASOS-009]
verificacion: ejecutada
cubre: ["/verification"]
---

## Historia
Como persona con una cuenta en la app móvil, quiero ver los casos de prueba en tarjetas, cargar más casos cuando hay más de diez y ver un aviso claro si la lista no carga,
para revisar los casos desde el teléfono con el mismo resultado que en la web.

## Reglas
- Cada caso es una tarjeta que muestra su código, su último resultado con su etiqueta, su título, el código de su programa y su número de ejecuciones, como «2 ejecuciones». Tocar la tarjeta abre el detalle del caso.
- El botón ⋯ de cada tarjeta abre un menú. Su opción «Ver detalle» abre el detalle del caso; las opciones «Registrar ejecución» e «Informe PDF» se describen en otras épicas.
- Sin filtros ni orden elegidos, las tarjetas salen por código ascendente.
- La primera carga trae 10 casos. «Cargar más» añade los 10 siguientes a continuación de los que ya se ven, sin sustituirlos. Mientras los pide, el botón indica que está cargando. Cuando ya se ven todos los casos, «Cargar más» no aparece.
- El recuento dice cuántos casos se ven frente al total, con la forma «1–10 de 25».
- Encima de la lista, el título «Verificación» y el resumen «25 casos de prueba · 50 ejecuciones» de la lista sin filtrar.
- Mientras llega la primera respuesta no se muestran casos antiguos: aparece un indicador de carga.
- Si la primera carga no llega, aparece el aviso «No se pudieron cargar los casos de prueba» con la traza de la petición fallida o, si no hubo respuesta del servidor, con el texto «No se pudo contactar con el servidor»; y el botón «Reintentar», que vuelve a pedir la lista.
- Si falla la carga de la página siguiente, los casos ya vistos se conservan y aparece el mismo aviso con «Reintentar», que vuelve a pedir esa página.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en /login sin ninguna sesión de SIGPRO guardada en el dispositivo, con `alumno01` en «Tenant de trabajo»; `gestor@sigpro.test` (`Gestor1234!`) inicia sesión y llega a /programs, y después abre la sección «Verificación», que lleva a /verification.

## Criterios de aceptación
```gherkin
Característica: Lista de casos de prueba en la app móvil

  Esquema del escenario: «Cargar más» añade los casos siguientes
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil, ha abierto /verification y ha pulsado «Cargar más» <veces> veces
    Cuando mira la lista
    Entonces ve el recuento <recuento>, el último caso visible es <ultimo> y el botón «Cargar más» <boton>

    Ejemplos:
      | veces | recuento | ultimo | boton |
      | 0 | «1–10 de 25» | TC-010 | aparece |
      | 1 | «1–20 de 25» | TC-020 | aparece |
      | 2 | «1–25 de 25» | TC-025 | no aparece |

  Esquema del escenario: Cada tarjeta muestra sus datos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha abierto /verification
    Cuando mira la tarjeta del caso <codigo>
    Entonces ve el último resultado <resultado>, el título <titulo>, el programa <programa> y <ejecuciones> ejecuciones

    Ejemplos:
      | codigo | resultado | titulo | programa | ejecuciones |
      | TC-001 | «Bloqueado» | Verificar disponibilidad (caso 001) | PRG-001 | 2 |
      | TC-002 | «Fallido» | Verificar latencia (caso 002) | PRG-001 | 3 |
      | TC-004 | «Superado» | Verificar trazabilidad (caso 004) | PRG-001 | 2 |

  Esquema del escenario: La primera carga muestra un indicador hasta que llega la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y la prueba retrasa <espera> la respuesta de GET /api/test-cases
    Cuando abre /verification
    Entonces mientras espera ve el indicador de carga y ningún caso
    Y al llegar la respuesta ve 10 casos, empezando por TC-001

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Si la primera carga no llega, el aviso dice qué ha pasado y ofrece volver a pedirla
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y la petición GET /api/test-cases <fallo> al abrir /verification
    Cuando abre /verification
    Entonces ve el aviso «No se pudieron cargar los casos de prueba», con <detalle>, y el botón «Reintentar»
    Y no ve ningún caso

    Ejemplos:
      | fallo | detalle |
      | responde con error 500 | la traza de la petición fallida |
      | no obtiene respuesta del servidor | el texto «No se pudo contactar con el servidor» |

  Esquema del escenario: Si falla la página siguiente, los casos vistos se conservan y aparece el aviso de error
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil, ha abierto /verification con 10 casos a la vista y la petición de la página <pagina> de GET /api/test-cases responde con error 500
    Cuando pulsa «Cargar más»
    Entonces sigue viendo los casos desde TC-001 y el aviso «No se pudieron cargar los casos de prueba» con el botón «Reintentar»
    Y ve el recuento «1–10 de 25»

    Ejemplos:
      | pagina |
      | 2 |
```

## Fuera de alcance
- La búsqueda, los filtros y el orden de la lista: la historia de búsqueda, filtros y orden de la app móvil de EP-VER-CASOS.
- La selección de casos, su barra de acciones y el informe PDF, con su botón de cabecera y sus opciones de menú: EP-VER-INFORME.
- La opción «Registrar ejecución» del menú de cada tarjeta: EP-VER-EJECUCION.
- El detalle del caso: la historia de detalle de la app móvil de EP-VER-CASOS.

## Decisiones pendientes
- Cómo se escribe el número de ejecuciones de un caso con una sola ejecución. Hoy la tarjeta dice «1 ejecuciones». Queda por decidir si se usa «1 ejecución».
