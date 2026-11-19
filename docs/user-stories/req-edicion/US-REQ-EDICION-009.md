---
id: US-REQ-EDICION-009
tipo: historia
epica: EP-REQ-EDICION
titulo: "[Web] Editar un requisito en su panel y en su fila"
etiquetas: [web]
relacionadas: [US-REQ-EDICION-003, US-REQ-EDICION-010, US-REQ-EDICION-013, US-REQ-ARBOL-003]
verificacion: ejecutada
cubre: ["/programs/:code/requirements"]
permisos: [requirement.edit]
---

## Historia
Como gestor de un programa o consultor que trabaja en la web, quiero cambiar el título, la prioridad, las etiquetas o la descripción de un requisito desde su panel, o su título directamente en su fila,
para corregir un requisito sin salir del árbol, y saber antes de guardar si cambiar el texto lo devolverá a borrador.

## Reglas
- El panel de detalle de un requisito se abre al elegirlo en el árbol. Muestra los campos «Título», «Prioridad», «Etiquetas» y «Descripción», y los botones «Guardar» y «Guardar y cerrar».
- «Guardar» y «Guardar y cerrar» están deshabilitados mientras no hay cambios, con la explicación «No hay cambios que guardar».
- Si el título o la descripción son distintos de los guardados y el requisito no está en borrador, aparece el aviso «Este requisito está en estado aprobado. Si cambias el título o la descripción volverá a Borrador.», con el estado en minúsculas (`aprobado`, `verificado` o `validado`). El aviso aparece al escribir, antes de guardar. Cambiar solo la prioridad o las etiquetas no lo muestra.
- Al guardar, aparece el aviso «Requisito guardado» con el texto «REQ-001 actualizado», o con el texto «REQ-001 volvió a Borrador» si el requisito pasó a borrador. El estado del panel se actualiza.
- «Guardar y cerrar» guarda y cierra el panel. «Guardar» lo deja abierto.
- La descripción tiene una barra «Formato del texto» con «Negrita», «Cursiva» y «Lista», que dan formato al texto seleccionado; el formato se conserva al guardar.
- Un título con menos de 3 caracteres o más de 120 no se guarda: el aviso de la validación aparece bajo «Título» y el requisito conserva lo que tenía.
- En la fila, el título se edita con doble clic sobre él, con F2 si la fila está elegida, o con «Renombrar» del menú de la fila. Intro guarda el título nuevo y Esc cancela; salir del campo también cancela sin guardar.
- Un título no válido en la fila deja el campo abierto, con el motivo de la validación como explicación del campo, y no guarda nada.
- Con un rol sin permiso de edición (`auditor`), los campos del panel son de solo lectura, «Guardar» está deshabilitado con la explicación «Tu rol no permite editar requisitos», y «Renombrar» del menú de la fila también.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona inicia sesión en `/login?tenant=alumno01` con la cuenta de la fila y su contraseña del seed (`gestor@sigpro.test` `Gestor1234!`, `auditor@sigpro.test` `Audit1234!`), en un navegador sin sesiones de SIGPRO guardadas, y abre `/programs/PRG-001/requirements`.
- Estado del seed, sin pasos previos: `REQ-001` está aprobado y se titula «Disponibilidad del subsistema 001»; `REQ-002` está verificado y se titula «Latencia del subsistema 002»; `REQ-003` está validado.
- Convenciones de los ejemplos: `(N letras a)` es un texto de N letras «a» seguidas.

## Criterios de aceptación
```gherkin
Característica: Edición de requisitos en la web

  Esquema del escenario: Cambiar la prioridad o las etiquetas guarda sin devolver a borrador
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, está en /programs/PRG-001/requirements y ha elegido REQ-001, que está aprobado
    Cuando <cambio> y pulsa «Guardar»
    Entonces ve el aviso «Requisito guardado» con el texto «REQ-001 actualizado»
    Y el estado de REQ-001 en el panel es «Aprobado»

    Ejemplos:
      | cambio |
      | cambia «Prioridad» a «Baja» |
      | añade la etiqueta «Normativo» en «Etiquetas» |

  Esquema del escenario: Cambiar el título o la descripción de un requisito aprobado lo devuelve a borrador
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, está en /programs/PRG-001/requirements y ha elegido REQ-001, que está aprobado
    Cuando <cambio> y pulsa «Guardar»
    Entonces ve el aviso «Requisito guardado» con el texto «REQ-001 volvió a Borrador»
    Y el estado de REQ-001 en el panel es «Borrador»

    Ejemplos:
      | cambio |
      | cambia «Título» a Disponibilidad revisada del subsistema 001 |
      | escribe Texto revisado del requisito en «Descripción» |

  Esquema del escenario: El aviso de vuelta a borrador aparece solo al cambiar el texto
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, está en /programs/PRG-001/requirements y ha elegido REQ-001, que está aprobado
    Cuando <cambio>
    Entonces <aviso>

    Ejemplos:
      | cambio | aviso |
      | cambia «Título» a Disponibilidad revisada del subsistema 001 | ve el aviso «Este requisito está en estado aprobado. Si cambias el título o la descripción volverá a Borrador.» |
      | cambia «Prioridad» a «Baja» | no ve ningún aviso de vuelta a borrador |

  Esquema del escenario: Un título no válido no se guarda
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, está en /programs/PRG-001/requirements y ha elegido REQ-002, que está verificado
    Cuando cambia «Título» a <titulo> y pulsa «Guardar»
    Entonces ve bajo «Título» el aviso <aviso>
    Y REQ-002 conserva su título «Latencia del subsistema 002» y su estado «Verificado»

    Ejemplos:
      | titulo | aviso |
      | ab | «El título debe tener al menos 3 caracteres» |
      | (121 letras a) | «El título admite hasta 120 caracteres» |

  Esquema del escenario: La edición en la fila guarda con Intro y cancela con Esc
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements con REQ-002 visible, que está verificado
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | hace doble clic en el título de REQ-002, escribe Latencia revisada del subsistema 002 y pulsa Intro | ve el aviso «Requisito guardado» con el texto «REQ-002 volvió a Borrador» y el título de REQ-002 es Latencia revisada del subsistema 002 |
      | elige REQ-002, pulsa F2, escribe Latencia revisada del subsistema 002 y pulsa Intro | ve el aviso «Requisito guardado» con el texto «REQ-002 volvió a Borrador» y el título de REQ-002 es Latencia revisada del subsistema 002 |
      | hace doble clic en el título de REQ-002, escribe Latencia cambiada y pulsa Esc | el título de REQ-002 sigue siendo Latencia del subsistema 002 y no aparece ningún aviso de guardado |
      | hace doble clic en el título de REQ-002, escribe ab y pulsa Intro | el campo sigue abierto con la explicación «El título debe tener al menos 3 caracteres» y el título de REQ-002 no cambia |

  Esquema del escenario: Un rol sin permiso de edición no cambia nada
    Dado que el tenant alumno01 está recién reiniciado y auditor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | elige REQ-001 en el árbol y mira el campo «Título» | el campo «Título» es de solo lectura |
      | elige REQ-001 en el árbol y mira «Guardar» | «Guardar» está deshabilitado con la explicación «Tu rol no permite editar requisitos» |
      | abre el menú de la fila de REQ-001 | «Renombrar» está deshabilitado con la explicación «Tu rol no permite editar requisitos» |

  Esquema del escenario: El formato del texto de la descripción se guarda con el requisito
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, está en /programs/PRG-001/requirements y ha elegido REQ-002, que está verificado
    Cuando escribe Texto de prueba en «Descripción», lo selecciona, pulsa <boton> y pulsa «Guardar»
    Entonces la descripción guardada muestra «Texto de prueba» con <formato>

    Ejemplos:
      | boton | formato |
      | «Negrita» | negrita |
      | «Cursiva» | cursiva |
      | «Lista» | forma de lista |
```

## Fuera de alcance
- La vuelta a borrador y el resto de reglas de la edición, tal como las recibe la API: la historia de la API de edición de esta misma épica.
- La lectura de los datos del panel y de su pestaña de pruebas: EP-REQ-ARBOL y EP-REQ-TRAZA.
