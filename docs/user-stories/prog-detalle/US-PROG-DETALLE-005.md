---
id: US-PROG-DETALLE-005
tipo: historia
epica: EP-PROG-DETALLE
titulo: "[Móvil] Ver la ficha de un programa: cabecera, datos, opciones, requisitos y botón de editar según el rol"
etiquetas: [movil]
relacionadas: [US-PROG-DETALLE-002, US-PROG-DETALLE-006]
verificacion: codigo
cubre: ["/programs/:code"]
permisos: [program.edit]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero abrir la ficha de un programa en la app móvil, ver su código, su estado y sus datos, cambiar entre sus opciones y pasar a sus requisitos, y saber si mi rol me permite editarlo,
para consultar un programa desde el móvil con los permisos de mi rol.

## Reglas
- La pantalla de `/programs/:code` tiene como título el nombre del programa. Debajo, en una misma línea, aparecen el código del programa y su estado como etiqueta («Borrador», «Activo», «En pausa», «Cerrado» o «Cancelado»).
- Debajo de esa línea está el botón «Editar programa».
- La ficha tiene tres opciones, «Resumen», «Hitos» y «Proveedores», en ese orden, dentro de un grupo con el nombre «Detalle del programa». La ficha se abre siempre en «Resumen».
- Elegir una opción muestra su contenido, y el de la opción anterior deja de verse.
- «Resumen» muestra la barra «Progreso» con el texto `11 %`, los campos «Responsable», «Fechas» y «Presupuesto» con sus valores, la descripción solo si el programa tiene una, y el botón «Ver requisitos». Las fechas van como `dd/mm/aaaa → dd/mm/aaaa` y el presupuesto, como `450.000 €`.
- «Hitos» muestra el panel de hitos del programa, cuyo contenido es de EP-HITOS. «Proveedores» muestra el panel de proveedores del programa, cuyo contenido es de EP-PROVEEDORES.
- «Ver requisitos» lleva a `/programs/:code/requirements`.
- «Editar programa» está habilitado para los roles `admin` y `program_manager`, y al pulsarlo se abre `/programs/:code/edit`. Para los roles `consultant` y `auditor` está deshabilitado y, debajo del botón, se lee el motivo «Tu rol no permite modificar programas».
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app móvil se deja en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo». La cuenta de la fila inicia sesión: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o `alumno01@sigpro.lab` (`Alumno1234!`, rol admin, sin segundo factor). Tras iniciar sesión se abre la ruta `/programs/PRG-001`. Cada fila parte de un contexto nuevo.

## Criterios de aceptación
```gherkin
Característica: Ficha de un programa en la app móvil

  Esquema del escenario: La ficha de PRG-001 muestra sus datos del seed
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo»
    Cuando abre la ruta /programs/PRG-001
    Entonces ve <dato> con el valor <valor>

    Ejemplos:
      | dato | valor |
      | el título | Sistema de mando táctico Ártemis |
      | el código | PRG-001 |
      | el estado | «Activo» |
      | el campo «Responsable» | Marta Ruiz |
      | el campo «Fechas» | 01/01/2023 → 01/07/2024 |
      | el campo «Presupuesto» | 450.000 € |
      | la barra «Progreso» | 11 % |
      | la descripción | Programa «Sistema de mando táctico Ártemis»: alcance, hitos, requisitos y verificación del sistema. |

  Esquema del escenario: El botón Editar programa depende del rol en la app móvil
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo»
    Cuando abre la ruta /programs/PRG-001
    Entonces el botón «Editar programa» está <estado_boton>
    Y <al_pulsarlo>

    Ejemplos:
      | cuenta | estado_boton | al_pulsarlo |
      | gestor@sigpro.test | habilitado | al pulsarlo se abre la ruta /programs/PRG-001/edit |
      | alumno01@sigpro.lab | habilitado | al pulsarlo se abre la ruta /programs/PRG-001/edit |
      | consultor@sigpro.test | deshabilitado, y debajo se lee «Tu rol no permite modificar programas» | no se puede pulsar |
      | auditor@sigpro.test | deshabilitado, y debajo se lee «Tu rol no permite modificar programas» | no se puede pulsar |

  Esquema del escenario: Cada opción de la ficha muestra su contenido en la app móvil
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y ha abierto la ruta /programs/PRG-001
    Cuando elige la opción <opcion>
    Entonces ve <contenido>
    Y la opción seleccionada es <opcion>

    Ejemplos:
      | opcion | contenido |
      | «Resumen» | los datos del programa y el botón «Ver requisitos» |
      | «Hitos» | el panel de hitos del programa |
      | «Proveedores» | el panel de proveedores del programa |

  Esquema del escenario: Ver requisitos lleva al árbol del programa en la app móvil
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y ha abierto la ruta /programs/<codigo>
    Cuando pulsa «Ver requisitos»
    Entonces llega a /programs/<codigo>/requirements

    Ejemplos:
      | codigo |
      | PRG-001 |
```

## Fuera de alcance
- El panel de hitos y el alta, la edición, el avance y el borrado de hitos: EP-HITOS.
- El panel de proveedores y la búsqueda de proveedores: EP-PROVEEDORES.
- La pantalla de alta y edición a la que lleva «Editar programa»: EP-PROG-ALTA.
- Archivar, duplicar y eliminar un programa: EP-PROG-GESTION.
- El árbol y la matriz de requisitos a los que lleva el botón «Ver requisitos»: las épicas EP-REQ-*.
- El inicio de sesión: EP-LOGIN.

## Decisiones pendientes
- Si la ficha de la app móvil debe mostrar también «Prioridad», «Clasificado» e «Hitos completados», como la ficha web. Hoy no los muestra. Esto describe lo que existe, no es un criterio, y que la app los muestre o no los muestre no se reporta como defecto.
