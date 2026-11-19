---
id: US-PROG-GESTION-002
tipo: historia
epica: EP-PROG-GESTION
titulo: "[API] Duplicar un programa como borrador, sin hitos y con el código siguiente"
etiquetas: [api]
relacionadas: [US-LOGIN-001, US-PROG-LISTA-001, US-PROG-GESTION-001, US-PROG-GESTION-003]
verificacion: codigo
cubre: ["POST /api/programs/:code/duplicate"]
permisos: [program.create]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con una sesión iniciada en un tenant, quiero copiar un programa como borrador,
para partir de sus datos generales en un programa nuevo sin arrastrar su avance.

## Reglas
- `POST /api/programs/:code/duplicate` exige sesión: el `accessToken` va en la cabecera `Authorization` como Bearer. Sin esa cabecera responde 401 `missing_token`; con un texto que no es un token válido, 401 `invalid_token`.
- El permiso `program.create` lo tienen el administrador y el gestor de programas. Con el consultor o el auditor la respuesta es 403 `forbidden` y no se crea nada. El rol se comprueba antes de buscar el programa.
- La copia recibe el siguiente código libre del tenant (el mayor código que exista más uno: con 24 programas, `PRG-025`).
- La copia se crea en estado `draft`, sea cual sea el estado del original.
- El nombre de la copia es el nombre del original seguido de « (copia)».
- La copia recibe del original la descripción, la prioridad, la clasificación, el presupuesto, las fechas de inicio y de fin, y el responsable.
- La copia no tiene hitos: `milestonesTotal` 0, `milestonesDone` 0 y `progress` 0.
- La respuesta es 201 con la copia, en el mismo formato que la lista de programas.
- El original no cambia: conserva su estado, su nombre, sus hitos y su avance.
- La copia queda en la auditoría como `program.duplicated`, con el código del original como origen.
- Un código que no existe en el tenant responde 404 `program_not_found` y no crea nada.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la fila obtiene el `accessToken` de la cuenta de su ejemplo con `POST /api/auth/login`: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o, para el rol admin, `admin@sigpro.test` (`Admin1234!`), que completa el segundo factor con el código `123456` (`POST /api/auth/mfa`) y usa el `accessToken` que recibe. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.

## Criterios de aceptación
```gherkin
Característica: Duplicar un programa por la API

  Esquema del escenario: La copia recibe el código siguiente, el nombre con (copia) y los datos del original
    Dado que en el tenant alumno01, recién reiniciado, PRG-001 tiene el estado active, con 1 de 9 hitos cumplidos
    Cuando <cuenta> pide POST /api/programs/PRG-001/duplicate
    Entonces la respuesta es 201 con code PRG-025 y status draft
    Y el nombre de la copia es Sistema de mando táctico Ártemis (copia)
    Y la copia trae priority medium, classified true, ownerName Marta Ruiz, startDate 2023-01-01, endDate 2024-07-01 y budgetEur 450000
    Y la copia tiene progress 0 y milestonesTotal 0
    Y PRG-001 sigue con status active y progress 11

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | admin@sigpro.test |

  Esquema del escenario: La copia es siempre borrador, aunque el original esté en pausa o cancelado
    Dado que en el tenant alumno01, recién reiniciado, <codigo> tiene el estado <estado_original>
    Cuando gestor@sigpro.test pide POST /api/programs/<codigo>/duplicate
    Entonces la respuesta es 201 con code PRG-025 y status draft
    Y el nombre de la copia es <nombre_copia>

    Ejemplos:
      | codigo | estado_original | nombre_copia |
      | PRG-004 | on_hold | Plataforma UAV Cóndor (copia) |
      | PRG-008 | cancelled | Red de comunicaciones satelitales (copia) |

  Esquema del escenario: Solo el administrador y el gestor pueden duplicar
    Dado que en el tenant alumno01, recién reiniciado, el tenant tiene 24 programas
    Cuando <cuenta> pide POST /api/programs/PRG-001/duplicate
    Entonces la respuesta es <respuesta>
    Y el tenant tiene <total> programas

    Ejemplos:
      | cuenta | respuesta | total |
      | consultor@sigpro.test | 403 forbidden | 24 |
      | auditor@sigpro.test | 403 forbidden | 24 |

  Esquema del escenario: Una petición sin sesión válida o a un código inexistente no crea ninguna copia
    Dado que en el tenant alumno01, recién reiniciado, la petición de la fila se hace con la credencial indicada
    Cuando pide POST /api/programs/<codigo>/duplicate con <credencial>
    Entonces la respuesta es <respuesta>
    Y el tenant tiene 24 programas

    Ejemplos:
      | codigo | credencial | respuesta |
      | PRG-001 | (sin cabecera Authorization) | 401 missing_token |
      | PRG-001 | (un texto que no es un token) | 401 invalid_token |
      | PRG-099 | el accessToken de gestor@sigpro.test | 404 program_not_found |
```

## Decisiones pendientes
- Qué más se copia además de la ficha del programa. Hoy la copia no lleva requisitos, casos de prueba, no conformidades, documentos ni proveedores; la decisión documentada solo excluye los hitos.
- Qué pasa si ya existe un programa con el nombre de la copia. Hoy se crea otro igual; el alta, en cambio, responde 422 ante un nombre repetido.

## Fuera de alcance
- Editar el nombre, las fechas o el responsable de la copia: EP-PROG-ALTA.
- Duplicar desde la lista de la web y de la app móvil, con sus avisos y la nueva ordenación: historias web y móvil de EP-PROG-GESTION.
- Las cifras de las tarjetas de la cabecera después de duplicar: EP-PROG-METRICAS.
- Cómo se llega a la lista con una sesión iniciada: EP-LOGIN.
