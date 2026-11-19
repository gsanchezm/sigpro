---
id: US-REQ-EDICION-013
tipo: historia
epica: EP-REQ-EDICION
titulo: "[Móvil] Editar un requisito en la hoja"
etiquetas: [movil]
relacionadas: [US-REQ-EDICION-003, US-REQ-EDICION-009, US-REQ-EDICION-014, US-REQ-EDICION-015, US-REQ-ARBOL-009]
verificacion: ejecutada
cubre: ["/programs/:code/requirements"]
permisos: [requirement.edit]
---

## Historia
Como gestor de un programa o consultor que trabaja desde el móvil, quiero editar el título, la prioridad, las etiquetas o la descripción de un requisito desde su hoja,
para corregirlo y saber antes de guardar si cambiar el texto lo devolverá a borrador.

## Reglas
- La hoja de un requisito muestra sus datos y los botones «Editar», «Mover a…» y «Eliminar». «Editar» abre el formulario de edición dentro de la misma hoja, sin un diálogo encima.
- El formulario muestra los campos «Título», «Prioridad», «Etiquetas» y «Descripción» (como texto plano, con la misma ayuda que en el alta), y los botones «Cancelar», «Guardar» y «Guardar y cerrar».
- «Guardar» y «Guardar y cerrar» están deshabilitados mientras no hay cambios, con la explicación «No hay cambios que guardar».
- «Guardar» vuelve a los datos del requisito y la hoja sigue abierta. «Guardar y cerrar» cierra la hoja. En los dos casos aparece el aviso «Requisito guardado» con el texto «REQ-001 actualizado», o con el texto «REQ-001 volvió a Borrador» si el requisito pasó a borrador.
- Si el título o la descripción cambian y el requisito no está en borrador, el formulario muestra el aviso «Este requisito está en estado aprobado. Si cambias el título o la descripción volverá a Borrador.», con el estado del requisito en minúsculas (`aprobado`, `verificado` o `validado`). Cambiar solo la prioridad o las etiquetas no lo muestra.
- «Cancelar» sale del formulario sin guardar nada.
- Un título no válido muestra su aviso bajo «Título» y no se guarda.
- Con un rol sin permiso de edición (`auditor`), «Editar» está deshabilitado con la explicación «Tu rol no permite editar requisitos».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo»; la persona inicia sesión con la cuenta de la fila y su contraseña del seed (`gestor@sigpro.test` `Gestor1234!`, `consultor@sigpro.test` `Consul1234!`, `auditor@sigpro.test` `Audit1234!`), llega a `/programs/PRG-001/requirements` y abre la hoja de REQ-001 o de REQ-002.
- Estado del seed, sin pasos previos: `REQ-001` está aprobado y se titula «Disponibilidad del subsistema 001»; `REQ-002` está verificado y se titula «Latencia del subsistema 002».
- Convenciones de los ejemplos: `(121 letras a)` es un texto de 121 letras «a» seguidas.

## Criterios de aceptación
```gherkin
Característica: Edición de requisitos en la app móvil

  Esquema del escenario: Guardar o guardar y cerrar según el cambio y el estado final
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto la hoja de REQ-001, que está aprobado
    Cuando <cambio> y pulsa <boton>
    Entonces ve el aviso «Requisito guardado» con el texto <aviso_texto>
    Y la hoja <hoja>
    Y el estado de REQ-001 es <estado>

    Ejemplos:
      | cambio | boton | aviso_texto | hoja | estado |
      | cambia «Prioridad» a «Baja» | «Guardar» | «REQ-001 actualizado» | sigue abierta con los datos del requisito | «Aprobado» |
      | cambia «Título» a Disponibilidad revisada del subsistema 001 | «Guardar y cerrar» | «REQ-001 volvió a Borrador» | se cierra | «Borrador» |
      | añade la etiqueta «Normativo» en «Etiquetas» | «Guardar y cerrar» | «REQ-001 actualizado» | se cierra | «Aprobado» |

  Esquema del escenario: El aviso de vuelta a borrador aparece solo al cambiar el texto
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto el formulario de edición de REQ-001, que está aprobado
    Cuando <cambio>
    Entonces <aviso>

    Ejemplos:
      | cambio | aviso |
      | cambia «Título» a Disponibilidad revisada del subsistema 001 | ve el aviso «Este requisito está en estado aprobado. Si cambias el título o la descripción volverá a Borrador.» |
      | cambia «Prioridad» a «Baja» | no ve ningún aviso de vuelta a borrador |

  Esquema del escenario: Sin cambios no se guarda, cancelar descarta y un título no válido no se envía
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto el formulario de edición de REQ-002, que está verificado
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | no cambia ningún campo | «Guardar» y «Guardar y cerrar» están deshabilitados con la explicación «No hay cambios que guardar» |
      | cambia «Título» a ab y pulsa «Guardar» | ve bajo «Título» el aviso «El título debe tener al menos 3 caracteres» y el título de REQ-002 no cambia |
      | cambia «Título» a Otro título y pulsa «Cancelar» | sale del formulario y el título de REQ-002 sigue siendo Latencia del subsistema 002 |

  Esquema del escenario: Un rol sin permiso de edición no abre el formulario
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto la hoja de REQ-001
    Cuando mira «Editar»
    Entonces «Editar» <estado>

    Ejemplos:
      | cuenta | estado |
      | gestor@sigpro.test | está habilitado |
      | auditor@sigpro.test | está deshabilitado con la explicación «Tu rol no permite editar requisitos» |
```

## Fuera de alcance
- Mover el requisito con «Mover a…»: la historia móvil de reordenación de esta misma épica.
- Eliminar el requisito desde la hoja: la historia móvil de borrado de esta misma épica.
- La edición en la web, con su panel y su edición en la fila: la historia web de edición de esta misma épica.
- La vuelta a borrador tal como la aplica la API: la historia de la API de edición de esta misma épica.
