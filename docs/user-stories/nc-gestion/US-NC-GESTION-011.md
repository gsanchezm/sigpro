---
id: US-NC-GESTION-011
tipo: historia
epica: EP-NC-GESTION
titulo: "[Móvil] Editar la severidad, la descripción y la asignación desde el detalle"
etiquetas: [movil]
relacionadas: [US-NC-GESTION-003, US-NC-GESTION-007, US-NC-GESTION-010, US-NC-GESTION-013]
verificacion: codigo
cubre: ["/nc"]
permisos: [nc.edit]
---

## Historia
Como persona que mantiene una no conformidad desde el móvil, quiero editar su severidad, su descripción y su persona responsable desde su detalle,
para corregirla sin tener que abrir la web.

## Reglas
- Se abre tocando una tarjeta de /nc. El detalle es una hoja con el título «Detalle de NC-003». Muestra el código, las insignias de estado y de severidad, «Programa», «Descripción», «Asignada a», el botón «Editar», la sección de cambio de estado y los comentarios (US-NC-GESTION-012).
- «Editar» sustituye la vista de lectura por el formulario «Editar no conformidad», con «Severidad» (tres opciones: «Menor», «Mayor» y «Crítica»), «Descripción» (un campo de varias líneas con el mismo aviso de párrafos que el alta), «Asignada a» (con el campo «Buscar persona» y el botón «Quitar asignación») y los botones «Cancelar», «Guardar» y «Guardar y cerrar».
- Pueden editar `admin`, `program_manager` y `consultant`. El rol `auditor` ve «Editar» deshabilitado, con la explicación «Tu rol puede leer y comentar, pero no modificar esta no conformidad.» visible junto al botón.
- «Guardar» y «Guardar y cerrar» solo se habilitan con cambios. Sin cambios, están deshabilitados con la explicación «No hay cambios que guardar».
- Solo viajan al servidor los campos cambiados. La descripción viaja solo si cambia su texto.
- La descripción se valida antes de enviar: con menos de 10 caracteres aparece «La descripción debe tener al menos 10 caracteres» bajo el campo y no se envía nada.
- Al guardar con éxito aparece el aviso «NC-003 guardada» y el detalle vuelve a la vista de lectura con los datos que devuelve el servidor. «Guardar y cerrar» además cierra la hoja.
- La asignación: al escribir en «Buscar persona» se muestran las personas del tenant cuyo nombre contiene lo escrito, sin distinguir mayúsculas. Elegir una persona la asigna al guardar. «Quitar asignación» la quita y, en la vista de lectura, «Asignada a» muestra «Sin asignar».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona de la fila abre la app en /login con `alumno01` en «Tenant de trabajo», inicia sesión, llega a /nc y toca NC-003. NC-003 tiene severidad «Crítica», la descripción «Desviación detectada en la ejecución 003: el resultado no cumple el criterio de aceptación.» y está asignada a «Andrés Molina».
- En los ejemplos, `(10 letras a)` es un texto de diez letras `a` seguidas, sin espacios.

## Criterios de aceptación
```gherkin
Característica: Edición de una no conformidad en la app móvil

  Esquema del escenario: Un rol con permiso de edición cambia la severidad y guarda
    Dado que en el tenant alumno01, recién reiniciado, <correo> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto el detalle de NC-003
    Cuando pulsa «Editar», elige <severidad> en «Severidad» y pulsa «Guardar»
    Entonces ve el aviso «NC-003 guardada»
    Y la severidad del detalle es <severidad>

    Ejemplos:
      | correo | severidad |
      | gestor@sigpro.test | «Menor» |
      | consultor@sigpro.test | «Mayor» |

  Esquema del escenario: Los dos botones de guardado se diferencian en lo que pasa después
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto el detalle de NC-003
    Cuando pulsa «Editar», elige «Menor» en «Severidad» y pulsa <boton>
    Entonces ve el aviso «NC-003 guardada»
    Y <destino>

    Ejemplos:
      | boton | destino |
      | «Guardar» | la hoja de detalle sigue abierta en la vista de lectura con la severidad «Menor» |
      | «Guardar y cerrar» | la hoja de detalle se cierra |

  Esquema del escenario: La descripción debe tener al menos 10 caracteres para guardarse
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto el detalle de NC-003
    Cuando pulsa «Editar», sustituye el texto de «Descripción» por <texto> y pulsa «Guardar»
    Entonces <resultado>

    Ejemplos:
      | texto | resultado |
      | (9 letras a) | ve el mensaje «La descripción debe tener al menos 10 caracteres» bajo el campo y no se envía ninguna petición |
      | (10 letras a) | ve el aviso «NC-003 guardada» |

  Esquema del escenario: Elegir una persona la asigna al guardar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto el detalle de NC-003
    Cuando pulsa «Editar», escribe <busqueda> en «Buscar persona», elige <persona> y pulsa «Guardar»
    Entonces ve el aviso «NC-003 guardada»
    Y en «Asignada a» aparece <persona>

    Ejemplos:
      | busqueda | persona |
      | Lucí | Lucía Fernández |
      | CARMEN | Carmen Vidal |

  Esquema del escenario: Quitar la asignación deja la no conformidad sin responsable
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto el detalle de NC-003
    Cuando <intento>
    Entonces ve el aviso «NC-003 guardada»
    Y en «Asignada a» aparece «Sin asignar»

    Ejemplos:
      | intento |
      | pulsa «Editar», pulsa «Quitar asignación» y pulsa «Guardar» |

  Esquema del escenario: Sin cambios no se puede guardar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto el detalle de NC-003
    Cuando <intento>
    Entonces «Guardar» y «Guardar y cerrar» están deshabilitados con la explicación «No hay cambios que guardar»

    Ejemplos:
      | intento |
      | pulsa «Editar» y no cambia ningún campo |

  Esquema del escenario: El rol de auditoría no puede entrar en la edición
    Dado que en el tenant alumno01, recién reiniciado, auditor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto el detalle de NC-003
    Cuando <intento>
    Entonces el botón está deshabilitado y la explicación «Tu rol puede leer y comentar, pero no modificar esta no conformidad.» se ve junto al botón

    Ejemplos:
      | intento |
      | mira el botón «Editar» |
```

## Fuera de alcance
- El cambio de estado de la no conformidad: EP-NC-TABLERO.
- El comentario y el cierre desde el detalle: US-NC-GESTION-012.
- El alta de la no conformidad: US-NC-GESTION-010.
- La edición desde la web: US-NC-GESTION-007.
- El formato enriquecido de la descripción: US-NC-GESTION-013.
