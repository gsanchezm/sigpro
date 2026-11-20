---
id: US-AUDITORIA-008
tipo: historia
epica: EP-AUDITORIA
titulo: "[Móvil] Ver el registro de auditoría en /audit: lista, «Cargar más» y avisos por rol"
etiquetas: [movil]
relacionadas: [US-AUDITORIA-001, US-AUDITORIA-003, US-AUDITORIA-006, US-AUDITORIA-009]
verificacion: ejecutada
cubre: ["/audit"]
permisos: [audit.view]
---

## Historia
Como admin o auditor que trabaja desde la app móvil, quiero ver el registro de auditoría de mi tenant como una lista que se completa al bajar o con un botón,
para leer qué se hizo, quién lo hizo y cuándo, también desde el teléfono.

## Reglas
- Solo admin y auditor ven el registro. Un gestor de programa o un consultor que abre `/audit` ve, en lugar de la lista, el aviso «Tu rol no permite ver la auditoría», con la explicación «Solo admin y auditor pueden consultar el registro.» y el botón «Volver a Programas». No aparece ningún evento.
- En la pestaña «Más», «Auditoría» aparece solo a admin y auditor.
- La pantalla tiene el título «Auditoría» y el subtítulo «Registro de actividad del tenant».
- Administración, solo para admin, tiene una sección «Auditoría» en `/admin?tab=audit` que muestra este mismo registro, con los mismos eventos, contador, filtros y avisos. Cómo se elige la pestaña y qué ve quien no es admin son de la épica de Administración de usuarios.
- Cada evento es una tarjeta con la misma información que en la web: la fecha y la hora; el actor, con el nombre de su cuenta o «Sistema» si no tiene actor; la acción, con su nombre en español y, debajo, su código; la entidad, con su nombre en español y su código; y el resumen del detalle, con cada campo como «campo: valor» separados por « · ». Si el detalle es `null`, el resumen está vacío.
- Las tarjetas van del evento más reciente al más antiguo.
- El contador dice «Mostrando N de M eventos»: N son los eventos cargados y M, el total que cumple los filtros. Mientras carga la primera página, el contador muestra «…» y aparece un indicador de carga.
- La primera página trae 20 eventos. Mientras queden eventos, aparece el botón «Cargar más», que pide la página siguiente. Además, al llegar cerca del final de la lista se pide la página siguiente sin pulsar nada. Las páginas se añaden sin repetir eventos. Cuando no quedan más, desaparece el botón y, debajo de la lista, aparece «No hay más eventos».
- Si falla la primera página, aparece el aviso «No se pudo cargar la auditoría» con la traza del error y el botón «Reintentar», que vuelve a pedirla.
- Si falla una página siguiente, los eventos ya cargados se quedan y aparece un aviso con la traza del error. El botón «Cargar más» pide esa página otra vez. La carga al final no la vuelve a pedir sola.
- Preparación de cada fila, en el tenant `alumno01`: antes de cada fila se comprueba que el caos del tenant está apagado: `GET /api/config` con la cabecera `x-tenant: alumno01` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se reinicia el tenant con `POST /api/admin/reset`, ese mismo token y la cabecera `x-tenant: alumno01`. La app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y cada cuenta de la fila entra con su correo y su contraseña.
- Cifras de la semilla usadas en los ejemplos: 130 eventos y, como primero, `AL-130` (`requirement.created` sobre `REQ-011`, hecho por Lucía Fernández).

## Criterios de aceptación
```gherkin
Característica: Pantalla de auditoría en la app móvil

  Esquema del escenario: Solo admin y auditor ven el registro en /audit
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y la contraseña <contraseña>
    Cuando abre /audit
    Entonces ve <resultado>

    Ejemplos:
      | cuenta | contraseña | resultado |
      | auditor@sigpro.test | Audit1234! | el título «Auditoría» y la lista de eventos |
      | gestor@sigpro.test | Gestor1234! | el aviso «Tu rol no permite ver la auditoría», con la explicación «Solo admin y auditor pueden consultar el registro.», y ningún evento |

  Esquema del escenario: La lista carga la página siguiente con «Cargar más» o al llegar al final
    Dado que el tenant alumno01 está recién reiniciado y auditor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y la contraseña Audit1234!, y ha abierto /audit
    Cuando <accion> <veces> veces
    Entonces el contador dice <contador>
    Y <fin>

    Ejemplos:
      | accion | veces | contador | fin |
      | pulsa «Cargar más» | 1 | Mostrando 40 de 130 eventos | no aparece «No hay más eventos» y sigue «Cargar más» |
      | se desplaza hasta el final de la lista | 1 | Mostrando 40 de 130 eventos | no aparece «No hay más eventos» y sigue «Cargar más» |
      | pulsa «Cargar más» | 6 | Mostrando 130 de 130 eventos | aparece «No hay más eventos» y no hay «Cargar más» |

  Esquema del escenario: Un fallo al pedir una página muestra su aviso y se puede volver a pedir
    Dado que el tenant alumno01 está recién reiniciado, auditor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y la contraseña Audit1234!, y la prueba responde 500 a la petición de <pagina_fallida>
    Cuando <accion>
    Entonces ve <aviso> y el botón <boton>
    Cuando pulsa <boton> con la API disponible
    Entonces el contador dice <contador_tras_reintentar>

    Ejemplos:
      | pagina_fallida | accion | aviso | boton | contador_tras_reintentar |
      | la primera página de GET /api/audit | abre /audit | el título «No se pudo cargar la auditoría» con la traza del error | «Reintentar» | Mostrando 20 de 130 eventos |
      | la página siguiente de GET /api/audit | abre /audit y pulsa «Cargar más» | la traza del error debajo de los eventos cargados | «Cargar más» | Mostrando 40 de 130 eventos |

  Esquema del escenario: La sección Auditoría de Administración muestra el mismo registro
    Dado que el tenant alumno01 está recién reiniciado y alumno01@sigpro.lab ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y la contraseña Alumno1234!
    Cuando abre /admin?tab=audit
    Entonces ve el título «Registro de auditoría» y el contador dice <contador>

    Ejemplos:
      | contador |
      | Mostrando 20 de 130 eventos |
```

## Fuera de alcance
- Los filtros, la búsqueda y las fechas escritas a mano: los cubre EP-AUDITORIA en la app móvil.
- El listado de la API y sus páginas por cursor: los cubre EP-AUDITORIA en la API.
- El permiso de lectura y el aislamiento por tenant: los cubre EP-AUDITORIA en la API.
- La misma pantalla en la web: la cubre EP-AUDITORIA en la web.
- La pestaña «Usuarios», la de «Modo caos», la de «Datos» y la elección de pestaña por la dirección de Administración: EP-ADMIN-USUARIOS y EP-CAOS-RESET.

## Decisiones pendientes
- Qué texto exacto lleva la línea de traza bajo los avisos de error de la auditoría. Hoy muestra el código del error y un identificador de traza; no está decidido el formato. Ninguna fila lo afirma ni lo excluye.
