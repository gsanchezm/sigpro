---
id: US-HITOS-001
tipo: historia
epica: EP-HITOS
titulo: "[API] Listar los hitos de un programa por fecha límite"
etiquetas: [api]
relacionadas: [US-HITOS-006, US-HITOS-010, US-PROG-DETALLE-001]
verificacion: codigo
cubre: ["GET /api/programs/:code/milestones"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas) con sesión iniciada en un tenant, quiero pedir los hitos de un programa,
para verlos en orden de fecha límite, con su avance y con la indicación de cuáles están cumplidos.

## Reglas
- `GET /api/programs/:code/milestones` exige sesión: el `accessToken` va en la cabecera `Authorization` como Bearer. Sin esa cabecera responde 401 `missing_token`; con un texto que no es un token válido, 401 `invalid_token`.
- No exige ningún permiso de rol: admin, program_manager, consultant y auditor reciben la lista.
- La respuesta 200 es una lista de hitos. Cada hito trae `id` (el código del programa, `-M` y un número de dos cifras, por ejemplo `PRG-001-M01`), `programCode`, `name`, `dueDate` (en formato AAAA-MM-DD), `progress` (entero de 0 a 100) y `done` (booleano, verdadero solo con un avance de 100).
- La lista va por `dueDate` ascendente y, con la misma fecha, por `id` ascendente.
- Solo entran los hitos del programa pedido y del tenant de la sesión. Un código que no es un programa de ese tenant responde 404 `program_not_found`, aunque ese código exista en otro tenant.
- Un programa sin hitos responde 200 con una lista vacía.
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos, nombrados en este orden: SRR, PDR, CDR, TRR, FAT, SAT, Entrega, Cierre y Garantía (`PRG-001-M01` a `PRG-001-M09`). Solo el primero está cumplido, el segundo (PDR) va al 10 % y el resto al 0 %. `PRG-004` también tiene 9 hitos con esos mismos nombres: los dos primeros están cumplidos y CDR (`PRG-004-M03`) va al 45 %.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `POST /api/auth/login` con la cabecera `x-tenant: alumno01` da el `accessToken` de la cuenta que indique la fila: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o `alumno01@sigpro.lab` (rol admin, sin segundo factor). Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Para la fila del programa `PRG-025`: se reinicia también `alumno02` con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`) y, con ese mismo token, `POST /api/programs/PRG-001/duplicate` crea en ese tenant la copia de `PRG-001`, que recibe el código `PRG-025` y queda en borrador sin hitos. Así `PRG-025` existe solo en `alumno02`. Al terminar la fila se reinicia también `alumno02`.

## Criterios de aceptación
```gherkin
Característica: Lista de hitos de un programa por la API

  Esquema del escenario: La lista trae los hitos del programa en orden de fecha límite
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs/<programa>/milestones
    Entonces la respuesta es 200 con <total> hitos
    Y el primero es <primero> y el último es <ultimo>
    Y <cumplidos> de ellos tienen done verdadero

    Ejemplos:
      | programa | total | primero | ultimo | cumplidos |
      | PRG-001 | 9 | PRG-001-M01 | PRG-001-M09 | 1 |
      | PRG-004 | 9 | PRG-004-M01 | PRG-004-M09 | 2 |

  Esquema del escenario: Cada hito trae su nombre, su avance y si está cumplido
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando pide GET /api/programs/<programa>/milestones
    Entonces el hito <id> trae name <nombre>, progress <avance> y done <cumplido>

    Ejemplos:
      | programa | id | nombre | avance | cumplido |
      | PRG-001 | PRG-001-M01 | SRR | 100 | true |
      | PRG-001 | PRG-001-M02 | PDR | 10 | false |
      | PRG-001 | PRG-001-M03 | CDR | 0 | false |
      | PRG-004 | PRG-004-M03 | CDR | 45 | false |

  Esquema del escenario: Un código que no es un programa del tenant responde 404
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y <situacion>
    Cuando pide GET /api/programs/<programa>/milestones
    Entonces la respuesta es 404 program_not_found

    Ejemplos:
      | programa | situacion |
      | PRG-999 | no existe ningún programa con ese código en ningún tenant |
      | PRG-025 | en alumno02 se ha duplicado PRG-001 durante la preparación y la copia tiene ese código |

  Esquema del escenario: Solo entrega la lista quien tiene una sesión válida
    Dado que en el tenant alumno01, recién reiniciado, PRG-001 tiene sus 9 hitos del seed
    Cuando pide GET /api/programs/PRG-001/milestones con <credencial>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | respuesta |
      | (sin cabecera Authorization) | 401 missing_token |
      | (un texto que no es un token) | 401 invalid_token |
      | el accessToken de consultor@sigpro.test | 200 con 9 hitos |
      | el accessToken de auditor@sigpro.test | 200 con 9 hitos |
      | el accessToken de alumno01@sigpro.lab | 200 con 9 hitos |
```

## Fuera de alcance
- El alta, la edición, el avance y el borrado de hitos: EP-HITOS, en sus historias de la API de alta, edición, avance y borrado.
- La pestaña «Hitos» en la web y en la app móvil: EP-HITOS, en sus historias de interfaz. El resto de la ficha del programa: EP-PROG-DETALLE.
- Los datos de avance del programa que devuelve su ficha: EP-PROG-DETALLE.
- El aislamiento de datos entre tenants una vez iniciada la sesión: EP-MULTITENANT-PERMISOS.
