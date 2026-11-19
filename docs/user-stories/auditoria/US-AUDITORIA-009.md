---
id: US-AUDITORIA-009
tipo: historia
epica: EP-AUDITORIA
titulo: "[Móvil] Filtrar y buscar en /audit con las fechas escritas a mano"
etiquetas: [movil]
relacionadas: [US-AUDITORIA-007, US-AUDITORIA-008]
verificacion: codigo
cubre: ["/audit"]
---

## Historia
Como admin o auditor que trabaja desde la app móvil, quiero reducir el registro por entidad, por días escritos a mano o por texto,
para encontrar un cambio concreto desde el teléfono, sabiendo qué fecha se aplica y cuál no.

## Reglas
- Los controles de filtro son «Entidad», un desplegable con «Todas las entidades» y las ocho entidades (Programa, Requisito, Ejecución, Documento, Tenant, No conformidad, Hito y Usuario); «Desde» y «Hasta», campos de texto con el texto de ayuda «AAAA-MM-DD» y como máximo 10 caracteres; y el campo «Buscar en la auditoría», con el texto de ayuda «Acción o código…». «Limpiar filtros» aparece cuando hay algo escrito en cualquiera de ellos.
- Los filtros se aplican sin pulsar nada, al dejar de escribir.
- Una fecha se aplica solo si está completa y existe en el calendario. Si no, bajo su campo aparece «Indica una fecha válida» y ese límite no se aplica: la lista se muestra sin él, con los demás filtros que sí valgan. Por ejemplo, `2026-02-30`, `2026-13-01` y `2026-1-5` no valen.
- Si «Hasta» es anterior a «Desde», bajo «Hasta» aparece «La fecha «Hasta» no puede ser anterior a «Desde»» y no se aplica ninguna de las dos fechas.
- Un campo de fecha vacío no es un error.
- Las fechas son días completos en UTC: «Desde» incluye su día desde el principio y «Hasta» incluye su día hasta el final.
- El texto busca, sin distinguir mayúsculas, en la acción y en el código de la entidad. No busca por el nombre de quien hizo el cambio.
- El contador dice «Mostrando N de M eventos» y refleja los filtros que se aplican. Si ningún evento cumple los filtros, aparece «Sin eventos» y debajo «Ningún evento coincide con los filtros aplicados.».
- «Limpiar filtros» quita todos los filtros a la vez, incluidas las fechas y el texto, y vuelve a la primera página.
- Preparación de cada fila, en el tenant `alumno01`: antes de cada fila se comprueba que el caos del tenant está apagado: `GET /api/config` con la cabecera `x-tenant: alumno01` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se reinicia el tenant con `POST /api/admin/reset`, ese mismo token y la cabecera `x-tenant: alumno01`. La app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo», y `auditor@sigpro.test` (contraseña `Audit1234!`) entra y abre `/audit`.
- Cifras de la semilla para los ejemplos: 130 eventos; 9 eventos entre el 19 de enero y ese mismo día (UTC); 5 eventos con «Hasta» el 6 de enero; y 13 eventos de cambio de estado de requisito, la misma cifra que con la entidad «Requisito» y el texto state_changed.

## Criterios de aceptación
```gherkin
Característica: Filtros con fechas escritas a mano en la app móvil

  Esquema del escenario: Una fecha completa y real se aplica al registro
    Dado que el tenant alumno01 está recién reiniciado y auditor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y la contraseña Audit1234!, y ha abierto /audit
    Cuando escribe <desde> en «Desde» y <hasta> en «Hasta»
    Entonces el contador dice <contador>
    Y no aparece ningún aviso bajo los campos de fecha

    Ejemplos:
      | desde | hasta | contador |
      | 2026-01-19 | 2026-01-19 | Mostrando 9 de 9 eventos |
      | (vacío) | 2026-01-06 | Mostrando 5 de 5 eventos |

  Esquema del escenario: Una fecha que no existe no se aplica y lo indica
    Dado que el tenant alumno01 está recién reiniciado y auditor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y la contraseña Audit1234!, y ha abierto /audit
    Cuando escribe <desde> en «Desde»
    Entonces ve bajo «Desde» el aviso «Indica una fecha válida»
    Y el contador dice Mostrando 20 de 130 eventos

    Ejemplos:
      | desde |
      | 2026-02-30 |
      | 2026-13-01 |
      | 2026-1-5 |

  Esquema del escenario: Hasta anterior a Desde no aplica ninguna de las dos fechas
    Dado que el tenant alumno01 está recién reiniciado y auditor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y la contraseña Audit1234!, y ha abierto /audit
    Cuando escribe <desde> en «Desde» y <hasta> en «Hasta»
    Entonces ve bajo «Hasta» el aviso «La fecha «Hasta» no puede ser anterior a «Desde»»
    Y el contador dice Mostrando 20 de 130 eventos

    Ejemplos:
      | desde | hasta |
      | 2026-01-19 | 2026-01-06 |

  Esquema del escenario: Entidad y texto se combinan, y «Limpiar filtros» vuelve a la lista completa
    Dado que el tenant alumno01 está recién reiniciado y auditor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y la contraseña Audit1234!, y ha abierto /audit
    Cuando elige la entidad <entidad> en «Entidad» y escribe <texto> en «Buscar en la auditoría»
    Entonces el contador dice <contador>
    Cuando pulsa «Limpiar filtros»
    Entonces el contador dice Mostrando 20 de 130 eventos
    Y «Limpiar filtros» deja de aparecer

    Ejemplos:
      | entidad | texto | contador |
      | Requisito | state_changed | Mostrando 13 de 13 eventos |
```

## Fuera de alcance
- Los mismos filtros con el selector de fechas de la web: esta historia cubre solo las fechas escritas a mano en la app móvil; la diferencia está en «Decisiones pendientes».
- La lista, la carga y los avisos por rol de la pantalla: los cubre EP-AUDITORIA en la app móvil.
- Los resultados de cada filtro en la API: los cubre EP-AUDITORIA en la API.

## Decisiones pendientes
- Si la app móvil debe ofrecer además un selector de calendario en «Desde» y «Hasta», como indica para el filtro de auditoría la tabla de componentes del plan. Hoy las fechas solo se escriben a mano. Ninguna fila lo afirma ni lo excluye.
