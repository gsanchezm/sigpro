---
id: US-NAVEGACION-012
tipo: historia
epica: EP-NAVEGACION
titulo: "[Móvil] Buscar en la pantalla «Búsqueda global» con resultados agrupados"
etiquetas: [movil]
relacionadas: [US-NAVEGACION-001, US-NAVEGACION-007, US-NAVEGACION-011, US-NAVEGACION-013]
verificacion: ejecutada
cubre: ["/search"]
---

## Historia
Como persona que usa SIGPRO en el móvil, quiero buscar un programa, un requisito, un caso, una no conformidad o un documento desde una pantalla propia,
para encontrarlo sin recorrer las listas, con los mismos resultados que en la web.

## Reglas
- Se llega desde «Más», con la primera fila «Búsqueda global». La pantalla se titula «Búsqueda global». El campo «Búsqueda global» tiene el foco al abrirse y muestra el texto de ayuda «Buscar código o nombre…» mientras está vacío.
- Con menos de dos caracteres (sin contar los espacios del principio y del final), el aviso es «Escribe al menos 2 caracteres» y no se pide nada. Con el campo vacío, el aviso es el mismo.
- Desde dos caracteres, la búsqueda se pide cuando el texto lleva 250 ms sin cambiar, para no pedir una respuesta por cada letra. Mientras la respuesta no llega, el aviso dice «Buscando…». Mientras se escribe, no se muestran los resultados de la búsqueda anterior.
- Los resultados se agrupan por tipo, en el orden de la web, con el título del grupo (Programas, Requisitos, Casos de prueba, No conformidades, Documentos) y su total: «5 / 40» cuando hay más coincidencias que las que se muestran, o solo el total cuando se muestran todas. Cada resultado se lee como código, título y subtítulo, en ese orden. Si hay más coincidencias que las mostradas, bajo el grupo aparece «N más», con el número de las que no se muestran.
- El aviso de estado dice «N resultados en M grupos», o «1 resultado» si hay uno solo. Si no hay coincidencias, dice «Sin resultados para «<texto>»».
- Si la petición falla, el aviso dice «No se pudo buscar» y aparece el botón «Reintentar». Pulsarlo vuelve a pedir el mismo texto.
- Al salir de la pantalla, el campo queda vacío.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se inicia sesión en la app móvil con `gestor@sigpro.test` y `Gestor1234!`, con `alumno01` en «Tenant de trabajo», y se abre «Búsqueda global» desde «Más».

## Criterios de aceptación
```gherkin
Característica: Búsqueda global en la app móvil

  Esquema del escenario: El campo muestra el aviso mínimo o el resultado de lo escrito
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil y ha abierto «Búsqueda global» desde «Más»
    Cuando el campo «Búsqueda global» contiene <texto>
    Entonces ve <aviso>

    Ejemplos:
      | texto | aviso |
      | (vacío) | «Escribe al menos 2 caracteres» |
      | a | «Escribe al menos 2 caracteres» |
      | zz | «Sin resultados para «zz»» |

  Esquema del escenario: Los grupos muestran su total y el aviso de estado dice cuántos resultados hay
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil y ha abierto «Búsqueda global» desde «Más»
    Cuando escribe PRG-001 en «Búsqueda global» y los resultados llegan
    Entonces ve el grupo «Programas» con el total 1 y el grupo «Documentos» con el total 2, en ese orden
    Y el aviso de estado dice «3 resultados en 2 grupos»

    Ejemplos:
      | texto |
      | PRG-001 |

  Esquema del escenario: Un grupo con más coincidencias que resultados muestra su total parcial y el «N más»
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil y ha abierto «Búsqueda global» desde «Más»
    Cuando escribe <texto> en «Búsqueda global» y los resultados llegan
    Entonces ve el grupo <grupo> con el total <total>, con <mostrados> resultados y debajo «<masq> más»

    Ejemplos:
      | texto | grupo | total | mostrados | masq |
      | subsistema | «Requisitos» | «5 / 40» | 5 | 35 |
      | verificar | «Casos de prueba» | «5 / 25» | 5 | 20 |

  Esquema del escenario: Un error de la búsqueda se puede reintentar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil, ha abierto «Búsqueda global» desde «Más» y la prueba hace fallar la respuesta de GET /api/search
    Cuando escribe <texto> en «Búsqueda global»
    Entonces ve el aviso «No se pudo buscar» y el botón «Reintentar»
    Y después de dejar de hacer fallar la respuesta, al pulsar «Reintentar» ve el aviso «3 resultados en 2 grupos»

    Ejemplos:
      | texto |
      | PRG-001 |

  Esquema del escenario: Mientras la búsqueda espera la respuesta, el aviso dice «Buscando…»
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil, ha abierto «Búsqueda global» desde «Más» y la prueba retrasa 3 segundos la respuesta de GET /api/search
    Cuando escribe <texto> en «Búsqueda global»
    Entonces ve el aviso «Buscando…» mientras espera
    Y al llegar la respuesta ve el aviso «3 resultados en 2 grupos»

    Ejemplos:
      | texto |
      | PRG-001 |
```

## Fuera de alcance
- Lo que abre cada resultado: US-NAVEGACION-013.
- El icono de búsqueda de la cabecera de la web y su pantalla completa: US-NAVEGACION-007.
- Lo que devuelve la API y el mínimo de caracteres exigido por el servidor: US-NAVEGACION-001 y US-NAVEGACION-002.
- Los documentos restringidos dentro de la búsqueda: US-DOC-RESTRINGIDOS-004.

## Decisiones pendientes
- Si la búsqueda debe tener también un acceso directo desde la cabecera de las pestañas, como en la web. Hoy solo está en «Más».
- Si el aviso de estado con un solo grupo debe decir «1 grupo». Hoy dice «en 1 grupos», como la web.
