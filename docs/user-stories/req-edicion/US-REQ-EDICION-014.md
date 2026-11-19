---
id: US-REQ-EDICION-014
tipo: historia
epica: EP-REQ-EDICION
titulo: "[Móvil] Mover un requisito con «Mover a…»"
etiquetas: [movil]
relacionadas: [US-REQ-EDICION-005, US-REQ-EDICION-010, US-REQ-EDICION-007, US-REQ-ARBOL-009]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
permisos: [requirement.edit]
---

## Historia
Como gestor de un programa o consultor que trabaja desde el móvil, quiero colocar un requisito antes o después de otro de su mismo nivel con «Mover a…»,
para cambiar el orden de un grupo de hermanos sin arrastrar, que en el móvil no existe.

## Reglas
- «Mover a…» de la hoja de un requisito abre el formulario «Mover requisito». Su texto de ayuda es «Reordena entre hermanos: el requisito conserva su padre.».
- «Junto a» ofrece los demás requisitos con el mismo padre, con el formato «REQ-006 · Redundancia del subsistema 006». Por defecto viene elegido el primero de la lista. El propio requisito no aparece.
- «Colocar» ofrece «Antes» y «Después», y viene elegido «Antes».
- «Mover» coloca el requisito en esa posición: el formulario se cierra y aparece el aviso «Orden actualizado» con el texto «REQ-001 se movió».
- «Cancelar» cierra el formulario sin cambiar el orden.
- Un requisito sin hermanos tiene «Mover a…» deshabilitado con la explicación «Es el único de su nivel: no hay con quién cambiar su posición.». No se ofrece ningún otro destino.
- Con un rol sin permiso de edición (`auditor`), «Mover a…» está deshabilitado con la explicación «Tu rol no permite editar requisitos».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo»; la persona inicia sesión con la cuenta de la fila y su contraseña del seed (`gestor@sigpro.test` `Gestor1234!`, `auditor@sigpro.test` `Audit1234!`), llega a `/programs/PRG-001/requirements` y abre la hoja del requisito de la fila.
- Estado del seed, sin pasos previos: las raíces de `PRG-001` son `REQ-001`, `REQ-006` y `REQ-011`, en ese orden; `REQ-004` es el único hijo de `REQ-003`, y `REQ-014` es el único hijo de `REQ-013`.

## Criterios de aceptación
```gherkin
Característica: Reordenación de requisitos desde la app móvil

  Esquema del escenario: Mover coloca el requisito junto al hermano elegido
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto la hoja de <codigo>
    Cuando abre «Mover a…», elige <junto_a> en «Junto a», elige <colocar> en «Colocar» y pulsa «Mover»
    Entonces ve el aviso «Orden actualizado» con el texto «<codigo> se movió»
    Y las raíces de PRG-001 quedan en el orden <orden>

    Ejemplos:
      | codigo | junto_a | colocar | orden |
      | REQ-001 | «REQ-011 · Cifrado del subsistema 011» | «Después» | REQ-006, REQ-011, REQ-001 |
      | REQ-011 | «REQ-001 · Disponibilidad del subsistema 001» | «Antes» | REQ-011, REQ-001, REQ-006 |

  Esquema del escenario: Cancelar no cambia el orden
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto la hoja de REQ-001
    Cuando abre «Mover a…», elige <junto_a> en «Junto a» y pulsa «Cancelar»
    Entonces el formulario se cierra y las raíces de PRG-001 siguen en el orden REQ-001, REQ-006, REQ-011

    Ejemplos:
      | junto_a |
      | «REQ-011 · Cifrado del subsistema 011» |
      | «REQ-006 · Redundancia del subsistema 006» |

  Esquema del escenario: Un requisito sin hermanos o un rol sin permiso no se puede mover
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto la hoja de <codigo>
    Cuando mira «Mover a…»
    Entonces «Mover a…» está deshabilitado con la explicación <motivo>

    Ejemplos:
      | cuenta | codigo | motivo |
      | gestor@sigpro.test | REQ-004 | «Es el único de su nivel: no hay con quién cambiar su posición.» |
      | auditor@sigpro.test | REQ-001 | «Tu rol no permite editar requisitos» |
```

## Fuera de alcance
- Cambiar el padre del requisito al moverlo: la historia no implementada de esta misma épica.
- La reordenación desde la web, con «Subir», «Bajar» y arrastrando: la historia web de reordenación de esta misma épica.
- La respuesta de la API a una reordenación inválida: la historia de la API de reordenación de esta misma épica.
