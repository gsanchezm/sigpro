---
id: US-PROG-GESTION-009
tipo: historia
epica: EP-PROG-GESTION
titulo: "[Web] Exportar a CSV la lista de programas desde la cabecera"
etiquetas: [web]
relacionadas: [US-LOGIN-007, US-PROG-LISTA-002, US-PROG-LISTA-004, US-PROG-GESTION-004, US-PROG-GESTION-007]
verificacion: ejecutada
cubre: ["/programs"]
permisos: [program.export]
---

## Historia
Como persona que prepara un informe de programas, quiero descargar la lista tal como la tengo filtrada y ordenada,
para llevarla a una hoja de cálculo sin copiarla a mano.

## Reglas
- En escritorio (ancho de 1024 px o más), el botón «Exportar CSV» está en la cabecera de la página, junto a «Nuevo programa». En el diseño responsive no hay botón de exportación (ver Decisiones pendientes).
- Al pulsarlo se descarga `sigpro-programas.csv` con todos los programas que cumplen los filtros y el orden vigentes, no solo los de la página que se ve. El formato es el del archivo de la API (US-PROG-GESTION-004).
- Después aparece el aviso informativo «CSV generado» con «N filas exportadas», donde N es el número de programas que cumplen los filtros.
- El botón está deshabilitado mientras carga la lista, si la lista da error o si ningún programa cumple los filtros. Su motivo, como texto de ayuda, es «No hay programas para exportar».
- Exportar no cambia los filtros, el orden ni la selección.
- El botón lo ven habilitado todos los roles cuando hay programas que exportar.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe la cuenta de la fila con su contraseña (`gestor@sigpro.test` con `Gestor1234!` si la fila no dice otra cosa; `consultor@sigpro.test` con `Consul1234!` o `auditor@sigpro.test` con `Audit1234!`) y se llega a `/programs`.

## Criterios de aceptación
```gherkin
Característica: Exportar la lista de programas a CSV en la web

  Esquema del escenario: La descarga contiene los programas que cumplen los filtros vigentes
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha entrado en /programs con <filtro> en escritorio
    Cuando pulsa «Exportar CSV»
    Entonces se descarga sigpro-programas.csv con <codigos>
    Y aparece el aviso informativo «CSV generado» con «<filas> filas exportadas»

    Ejemplos:
      | cuenta | filtro | codigos | filas |
      | gestor@sigpro.test | «Estado» en «En pausa» | PRG-004, PRG-012 y PRG-020 | 3 |
      | auditor@sigpro.test | PRG-001 en el buscador de la lista y 2024-07-01 en «Fin hasta» | PRG-001 | 1 |
      | consultor@sigpro.test | ningún filtro | PRG-001 a PRG-024 | 24 |

  Esquema del escenario: El botón no se puede usar si ningún programa cumple los filtros
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con <filtro> en escritorio
    Cuando mira el botón «Exportar CSV»
    Entonces el botón está deshabilitado con el motivo «No hay programas para exportar»

    Ejemplos:
      | filtro |
      | el buscador de la lista escrito «PRG-999» |
      | «Responsable» con «Alumno 01» elegido |
```

## Decisiones pendientes
- Si el diseño responsive (ancho menor de 1024 px) debe ofrecer «Exportar CSV». Hoy su cabecera no lo tiene, y la app móvil sí lo ofrece (US-PROG-GESTION-012).

## Fuera de alcance
- Exportar solo las filas marcadas: US-PROG-GESTION-007.
- El formato del archivo y la API: US-PROG-GESTION-004.
- Los filtros de la lista y cómo se combinan: EP-PROG-LISTA.
- La exportación desde la app móvil: US-PROG-GESTION-012.
