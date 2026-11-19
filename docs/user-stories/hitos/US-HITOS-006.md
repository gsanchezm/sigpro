---
id: US-HITOS-006
tipo: historia
epica: EP-HITOS
titulo: "[Web] Ver la pestaña «Hitos»: tabla, recuento, estados y permisos de cada rol"
etiquetas: [web]
relacionadas: [US-HITOS-001, US-HITOS-010, US-PROG-DETALLE-002]
verificacion: codigo
cubre: ["/programs/:code"]
permisos: [milestone.edit, milestone.delete]
---

## Historia
Como persona con una cuenta en SIGPRO que gestiona programas o solo los consulta, quiero ver los hitos de un programa en una tabla con su fecha límite, su avance y su estado,
para saber cuántos están cumplidos y qué puedo cambiar según mi rol.

## Reglas
- En la ficha de un programa, la pestaña «Hitos» muestra una tabla con las columnas «Hito», «Fecha límite», «Avance» y «Estado». Cada fila es un hito.
- Los hitos van por fecha límite ascendente y, con la misma fecha, por su código.
- La columna «Fecha límite» muestra la fecha como dd/mm/aaaa. La columna «Avance» muestra el valor como «n %» junto a un deslizador de avance que va de 0 a 100 en pasos de 5. La columna «Estado» muestra «Cumplido» cuando el avance es 100 %, «En curso» cuando está entre 1 % y 99 %, y «Pendiente» con 0 %.
- Sobre la tabla, el recuento dice «n de N hitos cumplidos», con N el número de hitos del programa. Mientras la lista se carga, el recuento muestra solo «…».
- Encima de la tabla, con permiso de edición se ve el texto «Doble clic para editar · Intro guarda · Esc cancela». Sin permiso de edición se ve el texto «Tu rol no permite modificar hitos».
- Los roles admin y program_manager tienen los permisos `milestone.edit` y `milestone.delete`: pueden crear, editar, mover el avance y borrar. Los roles consultant y auditor solo ven la tabla. Para ellos, el botón «Nuevo hito» está deshabilitado y, al pasar el ratón por él, se ve el motivo «Tu rol no permite crear hitos»; los deslizadores de avance no se pueden mover; y el menú ⋯ de cada hito ofrece «Renombrar» y «Eliminar» deshabilitados, con los motivos «Tu rol no permite modificar hitos» y «Tu rol no permite eliminar hitos» al pasar el ratón.
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos, nombrados en este orden: SRR, PDR, CDR, TRR, FAT, SAT, Entrega, Cierre y Garantía. Solo SRR está cumplido, PDR va al 10 % y el resto al 0 %, con lo que el recuento es «1 de 9 hitos cumplidos». `PRG-004` tiene 9 hitos con esos mismos nombres: SRR y PDR están cumplidos, CDR va al 45 % y el recuento es «2 de 9 hitos cumplidos». `PRG-003` tiene hitos en el seed, pero la fila de estado vacío los borra todos antes de entrar.
- Preparación de cada fila: en el tenant `alumno01`, se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada y se entra con la cuenta de la fila (`gestor@sigpro.test` con `Gestor1234!`, `consultor@sigpro.test` con `Consul1234!` o `auditor@sigpro.test` con `Audit1234!`) hasta llegar a `/programs`. Para las filas que borran hitos como preparación, se usa el `accessToken` de `gestor@sigpro.test`, obtenido con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`.
- Para las filas de carga y de error, la prueba retrasa o responde la petición `GET /api/programs/PRG-001/milestones` en el navegador antes de abrir la pestaña.

## Criterios de aceptación
```gherkin
Característica: Pestaña de hitos en la ficha del programa (web)

  Esquema del escenario: La tabla muestra cada hito con su avance y su estado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada y abre /programs/PRG-001 y elige la pestaña «Hitos»
    Cuando mira la fila de <hito>
    Entonces la columna <columna> muestra <valor>

    Ejemplos:
      | hito | columna | valor |
      | «SRR» | «Avance» | 100 % |
      | «SRR» | «Estado» | «Cumplido» |
      | «PDR» | «Avance» | 10 % |
      | «PDR» | «Estado» | «En curso» |
      | «CDR» | «Estado» | «Pendiente» |

  Esquema del escenario: Los hitos van por fecha límite y el recuento dice cuántos están cumplidos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada y abre /programs/<programa> y elige la pestaña «Hitos»
    Cuando mira la tabla de hitos
    Entonces el primer hito es <primero>, el último es <ultimo> y el recuento dice <recuento>

    Ejemplos:
      | programa | primero | ultimo | recuento |
      | PRG-001 | «SRR» | «Garantía» | «1 de 9 hitos cumplidos» |
      | PRG-004 | «SRR» | «Garantía» | «2 de 9 hitos cumplidos» |

  Esquema del escenario: Cada rol ve la tabla con lo que su rol permite
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha entrado en /programs con sesión iniciada y abre /programs/PRG-001 y elige la pestaña «Hitos»
    Cuando mira el encabezado de la tabla y el botón «Nuevo hito»
    Entonces ve <resultado>

    Ejemplos:
      | cuenta | resultado |
      | gestor@sigpro.test | el texto «Doble clic para editar · Intro guarda · Esc cancela» y «Nuevo hito» habilitado |
      | consultor@sigpro.test | el texto «Tu rol no permite modificar hitos», «Nuevo hito» deshabilitado y los deslizadores de avance sin poder moverse |
      | auditor@sigpro.test | el texto «Tu rol no permite modificar hitos», «Nuevo hito» deshabilitado y los deslizadores de avance sin poder moverse |

  Esquema del escenario: La pestaña muestra el estado vacío cuando el programa no tiene hitos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada y se han borrado, uno a uno y con su id, todos los hitos de <programa> mediante DELETE hasta que su lista está vacía
    Cuando abre /programs/<programa> y elige la pestaña «Hitos»
    Entonces ve el aviso «Este programa todavía no tiene hitos.» y el recuento dice «0 de 0 hitos cumplidos»

    Ejemplos:
      | programa |
      | PRG-003 |

  Esquema del escenario: Mientras llega la lista se ven filas de carga y el recuento solo dice «…»
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada y la prueba retrasa <espera> la respuesta de GET /api/programs/PRG-001/milestones en el navegador
    Cuando abre /programs/PRG-001 y elige la pestaña «Hitos»
    Entonces mientras llega la respuesta ve filas de carga en lugar de hitos y el recuento solo dice «…»
    Y al llegar la respuesta ve los 9 hitos del programa

    Ejemplos:
      | espera |
      | 3 segundos |

  Esquema del escenario: Un fallo al cargar la lista se muestra con «Reintentar»
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada y la prueba responde 500 a GET /api/programs/<programa>/milestones en el navegador
    Cuando abre /programs/<programa> y elige la pestaña «Hitos»
    Entonces ve el aviso «No se pudieron cargar los hitos» con el botón «Reintentar» y no ve ninguna fila de hito
    Y cuando la prueba deja de responder 500 y pulsa «Reintentar» ve los 9 hitos del programa

    Ejemplos:
      | programa |
      | PRG-001 |
```

## Fuera de alcance
- La ficha del programa, su cabecera, su resumen y las pestañas Requisitos y Proveedores: EP-PROG-DETALLE.
- El alta, la edición del nombre y de la fecha, el avance y el borrado desde la tabla: EP-HITOS, en sus historias de interfaz de la web.
- Cómo se entra en Programas: EP-LOGIN.
- El texto de la línea técnica que pueda acompañar al aviso de carga fallida: no se afirma aquí.
