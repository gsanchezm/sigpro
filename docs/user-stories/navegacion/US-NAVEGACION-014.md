---
id: US-NAVEGACION-014
tipo: historia
epica: EP-NAVEGACION
titulo: "[Móvil] Llegar a Programas o a Acceso desde la raíz y las pantallas privadas"
etiquetas: [movil]
relacionadas: [US-NAVEGACION-010, US-NAVEGACION-011, US-LOGIN-012]
verificacion: ejecutada
---

## Historia
Como persona que abre la app móvil desde su inicio o desde un enlace, quiero llegar a Programas si tengo sesión y a Acceso si no la tengo,
para empezar siempre en una pantalla que me sirva.

## Reglas
- La raíz de la app (`/`) lleva a `/programs` si hay sesión iniciada, y a `/login` si no la hay.
- Una pantalla de la zona autenticada (Programas, Verificación, NC, Misión, Más y sus páginas) sin sesión iniciada lleva a `/login`.
- Con sesión iniciada, `/login`, `/register` y `/forgot` llevan a `/programs`.
- Las páginas legales (`/legal/terms` y `/legal/privacy`) y la ayuda (`/help`) se leen con o sin sesión: no redirigen.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las filas con sesión inician sesión en la app móvil con `gestor@sigpro.test` y `Gestor1234!`, con `alumno01` en «Tenant de trabajo». Las filas sin sesión usan la app sin ninguna sesión de SIGPRO guardada en el dispositivo o en el navegador.

## Criterios de aceptación
```gherkin
Característica: Raíz y pantallas privadas en la app móvil

  Esquema del escenario: Con sesión iniciada, la raíz y las páginas de Acceso llevan a Programas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la app móvil
    Cuando abre <direccion>
    Entonces llega a /programs

    Ejemplos:
      | direccion |
      | / |
      | /login |
      | /register |

  Esquema del escenario: Sin sesión, las pantallas privadas llevan a Acceso y las páginas legales se leen
    Dado que en la app móvil, sin ninguna sesión de SIGPRO guardada, en el tenant alumno01, recién reiniciado
    Cuando abre <direccion>
    Entonces llega a <destino>

    Ejemplos:
      | direccion | destino |
      | / | /login |
      | /programs | /login |
      | /more | /login |
      | /legal/terms | /legal/terms, que se lee sin sesión |
```

## Fuera de alcance
- La pantalla de Acceso, sus campos y su validación: EP-LOGIN (US-LOGIN-011 y US-LOGIN-012 para la app móvil).
- El registro y la recuperación de la contraseña: EP-REGISTRO y EP-RECUPERAR.
- El contenido de las páginas legales y de la ayuda: las épicas transversales de páginas legales y ayuda.

## Decisiones pendientes
- Qué debe pasar ante una dirección que la app no tiene. Hoy la app móvil no tiene una pantalla propia para las direcciones desconocidas y no redirige como la web; no está decidido qué debe ver la persona.
- Si, tras iniciar sesión, la persona debe volver a la pantalla privada que pidió antes. Hoy llega siempre a Programas.
