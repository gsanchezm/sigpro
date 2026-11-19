---
id: US-REQ-EDICION-010
tipo: historia
epica: EP-REQ-EDICION
titulo: "[Web] Reordenar con Subir, Bajar, el teclado y arrastrando"
etiquetas: [web]
relacionadas: [US-REQ-EDICION-005, US-REQ-EDICION-007, US-REQ-EDICION-009, US-REQ-ARBOL-003]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
permisos: [requirement.edit]
---

## Historia
Como gestor de un programa o consultor que trabaja en la web, quiero cambiar el orden de un requisito entre sus hermanos con el menú de la fila, con el teclado o arrastrándolo,
para priorizar el árbol sin cambiar a qué padre pertenece ningún requisito.

## Reglas
- En el menú de cada fila, «Subir» coloca el requisito antes de su hermano anterior y «Bajar» lo coloca después de su hermano siguiente.
- Con el foco en una fila, Alt más la flecha hacia arriba la sube y Alt más la flecha hacia abajo la baja, entre sus hermanos.
- Arrastrar una fila y soltarla sobre otra la coloca entre los hermanos de la fila destino. Si la fila destino tiene otro padre, la caída no se acepta: no cambia ningún orden y no aparece ningún aviso.
- Al arrastrar, la posición depende de dónde se suelta sobre la fila destino: en el cuarto superior, el requisito va antes; en el cuarto inferior, después; en la zona central, si el requisito venía de más arriba, va detrás de la fila destino, y si venía de más abajo, delante.
- Cada movimiento correcto muestra el aviso «Orden actualizado» con el texto formado por el código del requisito movido y «se movió» (por ejemplo «REQ-006 se movió»), y el orden se ve al instante.
- En el primer hermano, «Subir» está deshabilitado con la explicación «Ya es el primero de su nivel». En el último, «Bajar» está deshabilitado con la explicación «Ya es el último de su nivel». La misma regla vale para Alt más flecha en esos extremos: no se mueve nada.
- Con un rol sin permiso de edición (`auditor`), «Subir» y «Bajar» están deshabilitados con la explicación «Tu rol no permite editar requisitos», la fila no se puede arrastrar y el teclado no la mueve.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona inicia sesión en `/login?tenant=alumno01` con la cuenta de la fila y su contraseña del seed (`gestor@sigpro.test` `Gestor1234!`, `auditor@sigpro.test` `Audit1234!`), en un navegador sin sesiones de SIGPRO guardadas, y abre `/programs/PRG-001/requirements` con el árbol desplegado.
- Estado del seed, sin pasos previos: las raíces de `PRG-001` son `REQ-001`, `REQ-006` y `REQ-011`, en ese orden; los hijos de `REQ-001` son `REQ-002`, `REQ-003` y `REQ-005`, en ese orden.

## Criterios de aceptación
```gherkin
Característica: Reordenación de requisitos en la web

  Esquema del escenario: Subir y bajar en el menú mueve el requisito entre sus hermanos
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando abre el menú de la fila de <codigo> y elige <opcion>
    Entonces ve el aviso «Orden actualizado» con el texto «<codigo> se movió»
    Y las raíces de PRG-001 quedan en el orden <orden>

    Ejemplos:
      | codigo | opcion | orden |
      | REQ-006 | «Subir» | REQ-006, REQ-001, REQ-011 |
      | REQ-011 | «Subir» | REQ-001, REQ-011, REQ-006 |
      | REQ-001 | «Bajar» | REQ-006, REQ-001, REQ-011 |

  Esquema del escenario: Los extremos del orden no se pueden mover
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando abre el menú de la fila de <codigo>
    Entonces <opcion> está deshabilitado con la explicación <motivo>

    Ejemplos:
      | codigo | opcion | motivo |
      | REQ-001 | «Subir» | «Ya es el primero de su nivel» |
      | REQ-011 | «Bajar» | «Ya es el último de su nivel» |

  Esquema del escenario: El teclado mueve la fila elegida entre sus hermanos
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, está en /programs/PRG-001/requirements y el árbol de REQ-001 está desplegado
    Cuando elige la fila de <codigo> y pulsa <tecla>
    Entonces los hijos de REQ-001 quedan en el orden <orden>

    Ejemplos:
      | codigo | tecla | orden |
      | REQ-005 | Alt más flecha arriba | REQ-002, REQ-005, REQ-003 |
      | REQ-002 | Alt más flecha abajo | REQ-003, REQ-002, REQ-005 |

  Esquema del escenario: Arrastrar y soltar reordena solo entre hermanos
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, está en /programs/PRG-001/requirements y el árbol de REQ-001 está desplegado
    Cuando arrastra la fila de <origen> y la suelta <zona> de la fila de <destino>
    Entonces <resultado>

    Ejemplos:
      | origen | destino | zona | resultado |
      | REQ-011 | REQ-001 | en el cuarto superior | las raíces de PRG-001 quedan REQ-011, REQ-001, REQ-006 |
      | REQ-001 | REQ-011 | en el cuarto inferior | las raíces de PRG-001 quedan REQ-006, REQ-011, REQ-001 |
      | REQ-002 | REQ-003 | en la zona central | los hijos de REQ-001 quedan REQ-003, REQ-002, REQ-005 |
      | REQ-002 | REQ-006 | en cualquier zona | ningún orden cambia y no aparece el aviso «Orden actualizado» |

  Esquema del escenario: Un rol sin permiso de edición no reordena
    Dado que el tenant alumno01 está recién reiniciado y auditor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando abre el menú de la fila de <codigo> y mira <opcion>
    Entonces <opcion> está deshabilitado con la explicación «Tu rol no permite editar requisitos» y las raíces de PRG-001 siguen en el orden REQ-001, REQ-006, REQ-011

    Ejemplos:
      | codigo | opcion |
      | REQ-006 | «Subir» |
      | REQ-001 | «Bajar» |
```

## Fuera de alcance
- Cambiar de padre al arrastrar hasta otro nivel: no existe; ver la historia de la API que lo describe como no implementada en esta misma épica.
- La respuesta de la API al reordenar y sus motivos: la historia de la API de reordenación de esta misma épica.
- Los atajos de teclado que no mueven requisitos, como N o la búsqueda: EP-REQ-ARBOL.
