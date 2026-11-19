---
id: US-MULTITENANT-PERMISOS-006
tipo: historia
epica: EP-MULTITENANT-PERMISOS
titulo: "[Transversal] Ningún listado, búsqueda, exportación ni descarga mezcla datos de dos tenants"
etiquetas: [transversal]
relacionadas: [US-MULTITENANT-PERMISOS-002, US-MULTITENANT-PERMISOS-003, US-DOC-LISTA-005, US-MISION-FEED-002, US-NAVEGACION-001]
verificacion: codigo
---

## Historia
Como alumno que comparte SIGPRO con otros alumnos, quiero que todo lo que la aplicación me muestra, busca, exporta o me entrega sea solo de mi tenant,
para que mis resultados no se mezclen con los de otro, aunque los códigos coincidan.

## Reglas
- Ninguna superficie incluye datos de otro tenant: ni los listados (programas, requisitos, casos, no conformidades, documentos, proveedores y registro de auditoría), ni la búsqueda global, ni la exportación de programas en CSV, ni el informe PDF de verificación, ni las descargas de documentos y de evidencias, ni los avisos en vivo del panel de misión.
- Un código que existe en dos tenants muestra los datos del tenant de la sesión: `PRG-001` es «Sistema de mando táctico Ártemis» en `alumno01` y «Programa de aislamiento» en `alumno02` cuando `alumno02` lo ha renombrado.
- Una escritura de un tenant no cambia lo que ve el otro, aunque el código sea el mismo.
- Cambiar el tenant de trabajo desde la pantalla de laboratorio de la web cierra la sesión abierta y lleva a la pantalla de acceso. Con una sesión abierta, los datos que se ven son los del tenant de esa sesión.
- Preparación de cada fila: se reinician `alumno01` y `alumno02` con `POST /api/admin/reset`, cada uno con el token de su administrador (`alumno01@sigpro.lab` y `alumno02@sigpro.lab`, contraseña `Alumno1234!`) y la cabecera `x-tenant` de su tenant, con el caos apagado. Cada administrador inicia sesión con `POST /api/auth/login`, su cabecera `x-tenant` y su contraseña, y usa el `accessToken` que recibe. Después `alumno02@sigpro.lab` renombra `PRG-001` a «Programa de aislamiento» y crea el programa `PRG-025` «Programa de aislamiento nuevo» (responsable `u1`, inicio `2026-03-01`, fin `2026-12-31`, presupuesto `150000`), publica la versión 4 de `DOC-001` con la línea «Versión solo de alumno02» y crea el hito `PRG-025-M01` en `PRG-025`. `alumno01` no recibe ninguna otra operación.

## Criterios de aceptación
```gherkin
Característica: Los datos que se muestran y se entregan son solo del tenant de la sesión

  Esquema del escenario: Lo que busca, lista, exporta o descarga alumno01 no incluye datos de alumno02
    Dado que en los tenants alumno01 y alumno02, recién reiniciados y con la preparación de la regla, una persona ha iniciado sesión en alumno01 con un rol que puede usar la superficie
    Cuando <accion> en la plataforma que use
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | busca «aislamiento» en la búsqueda global | no aparece ningún programa ni documento y la búsqueda no tiene resultados |
      | pide el listado de programas con el texto «aislamiento» | el listado no tiene ningún programa y el total es 0 |
      | exporta el listado de programas en CSV | el archivo tiene 24 programas y ninguno tiene el código PRG-025 ni el nombre «Programa de aislamiento» |
      | descarga el documento DOC-001 | el archivo corresponde a la versión 3 y no a la versión 4 de alumno02 |
      | abre el registro de auditoría y busca «PRG-025» | no aparece ningún evento y el total es 0 |

  Esquema del escenario: Una escritura de un tenant no cambia lo que ve el otro
    Dado que en los tenants alumno01 y alumno02, recién reiniciados y con la preparación de la regla, una persona ha iniciado sesión en alumno01 con un rol que puede hacer la acción
    Cuando <accion> en alumno01
    Entonces en alumno02 <resultado>

    Ejemplos:
      | accion | resultado |
      | crea el programa «Programa de otro tenant», que recibe el código PRG-025 | PRG-025 sigue con el nombre «Programa de aislamiento nuevo» y el listado de programas tiene 25 programas |
      | cambia el nombre de PRG-001 a «Programa solo de alumno01» | PRG-001 sigue con el nombre «Programa de aislamiento» |
      | publica una versión nueva de DOC-001 | DOC-001 sigue con su versión 4, «Versión solo de alumno02» |
```

## Decisiones pendientes
- Qué ocurre si se abre la web con `?tenant=alumno02` mientras hay una sesión abierta de `alumno01`. Hoy el tenant de trabajo cambia en el navegador y la pantalla de laboratorio muestra el tenant nuevo, pero los datos siguen siendo los de la sesión abierta. No está decidido si la sesión debe cerrarse, si debe avisarse al usuario o si no debe pasar nada. Esto describe lo que existe hoy y no es un criterio: que la aplicación lo mantenga o lo cambie no se reporta como defecto.

## Fuera de alcance
- Las reglas de cada listado, búsqueda, exportación o descarga (orden, filtros, formato y contenido): cada una en la épica de su módulo.
- Los permisos de cada operación: US-MULTITENANT-PERMISOS-005.
- La cabecera `x-tenant` frente a un token: US-MULTITENANT-PERMISOS-004.
- El reinicio del tenant y el modo caos: EP-CAOS-RESET.
