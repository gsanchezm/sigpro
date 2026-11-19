---
id: US-PROG-DETALLE-002
tipo: historia
epica: EP-PROG-DETALLE
titulo: "[Web] Ver la ficha de un programa: cabecera, datos, pestañas y botón de editar según el rol"
etiquetas: [web]
relacionadas: [US-PROG-DETALLE-001, US-PROG-DETALLE-003, US-PROG-DETALLE-004, US-PROG-DETALLE-005]
verificacion: codigo
cubre: ["/programs/:code"]
permisos: [program.edit]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero abrir la ficha de un programa y ver de un vistazo su código, su estado, sus datos y sus pestañas, y si mi rol me permite editarlo,
para entender el programa, pasar a sus requisitos y decidir si lo modifico.

## Reglas
- La cabecera de `/programs/:code` muestra el código del programa, su estado como etiqueta («Borrador», «Activo», «En pausa», «Cerrado» o «Cancelado») y, a la derecha, el botón «Editar programa».
- Debajo, el nombre del programa es el título de la página. Si el programa tiene descripción, el texto aparece bajo el título; si no la tiene, no aparece nada.
- Después, la barra «Progreso» con el porcentaje escrito junto a ella, sin decimales y pegado al signo, como `11%`.
- Las opciones de la ficha son las pestañas «Resumen», «Hitos» y «Requisitos», en ese orden. La ficha se abre siempre en «Resumen».
- «Resumen» muestra seis campos: «Responsable», «Fechas», «Presupuesto», «Prioridad», «Clasificado» y «Hitos completados». Las fechas van como `dd/mm/aaaa → dd/mm/aaaa`; el presupuesto, como `450.000 €`; la prioridad, como «Baja», «Media» o «Alta»; «Clasificado» vale «Sí» o «No»; y «Hitos completados» muestra `hechos / total`. Debajo de los campos está la sección de proveedores, cuyo contenido es de EP-PROVEEDORES.
- «Hitos» muestra el panel de hitos del programa, cuyo contenido es de EP-HITOS.
- «Requisitos» no muestra ninguna lista: muestra solo el enlace «Abrir el árbol de requisitos de este programa», que lleva a `/programs/:code/requirements`.
- Elegir una opción muestra su contenido, y el de la opción anterior deja de verse.
- Con una ventana de 1024 px o más, las tres opciones se ven como pestañas en fila bajo la cabecera. Con una ventana de menos de 1024 px, las mismas opciones aparecen en una lista desplegable con la etiqueta «Detalle del programa».
- Con el foco en una pestaña, la flecha derecha pasa a la siguiente y la flecha izquierda a la anterior. Desde la última, la flecha derecha vuelve a la primera; desde la primera, la flecha izquierda va a la última.
- «Editar programa» está habilitado para los roles `admin` y `program_manager`, y al pulsarlo se abre `/programs/:code/edit`. Para los roles `consultant` y `auditor` está deshabilitado, con la explicación «Tu rol no permite modificar programas».
- Una persona sin ninguna sesión de SIGPRO guardada que abre `/programs/:code` llega a `/login` y no ve datos del programa.
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se inicia sesión con la cuenta de la fila y se llega a Programas. Las cuentas son `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y `alumno01@sigpro.lab` (`Alumno1234!`, rol admin, sin segundo factor). Cada fila parte de un contexto nuevo.

## Criterios de aceptación
```gherkin
Característica: Ficha de un programa en la web

  Esquema del escenario: La ficha de PRG-001 muestra sus datos del seed
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre /programs/PRG-001
    Entonces ve <dato> con el valor <valor>

    Ejemplos:
      | dato | valor |
      | el código | PRG-001 |
      | el título de la página | Sistema de mando táctico Ártemis |
      | la descripción | Programa «Sistema de mando táctico Ártemis»: alcance, hitos, requisitos y verificación del sistema. |
      | el estado | «Activo» |
      | el campo «Responsable» | Marta Ruiz |
      | el campo «Fechas» | 01/01/2023 → 01/07/2024 |
      | el campo «Presupuesto» | 450.000 € |
      | el campo «Prioridad» | «Media» |
      | el campo «Clasificado» | «Sí» |
      | el campo «Hitos completados» | 1 / 9 |
      | la barra «Progreso» | 11% |

  Esquema del escenario: El botón Editar programa depende del rol
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la web
    Cuando abre /programs/PRG-001
    Entonces el botón «Editar programa» está <estado_boton>
    Y <al_pulsarlo>

    Ejemplos:
      | cuenta | estado_boton | al_pulsarlo |
      | gestor@sigpro.test | habilitado | al pulsarlo llega a /programs/PRG-001/edit |
      | alumno01@sigpro.lab | habilitado | al pulsarlo llega a /programs/PRG-001/edit |
      | consultor@sigpro.test | deshabilitado con la explicación «Tu rol no permite modificar programas» | no se puede pulsar |
      | auditor@sigpro.test | deshabilitado con la explicación «Tu rol no permite modificar programas» | no se puede pulsar |

  Esquema del escenario: Cada opción de la ficha muestra su contenido en cada ventana
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001 con una ventana de <ventana>
    Cuando elige la opción <opcion>
    Entonces ve <contenido>
    Y la opción seleccionada es <opcion>

    Ejemplos:
      | ventana | opcion | contenido |
      | 1440 px | «Resumen» | los datos de la ficha y la sección de proveedores del programa |
      | 1440 px | «Hitos» | el panel de hitos del programa |
      | 1440 px | «Requisitos» | solo el enlace «Abrir el árbol de requisitos de este programa» |
      | 390 px | «Resumen» | los datos de la ficha y la sección de proveedores del programa |
      | 390 px | «Hitos» | el panel de hitos del programa |
      | 390 px | «Requisitos» | solo el enlace «Abrir el árbol de requisitos de este programa» |

  Esquema del escenario: Las flechas del teclado cambian de pestaña con una ventana ancha
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web con una ventana de 1440 px y está en /programs/PRG-001 con la pestaña <desde> seleccionada y el foco en ella
    Cuando pulsa la <tecla>
    Entonces la pestaña seleccionada es <hasta>

    Ejemplos:
      | desde | tecla | hasta |
      | «Resumen» | flecha derecha | «Hitos» |
      | «Resumen» | flecha izquierda | «Requisitos» |

  Esquema del escenario: El ancho de la ventana decide cómo se ven las opciones
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001 con una ventana de <ancho>
    Cuando mira las opciones de la ficha
    Entonces ve <forma>

    Ejemplos:
      | ancho | forma |
      | 390 px | una lista desplegable con la etiqueta «Detalle del programa» |
      | 1023 px | una lista desplegable con la etiqueta «Detalle del programa» |
      | 1024 px | las pestañas «Resumen», «Hitos» y «Requisitos» en fila |
      | 1440 px | las pestañas «Resumen», «Hitos» y «Requisitos» en fila |

  Esquema del escenario: El enlace de Requisitos lleva al árbol del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y tiene abierta la ficha de <codigo> con la pestaña «Requisitos» seleccionada
    Cuando pulsa «Abrir el árbol de requisitos de este programa»
    Entonces llega a /programs/<codigo>/requirements

    Ejemplos:
      | codigo |
      | PRG-001 |

  Esquema del escenario: Sin sesión, la ficha lleva al acceso
    Dado que en el tenant alumno01, recién reiniciado, una persona sin ninguna sesión de SIGPRO guardada está en /login?tenant=alumno01
    Cuando abre <ruta>
    Entonces llega a /login
    Y no ve ningún dato del programa

    Ejemplos:
      | ruta |
      | /programs/PRG-001 |
```

## Fuera de alcance
- El contenido de la pestaña Hitos y el alta, la edición, el avance y el borrado de hitos: EP-HITOS.
- La sección de proveedores del Resumen y su búsqueda: EP-PROVEEDORES.
- La pantalla de alta y edición a la que lleva «Editar programa»: EP-PROG-ALTA.
- Archivar, duplicar y eliminar un programa: EP-PROG-GESTION.
- El árbol y la matriz de requisitos a los que lleva el enlace: las épicas EP-REQ-*.
- El inicio de sesión con el que se llega a la ficha: EP-LOGIN.
- La lista de programas y el panel lateral que se abre desde ella: EP-PROG-LISTA y EP-PROG-DETALLE, en la historia del panel lateral.
