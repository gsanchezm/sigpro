---
id: US-NAVEGACION-011
tipo: historia
epica: EP-NAVEGACION
titulo: "[Móvil] Navegar con las pestañas inferiores y el menú «Más» según el rol"
etiquetas: [movil]
relacionadas: [US-NAVEGACION-004, US-NAVEGACION-010, US-NAVEGACION-012, US-NAVEGACION-014, US-NAVEGACION-016, US-LOGIN-013]
verificacion: codigo
cubre: ["/programs", "/verification", "/nc", "/mission", "/more", "/documents", "/audit", "/admin", "/profile", "/help", "/legal/terms", "/legal/privacy"]
permisos: [audit.view, users.manage]
---

## Historia
Como persona que usa SIGPRO en el móvil, quiero una barra inferior con las secciones principales y un menú «Más» con el resto, según mi rol,
para llegar a cualquier módulo con el pulgar y saber siempre en cuál estoy.

## Reglas
- La barra inferior tiene cinco pestañas, en este orden y para todos los roles: Programas, Verificación, NC, Misión y Más. Su texto visible es «Programas», «Verificación», «NC», «Misión» y «Más». Su nombre completo es «Programas», «Verificación», «No conformidades», «Panel de misión» y «Más».
- Cada pestaña lleva a su sección: `/programs`, `/verification`, `/nc` y `/mission`. La pestaña «Más» lleva a `/more`.
- La pestaña de la sección en la que está la persona queda marcada como activa. Dentro de «Más», y en cualquiera de sus páginas, queda marcada la pestaña «Más».
- «Más» muestra la pantalla «Más», con una fila por cada elemento y en este orden: «Búsqueda global» (`/search`), «Documentos» (`/documents`), «Auditoría» (`/audit`), «Administración» (`/admin`), «Perfil» (`/profile`), «Ayuda» (`/help`), «Condiciones» (`/legal/terms`) y «Privacidad» (`/legal/privacy`). Búsqueda global, Documentos, Perfil, Ayuda, Condiciones y Privacidad las ven todos los roles.
- La fila «Auditoría» la ve quien tiene el permiso `audit.view`, que son el admin y el auditor. La fila «Administración» la ve quien tiene el permiso `users.manage`, que es solo el admin.
- Al tocar una fila, su página se abre dentro de «Más». La barra inferior sigue visible.
- Tocar la pestaña «Más» estando en otra pestaña lleva de nuevo a la pantalla «Más», aunque antes se estuviera en una de sus páginas.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se inicia sesión en la app móvil con la cuenta de la fila, con `alumno01` en «Tenant de trabajo».

## Criterios de aceptación
```gherkin
Característica: Pestañas inferiores y menú «Más» en la app móvil

  Esquema del escenario: La pantalla «Más» muestra las filas que corresponden al rol
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene sesión iniciada en la app móvil con alumno01 en «Tenant de trabajo»
    Cuando abre la pestaña «Más»
    Entonces ve las filas <filas>
    Y las filas que no ve son <ocultas>

    Ejemplos:
      | cuenta | filas | ocultas |
      | alumno01@sigpro.lab | Búsqueda global, Documentos, Auditoría, Administración, Perfil, Ayuda, Condiciones y Privacidad | (ninguna) |
      | auditor@sigpro.test | Búsqueda global, Documentos, Auditoría, Perfil, Ayuda, Condiciones y Privacidad | «Administración» |
      | gestor@sigpro.test | Búsqueda global, Documentos, Perfil, Ayuda, Condiciones y Privacidad | «Auditoría» y «Administración» |
      | consultor@sigpro.test | Búsqueda global, Documentos, Perfil, Ayuda, Condiciones y Privacidad | «Auditoría» y «Administración» |

  Esquema del escenario: Cada pestaña lleva a su sección y queda marcada como activa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil y está en /programs
    Cuando toca la pestaña <pestana>
    Entonces llega a <ruta> y la pestaña <pestana> queda marcada como activa

    Ejemplos:
      | pestana | ruta |
      | «Programas» | /programs |
      | «Verificación» | /verification |
      | «NC» | /nc |
      | «Misión» | /mission |
      | «Más» | /more |

  Esquema del escenario: Tocar una fila de «Más» abre su página dentro de «Más»
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene sesión iniciada en la app móvil con alumno01 en «Tenant de trabajo» y está en la pantalla «Más»
    Cuando toca <fila>
    Entonces llega a <ruta>
    Y la barra inferior sigue visible con la pestaña «Más» marcada

    Ejemplos:
      | cuenta | fila | ruta |
      | gestor@sigpro.test | «Documentos» | /documents |
      | gestor@sigpro.test | «Perfil» | /profile |
      | gestor@sigpro.test | «Ayuda» | /help |
      | gestor@sigpro.test | «Privacidad» | /legal/privacy |
      | alumno01@sigpro.lab | «Auditoría» | /audit |
      | alumno01@sigpro.lab | «Administración» | /admin |

  Esquema del escenario: Tocar «Más» desde otra pestaña muestra el menú y no la última página abierta
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil, ha abierto <seccion> desde «Más» y ha pasado a la pestaña «Programas»
    Cuando toca la pestaña «Más»
    Entonces llega a <ruta> y ve la pantalla «Más» con sus filas

    Ejemplos:
      | seccion | ruta |
      | «Documentos» | /more |
      | «Perfil» | /more |
```

## Fuera de alcance
- La pantalla «Búsqueda global», su campo y sus resultados: US-NAVEGACION-012. Abrir un resultado: US-NAVEGACION-013.
- Cerrar la sesión: está en la página «Perfil», y lo describe la épica de Acceso (US-LOGIN-013).
- El contenido de cada pantalla a la que lleva una pestaña o una fila: las épicas de cada módulo.
- La página `/lab`: no existe en la app móvil por decisión de paridad funcional.

## Decisiones pendientes
- Si «Requisitos» debe aparecer en la barra inferior o en «Más». Hoy no aparece en ninguno de los dos: US-NAVEGACION-016 describe la capacidad futura.
