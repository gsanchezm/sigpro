---
id: US-HITOS-002
tipo: historia
epica: EP-HITOS
titulo: "[API] Crear un hito con nombre y fecha límite en un programa"
etiquetas: [api]
relacionadas: [US-HITOS-001, US-HITOS-007, US-HITOS-011]
verificacion: ejecutada
cubre: ["POST /api/programs/:code/milestones"]
permisos: [milestone.edit]
---

## Historia
Como gestor de programas que usa la API (o una suite de pruebas), con permiso de edición de hitos, quiero añadir un hito con nombre y fecha límite a un programa,
para planificar un hito que todavía no tiene avance y que aparece en la lista de ese programa.

## Reglas
- `POST /api/programs/:code/milestones` exige sesión y el permiso `milestone.edit`, que tienen los roles admin y program_manager. Un rol consultant o auditor recibe 403 `forbidden`, aunque el cuerpo no sea válido o el programa no exista.
- El cuerpo lleva `name` y `dueDate` (AAAA-MM-DD). El nombre se recorta de los espacios del principio y del final, y su longitud se cuenta después de recortarlo: debe tener entre 2 y 80 caracteres.
- `dueDate` debe tener la forma AAAA-MM-DD y ser una fecha que existe en el calendario: 2027-02-29 no existe (2027 no es bisiesto) y se rechaza.
- Un cuerpo no válido responde 422 `validation_failed` con un motivo por cada campo no válido: `nameShort` (menos de 2 caracteres), `nameLong` (más de 80), `dateInvalid` (fecha no válida) o, si el campo falta, un motivo para ese campo. No se crea nada.
- Con un cuerpo válido responde 201 con el hito creado: `name` recortado, `dueDate` tal como se envió, `progress` 0 y `done` falso.
- El `id` del hito nuevo es el código del programa, `-M` y el número siguiente al mayor que ya tiene ese programa, aunque haya huecos. Con los hitos del 01 al 09, el nuevo es `PRG-001-M10`, también si antes se ha borrado el 03.
- El alta no acepta avance: un campo `progress` en el cuerpo se ignora y el hito nace con avance 0 %.
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos (`PRG-001-M01` a `PRG-001-M09`).
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, `POST /api/auth/login` con la cabecera `x-tenant: alumno01` da el `accessToken` de la cuenta que indique la fila: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o `alumno01@sigpro.lab` (rol admin, sin segundo factor). Si la fila dice que se ha borrado un hito, la preparación lo borra con `DELETE /api/milestones/<id>` antes de la petición de alta. Todas las peticiones llevan la cabecera `x-tenant: alumno01`.
- Para la fila del programa `PRG-025`: se reinicia también `alumno02` con el token de `alumno02@sigpro.lab` (contraseña `Alumno1234!`) y, con ese mismo token, `POST /api/programs/PRG-001/duplicate` crea en ese tenant la copia de `PRG-001`, que recibe el código `PRG-025`. Al terminar la fila se reinicia también `alumno02`.

## Criterios de aceptación
```gherkin
Característica: Alta de hitos por la API

  Esquema del escenario: Un hito válido se crea sin avance y con el número siguiente del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y <preparacion>
    Cuando envía POST /api/programs/PRG-001/milestones con el nombre <nombre> y la fecha límite 2027-03-15
    Entonces la respuesta es 201 con id <id>, name <guardado>, progress 0 y done falso

    Ejemplos:
      | preparacion | nombre | id | guardado |
      | no ha borrado ningún hito | (espacios delante y detrás de Revisión de diseño) | PRG-001-M10 | Revisión de diseño |
      | ha borrado PRG-001-M03 con DELETE /api/milestones/PRG-001-M03 | Revisión de diseño | PRG-001-M10 | Revisión de diseño |

  Esquema del escenario: El nombre se valida después de recortar los espacios y debe tener de 2 a 80 caracteres
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía POST /api/programs/PRG-001/milestones con el nombre <nombre> y la fecha límite 2027-03-15
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | nombre | respuesta |
      | (vacío) | 422 validation_failed con el motivo nameShort en name |
      | (tres espacios) | 422 validation_failed con el motivo nameShort en name |
      | A | 422 validation_failed con el motivo nameShort en name |
      | Ab | 201 con name Ab |
      | (80 caracteres) | 201 con ese nombre |
      | (81 caracteres) | 422 validation_failed con el motivo nameLong en name |

  Esquema del escenario: La fecha límite tiene la forma AAAA-MM-DD y debe existir en el calendario
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía POST /api/programs/PRG-001/milestones con el nombre Revisión de diseño y la fecha límite <fecha>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | fecha | respuesta |
      | (vacío) | 422 validation_failed con el motivo dateInvalid en dueDate |
      | (sin el campo) | 422 validation_failed con un motivo en dueDate |
      | 2027-3-5 | 422 validation_failed con el motivo dateInvalid en dueDate |
      | 05/03/2027 | 422 validation_failed con el motivo dateInvalid en dueDate |
      | 2027-02-29 | 422 validation_failed con el motivo dateInvalid en dueDate |
      | 2028-02-29 | 201 con dueDate 2028-02-29 |

  Esquema del escenario: El avance que envía el cuerpo no cambia el avance inicial
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken
    Cuando envía POST /api/programs/PRG-001/milestones con el nombre Revisión de diseño, la fecha límite 2027-03-15 y el avance <avance>
    Entonces la respuesta es 201 con progress 0 y done falso

    Ejemplos:
      | avance |
      | (sin el campo) |
      | 100 |

  Esquema del escenario: Solo admin y program_manager crean hitos
    Dado que en el tenant alumno01, recién reiniciado, PRG-001 tiene sus 9 hitos del seed
    Cuando envía POST /api/programs/PRG-001/milestones con <credencial> como Bearer, el nombre <nombre> y la fecha límite 2027-03-15
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | credencial | nombre | respuesta |
      | el accessToken de consultor@sigpro.test | Revisión de diseño | 403 forbidden |
      | el accessToken de consultor@sigpro.test | (vacío) | 403 forbidden |
      | el accessToken de auditor@sigpro.test | Revisión de diseño | 403 forbidden |
      | el accessToken de alumno01@sigpro.lab | Revisión de diseño | 201 con id PRG-001-M10 |

  Esquema del escenario: Un programa que no existe en el tenant no admite hitos nuevos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un accessToken y <situacion>
    Cuando envía POST /api/programs/<programa>/milestones con el nombre Revisión de diseño y la fecha límite 2027-03-15
    Entonces la respuesta es 404 program_not_found

    Ejemplos:
      | programa | situacion |
      | PRG-999 | no existe ningún programa con ese código en ningún tenant |
      | PRG-025 | en alumno02 se ha duplicado PRG-001 durante la preparación y la copia tiene ese código |
```

## Fuera de alcance
- La lista de hitos del programa: EP-HITOS, en la historia de la API de lista.
- La edición del nombre y de la fecha límite de un hito: EP-HITOS, en la historia de la API de edición.
- El avance y el cumplido de un hito: EP-HITOS, en la historia de la API de avance.
- El formulario «Nuevo hito» de la web y la hoja de alta de la app móvil: EP-HITOS, en sus historias de interfaz.
- El alta de programas, que se usa solo para preparar la fila de `PRG-025`: EP-PROG-ALTA.

## Decisiones pendientes
- Si el nombre de un hito debe ser único dentro de su programa. Hoy pueden existir dos hitos con el mismo nombre.
- Si la fecha límite debe caer entre la fecha de inicio y la fecha de fin del programa. Hoy se acepta cualquier fecha válida.
