---
id: US-REQ-ARBOL-013
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Móvil] Filtrar el árbol por estado y expandir o contraer todo"
etiquetas: [movil, no-implementada]
relacionadas: [US-REQ-ARBOL-004, US-REQ-ARBOL-003, US-REQ-ARBOL-009]
verificacion: no-ejecutable
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero filtrar el árbol por el estado de los requisitos y plegar o desplegar todas sus ramas de una vez,
para revisar los requisitos de un mismo paso de aprobación y ver la estructura completa de un programa desde la app, igual que en la web.

## Reglas
- Esta historia describe lo que la web ya hace y la app móvil todavía no tiene. La paridad con la web es el requisito; el comportamiento de la web está en las historias de la web que figuran en «relacionadas».
- En la pestaña «Árbol», la app móvil ofrece un filtro por estado con las opciones «Borrador», «Aprobado», «Verificado» y «Validado», que se combina con la búsqueda por código o título: un requisito aparece solo si cumple los dos. Cuando hay un estado elegido, la lista muestra los requisitos de ese estado y sus ancestros, y el contador cuenta lo que se muestra.
- La app móvil ofrece también los controles «Expandir todo» y «Contraer todo». «Contraer todo» deja visibles solo los requisitos raíz; «Expandir todo» despliega todas las ramas.
- Mientras hay búsqueda o un estado elegido, el árbol aparece desplegado.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app está en /login, sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo»; se escriben el correo y la contraseña de `gestor@sigpro.test` (`Gestor1234!`), se pulsa «Entrar» y se llega a Programas. Cada fila parte de un contexto nuevo.
- Tras un reinicio, `PRG-001` tiene 14 requisitos, de los que 3 están validados (`REQ-003`, `REQ-007` y `REQ-011`); sus raíces son `REQ-001`, `REQ-006` y `REQ-011`.

## Criterios de aceptación
```gherkin
Característica: Filtro por estado y plegado completo del árbol en la app móvil

  Esquema del escenario: El filtro por estado muestra solo los requisitos de ese estado y sus ancestros
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/PRG-001/requirements en la pestaña «Árbol»
    Cuando elige el estado <estado> en el filtro de estado
    Entonces ve <visibles>
    Y el contador dice <contador>

    Ejemplos:
      | estado | visibles | contador |
      | «Validado» | REQ-001, REQ-003, REQ-006, REQ-007 y REQ-011 | «5 de 14 requisitos» |

  Esquema del escenario: Contraer todo deja visibles solo los requisitos raíz
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/<programa>/requirements en la pestaña «Árbol»
    Cuando pulsa «Contraer todo»
    Entonces ve solo <visibles>
    Y el contador dice «14 de 14 requisitos»

    Ejemplos:
      | programa | visibles |
      | PRG-001 | REQ-001, REQ-006 y REQ-011 |

  Esquema del escenario: Expandir todo despliega todas las ramas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil, abre /programs/PRG-001/requirements en la pestaña «Árbol» y ha pulsado «Contraer todo»
    Cuando pulsa «Expandir todo»
    Entonces ve los catorce requisitos, de REQ-001 a REQ-014

    Ejemplos:
      | programa |
      | PRG-001 |
```

## Decisiones pendientes
- Dónde se colocan el filtro por estado y los dos controles de expandir y contraer todo en la pantalla del móvil, y cómo se ve el filtro (por ejemplo, como desplegable, como botones o de otra forma). No está decidido.
- Si los textos de los controles son los de la web («Expandir todo», «Contraer todo», «Limpiar filtros» y «Quitar «Borrador»») o unos propios de la app. No está decidido.

## Fuera de alcance
- El filtro y el plegado completo de la web: esta misma épica (EP-REQ-ARBOL), en la historia de la web sobre la búsqueda y el filtro y en la del árbol.
- La búsqueda por código o título de la app móvil, que ya existe: esta misma épica, en la historia de la app sobre el árbol.
- Cambiar el estado de un requisito desde la app: EP-REQ-FLUJO.
