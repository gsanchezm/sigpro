---
id: US-REQ-EDICION-015
tipo: historia
epica: EP-REQ-EDICION
titulo: "[Móvil] Eliminar un requisito desde la hoja"
etiquetas: [movil]
relacionadas: [US-REQ-EDICION-004, US-REQ-EDICION-011, US-REQ-EDICION-013, US-REQ-ARBOL-009]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
permisos: [requirement.delete]
---

## Historia
Como gestor de un programa que trabaja desde el móvil, quiero eliminar un requisito desde su hoja tras confirmar lo que se pierde,
para quitar un requisito que sobra sin salir de la lista del programa.

## Reglas
- «Eliminar» de la hoja de un requisito abre la confirmación «Eliminar requisito», con los botones «Eliminar» y «Cancelar».
- Si el requisito no tiene descendientes, el texto de la confirmación dice que se eliminará de forma permanente, con su código, por ejemplo «REQ-004 se eliminará de forma permanente.». Si tiene descendientes de cualquier nivel, dice que se eliminará con sus N requisitos descendientes, por ejemplo «REQ-006 y sus 4 requisitos descendientes se eliminarán de forma permanente.».
- «Eliminar» en la confirmación borra el requisito y sus descendientes, cierra la hoja y muestra el aviso «Requisito eliminado» con el texto «REQ-004 eliminado» (con el código del requisito borrado). Los requisitos borrados ya no aparecen en la lista.
- «Cancelar» cierra la confirmación: no se borra nada y la hoja sigue abierta.
- Con un rol sin permiso de borrado (`consultant` o `auditor`), «Eliminar» está deshabilitado con la explicación «Solo admin y gestor pueden eliminar requisitos».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo»; la persona inicia sesión con la cuenta de la fila y su contraseña (`gestor@sigpro.test` `Gestor1234!`, `consultor@sigpro.test` `Consul1234!`, `alumno01@sigpro.lab` `Alumno1234!`), llega a `/programs/PRG-001/requirements` y abre la hoja del requisito de la fila.
- Estado del seed, sin pasos previos: `REQ-004` no tiene descendientes; `REQ-006` tiene cuatro descendientes (`REQ-007`, `REQ-008`, `REQ-009` y `REQ-010`).

## Criterios de aceptación
```gherkin
Característica: Borrado de requisitos desde la app móvil

  Esquema del escenario: La confirmación dice cuántos descendientes se llevan
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto la hoja de <codigo>
    Cuando pulsa «Eliminar»
    Entonces ve la confirmación «Eliminar requisito» con el texto <texto>
    Y puede elegir «Eliminar» o «Cancelar»

    Ejemplos:
      | codigo | texto |
      | REQ-004 | «REQ-004 se eliminará de forma permanente.» |
      | REQ-006 | «REQ-006 y sus 4 requisitos descendientes se eliminarán de forma permanente.» |

  Esquema del escenario: Confirmar borra el requisito con sus descendientes y cierra la hoja
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto la hoja de <codigo>
    Cuando pulsa «Eliminar» y después «Eliminar» en la confirmación
    Entonces la hoja se cierra y ve el aviso «Requisito eliminado» con el texto <aviso>
    Y ya no aparecen <codigo> ni sus descendientes en la lista

    Ejemplos:
      | codigo | aviso |
      | REQ-004 | «REQ-004 eliminado» |
      | REQ-006 | «REQ-006 eliminado» |

  Esquema del escenario: Cancelar la confirmación no borra nada
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto la hoja de REQ-004
    Cuando pulsa «Eliminar» y después «Cancelar» en la confirmación
    Entonces la confirmación se cierra, la hoja de REQ-004 sigue abierta y REQ-004 sigue en la lista

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | alumno01@sigpro.lab |

  Esquema del escenario: Solo admin y gestor pueden eliminar desde la hoja
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», llega a /programs/PRG-001/requirements y ha abierto la hoja de REQ-004
    Cuando mira «Eliminar»
    Entonces «Eliminar» <estado>

    Ejemplos:
      | cuenta | estado |
      | gestor@sigpro.test | está habilitado |
      | consultor@sigpro.test | está deshabilitado con la explicación «Solo admin y gestor pueden eliminar requisitos» |
```

## Fuera de alcance
- La respuesta de la API al borrar y sus códigos de error: la historia de la API de borrado de esta misma épica.
- El borrado desde la web, con su menú de la fila: la historia web de borrado de esta misma épica.
- Los enlaces con casos de prueba que quedan tras el borrado: EP-REQ-TRAZA.
