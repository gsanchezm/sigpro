---
id: US-REQ-EDICION-012
tipo: historia
epica: EP-REQ-EDICION
titulo: "[Móvil] Dar de alta un requisito desde la lista"
etiquetas: [movil]
relacionadas: [US-REQ-EDICION-002, US-REQ-EDICION-008, US-REQ-EDICION-016, US-REQ-ARBOL-009]
verificacion: ejecutada
cubre: ["/programs/:code/requirements"]
permisos: [requirement.create]
---

## Historia
Como gestor de un programa o consultor que trabaja desde el móvil, quiero dar de alta un requisito con su descripción y sus etiquetas desde la lista del programa,
para completar el alta sin pasar por la web.

## Reglas
- «Nuevo requisito» de la lista de requisitos abre el diálogo «Nuevo requisito», con los campos «Título», «Requisito padre», «Prioridad», «Etiquetas» y «Descripción», y los botones «Crear requisito» y «Cancelar».
- «Requisito padre» ofrece «Ninguno (raíz)» y, por cada requisito del programa, una opción con el formato «REQ-001 · Disponibilidad del subsistema 001». Sin padre elegido, el requisito es una raíz.
- «Prioridad» ofrece «Baja», «Media» y «Alta», y viene elegida «Media».
- «Etiquetas» ofrece las etiquetas del catálogo con su nombre, por ejemplo «Ciberseguridad», y se pueden marcar varias.
- «Descripción» se escribe como texto plano: cada línea es un párrafo. Bajo el campo aparece la ayuda «Un párrafo por línea. El formato (negrita, listas) se pierde al editar el texto.».
- El título se comprueba en el propio diálogo: se recortan sus espacios, y debe tener entre 3 y 120 caracteres. Si no los tiene, no se envía nada y el aviso aparece bajo «Título».
- Al crear: el diálogo se cierra, aparece el aviso «Requisito creado» con el texto «REQ-041 se añadió al árbol», y el requisito queda abierto en su hoja con el estado «Borrador».
- Mientras se envía, «Crear requisito» está ocupado y no se puede volver a pulsar.
- Con un rol sin permiso de alta (`auditor`), «Nuevo requisito» está deshabilitado y debajo se lee «Tu rol no permite crear requisitos».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo»; la persona inicia sesión con la cuenta de la fila y su contraseña del seed (`gestor@sigpro.test` `Gestor1234!`, `consultor@sigpro.test` `Consul1234!`, `auditor@sigpro.test` `Audit1234!`) y llega a `/programs/PRG-001/requirements`.
- Convenciones de los ejemplos: `(vacío)` es un campo sin texto; `(121 letras a)` es un texto de 121 letras «a» seguidas.

## Criterios de aceptación
```gherkin
Característica: Alta de requisitos en la app móvil

  Esquema del escenario: Un alta válida nace en borrador con el padre y la prioridad elegidos
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y está en /programs/PRG-001/requirements
    Cuando pulsa «Nuevo requisito», escribe Requisito de prueba en «Título», elige <padre> en «Requisito padre», elige <prioridad> en «Prioridad» y pulsa «Crear requisito»
    Entonces ve el aviso «Requisito creado» con el texto «REQ-041 se añadió al árbol»
    Y el detalle de REQ-041 muestra el estado «Borrador»

    Ejemplos:
      | padre | prioridad |
      | «Ninguno (raíz)» | «Alta» |
      | «REQ-001 · Disponibilidad del subsistema 001» | «Baja» |

  Esquema del escenario: La etiqueta y la descripción se guardan con el requisito nuevo
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y está en /programs/PRG-001/requirements
    Cuando pulsa «Nuevo requisito», escribe Requisito de prueba en «Título», marca la etiqueta <etiqueta> en «Etiquetas», escribe <descripcion> en «Descripción» y pulsa «Crear requisito»
    Entonces ve el aviso «Requisito creado» con el texto «REQ-041 se añadió al árbol»
    Y el detalle de REQ-041 muestra la etiqueta <etiqueta>

    Ejemplos:
      | etiqueta | descripcion |
      | «Ciberseguridad» | Primera línea y segunda línea |

  Esquema del escenario: Un título no válido muestra su aviso bajo el campo y no se envía
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y está en /programs/PRG-001/requirements
    Cuando pulsa «Nuevo requisito», escribe <titulo> en «Título» y pulsa «Crear requisito»
    Entonces ve bajo «Título» el aviso <aviso>
    Y el diálogo sigue abierto y no aparece el aviso «Requisito creado»

    Ejemplos:
      | titulo | aviso |
      | (vacío) | «El título debe tener al menos 3 caracteres» |
      | ab | «El título debe tener al menos 3 caracteres» |
      | (121 letras a) | «El título admite hasta 120 caracteres» |

  Esquema del escenario: Solo los roles con permiso de alta pueden abrir el diálogo
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y está en /programs/PRG-001/requirements
    Cuando mira «Nuevo requisito» en la lista
    Entonces el botón <estado>

    Ejemplos:
      | cuenta | estado |
      | gestor@sigpro.test | está habilitado |
      | auditor@sigpro.test | está deshabilitado y debajo se lee «Tu rol no permite crear requisitos» |
```

## Fuera de alcance
- Añadir un hijo desde la hoja de otro requisito, que la app móvil no ofrece: la historia móvil no implementada de esta misma épica.
- La respuesta de la API a un alta inválida y sus motivos: la historia de la API de rechazo de altas de esta misma épica.
- El diálogo de alta de la web, que no pide descripción ni etiquetas y tiene editor de formato: la historia web de alta de esta misma épica.
