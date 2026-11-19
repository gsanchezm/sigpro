---
id: US-NC-GESTION-010
tipo: historia
epica: EP-NC-GESTION
titulo: "[Móvil] Abrir una no conformidad desde el diálogo de alta"
etiquetas: [movil]
relacionadas: [US-NC-GESTION-001, US-NC-GESTION-002, US-NC-GESTION-006, US-NC-GESTION-011, US-NC-TABLERO-010]
verificacion: ejecutada
cubre: ["/nc"]
permisos: [nc.create]
---

## Historia
Como persona con una cuenta en la app móvil de SIGPRO, quiero abrir una no conformidad desde /nc con los mismos campos que en la web,
para registrar una desviación desde el móvil y verla contada entre las abiertas.

## Reglas
- El botón «Nueva no conformidad», en la cabecera de /nc, está habilitado para todos los roles, porque todos tienen el permiso `nc.create`.
- El diálogo «Nueva no conformidad» tiene los mismos tres campos que la web:
  - «Programa»: una lista con la opción «Elige un programa» y los programas del tenant, cada uno como «PRG-001 · nombre»;
  - «Severidad»: tres opciones, «Menor», «Mayor» y «Crítica». Ninguna viene elegida;
  - «Descripción»: un campo de varias líneas con el texto de ayuda «Describe la desviación detectada…».
  Debajo del campo de descripción aparece el aviso «Un párrafo por línea. El formato (negrita, listas) se pierde al editar el texto.»
- Mientras cargan los programas, «Abrir no conformidad» está deshabilitado con la explicación «Cargando programas…».
- Antes de enviar se validan los campos con las mismas reglas y los mismos mensajes que la web, bajo cada campo: «Elige un programa», «Elige una severidad» y «La descripción debe tener al menos 10 caracteres». Con algún error no se envía nada y el diálogo sigue abierto.
- Con los tres campos válidos, el diálogo se cierra, aparece el aviso «NC-013 abierta» (la primera alta tras el reinicio) y el recuento pasa a «13 no conformidades · 9 abiertas».
- El alta no ofrece persona responsable: la no conformidad se abre sin asignar.
- «Cancelar» cierra el diálogo sin crear nada.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona de la fila abre la app en /login con `alumno01` en «Tenant de trabajo», inicia sesión y llega a /nc. Con el seed, el recuento es «12 no conformidades · 8 abiertas».
- En los ejemplos, `(10 letras a)` es un texto de diez letras `a` seguidas, sin espacios, escrito en «Descripción»; `(sin elegir)` significa que el campo se deja sin elegir o vacío.

## Criterios de aceptación
```gherkin
Característica: Alta de una no conformidad en la app móvil

  Esquema del escenario: Cada rol abre una no conformidad con datos válidos
    Dado que en el tenant alumno01, recién reiniciado, <correo> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y está en /nc
    Cuando pulsa «Nueva no conformidad», elige el programa PRG-001 en «Programa», elige <severidad> en «Severidad», escribe (10 letras a) en «Descripción» y pulsa «Abrir no conformidad»
    Entonces ve el aviso «NC-013 abierta»
    Y el recuento muestra «13 no conformidades · 9 abiertas»

    Ejemplos:
      | correo | severidad |
      | gestor@sigpro.test | «Crítica» |
      | auditor@sigpro.test | «Menor» |

  Esquema del escenario: Cada campo obligatorio se valida antes de enviar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y tiene abierto «Nueva no conformidad» desde /nc
    Cuando rellena el formulario así: <combinacion>, y pulsa «Abrir no conformidad»
    Entonces ve el mensaje <mensaje> bajo su campo
    Y el diálogo sigue abierto
    Y no se envía ninguna petición para abrir la no conformidad

    Ejemplos:
      | combinacion | mensaje |
      | programa (sin elegir), severidad «Mayor» y descripción (10 letras a) | «Elige un programa» |
      | programa PRG-001, severidad (sin elegir) y descripción (10 letras a) | «Elige una severidad» |
      | programa PRG-001, severidad «Mayor» y descripción (9 letras a) | «La descripción debe tener al menos 10 caracteres» |
      | programa PRG-001, severidad «Mayor» y descripción (sin elegir) | «La descripción debe tener al menos 10 caracteres» |
```

## Fuera de alcance
- La edición de la no conformidad y su asignación desde el detalle: US-NC-GESTION-011.
- La pantalla de alta de la web: US-NC-GESTION-006.
- Los motivos que devuelve la API al rechazar el alta: US-NC-GESTION-002.
- El tablero, sus tarjetas, sus filtros y el cambio de estado: EP-NC-TABLERO.
- El formato enriquecido de la descripción, que la app móvil no tiene: US-NC-GESTION-013.
