---
id: US-NAVEGACION-010
tipo: historia
epica: EP-NAVEGACION
titulo: "[Web] Llegar a Programas o a Acceso desde la raíz, las direcciones desconocidas y las privadas"
etiquetas: [web]
relacionadas: [US-NAVEGACION-004, US-NAVEGACION-014, US-LOGIN-007]
verificacion: codigo
---

## Historia
Como persona que abre SIGPRO desde un enlace o escribe una dirección a mano, quiero llegar siempre a una pantalla útil: Programas si tengo sesión y Acceso si no la tengo,
para no quedarme en una página vacía ni ante una dirección que no existe.

## Reglas
- La dirección `/` lleva a `/programs`. Sin sesión, `/programs` lleva a `/login`.
- Una dirección que no corresponde a ninguna pantalla de la web (por ejemplo `/requisitos`, o `/search`, que solo existe en la app móvil) lleva a `/` y de ahí a `/programs` si hay sesión, o a `/login` si no la hay.
- Una pantalla privada sin sesión iniciada lleva a `/login`. Son privadas las pantallas de la barra lateral (salvo `/lab`, que es pública), `/profile` y `/documents/<identificador>`.
- Con sesión iniciada, `/login`, `/register` y `/forgot` llevan a `/programs`.
- Cada redirección sustituye en el historial del navegador la dirección pedida: volver atrás después de una redirección no vuelve a la dirección que no existía ni a la que llevaba a Acceso.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las filas con sesión inician sesión con `gestor@sigpro.test` y `Gestor1234!` en `/login?tenant=alumno01`. Las filas sin sesión usan un navegador sin ninguna sesión de SIGPRO guardada.

## Criterios de aceptación
```gherkin
Característica: Raíz, direcciones desconocidas y pantallas privadas en la web

  Esquema del escenario: Con sesión iniciada, la raíz y las direcciones desconocidas llevan a Programas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la web de escritorio
    Cuando abre <direccion>
    Entonces llega a <destino>

    Ejemplos:
      | direccion | destino |
      | / | /programs |
      | /requisitos | /programs |
      | /search | /programs |

  Esquema del escenario: Sin sesión, las pantallas privadas y las direcciones desconocidas llevan a Acceso
    Dado que en una ventana sin ninguna sesión de SIGPRO guardada, en el tenant alumno01, recién reiniciado
    Cuando abre <direccion>
    Entonces llega a /login y no tiene sesión iniciada

    Ejemplos:
      | direccion |
      | / |
      | /programs |
      | /nc/NC-001 |
      | /profile |
      | /requisitos |

  Esquema del escenario: Con sesión iniciada, las páginas de Acceso llevan a Programas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la web de escritorio
    Cuando abre <direccion>
    Entonces llega a /programs

    Ejemplos:
      | direccion |
      | /login |
      | /register |
      | /forgot |
```

## Fuera de alcance
- La pantalla de Acceso, sus campos y su validación: EP-LOGIN, y el alta y la recuperación de la contraseña: EP-REGISTRO y EP-RECUPERAR.
- La página `/lab`: es pública, y sin sesión muestra su propia cabecera mínima en lugar de llevar a Acceso. Su contenido es de la pantalla del instructor.
- La pantalla que se muestra a un rol que escribe la dirección de una sección que no le corresponde: las épicas de cada módulo.

## Decisiones pendientes
- Si, tras iniciar sesión, la persona debe volver a la dirección privada que pidió antes. Hoy llega siempre a Programas.
