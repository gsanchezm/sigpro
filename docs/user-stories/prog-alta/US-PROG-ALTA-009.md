---
id: US-PROG-ALTA-009
tipo: historia
epica: EP-PROG-ALTA
titulo: "[Web] Elegir el responsable con búsqueda en el asistente"
etiquetas: [web]
relacionadas: [US-PROG-ALTA-006, US-PROG-ALTA-007]
verificacion: codigo
---

## Historia
Como gestor de programas que da de alta un programa desde la web, quiero buscar al responsable escribiendo parte de su nombre entre las personas del tenant,
para elegirlo sin recordar su correo ni su identificador.

## Reglas
- El campo «Responsable» del paso 1 ofrece las personas del tenant, con su nombre. Al enfocarlo se abre la lista.
- Escribir en el campo filtra la lista por el nombre: no distingue mayúsculas de minúsculas, no cuentan los espacios del principio y del final, y busca el texto escrito dentro del nombre. Sin ninguna coincidencia, la lista muestra «Sin coincidencias».
- Elegir una persona de la lista pone su nombre en el campo y cierra la lista. El asistente sigue en «Paso 1 de 3».
- Escribir sobre una persona ya elegida quita la elección: el campo deja de tener responsable hasta que se elija otra persona.
- La tecla Esc con la lista abierta cierra solo la lista. El asistente no se cierra.
- Las personas de la lista son las mismas que devuelve la lista de responsables del tenant, en su orden.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `gestor@sigpro.test` (contraseña `Gestor1234!`) inicia sesión en `/login?tenant=alumno01`, llega a /programs y abre «Nuevo programa». Tras el reinicio, el tenant tiene siete personas: Marta Ruiz, Javier Ortega, Lucía Fernández, Andrés Molina, Carmen Vidal, Pablo Serrano y Alumno 01.

## Criterios de aceptación
```gherkin
Característica: Búsqueda y elección del responsable en el asistente de alta

  Esquema del escenario: Escribir en el campo filtra las personas por su nombre
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto «Nuevo programa» y está en «Paso 1 de 3»
    Cuando escribe <texto> en «Responsable»
    Entonces la lista muestra <resultado>

    Ejemplos:
      | texto | resultado |
      | lucía | solo Lucía Fernández |
      | PABLO | solo Pablo Serrano |
      | xyz | «Sin coincidencias» |
      | (vacío) | las siete personas del tenant |

  Esquema del escenario: Elegir una persona fija el responsable y cierra la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto «Nuevo programa» y está en «Paso 1 de 3»
    Cuando elige a <persona> en la lista de «Responsable»
    Entonces el campo «Responsable» muestra <persona>, la lista se cierra y el asistente sigue en «Paso 1 de 3»

    Ejemplos:
      | persona |
      | Andrés Molina |
      | Alumno 01 |

  Esquema del escenario: Escribir sobre la persona elegida quita la elección
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto «Nuevo programa», ha elegido a Andrés Molina como responsable y está en «Paso 1 de 3»
    Cuando escribe <texto> en el campo «Responsable»
    Entonces el campo ya no tiene responsable elegido y pulsar «Siguiente» muestra el aviso «Selecciona un responsable de la lista»

    Ejemplos:
      | texto |
      | Pablo |
      | x |

  Esquema del escenario: La tecla Esc cierra primero la lista de responsables y después el asistente
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto «Nuevo programa», está en «Paso 1 de 3» y el campo «Responsable» está <situacion>
    Cuando pulsa la tecla Esc
    Entonces <resultado>

    Ejemplos:
      | situacion | resultado |
      | con la lista abierta | la lista se cierra y el asistente sigue abierto en «Paso 1 de 3» |
      | con la lista cerrada | el asistente se cierra |
```

## Fuera de alcance
- La lista de personas por sí misma, su orden y sus datos: EP-PROG-ALTA, historia de listado de responsables por la API.
- El resto de campos del paso 1 y los avisos de «Siguiente»: EP-PROG-ALTA, historia de apertura del asistente y validación de sus dos primeros pasos.
- El selector de responsable de la pantalla de edición de un programa: EP-PROG-ALTA, historia de edición de la web.
