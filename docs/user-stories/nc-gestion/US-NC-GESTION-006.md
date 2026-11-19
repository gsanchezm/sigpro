---
id: US-NC-GESTION-006
tipo: historia
epica: EP-NC-GESTION
titulo: "[Web] Abrir una no conformidad desde el formulario de alta"
etiquetas: [web]
relacionadas: [US-NC-GESTION-001, US-NC-GESTION-002, US-NC-GESTION-010, US-NC-TABLERO-006]
verificacion: codigo
cubre: ["/nc"]
permisos: [nc.create]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero abrir una no conformidad desde la pantalla de No conformidades, eligiendo su programa y su severidad y describiendo la desviación,
para registrarla y verla contada entre las abiertas.

## Reglas
- «Nueva no conformidad» está habilitado para todos los roles, porque todos tienen el permiso `nc.create`. Abre el formulario «Nueva no conformidad» sobre /nc.
- El formulario tiene tres campos obligatorios, marcados con asterisco:
  - «Programa»: una lista con la opción «Elige un programa» y los programas del tenant, cada uno como «PRG-001 · nombre».
  - «Severidad»: tres opciones, «Menor», «Mayor» y «Crítica». Ninguna viene elegida.
  - «Descripción»: un editor con los controles «Negrita», «Cursiva» y «Lista», y el texto de ayuda «Describe la desviación detectada…».
- El formulario no ofrece persona responsable: la no conformidad se abre sin asignar. La asignación se edita después, en el detalle (US-NC-GESTION-007).
- Antes de enviar se validan los tres campos. Cada error aparece bajo su campo y, si faltan varios, aparecen todos a la vez:
  - sin programa: «Elige un programa»;
  - sin severidad: «Elige una severidad»;
  - descripción con menos de 10 caracteres de texto sin formato: «La descripción debe tener al menos 10 caracteres».
  Con algún error no se envía ninguna petición y el formulario sigue abierto.
- Con los tres campos válidos, el formulario se cierra, aparece el aviso «NC-013 abierta» (la primera alta tras el reinicio) y el recuento de la pantalla pasa de «12 no conformidades · 8 abiertas» a «13 no conformidades · 9 abiertas».
- «Cancelar» cierra el formulario sin enviar nada y el recuento no cambia.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona de la fila inicia sesión en /login?tenant=alumno01 en un navegador sin sesión de SIGPRO guardada, y abre /nc. Con el seed, la pantalla muestra «12 no conformidades · 8 abiertas».
- En los ejemplos, `(10 letras a)` es un texto de diez letras `a` seguidas, sin espacios, escrito en «Descripción»; `(9 letras a)` y `(12 espacios)` siguen el mismo criterio.

## Criterios de aceptación
```gherkin
Característica: Alta de una no conformidad en la web

  Esquema del escenario: Cada rol abre una no conformidad con datos válidos
    Dado que en el tenant alumno01, recién reiniciado, <correo> ha iniciado sesión en /login?tenant=alumno01 y está en /nc
    Cuando pulsa «Nueva no conformidad», elige el programa PRG-001 en «Programa», elige <severidad> en «Severidad» y escribe (10 letras a) en «Descripción»
    Y pulsa «Abrir no conformidad»
    Entonces ve el aviso «NC-013 abierta»
    Y el recuento muestra «13 no conformidades · 9 abiertas»

    Ejemplos:
      | correo | severidad |
      | gestor@sigpro.test | «Crítica» |
      | consultor@sigpro.test | «Menor» |
      | auditor@sigpro.test | «Mayor» |
      | alumno01@sigpro.lab | «Mayor» |

  Esquema del escenario: Cada campo obligatorio se valida antes de enviar
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto «Nueva no conformidad» sobre /nc
    Cuando rellena el formulario así: <combinacion>, y pulsa «Abrir no conformidad»
    Entonces ve el mensaje <mensaje> bajo su campo
    Y el formulario sigue abierto
    Y no se envía ninguna petición para abrir la no conformidad

    Ejemplos:
      | combinacion | mensaje |
      | sin programa, severidad «Menor» y descripción (10 letras a) | «Elige un programa» |
      | programa PRG-001, sin severidad y descripción (10 letras a) | «Elige una severidad» |
      | programa PRG-001, severidad «Menor» y descripción (9 letras a) | «La descripción debe tener al menos 10 caracteres» |
      | programa PRG-001, severidad «Menor» y descripción (12 espacios) | «La descripción debe tener al menos 10 caracteres» |
      | programa PRG-001, severidad «Menor» y descripción vacía | «La descripción debe tener al menos 10 caracteres» |

  Esquema del escenario: Sin rellenar nada, los tres mensajes aparecen a la vez
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto «Nueva no conformidad» sobre /nc
    Cuando <intento>
    Entonces ve «Elige un programa» bajo «Programa», «Elige una severidad» bajo «Severidad» y «La descripción debe tener al menos 10 caracteres» bajo «Descripción»
    Y no se envía ninguna petición para abrir la no conformidad

    Ejemplos:
      | intento |
      | pulsa «Abrir no conformidad» con el formulario vacío |

  Esquema del escenario: Cancelar no abre ninguna no conformidad
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto «Nueva no conformidad» sobre /nc con los tres campos rellenos
    Cuando <intento>
    Entonces el formulario se cierra
    Y el recuento sigue mostrando «12 no conformidades · 8 abiertas»

    Ejemplos:
      | intento |
      | pulsa «Cancelar» |
```

## Fuera de alcance
- El tablero, las tarjetas, los filtros y el movimiento entre columnas: EP-NC-TABLERO.
- La edición de la no conformidad y su asignación: US-NC-GESTION-007.
- La pantalla de alta de la app móvil: US-NC-GESTION-010.
- Los motivos que devuelve la API al rechazar el alta: US-NC-GESTION-002.
