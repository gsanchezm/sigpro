---
id: US-PROG-ALTA-013
tipo: historia
epica: EP-PROG-ALTA
titulo: "[Móvil] Editar un programa y guardar o cerrar la edición"
etiquetas: [movil]
relacionadas: [US-PROG-ALTA-003, US-PROG-ALTA-010, US-PROG-ALTA-011, US-PROG-ALTA-012]
verificacion: ejecutada
cubre: ["/programs/:code/edit"]
permisos: [program.edit]
---

## Historia
Como gestor de programas que usa la app móvil, quiero editar un programa desde su pantalla de edición y guardarlo o cerrar la edición,
para corregir un dato del programa desde el móvil con las mismas reglas que en la web.

## Reglas
- La pantalla «Editar programa» muestra el código y el nombre del programa y, en los campos, sus valores guardados: «Código», «Nombre», «Descripción», «Responsable», «Estado», «Fecha de inicio», «Fecha de fin», «Presupuesto (€)», «Prioridad» y «Programa clasificado».
- Las fechas se escriben como `AAAA-MM-DD`. «Responsable» abre una hoja con el buscador, igual que en el alta.
- «Guardar» y «Guardar y cerrar» están deshabilitados mientras no cambie ningún campo, y debajo aparece el texto «No hay cambios que guardar».
- «Guardar» envía los cambios y se queda en la pantalla. Con éxito aparece el aviso «Programa actualizado» con el texto «PRG-001 se guardó correctamente».
- «Guardar y cerrar» envía los cambios y, con éxito, lleva al detalle de `PRG-001`.
- «Cancelar» vuelve a la pantalla anterior sin enviar nada.
- Un nombre que ya tiene otro programa del tenant, o que contiene «duplicado», no se guarda: aparece el aviso «422 · Ya existe un programa con ese nombre» arriba y el mismo texto bajo «Nombre».
- Un fin que no es posterior al inicio muestra bajo «Fecha de fin» el aviso «La fecha de fin debe ser posterior al inicio» y no se guarda.
- Quien no puede editar, consultor y auditor, ve el texto «Tu rol no permite modificar programas. Puedes ver el detalle, pero no guardar cambios.» y el botón «Volver al detalle». No ve campos para editar.
- Un código que no existe en el tenant muestra «No se encontró el programa» y el botón «Volver a Programas».
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, en la app, sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo», la cuenta de la fila inicia sesión (`gestor@sigpro.test` con `Gestor1234!`, salvo que la fila diga otra: `consultor@sigpro.test` con `Consul1234!` o `auditor@sigpro.test` con `Audit1234!`) y abre la pantalla de edición de `PRG-001`.
- Tras el reinicio, `PRG-001` es «Sistema de mando táctico Ártemis», con responsable Marta Ruiz, estado Activo, presupuesto 450000 y clasificado.

## Criterios de aceptación
```gherkin
Característica: Edición de un programa en la app móvil

  Esquema del escenario: La pantalla muestra los valores guardados y no deja guardar sin cambios
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto la edición de PRG-001 en /programs/PRG-001/edit
    Cuando observa la pantalla
    Entonces el campo <campo> muestra <valor> y «Guardar» está deshabilitado con el texto «No hay cambios que guardar»

    Ejemplos:
      | campo | valor |
      | «Nombre» | Sistema de mando táctico Ártemis |
      | «Responsable» | Marta Ruiz |
      | «Estado» | Activo |

  Esquema del escenario: Guardar aplica el cambio y se queda en la pantalla
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto la edición de PRG-001 en /programs/PRG-001/edit
    Cuando cambia el campo <campo> a <valor> y pulsa «Guardar»
    Entonces ve el aviso «Programa actualizado» con el texto «PRG-001 se guardó correctamente» y sigue en la edición con el campo <campo> en <valor>

    Ejemplos:
      | campo | valor |
      | «Presupuesto (€)» | 500000 |
      | «Estado» | En pausa |

  Esquema del escenario: Guardar y cerrar lleva al detalle del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto la edición de PRG-001 y ha cambiado «Nombre» a Sistema de mando táctico Ártemis II
    Cuando pulsa <boton>
    Entonces llega al detalle de PRG-001 y ve el aviso «Programa actualizado»

    Ejemplos:
      | boton |
      | «Guardar y cerrar» |

  Esquema del escenario: Los avisos del servidor y de las fechas aparecen junto al campo que falla
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto la edición de PRG-001
    Cuando <cambio> y pulsa «Guardar»
    Entonces <resultado>

    Ejemplos:
      | cambio | resultado |
      | escribe Radar de vigilancia costera RVC-2 en «Nombre» | ve el aviso «422 · Ya existe un programa con ese nombre» arriba y el mismo texto bajo «Nombre», y el programa no cambia |
      | escribe 2024-07-02 en «Fecha de inicio» | ve el aviso «La fecha de fin debe ser posterior al inicio» bajo «Fecha de fin» y no se guarda nada |

  Esquema del escenario: Quien no puede editar ve por qué y no ve campos para editar
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la app y abre la edición de PRG-001
    Cuando observa la pantalla
    Entonces ve el texto «Tu rol no permite modificar programas. Puedes ver el detalle, pero no guardar cambios.» y el botón «Volver al detalle», y no ve campos para editar

    Ejemplos:
      | cuenta |
      | consultor@sigpro.test |
      | auditor@sigpro.test |

  Esquema del escenario: Un programa que no existe en el tenant muestra el aviso de no encontrado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app
    Cuando abre la edición de <codigo>
    Entonces ve el aviso «No se encontró el programa» y el botón «Volver a Programas»

    Ejemplos:
      | codigo |
      | PRG-999 |
```

## Fuera de alcance
- Las reglas de nombre, fechas y propietario cuando se edita por la API: EP-PROG-ALTA, historia de validación de la edición por la API.
- El detalle del programa al que lleva «Guardar y cerrar», con sus pestañas: EP-PROG-DETALLE.
- Los mismos avisos y accesos en la web: EP-PROG-ALTA, historia de avisos y accesos de la edición en la web.
- Los hitos de un programa (EP-HITOS) y la lectura de sus proveedores (EP-PROVEEDORES): no se editan desde el asistente de alta ni desde la edición del programa.

## Decisiones pendientes
- Si el aviso superior «422 · …» debe desaparecer cuando la persona corrige el campo que falla. Hoy sigue visible hasta el siguiente envío. No está decidido.
