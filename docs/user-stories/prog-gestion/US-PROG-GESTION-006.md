---
id: US-PROG-GESTION-006
tipo: historia
epica: EP-PROG-GESTION
titulo: "[Web] Archivar, duplicar y eliminar un programa desde su menú de acciones"
etiquetas: [web]
relacionadas: [US-LOGIN-007, US-PROG-LISTA-005, US-PROG-LISTA-008, US-PROG-GESTION-001, US-PROG-GESTION-002, US-PROG-GESTION-003, US-PROG-GESTION-005, US-PROG-GESTION-008]
verificacion: codigo
cubre: ["/programs"]
permisos: [program.archive, program.create, program.delete]
---

## Historia
Como persona que gestiona programas desde la lista, quiero archivar, duplicar o eliminar un programa desde su menú de acciones, y ver el motivo cuando mi rol no puede hacer alguna de esas acciones,
para hacerlo sin abrir la ficha del programa.

## Reglas
- En escritorio (ancho de 1024 px o más), cada fila tiene un botón de menú con el nombre «Acciones para PRG-001». El menú tiene, en este orden, «Ver detalle», «Editar», «Duplicar», «Archivar», una línea separadora y «Eliminar».
- En el diseño responsive (menos de 1024 px), cada tarjeta tiene el mismo botón con el mismo nombre. Abre una hoja inferior titulada «Acciones para PRG-001» con las mismas acciones.
- Una acción que el rol no puede hacer aparece deshabilitada, con su motivo como texto de ayuda: «Editar» explica «Tu rol no permite modificar programas»; «Duplicar», «Tu rol no permite crear programas»; «Archivar», «Tu rol no permite archivar programas»; y «Eliminar», «Solo admin puede eliminar».
- «Archivar» pasa el programa a «Cerrado» sin pedir confirmación.
- «Duplicar» crea la copia como borrador sin pedir confirmación. Después, la lista pasa a orden descendente por código y a la página 1, y la copia es la primera fila o tarjeta.
- «Eliminar» abre el diálogo de confirmación de US-PROG-GESTION-008. No borra nada hasta que se confirma.
- Un fallo de la API muestra un aviso de error con el título «Ha ocurrido un error inesperado» y la traza HTTP.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe la cuenta de la fila con su contraseña (`gestor@sigpro.test` con `Gestor1234!` si la fila no dice otra cosa; `consultor@sigpro.test` con `Consul1234!`, `auditor@sigpro.test` con `Audit1234!` o `admin@sigpro.test` con `Admin1234!`, que pide el código `123456`) y se llega a `/programs`.

## Criterios de aceptación
```gherkin
Característica: Acciones de cada programa desde su menú en la web

  Esquema del escenario: Cada rol ve habilitadas solo las acciones que su permiso permite
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha entrado en /programs sin filtros en un diseño <diseno>
    Cuando abre las acciones de PRG-001
    Entonces «Editar» queda <editar>, «Duplicar» queda <duplicar>, «Archivar» queda <archivar> y «Eliminar» queda <eliminar>

    Ejemplos:
      | diseno | cuenta | editar | duplicar | archivar | eliminar |
      | escritorio | gestor@sigpro.test | habilitada | habilitada | habilitada | deshabilitada, con el motivo «Solo admin puede eliminar» |
      | escritorio | consultor@sigpro.test | deshabilitada, con el motivo «Tu rol no permite modificar programas» | deshabilitada, con el motivo «Tu rol no permite crear programas» | deshabilitada, con el motivo «Tu rol no permite archivar programas» | deshabilitada, con el motivo «Solo admin puede eliminar» |
      | responsive | auditor@sigpro.test | deshabilitada, con el motivo «Tu rol no permite modificar programas» | deshabilitada, con el motivo «Tu rol no permite crear programas» | deshabilitada, con el motivo «Tu rol no permite archivar programas» | deshabilitada, con el motivo «Solo admin puede eliminar» |
      | escritorio | admin@sigpro.test | habilitada | habilitada | habilitada | habilitada |

  Esquema del escenario: Archivar desde el menú cierra el programa y avisa del resultado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en un diseño <diseno>
    Cuando abre las acciones de PRG-001 y pulsa «Archivar»
    Entonces aparece el aviso de éxito «PRG-001 archivado»
    Y PRG-001 muestra el estado «Cerrado»

    Ejemplos:
      | diseno |
      | escritorio |
      | responsive |

  Esquema del escenario: Duplicar desde el menú crea una copia en borrador y la muestra primera
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en un diseño <diseno>
    Cuando abre las acciones de PRG-001 y pulsa «Duplicar»
    Entonces aparece el aviso de éxito «PRG-025 programa creado» con el texto «Copia creada como borrador»
    Y la primera fila de la lista es PRG-025, Sistema de mando táctico Ártemis (copia), con el estado «Borrador»
    Y el recuento dice «1–10 de 25»

    Ejemplos:
      | diseno |
      | escritorio |
      | responsive |

  Esquema del escenario: Eliminar desde el menú pide confirmación y solo al confirmar borra el programa
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test, con el segundo factor completado, ha entrado en /programs sin filtros en un diseño <diseno>
    Cuando abre las acciones de PRG-001, pulsa «Eliminar» y después pulsa «Eliminar» en el diálogo
    Entonces aparece el aviso de éxito «PRG-001 eliminado»
    Y PRG-001 ya no aparece en la lista y el recuento dice «1–10 de 23»

    Ejemplos:
      | diseno |
      | escritorio |
      | responsive |
```

## Fuera de alcance
- «Ver detalle» y «Editar»: EP-PROG-DETALLE y EP-PROG-ALTA.
- La selección de varias filas y sus acciones masivas: US-PROG-GESTION-005 y US-PROG-GESTION-007.
- El texto y los botones del diálogo de borrado: US-PROG-GESTION-008.
- La exportación de la lista: US-PROG-GESTION-009.
- Las cifras de las tarjetas de la cabecera después de cada acción: EP-PROG-METRICAS.
- Lo que hace la API en cada caso: US-PROG-GESTION-001, US-PROG-GESTION-002 y US-PROG-GESTION-003.
