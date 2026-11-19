---
id: US-PROG-GESTION-011
tipo: historia
epica: EP-PROG-GESTION
titulo: "[Móvil] Archivar, duplicar y eliminar un programa desde el menú de su tarjeta"
etiquetas: [movil]
relacionadas: [US-LOGIN-012, US-PROG-LISTA-008, US-PROG-GESTION-001, US-PROG-GESTION-002, US-PROG-GESTION-003, US-PROG-GESTION-006, US-PROG-GESTION-008, US-PROG-GESTION-010]
verificacion: ejecutada
cubre: ["/programs"]
permisos: [program.archive, program.create, program.delete]
---

## Historia
Como persona que gestiona programas desde el móvil, quiero archivar, duplicar o eliminar un programa desde el menú de su tarjeta, y ver por qué mi rol no puede hacer alguna de esas acciones,
para hacerlo desde la lista sin abrir el detalle del programa.

## Reglas
- Cada tarjeta tiene un botón con el nombre «Acciones para PRG-001» (con el código de su programa). Abre una hoja con el título «Acciones para PRG-001» y las acciones «Ver detalle», «Editar», «Duplicar», «Archivar» y «Eliminar».
- Una acción que el rol no puede hacer aparece deshabilitada, con su motivo escrito debajo como texto visible: «Editar», «Tu rol no permite modificar programas»; «Duplicar», «Tu rol no permite crear programas»; «Archivar», «Tu rol no permite archivar programas»; y «Eliminar», «Solo admin puede eliminar».
- «Archivar» y «Duplicar» actúan sin pedir confirmación.
- «Eliminar» abre la hoja de confirmación «Eliminar programa», con el mismo texto que la web («PRG-001 se eliminará de forma permanente junto con sus requisitos y documentos.» con un programa, y «N programas se eliminarán de forma permanente.» con varios) y los botones «Cancelar» y «Eliminar». Confirmado, borra el programa.
- Tras «Duplicar», aparece el aviso de éxito «PRG-025 programa creado» con el texto «Copia creada como borrador». La lista pasa a orden descendente, y la copia queda la primera.
- Tras «Archivar», aparece el aviso de éxito «PRG-001 archivado» y la tarjeta muestra el estado «Cerrado».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app está en /login sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo»; se escribe la cuenta de la fila con su contraseña (`gestor@sigpro.test` con `Gestor1234!` si la fila no dice otra cosa; `consultor@sigpro.test` con `Consul1234!`, `auditor@sigpro.test` con `Audit1234!` o `admin@sigpro.test` con `Admin1234!`, que completa el segundo paso con el código `123456`) y se llega a /programs.

## Criterios de aceptación
```gherkin
Característica: Acciones de cada programa desde el menú de su tarjeta en la app móvil

  Esquema del escenario: Cada rol ve habilitadas solo las acciones de la tarjeta que su permiso permite
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha entrado en /programs sin filtros en la app móvil
    Cuando abre las acciones de PRG-001
    Entonces «Editar» queda <editar>, «Duplicar» queda <duplicar>, «Archivar» queda <archivar> y «Eliminar» queda <eliminar>

    Ejemplos:
      | cuenta | editar | duplicar | archivar | eliminar |
      | gestor@sigpro.test | habilitada | habilitada | habilitada | deshabilitada, con el motivo «Solo admin puede eliminar» |
      | consultor@sigpro.test | deshabilitada, con el motivo «Tu rol no permite modificar programas» | deshabilitada, con el motivo «Tu rol no permite crear programas» | deshabilitada, con el motivo «Tu rol no permite archivar programas» | deshabilitada, con el motivo «Solo admin puede eliminar» |
      | admin@sigpro.test | habilitada | habilitada | habilitada | habilitada |

  Esquema del escenario: Archivar y duplicar desde la tarjeta actúan sin confirmación y avisan del resultado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en la app móvil
    Cuando abre las acciones de PRG-001 y pulsa <accion>
    Entonces aparece el aviso de éxito <aviso>
    Y <efecto>

    Ejemplos:
      | accion | aviso | efecto |
      | «Archivar» | «PRG-001 archivado» | la tarjeta de PRG-001 muestra el estado «Cerrado» |
      | «Duplicar» | «PRG-025 programa creado» con el texto «Copia creada como borrador» | la primera tarjeta es PRG-025, Sistema de mando táctico Ártemis (copia), con el estado «Borrador» |

  Esquema del escenario: Eliminar desde la tarjeta pide confirmación y solo al confirmar borra el programa
    Dado que en el tenant alumno01, recién reiniciado, admin@sigpro.test, con el segundo factor completado, ha entrado en /programs sin filtros en la app móvil
    Cuando abre las acciones de PRG-001, pulsa «Eliminar» y después <salida> en la hoja de confirmación
    Entonces <resultado>
    Y el recuento dice <recuento>

    Ejemplos:
      | salida | resultado | recuento |
      | «Cancelar» | no aparece ningún aviso de éxito y PRG-001 sigue en la lista | «1–10 de 24» |
      | «Eliminar» | aparece el aviso de éxito «PRG-001 eliminado» y PRG-001 ya no está en la lista | «1–10 de 23» |
```

## Fuera de alcance
- El menú de acciones de la web, de escritorio y responsive: US-PROG-GESTION-006.
- El diálogo de confirmación de la web: US-PROG-GESTION-008.
- La selección de varias tarjetas: US-PROG-GESTION-010.
- La exportación a CSV y la hoja de compartir: US-PROG-GESTION-012.
- Los filtros, la búsqueda y el «Cargar más» de la lista: EP-PROG-LISTA.
- Editar un programa desde la tarjeta: EP-PROG-ALTA.
- Lo que hace la API con cada acción: US-PROG-GESTION-001, US-PROG-GESTION-002 y US-PROG-GESTION-003.
