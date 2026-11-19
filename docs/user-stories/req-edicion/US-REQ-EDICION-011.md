---
id: US-REQ-EDICION-011
tipo: historia
epica: EP-REQ-EDICION
titulo: "[Web] Eliminar un requisito con su confirmación"
etiquetas: [web]
relacionadas: [US-REQ-EDICION-004, US-REQ-EDICION-009, US-REQ-EDICION-015, US-REQ-ARBOL-003]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
permisos: [requirement.delete]
---

## Historia
Como gestor de un programa en la web, quiero eliminar un requisito tras confirmar cuántos requisitos se llevan consigo,
para quitar un requisito que sobra sin borrar por error todo lo que cuelga de él.

## Reglas
- «Eliminar» del menú de la fila abre el diálogo de confirmación «Eliminar requisito», con los botones «Eliminar» y «Cancelar».
- Si el requisito no tiene descendientes, el texto del diálogo dice que se eliminará de forma permanente, con su código, por ejemplo «REQ-004 se eliminará de forma permanente.». Si tiene descendientes de cualquier nivel, el texto dice que se eliminarán con sus N requisitos descendientes, por ejemplo «REQ-006 y sus 4 requisitos descendientes se eliminarán de forma permanente.».
- «Cancelar» cierra el diálogo y no borra nada.
- «Eliminar» en el diálogo borra el requisito y sus descendientes, cierra el diálogo y muestra el aviso «Requisito eliminado» con el texto formado por el código del requisito borrado y «eliminado» (por ejemplo «REQ-004 eliminado»). Los requisitos borrados ya no aparecen en el árbol. Si el panel mostraba el requisito borrado, se cierra.
- Los casos de prueba enlazados a un requisito borrado siguen existiendo; solo desaparece el enlace.
- Con un rol sin permiso de borrado (`consultant` o `auditor`), «Eliminar» está deshabilitado con la explicación «Solo admin y gestor pueden eliminar requisitos».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona inicia sesión en `/login?tenant=alumno01` con la cuenta de la fila y su contraseña del seed (`gestor@sigpro.test` `Gestor1234!`, `consultor@sigpro.test` `Consul1234!`, `auditor@sigpro.test` `Audit1234!`), en un navegador sin sesiones de SIGPRO guardadas, y abre `/programs/PRG-001/requirements`.
- Estado del seed, sin pasos previos: `REQ-004` no tiene descendientes; `REQ-006` tiene cuatro descendientes (`REQ-007`, `REQ-008`, `REQ-009` y `REQ-010`).

## Criterios de aceptación
```gherkin
Característica: Borrado de requisitos en la web

  Esquema del escenario: Eliminar pide confirmación y dice cuántos descendientes se llevan
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando abre el menú de la fila de <codigo> y elige «Eliminar»
    Entonces ve el diálogo «Eliminar requisito» con el texto <texto>
    Y tiene los botones «Eliminar» y «Cancelar»
    Y todavía no se ha eliminado nada

    Ejemplos:
      | codigo | texto |
      | REQ-004 | «REQ-004 se eliminará de forma permanente.» |
      | REQ-006 | «REQ-006 y sus 4 requisitos descendientes se eliminarán de forma permanente.» |

  Esquema del escenario: Cancelar cierra el diálogo y el requisito sigue en el árbol
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando abre el menú de la fila de <codigo>, elige «Eliminar» y pulsa «Cancelar»
    Entonces el diálogo se cierra y <codigo> sigue en el árbol con todos sus requisitos

    Ejemplos:
      | codigo |
      | REQ-004 |
      | REQ-006 |

  Esquema del escenario: Eliminar quita el requisito y sus descendientes del árbol
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando abre el menú de la fila de <codigo>, elige «Eliminar» y pulsa «Eliminar» en el diálogo
    Entonces ve el aviso «Requisito eliminado» con el texto <aviso>
    Y ya no aparecen <codigo> ni sus descendientes, y el resto de requisitos de PRG-001 sigue en el árbol

    Ejemplos:
      | codigo | aviso |
      | REQ-004 | «REQ-004 eliminado» |
      | REQ-006 | «REQ-006 eliminado» |

  Esquema del escenario: Solo admin y gestor pueden eliminar
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando abre el menú de la fila de REQ-004
    Entonces «Eliminar» <estado>

    Ejemplos:
      | cuenta | estado |
      | gestor@sigpro.test | está habilitado |
      | consultor@sigpro.test | está deshabilitado con la explicación «Solo admin y gestor pueden eliminar requisitos» |
      | auditor@sigpro.test | está deshabilitado con la explicación «Solo admin y gestor pueden eliminar requisitos» |
```

## Fuera de alcance
- El borrado de los casos de prueba y de sus ejecuciones, que no ocurre con el borrado de un requisito: EP-REQ-TRAZA.
- La respuesta de la API al borrar y sus códigos de error: la historia de la API de borrado de esta misma épica.
