---
id: US-PROG-ALTA-014
tipo: historia
epica: EP-PROG-ALTA
titulo: "[Web] Avisar al equipo por correo al crear un programa"
etiquetas: [web, no-implementada]
relacionadas: [US-PROG-ALTA-001, US-PROG-ALTA-008, US-PROG-ALTA-012]
verificacion: no-ejecutable
---

## Historia
Como gestor de programas que da de alta un programa, quiero que el equipo del programa reciba un correo al crearlo,
para que sepa del nuevo programa sin tener que avisarle yo a mano.

## Reglas
- La opción «Notificar al equipo por correo», en el paso 3 del asistente de alta de la web, decide si el equipo del programa recibe un aviso por correo cuando se crea el programa. La app móvil ofrece la misma opción con el mismo texto.
- Con la opción activada, al crear el programa se envía un aviso por correo al equipo del programa.
- Con la opción desactivada, al crear el programa no se envía ningún aviso por correo.
- El programa se crea en los dos casos. El envío del aviso no cambia el resultado del alta.
- Hoy la aplicación no envía correos: la opción se puede cambiar y se envía a la API, pero no produce ningún envío. Esta historia describe lo mínimo acordado para cuando el aviso exista.
- Cuerpo base de los ejemplos: nombre `Programa de prueba alfa`, responsable Javier Ortega, inicio `2027-03-01`, fin `2027-03-02`, presupuesto `900000`, prioridad Alta y sin clasificar.

## Criterios de aceptación
```gherkin
Característica: Aviso por correo al equipo al crear un programa

  Esquema del escenario: La opción decide si el equipo recibe el aviso al crear el programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha completado el asistente de alta con los datos del cuerpo base y está en «Paso 3 de 3»
    Cuando deja «Notificar al equipo por correo» <opcion> y pulsa «Crear programa»
    Entonces <resultado>

    Ejemplos:
      | opcion | resultado |
      | activada | se envía un aviso por correo al equipo del programa y el programa queda creado |
      | desactivada | no se envía ningún aviso por correo y el programa queda creado |
```

## Fuera de alcance
- El alta del programa, sus datos y sus avisos de validación: EP-PROG-ALTA, historias de alta por la API, de asistente y de revisión en la web.
- La lista de los destinatarios del aviso, que todavía no está decidida: ver «Decisiones pendientes».

## Decisiones pendientes
- Quiénes forman «el equipo del programa»: el responsable, las personas que trabajan en el programa, todas las personas del tenant u otra lista.
- Contenido, asunto e idioma del correo.
- Si el mismo aviso debe salir también al editar un programa.
- Cómo se envía el aviso en el curso: correo real, correo simulado o registro visible dentro de la aplicación.
- Si la opción debe empezar activada o desactivada en el asistente.
- Qué ocurre si el envío del aviso falla después de crear el programa: si quien crea debe enterarse y cómo.
