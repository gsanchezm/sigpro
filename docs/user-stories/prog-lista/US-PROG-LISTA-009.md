---
id: US-PROG-LISTA-009
tipo: historia
epica: EP-PROG-LISTA
titulo: "[Móvil] Filtrar la lista de programas por fechas y responsable"
etiquetas: [movil, no-implementada]
relacionadas: [US-PROG-LISTA-002, US-PROG-LISTA-004, US-PROG-LISTA-008]
verificacion: no-ejecutable
---

## Historia
Como persona que usa la app móvil, quiero filtrar la lista de programas por fechas y por responsable, igual que en la web,
para encontrar los programas de un periodo o de una persona sin tener que usar el ordenador.

## Reglas
- Además del estado y del texto de búsqueda, la lista de programas de la app móvil ofrece los filtros «Inicio desde», «Fin hasta» y «Responsable», con los mismos textos y el mismo significado que en la web.
- «Inicio desde» filtra por la fecha de inicio del programa y «Fin hasta» por su fecha de fin. El día indicado cuenta en los dos. Cada fecha se compara solo con su campo.
- «Responsable» ofrece las personas del tenant, con el número de programas de cada una. Se puede escribir un nombre para reducir las opciones, y al elegir una persona la lista muestra solo sus programas. Hay un control para quitar el responsable elegido.
- Los filtros de fechas y de responsable se combinan con el estado y con el texto de búsqueda.
- «Limpiar filtros» quita también las fechas y el responsable.
- Cada cambio de filtro vuelve a la primera carga de 10 programas.
- Igual que el estado, estos filtros viven en la dirección de la pantalla.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada en el dispositivo, con `alumno01` en «Tenant de trabajo», y `gestor@sigpro.test` inicia sesión con `Gestor1234!` y llega a `/programs`.

## Criterios de aceptación
```gherkin
Característica: Filtros de fechas y responsable en la app móvil

  Esquema del escenario: Las fechas filtran la lista por inicio o por fin
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs en la app sin filtros
    Cuando escribe <fecha> en <campo>
    Entonces ve <resultado>

    Ejemplos:
      | campo | fecha | resultado |
      | «Inicio desde» | 2025-03-20 | PRG-019, PRG-020, PRG-021, PRG-022, PRG-023 y PRG-024, con el recuento «1–6 de 6» |
      | «Inicio desde» | 2025-03-21 | PRG-019, PRG-020, PRG-021, PRG-022 y PRG-024, con el recuento «1–5 de 5» |
      | «Fin hasta» | 2024-07-01 | PRG-001 y PRG-007, con el recuento «1–2 de 2» |
      | «Fin hasta» | 2023-12-31 | el mensaje «Ningún programa coincide con los filtros aplicados.» |

  Esquema del escenario: El filtro de responsable muestra los programas de la persona elegida
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs en la app sin filtros
    Cuando escribe <texto> en «Responsable» y elige <persona>
    Entonces ve <resultado>

    Ejemplos:
      | texto | persona | resultado |
      | Ruiz | Marta Ruiz | PRG-001, PRG-007, PRG-013 y PRG-019, con el recuento «1–4 de 4» |
      | Alumno | Alumno 01 | el mensaje «Ningún programa coincide con los filtros aplicados.» |

  Esquema del escenario: Los filtros de fecha se combinan con el estado y se limpian juntos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs en la app sin filtros
    Cuando elige «Activo» en «Estado» y escribe <fecha> en «Fin hasta»
    Entonces ve <resultado>
    Y al pulsar «Limpiar filtros» ve el recuento «1–10 de 24»

    Ejemplos:
      | fecha | resultado |
      | 2024-06-30 | PRG-007, con el recuento «1–1 de 1» |
      | 2024-07-01 | PRG-001 y PRG-007, con el recuento «1–2 de 2» |
```

## Decisiones pendientes
- Dónde y cómo se presentan los controles «Inicio desde», «Fin hasta» y «Responsable» en la pantalla de la app móvil: en la misma barra que el estado, en un panel que se abre desde la lista, o con el selector de fecha del sistema. Los textos y el significado de esos controles sí vienen de la web; su presentación en el móvil no está decidida. Esta historia no afirma ninguna presentación concreta.
- Si, en el móvil, las personas responsables se eligen escribiendo su nombre o desde una lista completa. No está decidido.

## Fuera de alcance
- El estado y el texto de búsqueda, con su recuento y sus opciones: EP-PROG-LISTA, en la historia de la lista de tarjetas de la app móvil.
- La exportación a CSV con estos filtros: EP-PROG-GESTION.
- La paginación con «Cargar más»: EP-PROG-LISTA, en la historia de la lista de tarjetas de la app móvil.
