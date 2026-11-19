---
id: US-DOC-LISTA-010
tipo: historia
epica: EP-DOC-LISTA
titulo: "[Web] Ver una versión de un documento en el visor"
etiquetas: [web]
relacionadas: [US-DOC-LISTA-004, US-DOC-LISTA-009, US-DOC-LISTA-012]
verificacion: codigo
cubre: ["/documents/:id/view"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero leer una versión de un documento como una página de lectura, sin el menú de la aplicación,
para leerlo completo, con su versión y su fecha a la vista, tanto desde la ficha como en una pestaña nueva.

## Reglas
- `/documents/:id/view` es una página de lectura sin el marco de la aplicación: no tiene el menú de navegación de SIGPRO. Sirve igual en una pestaña nueva que dentro de la ficha. Requiere la sesión iniciada en el mismo navegador.
- Sin parámetro, muestra la última versión. Con `?version=N`, muestra la versión N.
- La cabecera muestra el código del documento, su etiqueta de clasificación («Público» o «Restringido»), «Versión N», la fecha de la versión en dd/mm/aaaa y el título como encabezado. Si la versión tiene nota, la nota aparece debajo del título.
- El cuerpo muestra una tarjeta por página, titulada «Página N de T», donde T es el total de páginas. Cada tarjeta lleva sus líneas en el orden del documento. Los apartados numerados (por ejemplo, «1. Objeto») se leen en negrita, y las líneas vacías dejan un hueco.
- Las páginas se muestran todas a la vez, una debajo de otra. Al pie aparece el texto «SIGPRO · documento ficticio del laboratorio».
- Mientras llega el contenido, la página muestra «Cargando documento…».
- Un código que no existe, o una versión que no existe en ese documento, muestra el aviso «No se encontró el documento» con la traza de la petición. Cualquier otro fallo muestra el aviso «No se pudo cargar el documento» con la traza.
- Datos del seed que citan los ejemplos: `DOC-001` tiene tres versiones. La 3, la última, tiene dos páginas, de 12 y 9 líneas; la 2 tiene dos páginas, de 12 y 7 líneas; y la 1 tiene dos páginas, de 12 y 6 líneas. `DOC-002` tiene una sola versión, la 1, con dos páginas de 12 y 6 líneas. Las fechas de `DOC-001` son 05/02/2026 para la versión 3, 29/01/2026 para la 2 y 22/01/2026 para la 1.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada; `gestor@sigpro.test` (contraseña `Gestor1234!`) entra y llega a `/programs`. La prueba provoca las demoras y los errores de cada fila en ese navegador antes de abrir la página del visor.

## Criterios de aceptación
```gherkin
Característica: Visor de una versión en la web

  Esquema del escenario: El visor muestra la versión pedida con su cabecera
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene la sesión iniciada en la web
    Cuando abre <direccion>
    Entonces ve el código <codigo>, la versión <version>, la fecha <fecha>, el título <titulo> y la nota <nota>

    Ejemplos:
      | direccion | codigo | version | fecha | titulo | nota |
      | /documents/DOC-001/view | DOC-001 | 3 | 05/02/2026 | Plan de verificación PRG-001 | Nuevos criterios de aceptación y anexos |
      | /documents/DOC-001/view?version=2 | DOC-001 | 2 | 29/01/2026 | Plan de verificación PRG-001 | Ajuste de alcance y responsabilidades |
      | /documents/DOC-002/view | DOC-002 | 1 | 22/01/2026 | Especificación técnica PRG-001 | Versión inicial |

  Esquema del escenario: Cada página se titula con su número y reparte las líneas en orden
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene la sesión iniciada en la web
    Cuando abre /documents/DOC-001/view
    Entonces ve «Página <pagina> de 2» con las líneas que empiezan por <primera> y acaban en <ultima>

    Ejemplos:
      | pagina | primera | ultima |
      | 1 | Plan de verificación PRG-001 | El consultor ejecuta las pruebas. |
      | 2 | El auditor valida los resultados. | Anexo A: matriz de trazabilidad. |

  Esquema del escenario: Un documento o una versión que no existen muestran el aviso de no encontrado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene la sesión iniciada en la web
    Cuando abre <direccion>
    Entonces ve el aviso «No se encontró el documento» con la traza de la petición y ninguna página

    Ejemplos:
      | direccion |
      | /documents/DOC-013/view |
      | /documents/DOC-001/view?version=9 |

  Esquema del escenario: Mientras llega el contenido se ve «Cargando documento…» y después el documento
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene la sesión iniciada en la web y la prueba retrasa <espera> la respuesta de GET /api/documents/DOC-002/content en ese navegador
    Cuando abre /documents/DOC-002/view
    Entonces ve «Cargando documento…» mientras espera
    Y al llegar la respuesta ve «Página 2 de 2» con la línea «El consultor ejecuta las pruebas.» al principio

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |
```

## Decisiones pendientes
- Qué muestra el visor con `?version=0` o con un valor que no es un número. Hoy, con esos valores, muestra la última versión sin error, mientras que la API responde 404 a `version=0`; no está decidido cuál debe ser el comportamiento. Ningún ejemplo de esta historia lo afirma.
- La línea de detalle técnico que aparece bajo el aviso de error del visor (la traza de la petición fallida). Hoy la muestra; no está decidido si forma parte del producto ni qué debe contener.

## Fuera de alcance
- Comparar dos versiones: EP-DOC-VERSIONES.
- El acceso denegado de un documento restringido para un rol que no puede verlo: EP-DOC-RESTRINGIDOS.
- Cómo se inicia sesión antes de abrir el visor: EP-LOGIN.
- La ficha desde la que se abre el visor: historia de la ficha de la web de esta épica.
