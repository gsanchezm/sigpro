---
id: US-PROG-GESTION-012
tipo: historia
epica: EP-PROG-GESTION
titulo: "[Móvil] Exportar la lista o la selección de programas con la hoja de compartir"
etiquetas: [movil]
relacionadas: [US-LOGIN-012, US-PROG-LISTA-008, US-PROG-GESTION-004, US-PROG-GESTION-009, US-PROG-GESTION-010]
verificacion: codigo
cubre: ["/programs"]
permisos: [program.export]
---

## Historia
Como persona que prepara un informe desde el móvil, quiero exportar la lista filtrada o los programas marcados como CSV y enviarlo con la hoja de compartir del sistema,
para llevarlo a otra aplicación sin pasar por la web.

## Reglas
- El botón «Exportar CSV» está encima de las tarjetas. Si ningún programa cumple los filtros, el botón está deshabilitado y su motivo, «No hay programas para exportar», aparece como texto debajo.
- Al pulsarlo, se abre la hoja de compartir del sistema con el contenido del CSV y con el título `sigpro-programas.csv`. El contenido es el del archivo de la API (US-PROG-GESTION-004) con los filtros vigentes, con todos los programas que los cumplen, sin paginar.
- Con programas marcados, «Exportar selección» (barra de acciones masivas, US-PROG-GESTION-010) comparte solo esas filas, en el orden de la lista y con la misma cabecera.
- Tras abrir la hoja, aparece el aviso informativo «CSV generado» con «N filas exportadas», donde N es el número de programas que cumplen los filtros, o el de programas marcados en la selección.
- Todos los roles pueden exportar.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app está en /login sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo»; se escribe la cuenta de la fila con su contraseña (`gestor@sigpro.test` con `Gestor1234!` si la fila no dice otra cosa) y se llega a /programs.

## Criterios de aceptación
```gherkin
Característica: Exportar programas con la hoja de compartir en la app móvil

  Esquema del escenario: La hoja de compartir recibe el CSV de los programas que cumplen los filtros
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con <filtro> en la app móvil
    Cuando pulsa «Exportar CSV»
    Entonces la hoja de compartir recibe un CSV con <filas> programas, <codigos>
    Y aparece el aviso informativo «CSV generado» con «<filas> filas exportadas»

    Ejemplos:
      | filtro | filas | codigos |
      | el estado «En pausa» | 3 | PRG-004, PRG-012 y PRG-020 |
      | ningún filtro | 24 | desde PRG-001 hasta PRG-024 |

  Esquema del escenario: Exportar la selección comparte solo los programas marcados
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha marcado <marcados> en /programs sin filtros en la app móvil
    Cuando pulsa «Exportar selección» en la barra de acciones masivas
    Entonces la hoja de compartir recibe un CSV con las filas de <codigos>
    Y aparece el aviso informativo «CSV generado» con «<filas> filas exportadas»

    Ejemplos:
      | marcados | codigos | filas |
      | PRG-001 y PRG-003 | PRG-001 y PRG-003 | 2 |
      | PRG-002 | PRG-002 | 1 |

  Esquema del escenario: Sin programas que mostrar, exportar no está disponible
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con <filtro> en la app móvil
    Cuando mira el botón «Exportar CSV»
    Entonces el botón está deshabilitado y aparece el texto «No hay programas para exportar»

    Ejemplos:
      | filtro |
      | el buscador escrito «PRG-999» |
```

## Decisiones pendientes
- En el navegador (la app móvil en la web), donde no hay hoja de compartir, la app avisa con un error en lugar de descargar el archivo. No está decidido si debe descargarlo.
- Si el aviso «CSV generado» debe aparecer también cuando se cierra la hoja sin compartir. Hoy aparece igual.

## Fuera de alcance
- El formato del archivo y los filtros de la API: US-PROG-GESTION-004.
- La exportación desde la cabecera de la web: US-PROG-GESTION-009.
- La selección de programas y sus acciones masivas: US-PROG-GESTION-010.
- Los filtros de la lista y el «Cargar más»: EP-PROG-LISTA.
- Lo que muestra la hoja de compartir (aplicaciones de destino): lo decide el sistema operativo y no se describe aquí.
