---
id: US-CAOS-RESET-010
tipo: historia
epica: EP-CAOS-RESET
titulo: "[Web] Aplicar y apagar el modo caos desde /lab"
etiquetas: [web]
relacionadas: [US-CAOS-RESET-006, US-CAOS-RESET-007, US-CAOS-RESET-011, US-CAOS-RESET-012]
verificacion: ejecutada
---

## Historia
Como alumno que prepara una práctica con caos, quiero fijar en /lab la latencia, la tasa de errores y los textos variables de mi tenant, y apagarlos con un botón,
para encender el caos justo antes de la práctica y dejarlo apagado después.

## Reglas
- La sección «Modo caos» tiene el campo «Latencia máxima (ms)», el campo «Tasa de errores 500 en escrituras (0–1)», la casilla «Textos de botón variables», el botón «Aplicar caos» y el botón «Desactivar caos». Su texto de ayuda dice «Solo afecta al tenant de la sesión. Latencia aleatoria, errores 500 en escrituras y textos de botón que alternan.».
- Con una sesión de admin, al abrir /lab los dos campos y la casilla muestran la configuración guardada del tenant.
- «Aplicar caos» guarda los tres valores tal como están en pantalla y muestra el aviso de éxito «Configuración de caos aplicada».
- «Desactivar caos» guarda latencia 0, tasa 0 y la casilla sin marcar, y muestra el mismo aviso.
- Un valor fuera de rango no se guarda: aparece el aviso de error «Ha ocurrido un error inesperado» con la traza de la petición, y lo guardado no cambia.
- Tras aplicar, la web vuelve a leer la configuración del tenant sin recargar la página. Esa lectura es la que usa el botón de ejemplo de la sección «Contraejemplos».
- Sin sesión de admin, los dos campos, la casilla y los dos botones están deshabilitados y, al pasar el ratón por ellos, aparece el motivo «Inicia sesión como admin para cambiar el modo caos.». Ese mismo motivo aparece con cualquier sesión que no sea de admin.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos`. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos. La fila empieza sin sesión guardada en el navegador salvo que diga otra cosa.

## Criterios de aceptación
```gherkin
Característica: Modo caos desde /lab

  Esquema del escenario: Aplicar guarda la configuración y se conserva al recargar
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha iniciado sesión en /login?tenant=alumno01 y ha abierto /lab
    Cuando escribe <latencia> en «Latencia máxima (ms)», <tasa> en «Tasa de errores 500 en escrituras (0–1)», deja la casilla «Textos de botón variables» <casilla> y pulsa «Aplicar caos»
    Entonces ve el aviso de éxito «Configuración de caos aplicada»
    Y al recargar /lab los campos muestran <latencia> y <tasa>, y la casilla queda <casilla>

    Ejemplos:
      | latencia | tasa | casilla |
      | 400 | 0.5 | marcada |
      | 0 | 0 | sin marcar |

  Esquema del escenario: Desactivar caos devuelve los campos a reposo
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha aplicado en /lab latencia <latencia>, tasa <tasa> y la casilla <casilla>
    Cuando pulsa «Desactivar caos»
    Entonces ve el aviso de éxito «Configuración de caos aplicada»
    Y los campos muestran 0 y 0, y la casilla queda sin marcar

    Ejemplos:
      | latencia | tasa | casilla |
      | 400 | 0.5 | marcada |
      | 0 | 1 | sin marcar |

  Esquema del escenario: Un valor fuera de rango no se guarda
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha iniciado sesión y ha abierto /lab
    Cuando escribe <valor> en <campo> y pulsa «Aplicar caos»
    Entonces ve el aviso de error «Ha ocurrido un error inesperado» con la traza de la petición
    Y al recargar /lab los campos muestran 0 y 0, y la casilla queda sin marcar

    Ejemplos:
      | campo | valor |
      | «Latencia máxima (ms)» | 5001 |
      | «Latencia máxima (ms)» | -1 |
      | «Tasa de errores 500 en escrituras (0–1)» | 1.5 |

  Esquema del escenario: Sin sesión de admin los controles del modo caos están deshabilitados
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y <sesion> está en /lab
    Cuando mira los controles del modo caos
    Entonces el campo «Latencia máxima (ms)», el campo «Tasa de errores 500 en escrituras (0–1)», la casilla «Textos de botón variables» y los botones «Aplicar caos» y «Desactivar caos» están deshabilitados, y al pasar el ratón por ellos aparece el motivo «Inicia sesión como admin para cambiar el modo caos.»

    Ejemplos:
      | sesion |
      | una persona sin sesión iniciada |
      | gestor@sigpro.test con sesión iniciada |

  Esquema del escenario: Tras aplicar los textos variables, el botón de ejemplo alterna sin recargar la página
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y <cuenta> ha iniciado sesión y ha abierto /lab
    Cuando deja la casilla «Textos de botón variables» marcada, deja la latencia y la tasa en 0 y pulsa «Aplicar caos»
    Entonces el botón de ejemplo de la sección «Contraejemplos» alterna entre «Guardar» y «Guardar cambios» sin recargar la página

    Ejemplos:
      | cuenta |
      | alumno01@sigpro.lab |
```

## Fuera de alcance
- El modo caos desde la pestaña «Modo caos» de Administración: historia 011 de esta épica.
- El efecto del caos en las peticiones de la API: historia 007 de esta épica.
- El contrato de la API del modo caos: historia 006 de esta épica.
- Los botones «Guardar» de las pantallas de Programas, Requisitos, No conformidades y Perfil: las épicas de cada módulo.
