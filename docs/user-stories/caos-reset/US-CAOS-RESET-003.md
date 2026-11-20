---
id: US-CAOS-RESET-003
tipo: historia
epica: EP-CAOS-RESET
titulo: "[API] El reinicio borra las cuentas y los programas creados en la prueba"
etiquetas: [api]
relacionadas: [US-CAOS-RESET-002, US-CAOS-RESET-004, US-REGISTRO-001, US-PROG-ALTA-001]
verificacion: ejecutada
cubre: ["POST /api/admin/reset"]
---

## Historia
Como alumno que crea datos en sus pruebas, quiero que el reinicio borre las cuentas solicitadas y los programas que di de alta,
para que la siguiente prueba no encuentre restos de la anterior.

## Reglas
- El reinicio elimina las cuentas creadas durante la prueba y los programas dados de alta: el tenant vuelve a tener solo los datos del seed.
- El código de un programa nuevo sigue la numeración del seed. Tras el reinicio, la primera alta recibe `PRG-025`, aunque antes del reinicio se hubieran dado de alta programas, porque la semilla llega hasta `PRG-024`.
- `(cuenta recién solicitada)` es una solicitud hecha en la propia fila con `POST /api/auth/register`, la cabecera `x-tenant: alumno01` y el cuerpo `first` Ana, `last` Prueba, `email` un correo nuevo (`nueva-` seguido de una marca de tiempo y `@organizacion.es`), `org` Unidad de pruebas, `role` consultant, `password` y `confirm` Abcdefghij1! y `terms` true.
- La API rechaza con 422 `duplicate_name` un nombre de programa ya usado en el tenant: por eso, cuando un escenario da de alta varios programas antes del reinicio, cada alta lleva el cuerpo base con un nombre distinto (por ejemplo, Programa de prueba alfa y Programa de prueba beta).
- Las altas de programa de los ejemplos usan el cuerpo base: `name` Programa de prueba alfa, `ownerId` u2, `startDate` 2027-03-01, `endDate` 2027-03-02 y `budget` 900000. Las envía `gestor@sigpro.test` con su token de acceso, obtenido con `POST /api/auth/login` y `x-tenant: alumno01`.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos` y el cuerpo `{ "latencyMs": 0, "errorRate": 0, "flakyLabels": false }`. Las peticiones llevan la cabecera `x-tenant: alumno01` salvo que la fila diga otra cosa. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos.

## Criterios de aceptación
```gherkin
Característica: Borrado de lo creado durante la prueba

  Esquema del escenario: El reinicio borra la cuenta solicitada durante la prueba
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, se ha hecho la solicitud (cuenta recién solicitada) con la contraseña Abcdefghij1!
    Cuando envía POST /api/auth/login con x-tenant alumno01, esa cuenta y la contraseña <contraseña>
    Entonces la respuesta es <antes>
    Y tras reiniciar el tenant con POST /api/admin/reset y el token de alumno01@sigpro.lab, la misma petición responde <despues>

    Ejemplos:
      | contraseña | antes | despues |
      | Abcdefghij1! | 403 pending_approval | 401 invalid_credentials con attempts 1 |
      | x | 401 invalid_credentials con attempts 1 | 401 invalid_credentials con attempts 1 |

  Esquema del escenario: El reinicio devuelve el código de programa a la numeración del seed
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, gestor@sigpro.test ha dado de alta el número de programas que indica <altas_previas>, con el cuerpo base y un nombre distinto en cada alta
    Cuando envía POST /api/admin/reset con el token de alumno01@sigpro.lab
    Y después da de alta un programa con el cuerpo base
    Entonces la respuesta es 201 con el código PRG-025

    Ejemplos:
      | altas_previas |
      | 1 |
      | 2 |

  Esquema del escenario: El reinicio devuelve al seed un dato existente que se cambió durante la prueba
    Dado que en el tenant alumno01, recién reiniciado y con el modo caos apagado, gestor@sigpro.test ha cambiado con PATCH /api/programs/<codigo> el nombre a «Nombre de prueba»
    Cuando envía POST /api/admin/reset con el token de alumno01@sigpro.lab
    Y después consulta GET /api/programs/<codigo> con su token y la cabecera x-tenant alumno01
    Entonces la respuesta es 200 con un nombre distinto de «Nombre de prueba»

    Ejemplos:
      | codigo |
      | PRG-001 |
```

## Fuera de alcance
- Qué pasa con cada dato del seed (programas, requisitos, casos de prueba, documentos, no conformidades) más allá del mecanismo que estas filas comprueban: la épica de cada módulo.
- El alta de programas y sus reglas de código: EP-PROG-ALTA.
- El registro de cuentas y sus validaciones: EP-REGISTRO.
