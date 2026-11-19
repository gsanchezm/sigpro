---
id: US-PROG-ALTA-012
tipo: historia
epica: EP-PROG-ALTA
titulo: "[Móvil] Crear un programa con el asistente en una hoja"
etiquetas: [movil]
relacionadas: [US-PROG-ALTA-002, US-PROG-ALTA-008, US-PROG-ALTA-013, US-PROG-ALTA-014]
verificacion: codigo
permisos: [program.create]
---

## Historia
Como gestor de programas que usa la app móvil, quiero dar de alta un programa desde una hoja de tres pasos,
para crearlo desde el móvil con las mismas reglas que en la web.

## Reglas
- «Nuevo programa», en la cabecera de Programas, abre la hoja «Nuevo programa» en «Paso 1 de 3». Solo administrador y gestor de programas la pueden usar. Para consultor y auditor el botón está deshabilitado y el motivo «Tu rol no permite crear programas» aparece como texto visible.
- Paso 1, «Datos básicos»: «Código» (solo lectura, con el siguiente código libre, `PRG-025` tras el reinicio de la semilla), «Nombre» (obligatorio), «Descripción» (hasta 2000 caracteres), «Responsable» (obligatorio) y «Estado inicial» (Borrador o Activo; Borrador por defecto).
- Paso 2, «Planificación»: «Fecha de inicio» y «Fecha de fin», escritas como `AAAA-MM-DD` (el campo muestra ese formato como pista), «Presupuesto (€)» (obligatorio, con teclado numérico), «Prioridad» (Baja, Media o Alta; Media por defecto) y «Programa clasificado» (desactivado por defecto).
- Paso 3, «Revisión»: un resumen con código, nombre, responsable, fechas, presupuesto, prioridad y clasificado, y el interruptor «Notificar al equipo por correo», activado al empezar.
- «Siguiente» valida el paso que se ve. Si algo no es válido, no avanza y muestra el aviso bajo el campo que falla. Los avisos son los mismos que en la web: «El nombre debe tener al menos 3 caracteres», «Selecciona un responsable de la lista», «La fecha de inicio es obligatoria», «La fecha de fin debe ser posterior al inicio» y «El presupuesto debe ser mayor que 0». El aviso desaparece al corregir su campo.
- «Atrás» vuelve al paso anterior y conserva lo escrito. En el paso 1 está deshabilitado y debajo aparece el texto «Estás en el primer paso».
- «Responsable» abre una hoja con el buscador «Buscar responsable» (su pista es «Buscar persona…») y la lista de personas del tenant. Escribir filtra la lista por el nombre, sin distinguir mayúsculas; sin coincidencias aparece «Sin coincidencias». Tocar una persona la elige, cierra la hoja y el campo muestra su nombre.
- «Crear programa», en el paso 3, envía el alta. Con éxito, la hoja se cierra y aparece el aviso «Programa creado» con el texto «PRG-025 se añadió a la lista».
- Si el servidor responde 422 por el nombre, la hoja vuelve al paso 1 con el aviso «422 · Ya existe un programa con ese nombre» arriba y el mismo texto bajo «Nombre». No se crea nada.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, en la app, sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», se escribe `gestor@sigpro.test` y `Gestor1234!`, se pulsa «Entrar» y se llega a /programs. Para consultor, la cuenta es `consultor@sigpro.test` con `Consul1234!`.
- Cuerpo base de los ejemplos: nombre `Programa de prueba alfa`, responsable Javier Ortega, inicio `2027-03-01`, fin `2027-03-02`, presupuesto `900000`, prioridad Alta y sin clasificar. Los demás campos quedan como en el paso que los muestra por defecto.
- En los ejemplos, «(vacío)» significa que el campo se deja sin escribir, y «(ninguno)» significa que no se elige ningún responsable.

## Criterios de aceptación
```gherkin
Característica: Asistente de alta de un programa en la app móvil

  Esquema del escenario: Solo los roles que gestionan programas pueden abrir el asistente
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la app y está en /programs
    Cuando pulsa «Nuevo programa»
    Entonces <resultado>

    Ejemplos:
      | cuenta | resultado |
      | gestor@sigpro.test | se abre la hoja «Nuevo programa» en «Paso 1 de 3» |
      | consultor@sigpro.test | «Nuevo programa» está deshabilitado y el texto «Tu rol no permite crear programas» se ve debajo |

  Esquema del escenario: El paso 1 pide un nombre de al menos tres caracteres y un responsable
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto «Nuevo programa» y está en «Paso 1 de 3»
    Cuando escribe <nombre> en «Nombre», elige como responsable a <responsable> y pulsa «Siguiente»
    Entonces <resultado>

    Ejemplos:
      | nombre | responsable | resultado |
      | ab | Javier Ortega | ve el aviso «El nombre debe tener al menos 3 caracteres» y sigue en «Paso 1 de 3» |
      | abc | (ninguno) | ve el aviso «Selecciona un responsable de la lista» y sigue en «Paso 1 de 3» |
      | abc | Javier Ortega | pasa a «Paso 2 de 3» |

  Esquema del escenario: El paso 2 pide fechas coherentes y un presupuesto mayor que cero
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha completado el paso 1 con el nombre Programa de prueba alfa y el responsable Javier Ortega, y está en «Paso 2 de 3»
    Cuando escribe <inicio> en «Fecha de inicio», <fin> en «Fecha de fin» y <presupuesto> en «Presupuesto (€)» y pulsa «Siguiente»
    Entonces <resultado>

    Ejemplos:
      | inicio | fin | presupuesto | resultado |
      | (vacío) | 2027-03-02 | 900000 | ve el aviso «La fecha de inicio es obligatoria» y sigue en «Paso 2 de 3» |
      | 2027-03-01 | 2027-03-01 | 900000 | ve el aviso «La fecha de fin debe ser posterior al inicio» y sigue en «Paso 2 de 3» |
      | 2027-03-01 | 2027-03-02 | 0 | ve el aviso «El presupuesto debe ser mayor que 0» y sigue en «Paso 2 de 3» |
      | 2027-03-01 | 2027-03-02 | 1 | pasa a «Paso 3 de 3» |

  Esquema del escenario: Atrás depende del paso en el que está la hoja
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene abierta la hoja «Nuevo programa» en el paso <paso> con el nombre Programa de prueba alfa escrito
    Cuando pulsa «Atrás»
    Entonces <resultado>

    Ejemplos:
      | paso | resultado |
      | 1 | sigue en «Paso 1 de 3», «Atrás» está deshabilitado y debajo se ve el texto «Estás en el primer paso» |
      | 2 | vuelve a «Paso 1 de 3» con el nombre Programa de prueba alfa escrito |

  Esquema del escenario: El buscador de responsables filtra la hoja y elegir una persona cierra la hoja
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto la hoja «Nuevo programa» en «Paso 1 de 3» y ha tocado «Responsable»
    Cuando escribe <texto> en «Buscar responsable»
    Entonces ve <resultado>

    Ejemplos:
      | texto | resultado |
      | lucía | solo Lucía Fernández |
      | xyz | el texto «Sin coincidencias» |

  Esquema del escenario: Crear el programa con el nombre de la fila
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha completado la hoja «Nuevo programa» con el nombre <nombre> y el resto de datos del cuerpo base, y está en «Paso 3 de 3»
    Cuando pulsa «Crear programa»
    Entonces <resultado>

    Ejemplos:
      | nombre | resultado |
      | Programa de prueba alfa | aparece el aviso «Programa creado» con el texto «PRG-025 se añadió a la lista» y la hoja se cierra |
      | Sistema de mando táctico Ártemis | la hoja vuelve a «Paso 1 de 3» con el aviso «422 · Ya existe un programa con ese nombre» arriba y bajo «Nombre» |
```

## Fuera de alcance
- El detalle de la búsqueda de responsables en la web y la lista de personas por la API: EP-PROG-ALTA, historias de selector de responsable y de listado de responsables.
- Los motivos de cada dato no válido por la API: EP-PROG-ALTA, historia de validación del alta por la API.
- La edición de un programa en la app móvil: EP-PROG-ALTA, historia de edición en la app móvil.
- La lista de Programas con sus filtros y su orden: EP-PROG-LISTA.
- El aviso por correo al equipo que ofrece el paso 3: EP-PROG-ALTA, historia no implementada de aviso por correo.

## Decisiones pendientes
- Fechas escritas a mano que tienen el formato `AAAA-MM-DD` pero no existen (por ejemplo, `2027-02-30`). Hoy solo se comprueba la forma; no se comprueba que la fecha exista. No está decidido si la app debe rechazarlas y con qué aviso.
- Si el aviso superior «422 · …» debe desaparecer cuando la persona corrige el campo que falla. Hoy sigue visible hasta el siguiente envío. No está decidido.
