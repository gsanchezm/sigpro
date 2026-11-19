---
id: US-PROG-ALTA-008
tipo: historia
epica: EP-PROG-ALTA
titulo: "[Web] Revisar, crear o cancelar el alta desde el asistente"
etiquetas: [web]
relacionadas: [US-PROG-ALTA-001, US-PROG-ALTA-007, US-PROG-ALTA-012, US-PROG-ALTA-014]
verificacion: codigo
permisos: [program.create]
---

## Historia
Como gestor de programas que da de alta un programa desde la web, quiero revisar el resumen antes de crear el programa y que, si el servidor lo rechaza, el asistente me lleve al dato que falla,
para crear el programa solo cuando es correcto y corregirlo sin volver a empezar.

## Reglas
- «Atrás» vuelve al paso anterior y conserva lo escrito en todos los pasos. En el paso 1 está deshabilitado y su motivo es «Estás en el primer paso».
- «Cancelar», el botón «Cerrar» de la cabecera del asistente y la tecla Esc cierran el asistente sin crear nada. Un clic fuera del asistente también lo cierra.
- Paso 3, «Revisión»: un resumen con «Código», «Nombre», «Responsable», «Fechas» (en formato dd/mm/aaaa, con una flecha entre el inicio y el fin), «Presupuesto» (en euros, con separador de miles), «Prioridad» (con su nombre) y «Programa clasificado» (Sí o No).
- Paso 3: el interruptor «Notificar al equipo por correo» aparece activado al empezar. Debajo hay un texto de ayuda que dice que un nombre con «duplicado» devuelve 422. El interruptor puede cambiar de posición y no impide crear el programa.
- «Crear programa» envía el alta. Con éxito, el asistente se cierra, aparece el aviso «Programa creado» con el texto «PRG-025 se añadió a la lista» y la lista de Programas muestra el nuevo programa en la primera fila.
- Si el servidor responde 422, el asistente vuelve al paso 1 con el aviso «422 · Ya existe un programa con ese nombre» arriba y el mismo texto bajo «Nombre», y no se crea nada.
- Si el servidor responde con otro error, el asistente se queda en «Paso 3 de 3» con un aviso formado por el código HTTP de la respuesta, un separador «·» y el texto «Ha ocurrido un error inesperado». Si no hubo respuesta, el código es un guion largo (—). No se crea nada.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `gestor@sigpro.test` (contraseña `Gestor1234!`) inicia sesión en `/login?tenant=alumno01` y llega a /programs. El estado «completado» del asistente es el que deja la fila con los datos del cuerpo base: nombre `Programa de prueba alfa`, responsable Javier Ortega, inicio `2027-03-01`, fin `2027-03-02`, presupuesto `900000`, prioridad Alta y sin clasificar.
- En los ejemplos, «(vacío)» significa que el campo se deja sin escribir.

## Criterios de aceptación
```gherkin
Característica: Revisión, creación y cierre del asistente de alta en la web

  Esquema del escenario: Atrás vuelve un paso y conserva lo escrito
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene el asistente «Nuevo programa» en el paso <paso>, con los datos del cuerpo base escritos
    Cuando pulsa «Atrás»
    Entonces <resultado>

    Ejemplos:
      | paso | resultado |
      | 1 | «Atrás» está deshabilitado y su motivo es «Estás en el primer paso» |
      | 2 | vuelve a «Paso 1 de 3» y el campo «Nombre» muestra Programa de prueba alfa |
      | 3 | vuelve a «Paso 2 de 3» y el campo «Fecha de inicio» muestra 2027-03-01 y el campo «Presupuesto (€)» muestra 900000 |

  Esquema del escenario: Cerrar el asistente no crea ningún programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha completado el asistente con los datos del cuerpo base y está en «Paso 3 de 3»
    Cuando usa <salida> para cerrar el asistente
    Entonces el asistente se cierra y no existe ningún programa PRG-025 en la lista

    Ejemplos:
      | salida |
      | «Cancelar» |
      | el botón «Cerrar» de la cabecera del asistente |
      | la tecla Esc |

  Esquema del escenario: El resumen muestra los datos escritos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha completado el asistente con los datos del cuerpo base y está en «Paso 3 de 3»
    Cuando observa el resumen
    Entonces el resumen muestra <campo> con el valor <valor>

    Ejemplos:
      | campo | valor |
      | «Código» | PRG-025 |
      | «Fechas» | 01/03/2027 → 02/03/2027 |
      | «Presupuesto» | 900.000 € |
      | «Prioridad» | Alta |

  Esquema del escenario: El interruptor de aviso no impide crear el programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha completado el asistente con los datos del cuerpo base y está en «Paso 3 de 3»
    Cuando deja «Notificar al equipo por correo» <interruptor> y pulsa «Crear programa»
    Entonces aparece el aviso «Programa creado» con el texto «PRG-025 se añadió a la lista» y el asistente se cierra

    Ejemplos:
      | interruptor |
      | activado |
      | desactivado |

  Esquema del escenario: Un nombre repetido vuelve al paso 1 con el aviso del servidor
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha completado el asistente con el nombre <nombre> y el resto de datos del cuerpo base, y está en «Paso 3 de 3»
    Cuando pulsa «Crear programa»
    Entonces el asistente vuelve a «Paso 1 de 3» con el aviso «422 · Ya existe un programa con ese nombre» arriba y el mismo texto bajo «Nombre», y no se crea ningún programa

    Ejemplos:
      | nombre |
      | Sistema de mando táctico Ártemis |
      | sistema de MANDO táctico ártemis |
      | Programa DUPLICADO de prueba |

  Esquema del escenario: Otro error del servidor se queda en el paso 3
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha completado el asistente con los datos del cuerpo base y está en «Paso 3 de 3»
    Cuando pulsa «Crear programa» y la prueba hace que la respuesta de POST /api/programs sea <respuesta>
    Entonces sigue en «Paso 3 de 3» con el aviso <aviso> y no se crea ningún programa

    Ejemplos:
      | respuesta | aviso |
      | 500 | «500 · Ha ocurrido un error inesperado» |
      | sin respuesta | «— · Ha ocurrido un error inesperado» |
```

## Fuera de alcance
- Los pasos 1 y 2 y sus avisos de campo: EP-PROG-ALTA, historia de apertura del asistente y validación de sus dos primeros pasos.
- El selector de responsable: EP-PROG-ALTA, historia de selector de responsable en el asistente.
- El aviso por correo al equipo que activa o desactiva el interruptor: EP-PROG-ALTA, historia no implementada de aviso por correo.
- La lista de Programas después de crear, con sus filtros, su orden y su paginación: EP-PROG-LISTA.

## Decisiones pendientes
- Si el aviso superior «422 · …» debe desaparecer cuando la persona corrige el campo que falla. Hoy el aviso superior sigue visible hasta el siguiente envío, mientras el aviso bajo el campo sí desaparece al corregirlo. No está decidido.
- Si el texto de ayuda bajo el interruptor debe seguir mostrándose a quien crea programas. Hoy se muestra; no está decidido si se mantiene.
