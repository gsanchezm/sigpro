---
id: US-REQ-ARBOL-003
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Web] Ver el árbol de requisitos: jerarquía, orden, plegar y desplegar"
etiquetas: [web]
relacionadas: [US-REQ-ARBOL-009, US-REQ-ARBOL-001, US-PROG-DETALLE-002]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero ver los requisitos de un programa como un árbol, con cada requisito debajo de su padre y los hermanos en su orden, y poder plegar las ramas que no necesito,
para entender la estructura del programa y encontrar un requisito dentro de su rama.

## Reglas
- La página `/programs/:code/requirements` muestra los requisitos del programa de la dirección. En la cabecera hay una etiqueta «Programa», un desplegable con los programas del tenant (cada opción con el formato «PRG-001 · Sistema de mando táctico Ártemis») y, a su lado, el nombre del programa abierto.
- Cada requisito es una fila. Los hijos de un requisito van justo debajo de él, sangrados un nivel más que su padre. Los hermanos aparecen en el orden de su posición, y los requisitos raíz (sin padre) siguen el mismo orden entre ellos.
- Al abrir la página, todo el árbol aparece desplegado.
- Un requisito que tiene hijos muestra un botón de plegado con el nombre «Contraer» seguido del código (por ejemplo, «Contraer REQ-015») cuando está desplegado, y «Expandir REQ-015» cuando está plegado. Pulsarlo pliega o despliega solo esa rama. Al plegar un requisito dejan de verse todos sus descendientes, a cualquier nivel, y al desplegarlo vuelven a verse los que no estén plegados por su cuenta.
- Los botones «Contraer todo» y «Expandir todo» pliegan todas las ramas (quedan visibles solo los requisitos raíz) o despliegan todas. Están deshabilitados si el programa no tiene ningún requisito con hijos.
- Junto a los controles, el contador «N de M requisitos» indica cuántos requisitos hay en total (M) y cuántos cumplen los filtros de búsqueda y estado (N); sin filtros, N es igual a M. El contador no cambia al plegar ni al desplegar.
- Cada fila muestra el código, el título y el estado, con su etiqueta («Borrador», «Aprobado», «Verificado» o «Validado»). En una ventana de 1024 px o más, la fila muestra además las etiquetas del requisito (hasta dos, con su nombre, y «+n» si tiene más), la columna «Pruebas» (los casos que pasan de los enlazados, por ejemplo «1/2»; «—» si no tiene casos enlazados) y la columna «NC» (el código de la primera no conformidad abierta, con «+n» si hay más; «—» si no tiene ninguna abierta). Encima de las filas aparece la cabecera de columnas «Requisito», «Estado», «Pruebas» y «NC».
- En una ventana de menos de 1024 px, cada fila muestra solo el código, el título y el estado: no aparecen las etiquetas, ni la columna «Pruebas», ni la columna «NC», ni la cabecera de columnas.
- Al cambiar de programa en el desplegable, la página pasa a mostrar los requisitos del programa elegido, con la búsqueda y los filtros vacíos, todo el árbol desplegado y sin ningún detalle abierto.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se inicia sesión con la cuenta de la fila y se llega a Programas. Las cuentas son `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y `alumno01@sigpro.lab` (`Alumno1234!`, rol admin, sin segundo factor). Cada fila parte de un contexto nuevo.
- Tras un reinicio, `PRG-001` tiene 14 requisitos (de `REQ-001` a `REQ-014`), `PRG-002` tiene 14 (de `REQ-015` a `REQ-028`) y `PRG-004` no tiene ninguno.

## Criterios de aceptación
```gherkin
Característica: Árbol de requisitos en la web

  Esquema del escenario: Cada requisito aparece bajo su padre y en el orden de su posición
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-002/requirements con una ventana de 1440 px
    Cuando mira la lista de requisitos sin tocar ningún control
    Entonces ve el requisito <codigo> <lugar>

    Ejemplos:
      | codigo | lugar |
      | REQ-016 | justo debajo de REQ-015, sangrado un nivel más que REQ-015 |
      | REQ-017 | justo debajo de REQ-016, al mismo nivel que REQ-016 |
      | REQ-018 | justo debajo de REQ-017, sangrado un nivel más que REQ-017 |
      | REQ-019 | justo debajo de REQ-018, al mismo nivel que REQ-017 |
      | REQ-028 | justo debajo de REQ-027, sangrado un nivel más que REQ-027 |

  Esquema del escenario: Plegar un requisito oculta a sus descendientes y desplegarlo los devuelve
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-002/requirements con una ventana de 1440 px
    Cuando pulsa <contraer>
    Entonces deja de ver <ocultos>
    Y sigue viendo <visibles>
    Cuando pulsa <expandir>
    Entonces vuelve a ver <ocultos>

    Ejemplos:
      | contraer | expandir | ocultos | visibles |
      | «Contraer REQ-015» | «Expandir REQ-015» | REQ-016, REQ-017, REQ-018 y REQ-019 | REQ-020 |
      | «Contraer REQ-017» | «Expandir REQ-017» | REQ-018 | REQ-016 y REQ-019 |
      | «Contraer REQ-027» | «Expandir REQ-027» | REQ-028 | REQ-026 |

  Esquema del escenario: Contraer todo deja visibles solo los requisitos raíz
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre <programa>/requirements con una ventana de 1440 px
    Cuando pulsa «Contraer todo»
    Entonces ve solo <visibles>
    Y el contador dice «14 de 14 requisitos»

    Ejemplos:
      | programa | visibles |
      | /programs/PRG-001 | REQ-001, REQ-006 y REQ-011 |
      | /programs/PRG-002 | REQ-015, REQ-020 y REQ-025 |

  Esquema del escenario: Expandir todo despliega todas las ramas de nuevo
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001/requirements con una ventana de 1440 px y ha pulsado «Contraer todo»
    Cuando pulsa «Expandir todo»
    Entonces ve los catorce requisitos, de REQ-001 a REQ-014
    Y el contador dice «14 de 14 requisitos»

    Ejemplos:
      | programa |
      | PRG-001 |

  Esquema del escenario: Las filas muestran las etiquetas, las pruebas y las no conformidades en escritorio
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001/requirements con una ventana de <ancho>
    Cuando mira la fila de REQ-001
    Entonces ve el código REQ-001, el título Disponibilidad del subsistema 001 y el estado «Aprobado»
    Y <columnas>

    Ejemplos:
      | ancho | columnas |
      | 1440 px | ve la etiqueta «Ciberseguridad», la cabecera de columnas con «Pruebas» y «NC», y en la fila las columnas «Pruebas» y «NC» |
      | 390 px | no ve ninguna etiqueta, ni las columnas «Pruebas» y «NC», ni la cabecera de columnas |

  Esquema del escenario: Cambiar de programa en el desplegable muestra el árbol del programa elegido
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001/requirements con una ventana de 1440 px y ha escrito «005» en «Buscar requisitos»
    Cuando elige «PRG-002 · Radar de vigilancia costera RVC-2» en «Programa»
    Entonces llega a /programs/PRG-002/requirements
    Y el campo «Buscar requisitos» está vacío
    Y el contador dice «14 de 14 requisitos»
    Y ve el requisito REQ-015 con el título Registro de eventos del subsistema 015

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
```

## Fuera de alcance
- La búsqueda por código o título y el filtro por estado: esta misma épica (EP-REQ-ARBOL), en su historia de la web sobre búsqueda y filtros.
- El detalle de un requisito que se abre desde el árbol: esta misma épica, en su historia de la web sobre el detalle.
- Crear, editar, borrar y reordenar requisitos, incluido arrastrar una fila: EP-REQ-EDICION.
- Los botones de transición de estado y el flujo de aprobación: EP-REQ-FLUJO.
- La matriz de trazabilidad, que es otra pestaña de la misma pantalla: EP-REQ-TRAZA.
- La lista de programas y la ficha del programa desde la que se llega: EP-PROG-LISTA y EP-PROG-DETALLE.
- El inicio de sesión con el que se llega a la pantalla: EP-LOGIN.
