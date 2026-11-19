---
id: US-PROG-LISTA-008
tipo: historia
epica: EP-PROG-LISTA
titulo: "[Móvil] Ver la lista de programas en tarjetas con búsqueda, estado y «Cargar más»"
etiquetas: [movil]
relacionadas: [US-LOGIN-012, US-PROG-LISTA-001, US-PROG-LISTA-004, US-PROG-LISTA-006, US-PROG-LISTA-009, US-PROG-LISTA-010]
verificacion: ejecutada
cubre: ["/programs"]
---

## Historia
Como persona con una cuenta en la app móvil, quiero ver los programas en tarjetas, buscarlos por código o nombre y elegir su estado,
para encontrar un programa desde el teléfono y cargar más programas cuando hay más de diez.

## Reglas
- Cada programa es una tarjeta que muestra su código, su estado con la etiqueta, su nombre, su responsable, su presupuesto, sus fechas de inicio y de fin en formato dd/mm/aaaa, y su avance con una barra y su porcentaje. Tocar la tarjeta abre el detalle del programa (EP-PROG-DETALLE).
- Las tarjetas salen por código ascendente. La app móvil no ofrece ningún control para elegir otro orden.
- La primera carga trae 10 programas. «Cargar más» añade los 10 siguientes a continuación de los que ya se ven, sin sustituirlos. Mientras los pide, el botón indica que está cargando. Cuando ya se ven todos, «Cargar más» no aparece.
- El recuento dice cuántos programas se ven frente al total, con la forma «1–20 de 24».
- El estado se elige en el grupo «Estado», con las opciones «Todos», «Borrador», «Activo», «En pausa», «Cerrado» y «Cancelado». Solo una opción está elegida a la vez. «Todos» no filtra por estado.
- La búsqueda es el campo «Buscar programas», con el texto de ayuda «Buscar código o nombre…» mientras está vacío. La lista se filtra mientras se escribe; no hay ningún botón para buscar.
- Cada cambio de filtro vuelve a la primera carga de 10 programas.
- El estado y el texto de búsqueda viven en la dirección de la pantalla (por ejemplo `/programs?status=on_hold`), como en la web: abrir esa dirección muestra la misma lista.
- «Limpiar filtros» aparece cuando hay algún filtro aplicado y quita el estado y el texto; la lista vuelve a mostrar los primeros 10 programas.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada en el dispositivo, con `alumno01` en «Tenant de trabajo», y `gestor@sigpro.test` inicia sesión con `Gestor1234!` y llega a `/programs`.

## Criterios de aceptación
```gherkin
Característica: Lista de programas en la app móvil

  Esquema del escenario: «Cargar más» añade los programas siguientes
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs en la app y ha pulsado «Cargar más» <veces> veces
    Cuando mira la lista
    Entonces ve el recuento <recuento>, el último programa es <ultimo> y el botón «Cargar más» <boton>

    Ejemplos:
      | veces | recuento | ultimo | boton |
      | 0 | «1–10 de 24» | PRG-010 | aparece |
      | 1 | «1–20 de 24» | PRG-020 | aparece |
      | 2 | «1–24 de 24» | PRG-024 | no aparece |

  Esquema del escenario: El estado filtra la lista por ese estado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs en la app sin filtros
    Cuando elige <estado> en el grupo «Estado»
    Entonces ve <codigos> y el recuento <recuento>

    Ejemplos:
      | estado | codigos | recuento |
      | «En pausa» | PRG-004, PRG-012, PRG-020 | «1–3 de 3» |

  Esquema del escenario: La búsqueda compara código y nombre
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs en la app sin filtros
    Cuando escribe <texto> en «Buscar programas»
    Entonces ve <codigos> y el recuento <recuento>

    Ejemplos:
      | texto | codigos | recuento |
      | radar | PRG-002 | «1–1 de 1» |
      | Torre de control | PRG-015 | «1–1 de 1» |

  Esquema del escenario: Una dirección con filtros muestra la misma lista filtrada
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene su sesión iniciada en la app
    Cuando abre <direccion>
    Entonces ve <codigos> y el recuento <recuento>

    Ejemplos:
      | direccion | codigos | recuento |
      | /programs?status=on_hold | PRG-004, PRG-012, PRG-020 | «1–3 de 3» |
      | /programs?status=inventado | PRG-001 a PRG-010 | «1–10 de 24» |

  Esquema del escenario: «Limpiar filtros» vuelve a la lista de los primeros 10 programas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs en la app y ha aplicado <filtro>
    Cuando pulsa «Limpiar filtros»
    Entonces ve el recuento «1–10 de 24» y ningún filtro aplicado

    Ejemplos:
      | filtro |
      | «En pausa» en el grupo «Estado» |
      | el texto gestión en «Buscar programas» |
```

## Decisiones pendientes
- Si la lista móvil debe ofrecer un orden que la persona elija por columna. Hoy va por código ascendente, sin ningún control, igual que las tarjetas del diseño responsive de la web.
- Si el buscador debe ignorar las tildes: hoy «movil» no encuentra «Torre de control móvil TCM».

## Fuera de alcance
- Los filtros por fechas y por responsable de la app móvil: EP-PROG-LISTA, en la historia de filtros móviles no implementados.
- La selección múltiple, la exportación a CSV y el menú de cada tarjeta: EP-PROG-GESTION.
- El alta de un programa desde el botón «Nuevo programa»: EP-PROG-ALTA.
- Los estados de carga, vacío y error de la lista móvil: EP-PROG-LISTA, en la historia de estados de la app móvil.
- Las tarjetas de métricas de la cabecera: EP-PROG-METRICAS.
