---
id: US-HITOS-004
tipo: historia
epica: EP-HITOS
titulo: "[API] Registrar el avance de un hito: con el 100 % queda cumplido"
etiquetas: [api]
relacionadas: [US-HITOS-001, US-HITOS-008, US-HITOS-012, US-PROG-LISTA-001]
verificacion: ejecutada
cubre: ["PATCH /api/milestones/:id"]
permisos: [milestone.edit]
---

## Historia
Como gestor de programas que usa la API (o una suite de pruebas), quiero registrar el avance de un hito entre 0 y 100,
para saber cuándo está cumplido y cómo cambia el avance del programa.

## Reglas
- El avance (`progress`) es un número entero de 0 a 100, ambos incluidos. Un valor fuera de ese rango, con decimales, que no sea un número o nulo responde 422 `validation_failed` con el motivo `progressInvalid` en `progress`, y no cambia nada.
- `done` (cumplido) es verdadero si y solo si el avance es 100. Con un avance de 100 el hito queda cumplido, venga de donde venga, también desde 0 %. Con un avance menor de 100, `done` es falso: bajar un hito cumplido lo deja no cumplido.
- Enviar el avance que el hito ya tiene no cambia nada: la respuesta es 200 con el hito tal como estaba.
- El avance del programa, que devuelve `GET /api/programs/:code` en `progress`, es el porcentaje entero (redondeado) de hitos cumplidos sobre el total de sus hitos. Con `milestonesDone` y `milestonesTotal` se ven esos dos números.
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos. `PRG-001-M01` (SRR) está cumplido, `PRG-001-M02` (PDR) va al 10 % y `PRG-001-M03` (CDR) va al 0 %. `PRG-004` tiene 9 hitos: `PRG-004-M01` y `PRG-004-M02` están cumplidos y `PRG-004-M03` va al 45 %.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `POST /api/auth/login` con la cabecera `x-tenant: alumno01` da el `accessToken` de la cuenta que indique la fila: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o `alumno01@sigpro.lab` (rol admin, sin segundo factor). Todas las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Avance y cumplido de un hito por la API

  Esquema del escenario: El avance guardado marca el cumplido solo con el 100 %
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y el hito <hito> tiene el avance del seed (<previo> %)
    Cuando envía PATCH /api/milestones/<hito> con progress <avance>
    Entonces la respuesta es 200 con progress <avance> y done <cumplido>

    Ejemplos:
      | hito | previo | avance | cumplido |
      | PRG-001-M02 | 10 | 100 | true |
      | PRG-001-M03 | 0 | 100 | true |
      | PRG-004-M03 | 45 | 100 | true |
      | PRG-001-M02 | 10 | 99 | false |
      | PRG-001-M01 | 100 | 99 | false |
      | PRG-001-M01 | 100 | 0 | false |

  Esquema del escenario: El avance acepta solo enteros de 0 a 100
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y el hito PRG-001-M02 tiene el avance del seed (10 %)
    Cuando envía PATCH /api/milestones/PRG-001-M02 con progress <avance>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | avance | respuesta |
      | -1 | 422 validation_failed con el motivo progressInvalid en progress |
      | 0 | 200 con progress 0 y done falso |
      | 100 | 200 con progress 100 y done verdadero |
      | 101 | 422 validation_failed con el motivo progressInvalid en progress |
      | 50.5 | 422 validation_failed con el motivo progressInvalid en progress |
      | (el texto 50) | 422 validation_failed con el motivo progressInvalid en progress |

  Esquema del escenario: El avance del programa refleja sus hitos cumplidos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía PATCH /api/milestones/<hito> con progress <avance> y después pide GET /api/programs/<programa>
    Entonces el programa tiene progress <progreso>, milestonesDone <cumplidos> y milestonesTotal 9

    Ejemplos:
      | hito | avance | programa | progreso | cumplidos |
      | PRG-001-M02 | 100 | PRG-001 | 22 | 2 |
      | PRG-001-M02 | 99 | PRG-001 | 11 | 1 |
      | PRG-004-M03 | 100 | PRG-004 | 33 | 3 |

```

## Fuera de alcance
- La edición del nombre y de la fecha límite: EP-HITOS, en la historia de la API de edición.
- El deslizador de avance de la web y los botones − y + de la app móvil: EP-HITOS, en sus historias de interfaz.
- La ficha del programa y sus datos: EP-PROG-DETALLE. La lista de programas con su avance: EP-PROG-LISTA.

## Decisiones pendientes
- Si el avance debe admitir solo múltiplos de 5, como el deslizador de la web y los botones de la app móvil. Hoy la API acepta cualquier entero de 0 a 100, y esta historia no lo afirma como requisito.
