---
id: US-PROG-LISTA-004
tipo: historia
epica: EP-PROG-LISTA
titulo: "[Web] Filtrar y buscar en la lista de programas"
etiquetas: [web]
relacionadas: [US-PROG-LISTA-002, US-PROG-LISTA-005, US-PROG-LISTA-006, US-PROG-LISTA-009, US-LOGIN-007]
verificacion: codigo
cubre: ["/programs"]
---

## Historia
Como responsable de programas que busca un programa concreto, quiero filtrar la lista por estado, por fechas y por responsable, y buscarla por código o nombre,
para llegar al programa sin revisar toda la lista.

## Reglas
- El escritorio es un ancho de ventana de 1024 px o más; el diseño responsive, uno menor de 1024 px.
- En escritorio los filtros son chips en una misma barra: «Estado», «Inicio desde», «Fin hasta» y «Responsable». Mientras no hay valor, cada chip muestra su nombre precedido de un signo más («+ Estado», «+ Inicio desde», «+ Fin hasta» y «+ Responsable»).
- En el diseño responsive los mismos filtros están en el panel «Filtros». El botón «Filtros» abre el panel, muestra cuántos de los filtros de estado, fechas y responsable están activos, y el panel se cierra con «Listo».
- El buscador de la lista es el campo «Búsqueda global» de la cabecera en escritorio, y el campo «Buscar programas» de la propia página en el diseño responsive. Los dos muestran el texto de ayuda «Buscar código o nombre…».
- «Inicio desde» filtra por la fecha de inicio del programa y «Fin hasta» por su fecha de fin; el día indicado cuenta en los dos.
- «Responsable» ofrece las personas del tenant. Cada opción muestra cuántos programas tiene esa persona. Escribir un nombre reduce las opciones; si no coincide ninguna, aparece «Sin coincidencias».
- Los filtros se combinan entre sí y con el texto del buscador.
- Cambiar un filtro o escribir en el buscador vuelve a la primera página.
- «Limpiar filtros» aparece cuando hay algún filtro aplicado o texto en el buscador. Quita todos, incluido el texto, y deja el orden como estaba.
- El buscador de la cabecera filtra la lista solo en la página de programas; al salir de ella, el campo se vacía.
- Los filtros viven en la dirección de la página (por ejemplo `/programs?status=on_hold`): recargarla o abrir ese enlace muestra la misma lista. Entrar en `/programs` sin parámetros la muestra sin filtros. Un valor no válido en la dirección (un estado que no existe, una fecha con otra forma) se ignora.
- La tecla / lleva el foco al buscador de la lista cuando no se está escribiendo en ningún campo.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe `gestor@sigpro.test` con `Gestor1234!` y se llega a `/programs`.

## Criterios de aceptación
```gherkin
Característica: Filtros y búsqueda de la lista de programas en la web

  Esquema del escenario: El filtro de estado muestra solo los programas de ese estado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en un diseño <diseno>
    Cuando elige <estado> en «Estado» de los filtros
    Entonces la lista muestra <codigos> y el recuento dice <recuento>

    Ejemplos:
      | diseno | estado | codigos | recuento |
      | escritorio | «En pausa» | PRG-004, PRG-012, PRG-020 | «1–3 de 3» |

  Esquema del escenario: «Inicio desde» y «Fin hasta» incluyen el día indicado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en un diseño escritorio
    Cuando escribe <texto> en el buscador de la lista y <fecha> en <campo>
    Entonces la lista muestra <codigos>

    Ejemplos:
      | texto | campo | fecha | codigos |
      | PRG-001 | «Fin hasta» | 2024-06-30 | (ningún programa) |
      | PRG-001 | «Fin hasta» | 2024-07-01 | PRG-001 |
      | PRG-023 | «Inicio desde» | 2025-03-20 | PRG-023 |

  Esquema del escenario: El filtro de responsable muestra los programas de la persona elegida
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en un diseño escritorio
    Cuando escribe <busqueda> en «Responsable» y elige <persona>
    Entonces la lista muestra <codigos>

    Ejemplos:
      | busqueda | persona | codigos |
      | Ruiz | Marta Ruiz | PRG-001, PRG-007, PRG-013, PRG-019 |
      | Alumno | Alumno 01 | (ningún programa) |

  Esquema del escenario: El buscador compara código y nombre y muestra el recuento
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs sin filtros en un diseño <diseno>
    Cuando escribe <texto> en el buscador de la lista
    Entonces la lista muestra <codigos> y el recuento dice <recuento>

    Ejemplos:
      | diseno | texto | codigos | recuento |
      | escritorio | radar | PRG-002 | «1–1 de 1» |
      | responsive | Torre de control | PRG-015 | «1–1 de 1» |

  Esquema del escenario: «Limpiar filtros» quita filtros y texto y vuelve a la lista completa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha elegido «En pausa» en «Estado» y ha escrito gestión en el buscador de la lista en un diseño <diseno>
    Cuando pulsa «Limpiar filtros»
    Entonces la lista muestra el recuento «1–10 de 24» y el buscador queda vacío

    Ejemplos:
      | diseno |
      | escritorio |
      | responsive |

  Esquema del escenario: Una dirección con filtros muestra la lista filtrada
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su sesión iniciada en un diseño escritorio
    Cuando abre <direccion>
    Entonces la lista muestra <codigos> y el recuento dice <recuento>

    Ejemplos:
      | direccion | codigos | recuento |
      | /programs?status=on_hold | PRG-004, PRG-012, PRG-020 | «1–3 de 3» |
      | /programs?status=inventado | PRG-001 a PRG-010 | «1–10 de 24» |

  Esquema del escenario: La tecla / lleva el foco al buscador de la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test está en /programs en un diseño <diseno> sin escribir en ningún campo
    Cuando pulsa /
    Entonces el foco queda en <campo>

    Ejemplos:
      | diseno | campo |
      | escritorio | «Búsqueda global» de la cabecera |
      | responsive | «Buscar programas» |
```

## Decisiones pendientes
- Si el buscador de la lista debe ignorar las tildes: hoy «movil» no encuentra «Torre de control móvil TCM».
- Si una «Inicio desde» posterior a «Fin hasta» debe avisar de la incoherencia: hoy la lista sale vacía, sin aviso.

## Fuera de alcance
- La búsqueda global de la cabecera fuera de la lista de programas (resultados agrupados por tipo): EP-NAVEGACION.
- La exportación a CSV con estos filtros: EP-PROG-GESTION.
- El alta de un programa y su atajo de teclado: EP-PROG-ALTA.
- El orden por columna de la tabla: EP-PROG-LISTA, en la historia de la tabla de la web.
- La paginación de la lista: EP-PROG-LISTA, en la historia de paginación de la web.
