---
id: US-NC-GESTION-007
tipo: historia
epica: EP-NC-GESTION
titulo: "[Web] Editar la severidad, la descripción y la asignación en el detalle de una no conformidad"
etiquetas: [web]
relacionadas: [US-NC-GESTION-003, US-NC-GESTION-006, US-NC-GESTION-011, US-NC-GESTION-008, US-NC-TABLERO-009]
verificacion: codigo
cubre: ["/nc/:code"]
permisos: [nc.edit]
---

## Historia
Como persona que mantiene una no conformidad, quiero corregir desde su detalle su severidad, su descripción y la persona a la que está asignada,
para que el registro refleje lo que se sabe en cada momento.

## Reglas
- El detalle se abre en /nc/NC-003, sobre la pantalla de No conformidades. Muestra el código en el título «Detalle de NC-003», las insignias de estado y de severidad, «Programa» (el código y el nombre del programa, que enlaza a su ficha), «Estado» con la fecha de alta, «Severidad», «Descripción», «Asignada a», la sección «Cambiar estado» y «Comentarios». Las secciones de estado y de comentarios se describen en otras historias.
- Pueden editar `admin`, `program_manager` y `consultant`. El rol `auditor` ve el detalle en solo lectura: aparece el aviso «Tu rol puede leer y comentar, pero no modificar esta no conformidad.», la severidad, la descripción y la asignación no se pueden cambiar, y «Guardar» y «Guardar y cerrar» están deshabilitados con ese mismo texto como explicación.
- «Guardar» y «Guardar y cerrar» solo se habilitan cuando hay cambios. Sin cambios, están deshabilitados con la explicación «No hay cambios que guardar».
- Solo viajan al servidor los campos cambiados.
- La descripción se valida antes de enviar: con menos de 10 caracteres de texto sin formato aparece «La descripción debe tener al menos 10 caracteres» bajo el editor y no se envía nada.
- Al guardar con éxito aparece el aviso «NC-003 guardada». «Guardar» deja el detalle abierto con los datos que devuelve el servidor; «Guardar y cerrar» además vuelve a /nc.
- La asignación: al escribir en «Buscar persona…» se muestran las personas del tenant cuyo nombre contiene lo escrito, sin distinguir mayúsculas. Si ninguna coincide, aparece «Sin coincidencias». Elegir una persona la asigna al guardar. «Quitar asignación» deja el campo vacío; al guardar, la no conformidad queda sin asignar y el campo vuelve a mostrar «Buscar persona…».
- Un código que no existe, por ejemplo /nc/NC-999, muestra «No se encontró la no conformidad».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona de la fila inicia sesión en /login?tenant=alumno01 y abre /nc/NC-003. NC-003 está en «Acción correctiva», con severidad «Crítica», descripción «Desviación detectada en la ejecución 003: el resultado no cumple el criterio de aceptación.» y asignada a «Andrés Molina».
- En los ejemplos, `(10 letras a)` es un texto de diez letras `a` seguidas, sin espacios.

## Criterios de aceptación
```gherkin
Característica: Edición de una no conformidad en la web

  Esquema del escenario: Un rol con permiso de edición cambia la severidad
    Dado que en el tenant alumno01, recién reiniciado, <correo> ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando elige <severidad> en «Severidad» y pulsa «Guardar»
    Entonces ve el aviso «NC-003 guardada»
    Y la severidad del detalle es <severidad>

    Ejemplos:
      | correo | severidad |
      | gestor@sigpro.test | «Menor» |
      | consultor@sigpro.test | «Mayor» |

  Esquema del escenario: Los dos botones de guardado se diferencian en lo que pasa después
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando elige «Menor» en «Severidad» y pulsa <boton>
    Entonces ve el aviso «NC-003 guardada»
    Y <destino>

    Ejemplos:
      | boton | destino |
      | «Guardar» | el detalle de NC-003 sigue abierto con la severidad «Menor» |
      | «Guardar y cerrar» | la pantalla vuelve a /nc |

  Esquema del escenario: La descripción debe tener al menos 10 caracteres para guardarse
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando sustituye el texto de «Descripción» por <texto> y pulsa «Guardar»
    Entonces <resultado>

    Ejemplos:
      | texto | resultado |
      | (10 letras a) | ve el aviso «NC-003 guardada» |
      | (9 letras a) | ve el mensaje «La descripción debe tener al menos 10 caracteres» bajo «Descripción» y no se envía ninguna petición |

  Esquema del escenario: Elegir una persona la asigna al guardar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando escribe <busqueda> en «Buscar persona…», elige <persona> en la lista «Personas» y pulsa «Guardar»
    Entonces ve el aviso «NC-003 guardada»
    Y el campo «Asignada a» muestra <persona>

    Ejemplos:
      | busqueda | persona |
      | Lucí | Lucía Fernández |
      | CARMEN | Carmen Vidal |

  Esquema del escenario: Quitar la asignación deja la no conformidad sin responsable
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando <accion>
    Entonces ve el aviso «NC-003 guardada»
    Y el campo «Asignada a» queda vacío y muestra «Buscar persona…»

    Ejemplos:
      | accion |
      | pulsa «Quitar asignación» y después «Guardar» |

  Esquema del escenario: Una búsqueda sin coincidencias no ofrece personas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando escribe <busqueda> en «Buscar persona…»
    Entonces ve «Sin coincidencias» y ninguna persona en la lista «Personas»

    Ejemplos:
      | busqueda |
      | Zzzz |

  Esquema del escenario: Un rol sin permiso de edición ve el detalle en solo lectura
    Dado que en el tenant alumno01, recién reiniciado, <correo> ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003
    Cuando mira el detalle de NC-003
    Entonces ve el aviso «Tu rol puede leer y comentar, pero no modificar esta no conformidad.»
    Y «Guardar» y «Guardar y cerrar» están deshabilitados

    Ejemplos:
      | correo |
      | auditor@sigpro.test |

  Esquema del escenario: Sin cambios no se puede guardar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de NC-003 <estado>
    Cuando mira «Guardar» y «Guardar y cerrar»
    Entonces los dos están deshabilitados con la explicación «No hay cambios que guardar»

    Ejemplos:
      | estado |
      | sin tocar ningún campo |
      | con la severidad cambiada a «Menor» y de nuevo a «Crítica» |

  Esquema del escenario: Un código que no existe muestra el aviso de no encontrado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01
    Cuando abre /nc/<codigo>
    Entonces ve el mensaje «No se encontró la no conformidad»

    Ejemplos:
      | codigo |
      | NC-999 |
```

## Fuera de alcance
- El cambio de estado y el cierre con su comentario: EP-NC-TABLERO y US-NC-GESTION-009.
- El hilo de comentarios: US-NC-GESTION-008.
- El tablero y sus tarjetas: EP-NC-TABLERO.
- La misma edición desde la app móvil: US-NC-GESTION-011.
