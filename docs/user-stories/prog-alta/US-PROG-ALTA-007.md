---
id: US-PROG-ALTA-007
tipo: historia
epica: EP-PROG-ALTA
titulo: "[Web] Abrir el asistente de alta y validar sus dos primeros pasos"
etiquetas: [web]
relacionadas: [US-PROG-ALTA-002, US-PROG-ALTA-008, US-PROG-ALTA-009]
verificacion: ejecutada
permisos: [program.create]
---

## Historia
Como gestor de programas que da de alta un programa desde la web, quiero abrir el asistente desde Programas y que me avise de lo que falta en cada paso,
para no llegar al último paso con datos que no se pueden guardar.

## Reglas
- «Nuevo programa», en la página de Programas, abre el asistente «Nuevo programa» en «Paso 1 de 3». La tecla N también lo abre cuando ningún campo de texto tiene el foco.
- Solo los roles administrador y gestor de programas pueden usar «Nuevo programa». Para consultor y auditor el botón está deshabilitado y su motivo es «Tu rol no permite crear programas».
- Paso 1, «Datos básicos»: «Código» (solo lectura, con el siguiente código libre, `PRG-025` tras el reinicio de la semilla), «Nombre» (obligatorio), «Descripción» (hasta 2000 caracteres), «Responsable» (obligatorio, de la lista de personas del tenant) y «Estado inicial» (Borrador o Activo; Borrador por defecto).
- Paso 2, «Planificación»: «Fecha de inicio» (obligatoria), «Fecha de fin» (obligatoria), «Presupuesto (€)» (obligatorio), «Prioridad» (Baja, Media o Alta; Media por defecto) y «Programa clasificado» (sin marcar por defecto).
- «Siguiente» valida el paso que se ve. Si algo no es válido, no avanza, muestra el aviso bajo cada campo que falla y el aviso desaparece cuando se corrige ese campo.
- Avisos del paso 1: «El nombre debe tener al menos 3 caracteres» (nombre vacío, con espacios o de menos de tres letras) y «Selecciona un responsable de la lista» (sin responsable elegido).
- Avisos del paso 2: «La fecha de inicio es obligatoria» (inicio vacío); «La fecha de fin debe ser posterior al inicio» (fin vacío o no posterior al inicio), y «El presupuesto debe ser mayor que 0» (presupuesto vacío o igual o menor que 0).
- En las tablas, «(vacío)» significa que el campo se deja sin escribir, «(ninguno)» significa que no se elige ningún responsable, y «(2000 caracteres)» y «(2001 caracteres)» son descripciones de esas longitudes exactas. Los datos de los ejemplos son el nombre, el responsable, las fechas y el presupuesto del cuerpo base: nombre `Programa de prueba alfa`, responsable Javier Ortega, inicio `2027-03-01`, fin `2027-03-02` y presupuesto `900000`.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, en un navegador sin ninguna sesión de SIGPRO guardada, se abre `/login?tenant=alumno01`, se escribe el correo y la contraseña de la cuenta de la fila y se pulsa «Entrar» hasta llegar a /programs. Las cuentas de la preparación son `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`) y `auditor@sigpro.test` (`Audit1234!`).

## Criterios de aceptación
```gherkin
Característica: Asistente de alta de un programa en la web

  Esquema del escenario: Solo los roles que gestionan programas abren el asistente
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión y está en /programs
    Cuando pulsa «Nuevo programa»
    Entonces <resultado>

    Ejemplos:
      | cuenta | resultado |
      | gestor@sigpro.test | se abre el asistente «Nuevo programa» en «Paso 1 de 3» |
      | consultor@sigpro.test | «Nuevo programa» no se puede pulsar y su motivo es «Tu rol no permite crear programas» |
      | auditor@sigpro.test | «Nuevo programa» no se puede pulsar y su motivo es «Tu rol no permite crear programas» |

  Esquema del escenario: El paso 1 pide un nombre de al menos tres caracteres y un responsable
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto «Nuevo programa» y está en «Paso 1 de 3»
    Cuando escribe <nombre> en «Nombre», elige como responsable a <responsable> y pulsa «Siguiente»
    Entonces <resultado>

    Ejemplos:
      | nombre | responsable | resultado |
      | (vacío) | Javier Ortega | ve el aviso «El nombre debe tener al menos 3 caracteres» bajo «Nombre» y sigue en «Paso 1 de 3» |
      | ab | Javier Ortega | ve el aviso «El nombre debe tener al menos 3 caracteres» bajo «Nombre» y sigue en «Paso 1 de 3» |
      | abc | (ninguno) | ve el aviso «Selecciona un responsable de la lista» bajo «Responsable» y sigue en «Paso 1 de 3» |
      | abc | Javier Ortega | pasa a «Paso 2 de 3» |

  Esquema del escenario: La descripción admite hasta 2000 caracteres para avanzar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto «Nuevo programa» y está en «Paso 1 de 3»
    Cuando escribe Programa de prueba alfa en «Nombre», elige como responsable a Javier Ortega, escribe <descripcion> en «Descripción» y pulsa «Siguiente»
    Entonces <resultado>

    Ejemplos:
      | descripcion | resultado |
      | (2000 caracteres) | pasa a «Paso 2 de 3» |
      | (2001 caracteres) | sigue en «Paso 1 de 3» y no avanza |

  Esquema del escenario: El paso 2 pide fechas coherentes y un presupuesto mayor que cero
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha completado el paso 1 con el nombre Programa de prueba alfa y el responsable Javier Ortega, y está en «Paso 2 de 3»
    Cuando escribe <inicio> en «Fecha de inicio», <fin> en «Fecha de fin» y <presupuesto> en «Presupuesto (€)» y pulsa «Siguiente»
    Entonces <resultado>

    Ejemplos:
      | inicio | fin | presupuesto | resultado |
      | (vacío) | 2027-03-02 | 900000 | ve el aviso «La fecha de inicio es obligatoria» bajo «Fecha de inicio» y sigue en «Paso 2 de 3» |
      | 2027-03-01 | 2027-03-01 | 900000 | ve el aviso «La fecha de fin debe ser posterior al inicio» bajo «Fecha de fin» y sigue en «Paso 2 de 3» |
      | 2027-03-01 | (vacío) | 900000 | ve el aviso «La fecha de fin debe ser posterior al inicio» bajo «Fecha de fin» y sigue en «Paso 2 de 3» |
      | 2027-03-01 | 2027-03-02 | 0 | ve el aviso «El presupuesto debe ser mayor que 0» bajo «Presupuesto (€)» y sigue en «Paso 2 de 3» |
      | 2027-03-01 | 2027-03-02 | (vacío) | ve el aviso «El presupuesto debe ser mayor que 0» bajo «Presupuesto (€)» y sigue en «Paso 2 de 3» |
      | 2027-03-01 | 2027-03-02 | 1 | pasa a «Paso 3 de 3» |
```

## Fuera de alcance
- El detalle de la búsqueda de responsable y su lista de personas: EP-PROG-ALTA, historia de selector de responsable en el asistente.
- Los pasos siguientes del asistente, la revisión, la creación y los avisos del servidor: EP-PROG-ALTA, historia de revisión y creación desde el asistente.
- La validación de los mismos datos por la API: EP-PROG-ALTA, historias de validación del alta por la API.
- El aviso por correo al equipo del paso 3: EP-PROG-ALTA, historia no implementada de aviso por correo.

## Decisiones pendientes
- Aviso que ve la persona cuando la descripción supera los 2000 caracteres. Hoy el asistente no avanza, pero no muestra ningún aviso bajo «Descripción», porque el catálogo no tiene texto para ese caso. No está decidido si debe aparecer un aviso y con qué texto.
