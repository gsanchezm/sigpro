---
id: US-REQ-EDICION-008
tipo: historia
epica: EP-REQ-EDICION
titulo: "[Web] Dar de alta un requisito desde «Nuevo requisito»"
etiquetas: [web]
relacionadas: [US-REQ-EDICION-001, US-REQ-EDICION-002, US-REQ-EDICION-012, US-REQ-ARBOL-003]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
permisos: [requirement.create]
---

## Historia
Como gestor de un programa o consultor que trabaja en la web, quiero añadir un requisito desde el diálogo «Nuevo requisito»,
para que aparezca en el árbol en borrador, debajo del padre que elija, indicando solo su título, su padre y su prioridad.

## Reglas
- «Nuevo requisito» abre el diálogo «Nuevo requisito» con el código del programa, el campo «Título», la lista «Requisito padre» y la lista «Prioridad». Lo mismo ocurre con la tecla N cuando el foco no está en un campo.
- «Requisito padre» ofrece «Ninguno (raíz)» y, por cada requisito del programa, una opción con el formato «REQ-001 · Disponibilidad del subsistema 001». Sin padre elegido, el requisito es una raíz.
- «Prioridad» ofrece «Baja», «Media» y «Alta», y viene elegida «Media».
- El diálogo no pide descripción ni etiquetas: solo título, padre y prioridad.
- «Añadir hijo» del menú de la fila abre el mismo diálogo con ese requisito ya elegido como padre.
- Antes de enviar, el título se comprueba en la propia pantalla: se recortan sus espacios, y debe tener entre 3 y 120 caracteres. Si no los tiene, no se envía nada y el aviso aparece bajo el campo «Título».
- Al crear: el diálogo se cierra, aparece el aviso «Requisito creado» con el texto «REQ-041 se añadió al árbol», y el requisito queda seleccionado con su detalle abierto y su estado «Borrador».
- Mientras se envía, «Crear requisito» está ocupado y deshabilitado con la explicación «Procesando…».
- «Cancelar» cierra el diálogo sin crear nada.
- Con un rol sin permiso de alta (`auditor`), «Nuevo requisito» está deshabilitado con la explicación «Tu rol no permite crear requisitos», y la tecla N no abre el diálogo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona inicia sesión en `/login?tenant=alumno01` con la cuenta de la fila y su contraseña del seed (`gestor@sigpro.test` `Gestor1234!`, `consultor@sigpro.test` `Consul1234!`, `auditor@sigpro.test` `Audit1234!`), en un navegador sin sesiones de SIGPRO guardadas, y abre `/programs/PRG-001/requirements`.
- Convenciones de los ejemplos: `(vacío)` es un campo sin texto; `(tres espacios)` son tres espacios; `(N letras a)` es un texto de N letras «a» seguidas.

## Criterios de aceptación
```gherkin
Característica: Alta de requisitos en la web

  Esquema del escenario: Un alta válida aparece en borrador y queda seleccionada
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando pulsa «Nuevo requisito», escribe Requisito de prueba en «Título», elige <padre> en «Requisito padre», elige <prioridad> en «Prioridad» y pulsa «Crear requisito»
    Entonces ve el aviso «Requisito creado» con el texto «REQ-041 se añadió al árbol»
    Y el detalle de REQ-041 está abierto con el estado «Borrador»

    Ejemplos:
      | padre | prioridad |
      | «Ninguno (raíz)» | «Alta» |
      | «REQ-001 · Disponibilidad del subsistema 001» | «Baja» |

  Esquema del escenario: Un título no válido se rechaza en el diálogo sin enviar nada
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando pulsa «Nuevo requisito», escribe <titulo> en «Título» y pulsa «Crear requisito»
    Entonces ve bajo el campo «Título» el aviso <aviso>
    Y el diálogo sigue abierto y no aparece el aviso «Requisito creado»

    Ejemplos:
      | titulo | aviso |
      | (vacío) | «El título debe tener al menos 3 caracteres» |
      | (tres espacios) | «El título debe tener al menos 3 caracteres» |
      | ab | «El título debe tener al menos 3 caracteres» |
      | (121 letras a) | «El título admite hasta 120 caracteres» |

  Esquema del escenario: El aviso del título desaparece al corregirlo
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements, y ha pulsado «Crear requisito» con el título ab y ve el aviso «El título debe tener al menos 3 caracteres» bajo «Título»
    Cuando cambia el contenido de «Título» a <titulo_corregido>
    Entonces deja de ver el aviso bajo «Título»

    Ejemplos:
      | titulo_corregido |
      | abc |
      | (vacío) |

  Esquema del escenario: El padre que muestra el diálogo depende de cómo se abre
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando <accion>
    Entonces el campo «Requisito padre» muestra <padre>

    Ejemplos:
      | accion | padre |
      | pulsa la tecla N con el foco fuera de los campos | «Ninguno (raíz)» |
      | abre el menú de la fila de REQ-001 y elige «Añadir hijo» | «REQ-001 · Disponibilidad del subsistema 001» |

  Esquema del escenario: Cancelar cierra el diálogo y no crea nada
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando pulsa «Nuevo requisito», escribe Requisito de prueba en «Título» y pulsa «Cancelar»
    Entonces el diálogo «Nuevo requisito» está cerrado y no aparece el aviso «Requisito creado»

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | consultor@sigpro.test |

  Esquema del escenario: Solo los roles con permiso de alta pueden abrir el diálogo
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en /login?tenant=alumno01 y está en /programs/PRG-001/requirements
    Cuando la lista de requisitos está cargada
    Entonces el botón «Nuevo requisito» <estado>

    Ejemplos:
      | cuenta | estado |
      | gestor@sigpro.test | está habilitado |
      | consultor@sigpro.test | está habilitado |
      | auditor@sigpro.test | está deshabilitado y su explicación es «Tu rol no permite crear requisitos» |
```

## Fuera de alcance
- La respuesta de la API a un alta inválida y sus motivos: la historia de la API de rechazo de altas de esta misma épica.
- La descripción y las etiquetas del requisito nuevo: la web no las pide; la app móvil sí, en su historia de alta.
