---
id: US-NAVEGACION-004
tipo: historia
epica: EP-NAVEGACION
titulo: "[Web] Ver en la barra lateral las secciones de mi rol y cuál está activa"
etiquetas: [web]
relacionadas: [US-NAVEGACION-005, US-NAVEGACION-006, US-NAVEGACION-011, US-NAVEGACION-016]
verificacion: codigo
cubre: ["/mission", "/programs", "/programs/:code/requirements", "/verification", "/nc", "/documents", "/audit", "/admin"]
permisos: [audit.view, users.manage]
---

## Historia
Como persona con una sesión iniciada en la web de escritorio, quiero ver en la barra lateral las secciones que puedo usar y saber en cuál estoy,
para llegar a cada una con un clic y no perderme entre módulos.

## Reglas
- En escritorio, la barra lateral está a la izquierda de todas las pantallas autenticadas y lista, en este orden: Panel de misión (`/mission`), Programas (`/programs`), Requisitos (`/programs/PRG-001/requirements`), Verificación (`/verification`), No conformidades (`/nc`), Documentos (`/documents`), Auditoría (`/audit`), Administración (`/admin`) y Lab (`/lab`). Cada entrada es un enlace a esa dirección.
- Por rol: Panel de misión, Programas, Requisitos, Verificación, No conformidades, Documentos y Lab los ven todos los roles. Auditoría la ven el admin y el auditor, con el permiso `audit.view`. Administración la ve solo el admin, con el permiso `users.manage`. Quien no ve una entrada no la encuentra en la barra; lo que muestra la sección si se escribe su dirección a mano no es de esta historia.
- La entrada de la sección en la que está la persona queda marcada como página actual, y es la única marcada. Programas queda marcada en la lista de programas y en la ficha y la edición de un programa. Requisitos queda marcada solo en los requisitos de un programa. En `/profile` no queda marcada ninguna entrada.
- La entrada No conformidades muestra, con la barra desplegada, una insignia con el número de no conformidades abiertas del tenant. Están abiertas las que no están cerradas ni rechazadas.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`); después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada y se inicia sesión con la cuenta de la fila y su contraseña.

## Criterios de aceptación
```gherkin
Característica: Barra lateral de la web de escritorio

  Esquema del escenario: Cada rol ve sus entradas y las que no ve son las de otros roles
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene sesión iniciada en la web de escritorio
    Cuando mira la barra lateral
    Entonces ve <cantidad> entradas, en el orden de la lista
    Y las entradas que no ve son <ocultas>

    Ejemplos:
      | cuenta | cantidad | ocultas |
      | alumno01@sigpro.lab | 9 | (ninguna) |
      | auditor@sigpro.test | 8 | Administración |
      | gestor@sigpro.test | 7 | Auditoría y Administración |
      | consultor@sigpro.test | 7 | Auditoría y Administración |

  Esquema del escenario: La entrada de la sección en la que está queda marcada como página actual
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la web de escritorio
    Cuando abre <ruta>
    Entonces la única entrada marcada como página actual es <entrada>

    Ejemplos:
      | ruta | entrada |
      | /programs | Programas |
      | /programs/PRG-001 | Programas |
      | /programs/PRG-001/edit | Programas |
      | /programs/PRG-001/requirements | Requisitos |
      | /verification | Verificación |
      | /nc/NC-001 | No conformidades |
      | /documents | Documentos |
      | /profile | (ninguna) |

  Esquema del escenario: La insignia de No conformidades cuenta las abiertas del tenant
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en la web de escritorio con la barra desplegada
    Cuando mira la entrada No conformidades de la barra lateral
    Entonces la insignia muestra <cifra>

    Ejemplos:
      | cifra |
      | 8 |
```

## Fuera de alcance
- El plegado de la barra y las migas de pan: US-NAVEGACION-005. El cajón de navegación del diseño responsive: US-NAVEGACION-006.
- Lo que muestra cada sección y la pantalla de una sección a la que el rol no tiene acceso cuando se escribe su dirección: las épicas de cada módulo.
- Cómo cambia la insignia cuando llegan eventos de no conformidades: EP-MISION-FEED.
- El contenido de la pantalla `/lab`.

## Decisiones pendientes
- La entrada Requisitos lleva siempre a los requisitos de PRG-001, que es el programa del seed. No está decidido si debe llevar a la lista de programas, al último programa visitado u otra pantalla.
- Si la entrada Lab debe verla cualquier rol, como hoy, o solo un rol concreto.
