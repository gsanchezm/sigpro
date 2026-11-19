---
id: US-PROG-ALTA-010
tipo: historia
epica: EP-PROG-ALTA
titulo: "[Web] Editar un programa y guardar o cerrar la edición"
etiquetas: [web]
relacionadas: [US-PROG-ALTA-003, US-PROG-ALTA-011, US-PROG-ALTA-013]
verificacion: codigo
cubre: ["/programs/:code/edit"]
permisos: [program.edit]
---

## Historia
Como gestor de programas que usa la web, quiero abrir un programa en su pantalla de edición, cambiar algunos de sus datos y guardarlos o cerrar la edición,
para corregir un programa sin volver a darlo de alta.

## Reglas
- `/programs/:code/edit` muestra el título «Editar programa» y, debajo, el código y el nombre del programa. Los campos muestran los valores guardados: «Código» (solo lectura; su aviso al pasar el cursor es «El código no se puede cambiar»), «Nombre», «Descripción», «Responsable», «Estado», «Fecha de inicio», «Fecha de fin», «Presupuesto (€)», «Prioridad» y «Programa clasificado».
- «Estado» ofrece los cinco estados: Borrador, Activo, En pausa, Cerrado y Cancelado. «Prioridad» ofrece Baja, Media y Alta.
- «Guardar» y «Guardar y cerrar» están deshabilitados mientras ningún campo cambie. Su motivo es «No hay cambios que guardar».
- «Guardar» envía los cambios y se queda en la edición. Con éxito aparece el aviso «Programa actualizado» con el texto «PRG-001 se guardó correctamente» y los campos muestran los valores guardados.
- «Guardar y cerrar» envía los cambios y, con éxito, lleva a /programs/PRG-001 con el mismo aviso.
- «Cancelar» lleva a /programs/PRG-001 sin enviar nada.
- Mientras se guarda, el botón pulsado queda deshabilitado con la explicación «Procesando…».
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `gestor@sigpro.test` (contraseña `Gestor1234!`) inicia sesión en `/login?tenant=alumno01`, llega a /programs y abre /programs/PRG-001/edit. Tras el reinicio, `PRG-001` tiene el nombre «Sistema de mando táctico Ártemis», responsable Marta Ruiz, estado Activo, inicio `2023-01-01`, fin `2024-07-01`, presupuesto 450000, prioridad Media y clasificado.
- En las tablas, «(ninguno)» significa que no se cambia ningún campo.

## Criterios de aceptación
```gherkin
Característica: Edición de un programa en la web

  Esquema del escenario: El formulario muestra los valores guardados del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto /programs/PRG-001/edit
    Cuando observa el formulario
    Entonces el campo <campo> muestra <valor>

    Ejemplos:
      | campo | valor |
      | «Nombre» | Sistema de mando táctico Ártemis |
      | «Responsable» | Marta Ruiz |
      | «Programa clasificado» | marcado |

  Esquema del escenario: Guardar solo se habilita cuando algún campo cambia
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto /programs/PRG-001/edit
    Cuando <cambio>
    Entonces «Guardar» y «Guardar y cerrar» <estado>

    Ejemplos:
      | cambio | estado |
      | (ninguno) | están deshabilitados y su motivo es «No hay cambios que guardar» |
      | escribe «Sistema de mando táctico Ártemis II» en «Nombre» | están habilitados |

  Esquema del escenario: Guardar aplica el cambio y se queda en la edición
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto /programs/PRG-001/edit
    Cuando cambia el campo <campo> a <valor> y pulsa «Guardar»
    Entonces ve el aviso «Programa actualizado» con el texto «PRG-001 se guardó correctamente», sigue en /programs/PRG-001/edit y el campo <campo> muestra <valor>

    Ejemplos:
      | campo | valor |
      | «Presupuesto (€)» | 500000 |
      | «Estado» | En pausa |
      | «Prioridad» | Alta |
      | «Programa clasificado» | desmarcado |

  Esquema del escenario: Guardar y cerrar o cancelar llevan al detalle del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto /programs/PRG-001/edit y ha cambiado «Nombre» a Sistema de mando táctico Ártemis II
    Cuando pulsa <boton>
    Entonces <resultado>

    Ejemplos:
      | boton | resultado |
      | «Guardar y cerrar» | llega a /programs/PRG-001 y ve el aviso «Programa actualizado» |
      | «Cancelar» | llega a /programs/PRG-001 sin guardar, y al abrir /programs/PRG-001/edit el campo «Nombre» muestra Sistema de mando táctico Ártemis |
```

## Fuera de alcance
- Los avisos de error de la edición, las fechas incoherentes, el nombre repetido y los accesos sin permiso o a un programa inexistente: EP-PROG-ALTA, historia de avisos y accesos de la edición en la web.
- La edición por la API y sus reglas: EP-PROG-ALTA, historias de edición por la API.
- La pantalla de detalle del programa a la que lleva la edición: EP-PROG-DETALLE.
