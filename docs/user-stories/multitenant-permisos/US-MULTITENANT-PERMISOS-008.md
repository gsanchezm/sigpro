---
id: US-MULTITENANT-PERMISOS-008
tipo: historia
epica: EP-MULTITENANT-PERMISOS
titulo: "[Web] Acciones por rol: deshabilitadas con su motivo y accesos del menú según el rol"
etiquetas: [web]
relacionadas: [US-MULTITENANT-PERMISOS-007, US-MULTITENANT-PERMISOS-009, US-PROG-GESTION-006, US-REQ-FLUJO-009, US-DOC-VERSIONES-005, US-NC-GESTION-009, US-HITOS-006, US-AUDITORIA-006, US-ADMIN-USUARIOS-006, US-NAVEGACION-004]
verificacion: codigo
cubre: ["/programs", "/programs/:code", "/programs/:code/requirements", "/verification/:code", "/documents/:id", "/nc/:code", "/audit", "/admin"]
permisos: [program.delete, requirement.approve, testrun.execute, document.publish, nc.close, milestone.delete, audit.view, users.manage]
---

## Historia
Como persona que usa la web con su rol, quiero ver deshabilitadas las acciones que mi rol no puede hacer, con el motivo al alcance del ratón, y no ver los accesos de Auditoría y Administración si mi rol no los tiene,
para saber qué puedo hacer sin intentarlo.

## Reglas
- Una acción que el rol no puede dar aparece deshabilitada. Al pasar el ratón por encima, aparece el motivo que se indica en cada caso. Una acción deshabilitada no cambia nada.
- Una acción que el rol sí puede dar aparece habilitada, sin motivo.
- En el menú lateral, el acceso «Auditoría» solo aparece para `admin` y `auditor`, y el acceso «Administración» solo para `admin`. Si un rol sin permiso abre la dirección directamente, ve un aviso en lugar del contenido.
- El botón de paso de una no conformidad al estado cerrado se llama «Pasar a «Cerrada»».
- Roles y cuentas del tenant `alumno01`: `admin` es `alumno01@sigpro.lab` (contraseña `Alumno1234!`); `program_manager` es `gestor@sigpro.test` (`Gestor1234!`); `consultant` es `consultor@sigpro.test` (`Consul1234!`); `auditor` es `auditor@sigpro.test` (`Audit1234!`).
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset`, el token de `alumno01@sigpro.lab` y la cabecera `x-tenant: alumno01`, con el caos apagado. Después la persona abre `/login?tenant=alumno01` en un navegador sin sesión e inicia sesión con la cuenta de su rol. Cada fila parte de un contexto nuevo.

## Criterios de aceptación
```gherkin
Característica: Acciones y accesos de la web según el rol

  Esquema del escenario: La acción de eliminar un programa en la lista
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la web y está en /programs con PRG-001 en la lista
    Cuando abre las acciones de PRG-001
    Entonces la acción «Eliminar» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitada |
      | program_manager | deshabilitada, con el motivo «Solo admin puede eliminar» |
      | consultant | deshabilitada, con el motivo «Solo admin puede eliminar» |
      | auditor | deshabilitada, con el motivo «Solo admin puede eliminar» |

  Esquema del escenario: La acción de aprobar un requisito en borrador
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la web y está en /programs/PRG-002/requirements con REQ-017 abierto, en borrador
    Cuando mira los pasos de aprobación de REQ-017
    Entonces el botón «Aprobar» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitado |
      | program_manager | habilitado |
      | consultant | deshabilitado, con el motivo «Solo el gestor de programa o el admin pueden aprobar» |
      | auditor | deshabilitado, con el motivo «Solo el gestor de programa o el admin pueden aprobar» |

  Esquema del escenario: La acción de registrar una ejecución de un caso de prueba
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la web y está en /verification/TC-001
    Cuando mira el formulario «Registrar ejecución»
    Entonces el botón «Registrar ejecución» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitado |
      | program_manager | deshabilitado, con el motivo «Tu rol no permite registrar ejecuciones» |
      | consultant | habilitado |
      | auditor | deshabilitado, con el motivo «Tu rol no permite registrar ejecuciones» |

  Esquema del escenario: La acción de publicar una versión de un documento
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la web y está en /documents/DOC-001
    Cuando mira la acción de publicar
    Entonces el botón «Publicar nueva versión» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitado |
      | program_manager | habilitado |
      | consultant | deshabilitado, con el motivo «Solo admin y gestor pueden publicar versiones» |
      | auditor | deshabilitado, con el motivo «Solo admin y gestor pueden publicar versiones» |

  Esquema del escenario: La acción de cerrar una no conformidad en acción correctiva
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la web y está en /nc/NC-003, que está en «Acción correctiva»
    Cuando mira los pasos de estado de la no conformidad
    Entonces el botón del paso a «Cerrada» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitado |
      | program_manager | habilitado |
      | consultant | deshabilitado, con el motivo «Tu rol no permite cerrar no conformidades» |
      | auditor | deshabilitado, con el motivo «Tu rol no permite cerrar no conformidades» |

  Esquema del escenario: La acción de eliminar un hito del programa
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la web y está en la pestaña «Hitos» de /programs/PRG-001
    Cuando abre las acciones del hito PRG-001-M01
    Entonces la acción «Eliminar» está <estado>

    Ejemplos:
      | rol | estado |
      | admin | habilitada |
      | program_manager | habilitada |
      | consultant | deshabilitada, con el motivo «Tu rol no permite eliminar hitos» |
      | auditor | deshabilitada, con el motivo «Tu rol no permite eliminar hitos» |

  Esquema del escenario: El acceso a Auditoría en el menú y en su página
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la web
    Cuando mira el menú lateral y abre la dirección /audit
    Entonces en el menú lateral <menu> y al abrir /audit ve <vista>

    Ejemplos:
      | rol | menu | vista |
      | admin | aparece «Auditoría» | el registro de auditoría |
      | auditor | aparece «Auditoría» | el registro de auditoría |
      | program_manager | no aparece «Auditoría» | el aviso «Tu rol no permite ver la auditoría», con «Solo admin y auditor pueden consultar el registro.» y el enlace «Volver a Programas» |
      | consultant | no aparece «Auditoría» | el aviso «Tu rol no permite ver la auditoría», con «Solo admin y auditor pueden consultar el registro.» y el enlace «Volver a Programas» |

  Esquema del escenario: El acceso a Administración en el menú y en su página
    Dado que en el tenant alumno01, recién reiniciado, <rol> ha iniciado sesión en la web
    Cuando mira el menú lateral y abre la dirección /admin
    Entonces en el menú lateral <menu> y al abrir /admin ve <vista>

    Ejemplos:
      | rol | menu | vista |
      | admin | aparece «Administración» | la pantalla de administración del tenant |
      | program_manager | no aparece «Administración» | el aviso «Tu rol no permite administrar el tenant», con «Solo admin puede entrar en Administración.» y el enlace «Volver a Programas» |
      | consultant | no aparece «Administración» | el aviso «Tu rol no permite administrar el tenant», con «Solo admin puede entrar en Administración.» y el enlace «Volver a Programas» |
      | auditor | no aparece «Administración» | el aviso «Tu rol no permite administrar el tenant», con «Solo admin puede entrar en Administración.» y el enlace «Volver a Programas» |
```

## Fuera de alcance
- Qué hace cada acción una vez habilitada (formularios, confirmaciones y resultados): cada una en la épica de su módulo.
- La comprobación en la API de cada permiso, que es la barrera real: US-MULTITENANT-PERMISOS-005 y US-MULTITENANT-PERMISOS-007.
- Las acciones de la app móvil: US-MULTITENANT-PERMISOS-009.
- El contenido de las pantallas de Auditoría y Administración: EP-AUDITORIA y EP-ADMIN-USUARIOS.
