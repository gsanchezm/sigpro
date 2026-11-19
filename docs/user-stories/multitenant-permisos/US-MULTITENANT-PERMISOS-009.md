---
id: US-MULTITENANT-PERMISOS-009
tipo: historia
epica: EP-MULTITENANT-PERMISOS
titulo: "[Móvil] Acciones por rol: deshabilitadas con su motivo y accesos de la pestaña Más según el rol"
etiquetas: [movil]
relacionadas: [US-MULTITENANT-PERMISOS-007, US-MULTITENANT-PERMISOS-008, US-PROG-GESTION-011, US-DOC-VERSIONES-009, US-NC-GESTION-012, US-HITOS-010, US-AUDITORIA-008, US-ADMIN-USUARIOS-009, US-NAVEGACION-011]
verificacion: codigo
cubre: ["/programs", "/programs/:code", "/programs/:code/requirements", "/verification/:code", "/documents/:id", "/nc", "/more", "/audit", "/admin"]
permisos: [program.delete, requirement.approve, testrun.execute, document.publish, nc.close, milestone.delete, audit.view, users.manage]
---

## Historia
Como persona que usa la app móvil con su rol, quiero ver deshabilitadas las acciones que mi rol no puede hacer, con el motivo escrito debajo, y no ver en la pestaña Más los accesos de Auditoría y Administración si mi rol no los tiene,
para saber qué puedo hacer sin intentarlo, con la misma regla que en la web.

## Reglas
- Una acción que el rol no puede dar aparece deshabilitada, y debajo de ella aparece escrito el motivo que se indica en cada caso. Una acción deshabilitada no cambia nada.
- Una acción que el rol sí puede dar aparece habilitada, sin motivo.
- En la pestaña Más, el acceso «Auditoría» solo aparece para `admin` y `auditor`, y el acceso «Administración» solo para `admin`. Si un rol sin permiso abre esa pantalla, ve un aviso en lugar del contenido: para Auditoría, «Tu rol no permite ver la auditoría» y debajo «Solo admin y auditor pueden consultar el registro.»; para Administración, «Tu rol no permite administrar el tenant» y debajo «Solo admin puede entrar en Administración.».
- El botón de paso de una no conformidad al estado cerrado se llama «Mover a «Cerrada»».
- Roles y cuentas del tenant `alumno01`: `admin` es `alumno01@sigpro.lab` (contraseña `Alumno1234!`); `program_manager` es `gestor@sigpro.test` (`Gestor1234!`); `consultant` es `consultor@sigpro.test` (`Consul1234!`); `auditor` es `auditor@sigpro.test` (`Audit1234!`).
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset`, el token de `alumno01@sigpro.lab` y la cabecera `x-tenant: alumno01`, con el caos apagado. Después la persona abre la app sin sesión, escribe `alumno01` en «Tenant de trabajo» e inicia sesión con la cuenta de su rol. Cada fila parte de una sesión nueva.

## Criterios de aceptación
```gherkin
Característica: Acciones y accesos de la app móvil según el rol

  Esquema del escenario: La acción de eliminar un programa desde su menú de acciones
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la app y ve la lista de programas con PRG-001
    Cuando abre las acciones de PRG-001
    Entonces la acción «Eliminar» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitada |
      | program_manager | deshabilitada, y debajo aparece «Solo admin puede eliminar» |
      | consultant | deshabilitada, y debajo aparece «Solo admin puede eliminar» |
      | auditor | deshabilitada, y debajo aparece «Solo admin puede eliminar» |

  Esquema del escenario: La acción de aprobar un requisito en borrador
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la app y ha abierto REQ-017 de PRG-002, en borrador
    Cuando mira los pasos de su flujo de estados
    Entonces el paso «Aprobar» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitado |
      | program_manager | habilitado |
      | consultant | deshabilitado, y debajo aparece «Solo el gestor de programa o el admin pueden aprobar» |
      | auditor | deshabilitado, y debajo aparece «Solo el gestor de programa o el admin pueden aprobar» |

  Esquema del escenario: La acción de registrar una ejecución de un caso de prueba
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la app y ha abierto el caso TC-001
    Cuando mira el formulario de ejecución
    Entonces el botón «Registrar ejecución» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitado |
      | program_manager | deshabilitado, y en el formulario aparece el aviso «Tu rol no permite registrar ejecuciones» |
      | consultant | habilitado |
      | auditor | deshabilitado, y en el formulario aparece el aviso «Tu rol no permite registrar ejecuciones» |

  Esquema del escenario: La acción de publicar una versión de un documento
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la app y ha abierto el documento DOC-001
    Cuando mira la acción de publicar
    Entonces el botón «Publicar nueva versión» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitado |
      | program_manager | habilitado |
      | consultant | deshabilitado, y debajo aparece «Solo admin y gestor pueden publicar versiones» |
      | auditor | deshabilitado, y debajo aparece «Solo admin y gestor pueden publicar versiones» |

  Esquema del escenario: La acción de cerrar una no conformidad en acción correctiva
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la app y ha abierto NC-003, que está en «Acción correctiva»
    Cuando mira los pasos de estado de la no conformidad
    Entonces el botón «Mover a «Cerrada»» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitado |
      | program_manager | habilitado |
      | consultant | deshabilitado, y debajo aparece «Tu rol no permite cerrar no conformidades» |
      | auditor | deshabilitado, y debajo aparece «Tu rol no permite cerrar no conformidades» |

  Esquema del escenario: La acción de eliminar un hito del programa
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la app y ha abierto PRG-001 en la sección de hitos
    Cuando abre las acciones del hito PRG-001-M01
    Entonces la acción «Eliminar» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitada |
      | program_manager | habilitada |
      | consultant | deshabilitada, y debajo aparece «Tu rol no permite eliminar hitos» |
      | auditor | deshabilitada, y debajo aparece «Tu rol no permite eliminar hitos» |

  Esquema del escenario: El acceso a Auditoría en la pestaña Más
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la app
    Cuando abre la pestaña «Más»
    Entonces en la pestaña Más <menu> y al abrir Auditoría ve <vista>

    Ejemplos:
      | rol | menu | vista |
      | admin | aparece «Auditoría» | el registro de auditoría |
      | auditor | aparece «Auditoría» | el registro de auditoría |
      | program_manager | no aparece «Auditoría» | el aviso «Tu rol no permite ver la auditoría», y debajo «Solo admin y auditor pueden consultar el registro.» |
      | consultant | no aparece «Auditoría» | el aviso «Tu rol no permite ver la auditoría», y debajo «Solo admin y auditor pueden consultar el registro.» |

  Esquema del escenario: El acceso a Administración en la pestaña Más
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la app
    Cuando abre la pestaña «Más»
    Entonces en la pestaña Más <menu> y al abrir Administración ve <vista>

    Ejemplos:
      | rol | menu | vista |
      | admin | aparece «Administración» | la pantalla de administración del tenant |
      | program_manager | no aparece «Administración» | el aviso «Tu rol no permite administrar el tenant», y debajo «Solo admin puede entrar en Administración.» |
      | consultant | no aparece «Administración» | el aviso «Tu rol no permite administrar el tenant», y debajo «Solo admin puede entrar en Administración.» |
      | auditor | no aparece «Administración» | el aviso «Tu rol no permite administrar el tenant», y debajo «Solo admin puede entrar en Administración.» |
```

## Fuera de alcance
- Qué hace cada acción una vez habilitada (formularios, confirmaciones y resultados): cada una en la épica de su módulo.
- La comprobación en la API de cada permiso, que es la barrera real: US-MULTITENANT-PERMISOS-005 y US-MULTITENANT-PERMISOS-007.
- Las mismas acciones en la web: US-MULTITENANT-PERMISOS-008.
- El contenido de las pantallas de Auditoría y Administración: EP-AUDITORIA y EP-ADMIN-USUARIOS.
