---
id: US-DOC-LISTA-011
tipo: historia
epica: EP-DOC-LISTA
titulo: "[Móvil] Ver la lista de documentos en tarjetas, buscarla y descargar su PDF"
etiquetas: [movil]
relacionadas: [US-DOC-LISTA-006, US-DOC-LISTA-007, US-DOC-LISTA-008, US-DOC-LISTA-013]
verificacion: codigo
cubre: ["/documents"]
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero ver la lista de documentos en tarjetas, buscarla por código o título y descargar el PDF de un documento,
para encontrar lo que necesito y tenerlo a mano sin abrir un ordenador.

## Reglas
- La pantalla «Documentos» muestra la lista en una columna de tarjetas. Cada tarjeta lleva el código, que es un enlace a la ficha; el título; la etiqueta de clasificación, «Público» o «Restringido»; el código y el nombre del programa, separados por « · » (por ejemplo, `PRG-001 · Sistema de mando táctico Ártemis`); y la versión y la fecha de actualización (`v3 · 05/02/2026`).
- Las tarjetas van en orden de código ascendente, tal como las entrega la API, y el recuento «N documentos» cuenta las tarjetas que se ven.
- El buscador «Buscar documentos» (con el texto de ayuda «Buscar código o título…») deja las tarjetas cuyo código o título contiene el texto, sin distinguir mayúsculas y sin contar los espacios del principio y del final. No busca en el nombre del programa. Cuando hay texto, aparece «Limpiar filtros», que vacía el buscador.
- Cada tarjeta tiene el botón ⋯, que abre una hoja de acciones titulada «Acciones para» y el código del documento (por ejemplo, «Acciones para DOC-002»). La hoja ofrece dos opciones: «Ver documento», que abre la ficha, y «Descargar PDF», que descarga la última versión. La hoja no ofrece «Abrir en nueva pestaña», porque la app no tiene pestañas del navegador.
- «Descargar PDF» entrega el archivo con su nombre (`<código>-v<versión>.pdf`) y muestra el aviso «Descarga iniciada» con ese nombre. Si la descarga falla, muestra el aviso «No se pudo descargar el documento» con la traza de la petición. Cómo se entrega el archivo en iOS y en Android no forma parte de esta historia.
- Estados de la pantalla: mientras llega la respuesta, se ve el estado de carga. Si el tenant no tiene documentos, se ve el bloque «Sin documentos» con «Todavía no hay documentos.». Si el texto no coincide con ninguno, se ve «Sin documentos» con «Ningún documento coincide con los filtros aplicados.» y el botón «Limpiar filtros». Si la petición falla, se ve el aviso «No se pudieron cargar los documentos» con la traza y el botón «Reintentar», y ningún documento; «Reintentar» vuelve a pedir la lista.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo»; `gestor@sigpro.test` (contraseña `Gestor1234!`) entra y llega a `/programs`. Las demoras y los errores de cada fila los provoca la prueba antes de abrir `/documents`.
- Datos del seed que citan los ejemplos: en cada tenant hay doce documentos, `DOC-001` a `DOC-012`, dos por programa de `PRG-001` a `PRG-006`. Son restringidos `DOC-003`, `DOC-006`, `DOC-009` y `DOC-012`.

## Criterios de aceptación
```gherkin
Característica: Lista de documentos en la app móvil

  Esquema del escenario: Cada tarjeta muestra el documento con su clasificación, su programa y su versión
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y está en /documents
    Cuando mira la tarjeta de <codigo>
    Entonces ve el título <titulo>, el programa <programa>, la clasificación <clasificacion> y el texto <pie>

    Ejemplos:
      | codigo | titulo | programa | clasificacion | pie |
      | DOC-001 | Plan de verificación PRG-001 | PRG-001 · Sistema de mando táctico Ártemis | «Público» | v3 · 05/02/2026 |
      | DOC-003 | Plan de verificación PRG-002 | PRG-002 · Radar de vigilancia costera RVC-2 | «Restringido» | v2 · 29/01/2026 |

  Esquema del escenario: El buscador deja las tarjetas de los documentos cuyo código o título contiene el texto
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y está en /documents
    Cuando escribe <texto> en «Buscar documentos»
    Entonces el recuento dice <recuento> y las tarjetas son <codigos>

    Ejemplos:
      | texto | codigos | recuento |
      | plan | DOC-001, DOC-003, DOC-005, DOC-007, DOC-009 y DOC-011 | «6 documentos» |
      | PRG-004 | DOC-007 y DOC-008 | «2 documentos» |
      | Ártemis | ninguna | «0 documentos» |

  Esquema del escenario: El menú de la tarjeta ofrece ver el documento y descargar su última versión
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y está en /documents
    Cuando abre el menú ⋯ de la tarjeta de <codigo> y elige <opcion>
    Entonces <resultado>

    Ejemplos:
      | codigo | opcion | resultado |
      | DOC-002 | «Ver documento» | llega a la ficha de DOC-002 y ve el título Especificación técnica PRG-001 |
      | DOC-002 | «Descargar PDF» | ve el aviso «Descarga iniciada» con el nombre DOC-002-v1.pdf |

  Esquema del escenario: Mientras llega la respuesta se ve el estado de carga y después las tarjetas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y la prueba retrasa <espera> la respuesta de GET /api/documents en esa app
    Cuando abre /documents
    Entonces ve el estado de carga mientras espera
    Y al llegar la respuesta ve los 12 documentos y el recuento «12 documentos»

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Un texto sin coincidencias muestra el bloque vacío con la opción de limpiar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y está en /documents
    Cuando escribe <texto> en «Buscar documentos»
    Entonces ve el título «Sin documentos», el mensaje «Ningún documento coincide con los filtros aplicados.» y el botón «Limpiar filtros»
    Y al pulsar «Limpiar filtros» ve los 12 documentos

    Ejemplos:
      | texto |
      | zzz-no-existe |
      | Ártemis |

  Esquema del escenario: Un fallo de la petición muestra el aviso de error con «Reintentar»
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y la prueba responde con error <estado> a GET /api/documents en esa app
    Cuando abre /documents
    Entonces ve el aviso «No se pudieron cargar los documentos» con el botón «Reintentar» y ningún documento

    Ejemplos:
      | estado |
      | 500 |
      | 503 |

  Esquema del escenario: «Reintentar» pide la lista otra vez y la muestra cuando la respuesta llega bien
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil, la primera petición de GET /api/documents responde con error <estado> en esa app y las siguientes responden bien
    Cuando abre /documents y pulsa «Reintentar»
    Entonces ve los 12 documentos con el recuento «12 documentos» y ya no ve el aviso de error

    Ejemplos:
      | estado |
      | 500 |
      | 503 |
```

## Decisiones pendientes
- La línea de detalle técnico que aparece bajo el aviso de error (la traza de la petición fallida). Hoy la muestra; no está decidido si forma parte del producto ni qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.

## Fuera de alcance
- Filtrar la lista por programa y por clasificación en la app móvil: historia de móvil no implementada de esta épica.
- La ficha de un documento y su visor en la app: historia de la ficha móvil de esta épica.
- Cómo se entrega el PDF en iOS y en Android (hoja de compartir del sistema): historias de iOS y de Android de esta épica.
- Los avisos generales de la aplicación, como los de falta de conexión: épica transversal de avisos (EP-TOASTS).
- Los documentos restringidos y el aviso de documentos ocultos de la lista: EP-DOC-RESTRINGIDOS.
- Cómo se llega a Documentos desde la pestaña «Más»: EP-NAVEGACION.
