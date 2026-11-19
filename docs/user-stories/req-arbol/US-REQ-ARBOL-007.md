---
id: US-REQ-ARBOL-007
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Web] Ver las cifras del programa, leer el documento de requisitos y descargar el CSV"
etiquetas: [web]
relacionadas: [US-REQ-ARBOL-011, US-REQ-ARBOL-003, US-REQ-ARBOL-014]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero ver de un vistazo las cifras de los requisitos de un programa, leerlos como un documento numerado y descargarlos en CSV,
para saber cuánto está aprobado y cuánto verificado, y para compartir o tratar la lista fuera de SIGPRO.

## Reglas
- Encima de los controles de la pantalla hay cuatro tarjetas con las cifras del programa:
  - «Requisitos»: el número total de requisitos del programa; debajo, el texto «validados: N», con los que están en estado validado.
  - «Cobertura de verificación»: el porcentaje de requisitos que tienen al menos un caso de prueba enlazado, redondeado al entero y seguido de «%»; debajo, el texto «N de M con pruebas».
  - «Pendientes de aprobación»: el número de requisitos en borrador; debajo, el texto «en borrador».
  - «NC abiertas»: el número de no conformidades abiertas distintas que cuelgan de los casos enlazados de los requisitos; debajo, el texto «requisitos afectados: N», con el número de requisitos que tienen alguna no conformidad abierta.
- Las cuatro cifras salen del programa completo: no cambian con la búsqueda ni con el filtro de estado.
- Mientras la lista carga, las cifras muestran «…».
- La pestaña «Documento» muestra los requisitos que cumplen la búsqueda y el filtro de estado como un texto continuo, en el orden del árbol y con todas las ramas desplegadas. Cada requisito es un párrafo con su número (1, 1.1, 1.2.1 y así), su código en el margen izquierdo, su título precedido de su número (por ejemplo, «1.2 Disponibilidad del subsistema 017»), que abre el detalle del requisito al pulsarlo, su descripción y su estado a la derecha.
- Los números del documento se calculan sobre los requisitos que se muestran: si la búsqueda oculta un padre o un hermano, los números de los demás cambian.
- El botón «Exportar CSV» descarga el archivo `sigpro-requisitos.csv` con todos los requisitos del programa, aunque haya búsqueda o filtro activos. La primera línea es `code;title;state;priority;parent;tags;tests`, y cada requisito ocupa una línea. El título va entre comillas dobles; las etiquetas y los códigos de los casos enlazados van separados por `|`; `parent` va vacío en los requisitos raíz; y `tags` y `tests` van vacíos si no tienen. Al terminar muestra el aviso emergente «CSV generado» con el texto «N filas exportadas», donde N es el número de requisitos del programa.
- El botón «Exportar CSV» está deshabilitado cuando el programa no tiene requisitos.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se inicia sesión con `gestor@sigpro.test` (`Gestor1234!`) y se llega a Programas. Cada fila parte de un contexto nuevo.
- Tras un reinicio, `PRG-001` tiene 14 requisitos, con 3 validados, 3 en borrador y 13 con casos enlazados. `PRG-002` tiene 14 requisitos, con 4 validados, 5 en borrador y 13 con casos enlazados. `PRG-004` no tiene requisitos.
- Las líneas del CSV de `PRG-002` para `REQ-015` y `REQ-017` son, sin el salto de línea final: `REQ-015;"Registro de eventos del subsistema 015";validated;medium;;;TC-010` y `REQ-017;"Disponibilidad del subsistema 017";draft;low;REQ-015;security;TC-012`.

## Criterios de aceptación
```gherkin
Característica: Cifras, documento y CSV de los requisitos en la web

  Esquema del escenario: Las cuatro tarjetas muestran las cifras del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre <programa>/requirements con una ventana de 1440 px
    Cuando mira las tarjetas de cifras
    Entonces la tarjeta <tarjeta> muestra <valor> con el texto <texto>

    Ejemplos:
      | programa | tarjeta | valor | texto |
      | /programs/PRG-001 | «Requisitos» | 14 | «validados: 3» |
      | /programs/PRG-001 | «Cobertura de verificación» | «93 %» | «13 de 14 con pruebas» |
      | /programs/PRG-001 | «Pendientes de aprobación» | 3 | «en borrador» |
      | /programs/PRG-002 | «Requisitos» | 14 | «validados: 4» |
      | /programs/PRG-002 | «Pendientes de aprobación» | 5 | «en borrador» |

  Esquema del escenario: Las cifras no cambian con la búsqueda ni con el filtro de estado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001/requirements con una ventana de 1440 px
    Cuando escribe 005 en «Buscar requisitos» y elige «Validado» en el filtro «Estado»
    Entonces la tarjeta «Requisitos» sigue mostrando 14 con el texto «validados: 3»

    Ejemplos:
      | programa |
      | PRG-001 |

  Esquema del escenario: La pestaña Documento numera los requisitos según su lugar en el árbol
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-002/requirements con una ventana de 1440 px y elige la pestaña «Documento»
    Cuando mira el requisito <codigo>
    Entonces ve el número <numero> delante del título <titulo>

    Ejemplos:
      | codigo | numero | titulo |
      | REQ-015 | «1» | «Registro de eventos del subsistema 015» |
      | REQ-017 | «1.2» | «Disponibilidad del subsistema 017» |
      | REQ-018 | «1.2.1» | «Latencia del subsistema 018» |
      | REQ-019 | «1.3» | «Cifrado del subsistema 019» |

  Esquema del escenario: Con una búsqueda activa el documento recalcula los números
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-002/requirements con una ventana de 1440 px y elige la pestaña «Documento»
    Cuando escribe 017 en «Buscar requisitos»
    Entonces ve el requisito REQ-015 con el número «1» y el requisito REQ-017 con el número «1.1»

    Ejemplos:
      | programa |
      | PRG-002 |

  Esquema del escenario: Exportar CSV descarga todos los requisitos del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-002/requirements con una ventana de 1440 px y ha escrito 017 en «Buscar requisitos»
    Cuando pulsa «Exportar CSV»
    Entonces se descarga el archivo «sigpro-requisitos.csv»
    Y su primera línea es code;title;state;priority;parent;tags;tests
    Y ve el aviso emergente «CSV generado» con el texto <filas>

    Ejemplos:
      | filas |
      | «14 filas exportadas» |

  Esquema del escenario: Las líneas del CSV describen cada requisito con su padre, sus etiquetas y sus casos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-002/requirements con una ventana de 1440 px y pulsa «Exportar CSV»
    Cuando abre el archivo sigpro-requisitos.csv
    Entonces una de sus líneas es <linea>

    Ejemplos:
      | linea |
      | REQ-015;"Registro de eventos del subsistema 015";validated;medium;;;TC-010 |
      | REQ-017;"Disponibilidad del subsistema 017";draft;low;REQ-015;security;TC-012 |

  Esquema del escenario: Exportar CSV no está disponible en un programa sin requisitos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-004/requirements con una ventana de 1440 px
    Cuando mira el botón «Exportar CSV»
    Entonces el botón está deshabilitado

    Ejemplos:
      | programa |
      | PRG-004 |
```

## Decisiones pendientes
- El motivo que se muestra cuando «Exportar CSV» está deshabilitado porque no hay requisitos. Hoy el botón reutiliza el texto de la lista de programas («No hay programas para exportar»). No está decidido cuál debe ser, y ninguna fila lo afirma.

## Fuera de alcance
- La exportación CSV de la lista de programas: EP-PROG-LISTA.
- La exportación CSV en la app móvil: esta misma épica (EP-REQ-ARBOL), en la historia de la app móvil sobre copiar y exportar.
- Enlazar y desenlazar casos de prueba, que cambian las cifras de cobertura, y la matriz de trazabilidad: EP-REQ-TRAZA.
- Cambiar el estado de un requisito, de cuyo estado salen las cifras de validados y pendientes: EP-REQ-FLUJO.
- Crear o editar requisitos, que cambian las cifras: EP-REQ-EDICION.
- El árbol, la búsqueda y el detalle de un requisito: esta misma épica (EP-REQ-ARBOL), en sus historias de la web sobre el árbol, la búsqueda y el detalle.
