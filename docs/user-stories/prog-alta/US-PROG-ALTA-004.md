---
id: US-PROG-ALTA-004
tipo: historia
epica: EP-PROG-ALTA
titulo: "[API] Validar la edición: nombre, propietario, fechas y cuerpo vacío"
etiquetas: [api]
relacionadas: [US-PROG-ALTA-003, US-PROG-ALTA-011, US-PROG-ALTA-013]
verificacion: codigo
cubre: ["PATCH /api/programs/:code"]
---

## Historia
Como gestor de programas que corrige un programa, quiero que la API rechace una edición con un dato no válido y me diga el motivo de cada campo,
para no guardar nada a medias y corregir solo el dato que falla.

## Reglas
- Una edición rechazada responde 422 y el programa no cambia en ningún campo, ni siquiera en los que venían bien.
- Las reglas de cada campo enviado son estas: el nombre, el propietario y las fechas como se indica en los puntos siguientes; el presupuesto debe ser mayor que 0 (motivo `budgetPositive` en `presupuesto`), y la prioridad debe ser `low`, `medium` o `high` (si no lo es, un motivo para `prioridad`).
- Nombre: si cambia, debe tener al menos tres caracteres sin contar los espacios de los extremos. No puede coincidir, sin distinguir mayúsculas, con el nombre de otro programa del tenant, ni contener la palabra «duplicado» en ninguna combinación de mayúsculas. Esos casos responden 422 con `code: "duplicate_name"` y el motivo `dupName` en `nombre`.
- Un nombre igual al que ya tiene el programa, aunque solo cambien las mayúsculas, no se considera repetido y se guarda.
- Propietario: si se envía, debe ser una persona del tenant. Vacío o inexistente responde con el motivo `requiredOwner` en `propietario`.
- Fechas: si llegan las dos, el fin debe ser estrictamente posterior al inicio. Si llega una sola, la otra es la que tiene el programa. Un fin que no es posterior al inicio responde 422 con el motivo `endAfterStart` en `fin`.
- Una edición sin ningún campo responde 422 con `code: "validation_failed"`.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `gestor@sigpro.test` (contraseña `Gestor1234!`) obtiene su token de acceso con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`. Tras el reinicio, `PRG-001` es «Sistema de mando táctico Ártemis», con inicio `2023-01-01` y fin `2024-07-01`, y `PRG-002` es «Radar de vigilancia costera RVC-2».
- En los ejemplos, `(sin el campo)` es un campo que no se envía, `(vacío)` es un campo con cadena vacía, y `(sin campos)` es un cuerpo sin ningún campo.

## Criterios de aceptación
```gherkin
Característica: Validación de la edición de un programa por la API

  Esquema del escenario: El nombre que se envía debe ser válido y no repetido
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía PATCH /api/programs/PRG-001 con x-tenant alumno01, ese token y solo el campo nombre con el valor <nombre>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | nombre | respuesta |
      | (vacío) | 422 validation_failed con motivo requiredName en nombre |
      | ab | 422 validation_failed con motivo requiredName en nombre |
      | Radar de vigilancia costera RVC-2 | 422 duplicate_name con motivo dupName en nombre |
      | radar de vigilancia costera rvc-2 | 422 duplicate_name con motivo dupName en nombre |
      | Programa DUPLICADO de prueba | 422 duplicate_name con motivo dupName en nombre |
      | sistema de mando táctico ártemis | 200 con el nombre sistema de mando táctico ártemis |

  Esquema del escenario: Las fechas coherentes se comprueban con la fecha que no se envía
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía PATCH /api/programs/PRG-001 con x-tenant alumno01, ese token, el inicio <inicio> y el fin <fin>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | inicio | fin | respuesta |
      | 2024-07-01 | (sin el campo) | 422 validation_failed con motivo endAfterStart en fin |
      | 2024-06-30 | (sin el campo) | 200 con startDate 2024-06-30 y endDate 2024-07-01 |
      | (sin el campo) | 2023-01-01 | 422 validation_failed con motivo endAfterStart en fin |
      | (sin el campo) | 2023-01-02 | 200 con startDate 2023-01-01 y endDate 2023-01-02 |
      | 2025-01-01 | 2024-12-31 | 422 validation_failed con motivo endAfterStart en fin |
      | 2023-03-01 | 2023-03-02 | 200 con startDate 2023-03-01 y endDate 2023-03-02 |

  Esquema del escenario: El propietario, si se envía, debe ser una persona del tenant
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía PATCH /api/programs/PRG-001 con x-tenant alumno01, ese token y solo el campo propietario con el valor <propietario>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | propietario | respuesta |
      | (vacío) | 422 validation_failed con motivo requiredOwner en propietario |
      | u99 | 422 validation_failed con motivo requiredOwner en propietario |
      | u3 | 200 con ownerName Lucía Fernández |

  Esquema del escenario: Una edición sin campos no cambia el programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía PATCH /api/programs/PRG-001 con x-tenant alumno01, ese token y el cuerpo <cuerpo>
    Entonces la respuesta es 422 validation_failed y PRG-001 conserva todos sus valores de la semilla

    Ejemplos:
      | cuerpo |
      | (sin campos) |

```

## Fuera de alcance
- Las reglas del alta de cada campo cuando se crea un programa: EP-PROG-ALTA, historia de validación del alta por la API.
- Los permisos que rechazan la edición antes de validar el cuerpo: EP-PROG-ALTA, historia de permisos por rol.
- Los avisos que muestra la pantalla de edición de la web y de la app móvil: EP-PROG-ALTA, historias de edición de cada plataforma.

## Decisiones pendientes
- Motivo cuando un campo de la edición falta o no tiene el formato esperado: igual que en el alta, la respuesta trae el texto por defecto del validador para ese caso en lugar de una clave del catálogo. No está decidido qué clave debe llevar.
- Fechas que tienen el formato `AAAA-MM-DD` pero no existen (por ejemplo, `2027-02-30`): mismo caso que en el alta.
