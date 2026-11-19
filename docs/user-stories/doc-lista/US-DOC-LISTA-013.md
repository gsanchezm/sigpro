---
id: US-DOC-LISTA-013
tipo: historia
epica: EP-DOC-LISTA
titulo: "[Móvil] Filtrar la lista de documentos por programa y clasificación"
etiquetas: [movil, no-implementada]
relacionadas: [US-DOC-LISTA-002, US-DOC-LISTA-007, US-DOC-LISTA-011]
verificacion: no-ejecutable
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero acotar la lista de documentos por programa y por clasificación,
para encontrar los documentos de un programa sin escribir su código ni recorrer toda la lista.

## Reglas
- Hoy la lista de documentos de la app móvil solo tiene el buscador de texto por código o título. La API y la web sí permiten acotar la lista por programa y por clasificación: la paridad con la web es el requisito de esta historia.
- Con un programa elegido, la lista muestra solo los documentos de ese programa. Con una clasificación elegida, muestra solo los de esa clasificación. Con las dos, muestra los que cumplen ambas. El resultado es el mismo que el de la web.
- Qué control se usa, qué textos lleva, cómo se combina con el buscador y qué se ve cuando no hay coincidencias no está decidido: ver «Decisiones pendientes».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo»; `gestor@sigpro.test` (contraseña `Gestor1234!`) entra y llega a `/programs`, y después abre `/documents`.

## Criterios de aceptación
```gherkin
Característica: Filtros de programa y de clasificación en la app móvil

  Esquema del escenario: Acotar la lista por programa y clasificación muestra solo los documentos que cumplen ambos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y está en /documents
    Cuando elige <programa> como programa y <clasificacion> como clasificación
    Entonces ve solo los documentos <codigos>

    Ejemplos:
      | programa | clasificacion | codigos |
      | «PRG-002» | «Todas las clasificaciones» | DOC-003 y DOC-004 |
      | «Todos los programas» | «Restringido» | DOC-003, DOC-006, DOC-009 y DOC-012 |
      | «PRG-001» | «Restringido» | ninguno |
```

## Decisiones pendientes
- Qué control se usa para elegir el programa y la clasificación (desplegables, opciones en forma de chips o una hoja de opciones), y con qué textos.
- Si los filtros se combinan con el buscador de texto de la lista o si el buscador se vacía al elegir un filtro.
- Qué bloque se ve cuando ningún documento cumple los filtros. En la web es «Sin documentos» con el botón «Limpiar filtros», pero no está decidido que la app móvil deba mostrar lo mismo.
- Si la elección de programa y clasificación se conserva al salir de la lista y volver a ella.
