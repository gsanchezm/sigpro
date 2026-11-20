---
id: US-AUDITORIA-006
tipo: historia
epica: EP-AUDITORIA
titulo: "[Web] Ver el registro de auditoría en /audit: filas, contador, carga al final y avisos por rol"
etiquetas: [web]
relacionadas: [US-AUDITORIA-001, US-AUDITORIA-003, US-AUDITORIA-007, US-AUDITORIA-008]
verificacion: ejecutada
cubre: ["/audit"]
permisos: [audit.view]
---

## Historia
Como admin o auditor que trabaja en la web, quiero ver el registro de auditoría de mi tenant como una lista que se completa al bajar,
para leer qué se hizo, quién lo hizo y cuándo, sin tener que pedir cada página.

## Reglas
- Solo admin y auditor ven el registro. Un gestor de programa o un consultor que abre `/audit` ve, en lugar de la lista, el aviso «Tu rol no permite ver la auditoría», con la explicación «Solo admin y auditor pueden consultar el registro.» y el enlace «Volver a Programas», que lleva a `/programs`. No aparece ningún evento.
- En el menú lateral, «Auditoría» aparece solo a admin y auditor.
- La pantalla tiene el título «Auditoría» y el subtítulo «Registro de actividad del tenant».
- Cada evento es una fila con: la fecha y la hora en la zona horaria del navegador; el actor, con el nombre de su cuenta, o «Sistema» si el evento no tiene actor; la acción, con su nombre en español y, debajo, su código; la entidad, con su nombre en español (Programa, Requisito, Ejecución, Documento, Tenant, No conformidad, Hito o Usuario) y, debajo, su código (`entityId`); y el resumen del detalle, con cada campo como «campo: valor» separados por « · ». Si el detalle es `null`, el resumen está vacío.
- Las filas van del evento más reciente al más antiguo.
- El contador dice «Mostrando N de M eventos»: N son los eventos cargados y M, el total que cumple los filtros. Mientras carga la primera página, el contador muestra «…».
- La primera página trae 20 eventos. Al llegar al final de la lista se pide la siguiente sin pulsar nada, y sus eventos se añaden a la lista sin repetir ninguno. Cuando no quedan más, aparece «No hay más eventos».
- Mientras carga la primera página se muestran filas de carga.
- Si falla la primera página, aparece el aviso «No se pudo cargar la auditoría» con la traza del error y el botón «Reintentar», que vuelve a pedirla.
- Si falla una página siguiente, los eventos ya cargados se quedan, aparece un aviso con la traza del error debajo de ellos y el botón «Cargar más», que pide esa página. La lista no vuelve a pedirla sola.
- El texto «Todavía no hay actividad registrada.» aparece solo si el tenant no tiene ningún evento. Con la semilla no ocurre, así que ninguna fila lo comprueba.
- Administración, solo para admin, tiene una sección «Auditoría» en `/admin?tab=audit` que muestra este mismo registro, con los mismos eventos, contador, filtros y avisos. Cómo se elige la pestaña y qué ve quien no es admin son de la épica de Administración de usuarios.
- Para los ejemplos de solicitud de acceso, `(correo nuevo)` es `nueva-` seguido de una marca de tiempo y `@organizacion.es`, y el cuerpo de `POST /api/auth/register` es `first` Ana, `last` Prueba, `email` (correo nuevo), `org` Unidad de pruebas, `role` consultant, `password` y `confirm` Abcdefghij1! y `terms` true.
- Preparación de cada fila, en el tenant `alumno01`: antes de cada fila se comprueba que el caos del tenant está apagado: `GET /api/config` con la cabecera `x-tenant: alumno01` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se reinicia el tenant con `POST /api/admin/reset`, ese mismo token y la cabecera `x-tenant: alumno01`. El navegador se abre en `/login?tenant=alumno01` sin ninguna sesión de SIGPRO guardada, y cada cuenta de la fila entra con su correo y su contraseña.
- Cifras de la semilla usadas en los ejemplos: 130 eventos y, como primero, `AL-130` (`requirement.created` sobre `REQ-011`, hecho por Lucía Fernández, «Cifrado del subsistema 011»).

## Criterios de aceptación
```gherkin
Característica: Pantalla de auditoría en la web

  Esquema del escenario: Solo admin y auditor ven el registro en /audit
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha entrado en /login?tenant=alumno01 con la contraseña <contraseña>
    Cuando abre /audit
    Entonces ve <resultado>
    Y en el menú lateral <menu>

    Ejemplos:
      | cuenta | contraseña | resultado | menu |
      | auditor@sigpro.test | Audit1234! | el título «Auditoría», el subtítulo «Registro de actividad del tenant» y la lista de eventos | aparece «Auditoría» |
      | gestor@sigpro.test | Gestor1234! | el aviso «Tu rol no permite ver la auditoría», con la explicación «Solo admin y auditor pueden consultar el registro.», y ningún evento | no aparece «Auditoría» |

  Esquema del escenario: El enlace de la pantalla sin permiso vuelve a Programas
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha entrado en /login?tenant=alumno01 con la contraseña Gestor1234!
    Cuando abre /audit y pulsa «Volver a Programas»
    Entonces llega a <ruta>

    Ejemplos:
      | ruta |
      | /programs |

  Esquema del escenario: La primera página muestra los 20 eventos más recientes
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha entrado en /login?tenant=alumno01 con la contraseña <contraseña>
    Cuando abre /audit
    Entonces el contador dice «Mostrando 20 de 130 eventos»
    Y la primera fila tiene la acción «Requisito creado» con el código requirement.created, la entidad «Requisito» y el código REQ-011
    Y su actor es Lucía Fernández y su resumen es title: Cifrado del subsistema 011
    Y no aparece «No hay más eventos»

    Ejemplos:
      | cuenta | contraseña |
      | auditor@sigpro.test | Audit1234! |
      | alumno01@sigpro.lab | Alumno1234! |

  Esquema del escenario: Desplazarse hasta el final de la lista carga la página siguiente
    Dado que el tenant alumno01 está recién reiniciado, auditor@sigpro.test ha entrado en /login?tenant=alumno01 con la contraseña Audit1234! y ha abierto /audit
    Cuando se desplaza hasta el final de la lista <cargas> veces, una por cada página siguiente
    Entonces el contador dice <contador>
    Y <fin>

    Ejemplos:
      | cargas | contador | fin |
      | 1 | Mostrando 40 de 130 eventos | no aparece «No hay más eventos» |
      | 6 | Mostrando 130 de 130 eventos | aparece «No hay más eventos» |

  Esquema del escenario: Un fallo al pedir una página muestra su aviso y se puede volver a pedir
    Dado que el tenant alumno01 está recién reiniciado, auditor@sigpro.test ha entrado en /login?tenant=alumno01 con la contraseña Audit1234! y la prueba responde 500 a la petición de <pagina_fallida>
    Cuando <accion>
    Entonces ve el aviso <aviso> y el botón <boton>
    Cuando pulsa <boton> con la API disponible
    Entonces el contador dice <contador_tras_reintentar>

    Ejemplos:
      | pagina_fallida | accion | aviso | boton | contador_tras_reintentar |
      | la primera página de GET /api/audit | abre /audit | «No se pudo cargar la auditoría» con la traza del error | «Reintentar» | Mostrando 20 de 130 eventos |
      | la página siguiente de GET /api/audit | abre /audit y se desplaza hasta el final de la lista | la traza del error debajo de los eventos cargados | «Cargar más» | Mostrando 40 de 130 eventos |

  Esquema del escenario: Un evento sin actor se muestra como Sistema
    Dado que el tenant alumno01 está recién reiniciado, se ha enviado con POST /api/auth/register una solicitud de acceso con la cabecera x-tenant alumno01, el correo (correo nuevo) y el cuerpo de las Reglas, y <cuenta> ha entrado en /login?tenant=alumno01 con la contraseña <contraseña>
    Cuando abre /audit
    Entonces la primera fila tiene el actor «Sistema», la entidad «Usuario» y la acción con el código auth.register

    Ejemplos:
      | cuenta | contraseña |
      | auditor@sigpro.test | Audit1234! |

  Esquema del escenario: La sección Auditoría de Administración muestra el mismo registro
    Dado que el tenant alumno01 está recién reiniciado y alumno01@sigpro.lab ha entrado en /login?tenant=alumno01 con la contraseña Alumno1234!
    Cuando abre /admin?tab=audit
    Entonces ve el título «Registro de auditoría» y el contador dice <contador>
    Y la primera fila tiene la acción «Requisito creado» con el código requirement.created y el actor Lucía Fernández

    Ejemplos:
      | contador |
      | Mostrando 20 de 130 eventos |
```

## Fuera de alcance
- Los filtros, la búsqueda y «Limpiar filtros»: los cubre EP-AUDITORIA en sus pantallas de filtros.
- El listado de la API y sus páginas por cursor: los cubre EP-AUDITORIA en la API.
- El permiso de lectura y el aislamiento por tenant: los cubre EP-AUDITORIA en la API.
- La misma pantalla en la app móvil: la cubre EP-AUDITORIA en la app móvil.
- La pestaña «Usuarios», la de «Modo caos», la de «Datos» y la elección de pestaña por la dirección de Administración: EP-ADMIN-USUARIOS y EP-CAOS-RESET.

## Decisiones pendientes
- Qué texto exacto lleva la línea de traza bajo los avisos de error de la auditoría. Hoy muestra el código del error y un identificador de traza; no está decidido el formato. Ninguna fila lo afirma ni lo excluye.
- Qué nombre en español lleva la acción `auth.register`. El catálogo no tiene texto para esa acción, y hoy la fila muestra su código como nombre. Ninguna fila le asigna un texto.
- Si el registro debe permitir ordenar por columnas y seleccionar eventos, como indica para Auditoría la tabla de componentes del plan. Hoy es una lista cronológica sin orden por columnas ni selección.
