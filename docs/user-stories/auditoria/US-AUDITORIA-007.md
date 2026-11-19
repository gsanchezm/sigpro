---
id: US-AUDITORIA-007
tipo: historia
epica: EP-AUDITORIA
titulo: "[Web] Filtrar, buscar y limpiar el registro de auditoría en /audit"
etiquetas: [web]
relacionadas: [US-AUDITORIA-002, US-AUDITORIA-006, US-AUDITORIA-009]
verificacion: codigo
cubre: ["/audit"]
---

## Historia
Como admin o auditor que trabaja en la web, quiero reducir el registro por entidad, por días o por texto y volver a verlo completo con un solo gesto,
para encontrar un cambio concreto sin recorrer toda la lista.

## Reglas
- Encima de la lista hay tres controles: «Entidad», un desplegable con «Todas las entidades» y las ocho entidades (Programa, Requisito, Ejecución, Documento, Tenant, No conformidad, Hito y Usuario); «Desde» y «Hasta», selectores de fecha; y el campo «Buscar en la auditoría», con el texto de ayuda «Acción o código…».
- Elegir una entidad o una fecha aplica el filtro en el momento. Lo escrito en el campo de búsqueda se aplica al dejar de escribir, sin pulsar nada.
- Cambiar cualquier filtro vuelve a la primera página de resultados. Ningún resultado de un filtro anterior sustituye al de los filtros actuales.
- «Desde» y «Hasta» son días completos en UTC: «Desde» incluye su día desde el principio y «Hasta» incluye su día hasta el final.
- El texto busca, sin distinguir mayúsculas, en la acción y en el código de la entidad. No busca por el nombre de quien hizo el cambio.
- «Limpiar filtros» aparece solo cuando hay algún filtro escrito. Quita todos a la vez y vuelve a la primera página.
- El contador «Mostrando N de M eventos» refleja siempre los filtros aplicados.
- Si ningún evento cumple los filtros, la lista muestra «Sin eventos» y debajo «Ningún evento coincide con los filtros aplicados.».
- Si falla la petición con filtros, aparece el aviso «No se pudo cargar la auditoría» con el botón «Reintentar», que vuelve a pedir la lista con los filtros actuales.
- Preparación de cada fila, en el tenant `alumno01`: antes de cada fila se comprueba que el caos del tenant está apagado: `GET /api/config` con la cabecera `x-tenant: alumno01` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se reinicia el tenant con `POST /api/admin/reset`, ese mismo token y la cabecera `x-tenant: alumno01`. El navegador se abre en `/login?tenant=alumno01` sin ninguna sesión de SIGPRO guardada, y `auditor@sigpro.test` (contraseña `Audit1234!`) entra y abre `/audit`.
- Cifras de la semilla para los ejemplos: 130 eventos; 39 de programa, 65 de requisito y 13 de documento; 13 eventos de cambio de estado de requisito; 9 eventos entre el 19 de enero y ese mismo día (UTC), de los que 5 son de requisito; 5 eventos con «Hasta» el 6 de enero; y 4 eventos cuyo código es `REQ-011`.

## Criterios de aceptación
```gherkin
Característica: Filtros y búsqueda del registro de auditoría en la web

  Esquema del escenario: La entidad elegida deja solo sus eventos
    Dado que el tenant alumno01 está recién reiniciado y auditor@sigpro.test ha entrado en /login?tenant=alumno01 con la contraseña Audit1234! y ha abierto /audit
    Cuando elige <entidad> en «Entidad»
    Entonces el contador dice <contador>
    Y <estado_vacio>

    Ejemplos:
      | entidad | contador | estado_vacio |
      | Requisito | Mostrando 20 de 65 eventos | no aparece «Sin eventos» |
      | No conformidad | Mostrando 0 de 0 eventos | aparece «Sin eventos» y «Ningún evento coincide con los filtros aplicados.» |

  Esquema del escenario: Desde y Hasta incluyen los días completos
    Dado que el tenant alumno01 está recién reiniciado y auditor@sigpro.test ha entrado en /login?tenant=alumno01 con la contraseña Audit1234! y ha abierto /audit
    Cuando elige el día <desde> en «Desde» y el día <hasta> en «Hasta»
    Entonces el contador dice <contador>

    Ejemplos:
      | desde | hasta | contador |
      | 2026-01-19 | 2026-01-19 | Mostrando 9 de 9 eventos |
      | (vacío) | 2026-01-06 | Mostrando 5 de 5 eventos |

  Esquema del escenario: El texto busca en la acción y en el código de la entidad
    Dado que el tenant alumno01 está recién reiniciado y auditor@sigpro.test ha entrado en /login?tenant=alumno01 con la contraseña Audit1234! y ha abierto /audit
    Cuando escribe <texto> en «Buscar en la auditoría»
    Entonces el contador dice <contador>
    Y <estado_vacio>

    Ejemplos:
      | texto | contador | estado_vacio |
      | state_changed | Mostrando 13 de 13 eventos | no aparece «Sin eventos» |
      | REQ-011 | Mostrando 4 de 4 eventos | no aparece «Sin eventos» |
      | Javier | Mostrando 0 de 0 eventos | aparece «Sin eventos» y «Ningún evento coincide con los filtros aplicados.» |

  Esquema del escenario: Los filtros se combinan y «Limpiar filtros» devuelve la lista completa
    Dado que el tenant alumno01 está recién reiniciado, auditor@sigpro.test ha entrado en /login?tenant=alumno01 con la contraseña Audit1234! y ha abierto /audit
    Cuando elige la entidad <entidad> en «Entidad» y el día <dia> en «Desde» y en «Hasta»
    Entonces el contador dice Mostrando 5 de 5 eventos
    Cuando pulsa «Limpiar filtros»
    Entonces el contador dice Mostrando 20 de 130 eventos
    Y «Limpiar filtros» deja de aparecer

    Ejemplos:
      | entidad | dia |
      | Requisito | 2026-01-19 |

  Esquema del escenario: Un fallo al filtrar muestra el aviso y se puede volver a pedir
    Dado que el tenant alumno01 está recién reiniciado, auditor@sigpro.test ha entrado en /login?tenant=alumno01 con la contraseña Audit1234! y la prueba responde 500 a la petición de GET /api/audit con entity=requirement
    Cuando elige <entidad> en «Entidad»
    Entonces ve el aviso «No se pudo cargar la auditoría»
    Cuando pulsa «Reintentar» con la API disponible
    Entonces el contador dice <contador>

    Ejemplos:
      | entidad | contador |
      | Requisito | Mostrando 20 de 65 eventos |
```

## Fuera de alcance
- Los resultados de cada filtro en la API: los cubre EP-AUDITORIA en la API.
- La primera página, la carga al final y los avisos de la pantalla sin filtros: los cubre EP-AUDITORIA en la pantalla web.
- Los mismos filtros en la app móvil, con las fechas escritas a mano: los cubre EP-AUDITORIA en la app móvil.

## Decisiones pendientes
- Qué debe ver la persona que escribe a mano en «Desde» una fecha posterior a «Hasta» (o al revés). El selector de fechas limita sus valores con un mínimo y un máximo, pero lo escrito a mano puede dejar ese orden. Hoy la lista queda vacía con el estado «Sin eventos», sin ningún aviso sobre el orden. No está decidido si debe avisar, como hace la app móvil.
