---
id: US-PROG-ALTA-002
tipo: historia
epica: EP-PROG-ALTA
titulo: "[API] Rechazar el alta con un motivo por cada dato no válido"
etiquetas: [api]
relacionadas: [US-PROG-ALTA-001, US-PROG-ALTA-007, US-PROG-ALTA-012]
verificacion: codigo
cubre: ["POST /api/programs"]
---

## Historia
Como cliente de la API que da de alta un programa, quiero que un dato no válido impida el alta y que la respuesta me diga el motivo de cada campo que falla,
para corregir solo lo que falla y no crear un programa a medias.

## Reglas
- Un cuerpo que no cumple las reglas responde 422 con `code: "validation_failed"` y un objeto `errors` con un motivo por campo. No se crea ningún programa y no se asigna ningún código.
- Los motivos son claves del catálogo de Programas: `requiredName` (el nombre debe tener al menos tres caracteres), `requiredOwner` (propietario obligatorio y de la lista), `requiredStart` (inicio obligatorio con formato `AAAA-MM-DD`), `endAfterStart` (fin con formato `AAAA-MM-DD` y posterior al inicio), `budgetPositive` (presupuesto mayor que 0) y `dupName` (el nombre ya lo tiene otro programa del tenant, sin distinguir mayúsculas, o contiene la palabra «duplicado» en cualquier combinación de mayúsculas). Un nombre así responde 422 con `code: "duplicate_name"` y el motivo `dupName` en `nombre`.
- Las columnas de las tablas son los campos del cuerpo: «nombre» (`name`), «propietario» (`ownerId`, el id de la persona), «inicio» (`startDate`), «fin» (`endDate`), «presupuesto» (`budget`), «prioridad» (`priority`), «clasificado» (`classified`), «estado» (`status`) y «descripción» (`description`). El motivo de un campo se nombra por la columna.
- El nombre se recorta de espacios al principio y al final antes de comprobar sus tres caracteres. Un nombre con solo espacios cuenta como vacío.
- El fin debe ser estrictamente posterior al inicio. Un inicio que falta o no tiene el formato `AAAA-MM-DD` responde con `requiredStart` en `inicio`. Un fin que falta, no tiene ese formato o no es posterior al inicio responde con `endAfterStart` en `fin`.
- El presupuesto debe ser un número mayor que 0. Un valor en texto también se rechaza con `budgetPositive`.
- La prioridad es `low`, `medium` o `high`; el estado es uno de los cinco estados de Programas (`draft`, `active`, `on_hold`, `closed` o `cancelled`); clasificado es un booleano, y la descripción admite hasta 2000 caracteres. Un valor fuera de esas reglas responde 422 con un motivo para ese campo.
- Cuerpo base de los ejemplos: nombre `Programa de prueba alfa`, propietario `u2` (Javier Ortega), inicio `2027-03-01`, fin `2027-03-02` y presupuesto `900000`. Cada Esquema cambia solo lo que dice su tabla.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `gestor@sigpro.test` (contraseña `Gestor1234!`) obtiene su token de acceso con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`. Las peticiones de programas llevan esa cabecera y el token en `Authorization: Bearer`.
- En los ejemplos, `(vacío)` es un campo enviado con cadena vacía, `(sin el campo)` es un campo que no se envía, y `(900000 como texto)` es el número enviado entre comillas.

## Criterios de aceptación
```gherkin
Característica: Validación del alta de un programa por la API

  Esquema del escenario: Un cuerpo al que le falta un campo obligatorio no crea el programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/programs con x-tenant alumno01, ese token y el cuerpo base sin el campo <campo>
    Entonces la respuesta es 422 validation_failed con un motivo para <campo>
    Y no se crea ningún programa

    Ejemplos:
      | campo |
      | nombre |
      | propietario |
      | inicio |
      | fin |
      | presupuesto |

  Esquema del escenario: El nombre tiene al menos tres caracteres sin contar los espacios de los extremos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/programs con x-tenant alumno01, ese token, el nombre <nombre> y el resto del cuerpo base
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | nombre | respuesta |
      | (vacío) | 422 validation_failed con motivo requiredName en nombre |
      | ab | 422 validation_failed con motivo requiredName en nombre |
      | abc | 201 con el nombre abc |
      | (abc con espacios delante y detrás) | 201 con el nombre abc |

  Esquema del escenario: El propietario debe ser una persona del tenant
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/programs con x-tenant alumno01, ese token y el propietario <propietario> en el cuerpo base
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | propietario | respuesta |
      | (vacío) | 422 validation_failed con motivo requiredOwner en propietario |
      | u99 | 422 validation_failed con motivo requiredOwner en propietario |
      | u7 | 201 con ownerName Alumno 01 |

  Esquema del escenario: Las fechas tienen formato AAAA-MM-DD y el fin va después del inicio
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/programs con x-tenant alumno01, ese token, el inicio <inicio> y el fin <fin>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | inicio | fin | respuesta |
      | 2027-03-01 | 2027-03-02 | 201 con startDate 2027-03-01 y endDate 2027-03-02 |
      | 2027-03-01 | 2027-03-01 | 422 validation_failed con motivo endAfterStart en fin |
      | 2027-03-01 | (vacío) | 422 validation_failed con motivo endAfterStart en fin |
      | (vacío) | 2027-03-02 | 422 validation_failed con motivo requiredStart en inicio |
      | 01/03/2027 | 2027-03-02 | 422 validation_failed con motivo requiredStart en inicio |
      | 2027-3-1 | 2027-03-02 | 422 validation_failed con motivo requiredStart en inicio |

  Esquema del escenario: El presupuesto debe ser mayor que cero
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/programs con x-tenant alumno01, ese token y el presupuesto <presupuesto> en el cuerpo base
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | presupuesto | respuesta |
      | 0 | 422 validation_failed con motivo budgetPositive en presupuesto |
      | -1 | 422 validation_failed con motivo budgetPositive en presupuesto |
      | (900000 como texto) | 422 validation_failed con motivo budgetPositive en presupuesto |
      | (vacío) | 422 validation_failed con motivo budgetPositive en presupuesto |
      | 1 | 201 con budgetEur 1 |

  Esquema del escenario: Prioridad, clasificación, estado y descripción admiten solo sus valores
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/programs con x-tenant alumno01, ese token y el campo <campo> con el valor <valor> en el cuerpo base
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | campo | valor | respuesta |
      | prioridad | (sin el campo) | 201 con priority medium |
      | prioridad | high | 201 con priority high |
      | prioridad | urgente | 422 validation_failed con un motivo para priority |
      | clasificado | (sin el campo) | 201 con classified false |
      | clasificado | true | 201 con classified true |
      | clasificado | sí | 422 validation_failed con un motivo para classified |
      | estado | (sin el campo) | 201 con status draft |
      | estado | finalizado | 422 validation_failed con un motivo para status |
      | descripción | (2000 caracteres) | 201 con la descripción de 2000 caracteres |
      | descripción | (2001 caracteres) | 422 validation_failed con un motivo para description |

  Esquema del escenario: Un nombre que ya tiene otro programa del tenant, o que contiene «duplicado», no crea el programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un token de acceso
    Cuando envía POST /api/programs con x-tenant alumno01, ese token y el nombre <nombre> en el cuerpo base
    Entonces la respuesta es 422 duplicate_name con motivo dupName en nombre
    Y no se crea ningún programa

    Ejemplos:
      | nombre |
      | Sistema de mando táctico Ártemis |
      | sistema de mando táctico ártemis |
      | Programa DUPLICADO de prueba |
```

## Fuera de alcance
- Los permisos que rechazan el alta antes de validar el cuerpo: EP-PROG-ALTA, historia de permisos por rol.
- La validación de los mismos datos en el asistente de la web y de la app móvil: EP-PROG-ALTA, historias de asistente.
- La validación de la edición, con las mismas reglas aplicadas solo a los campos enviados: EP-PROG-ALTA, historia de validación de la edición por la API.

## Decisiones pendientes
- Motivo cuando un campo obligatorio falta del cuerpo. Hoy la respuesta trae el texto por defecto del validador en lugar de una clave del catálogo; no está decidido si debe ser `requiredName`, `requiredOwner` o `requiredStart` como cuando el campo viene vacío.
- Motivo de la prioridad, del estado, de clasificado y de la descripción cuando el valor no es válido. Hoy la respuesta trae el texto por defecto del validador, que no existe en el catálogo de Programas.
- Fechas que tienen el formato `AAAA-MM-DD` pero no existen (por ejemplo, `2027-02-30`). Hoy solo se comprueba la forma; no se comprueba que la fecha exista. No está decidido si el alta debe rechazarla y con qué motivo.
- Importes con decimales. Hoy el presupuesto se guarda redondeado a euros enteros, y un presupuesto mayor que 0 pero menor que 0,5 se guarda como 0. No está decidido.
- Estados que se pueden elegir al crear. La API admite los cinco estados y la web y la app móvil ofrecen solo borrador y activo. No está decidido si el alta por la API debe admitir los otros tres.
