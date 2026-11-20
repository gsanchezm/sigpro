---
id: US-CAOS-RESET-011
tipo: historia
epica: EP-CAOS-RESET
titulo: "[Web] Modo caos en Administración"
etiquetas: [web]
relacionadas: [US-CAOS-RESET-005, US-CAOS-RESET-006, US-CAOS-RESET-010, US-CAOS-RESET-013]
verificacion: ejecutada
cubre: ["/admin"]
---

## Historia
Como administrador de un tenant, quiero fijar el modo caos desde la pestaña «Modo caos» de Administración, con deslizadores, un interruptor y un botón de ejemplo que muestra el efecto,
para ver qué cambia en la interfaz antes de aplicarlo y apagarlo con un botón.

## Reglas
- Solo el admin ve Administración. Quien tiene otro rol y abre /admin recibe el aviso «Tu rol no permite administrar el tenant», con el texto «Solo admin puede entrar en Administración.» y el enlace «Volver a Programas».
- La pestaña «Modo caos» se abre en /admin?tab=chaos y muestra:
  - el título «Modo caos» y, junto a él, la insignia «Caos activo» o «Caos apagado», según lo guardado y no según el borrador;
  - el texto de ayuda «Solo afecta a este tenant: latencia aleatoria, errores 500 en las escrituras y textos de botón que alternan. Se guarda al aplicar.»;
  - el deslizador «Latencia máxima», de 0 a 5000 ms en pasos de 100, con su valor en ms (por ejemplo, «400 ms»);
  - el deslizador «Errores 500 en escrituras», de 0 a 100 % en pasos de 5, con su valor en % (por ejemplo, «50 %»);
  - el interruptor «Textos alternos («Guardar» / «Guardar cambios»)»;
  - los botones «Aplicar» y «Apagar caos».
- «Aplicar» solo está activo cuando el borrador es distinto de lo guardado. Sin cambios, al pasar el ratón por el botón aparece el motivo «No hay cambios que guardar». Con un cambio sin aplicar aparece el texto «Cambios sin aplicar».
- «Aplicar» guarda el borrador y muestra el aviso «Modo caos actualizado» con un cuerpo que resume lo guardado: la latencia en ms, el porcentaje de errores y si los textos alternos están activos («sí» o «no»).
- «Apagar caos» guarda latencia 0, errores 0 y el interruptor apagado. Está deshabilitado, con el motivo «Caos apagado», cuando el caos guardado está apagado y no hay cambios.
- Si guardar falla, aparece el aviso de error con la traza de la petición y el borrador se conserva para corregirlo.
- Con los textos alternos guardados, el «Botón de ejemplo» de la pestaña alterna su texto entre «Guardar» y «Guardar cambios». La pestaña lo explica con el texto «Con los textos alternos activos, este botón cambia entre «Guardar» y «Guardar cambios».». Al pulsarlo aparece el aviso informativo «Has pulsado «Guardar»» o «Has pulsado «Guardar cambios»», según el texto que mostraba en ese momento.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos`. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos. La fila empieza sin sesión guardada en el navegador salvo que diga otra cosa.

## Criterios de aceptación
```gherkin
Característica: Modo caos en la pestaña de Administración

  Esquema del escenario: Solo el admin ve la pestaña Modo caos
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y <cuenta> ha iniciado sesión en /login?tenant=alumno01
    Cuando abre /admin?tab=chaos
    Entonces ve <resultado>

    Ejemplos:
      | cuenta | resultado |
      | gestor@sigpro.test | el aviso «Tu rol no permite administrar el tenant» |
      | consultor@sigpro.test | el aviso «Tu rol no permite administrar el tenant» |
      | auditor@sigpro.test | el aviso «Tu rol no permite administrar el tenant» |
      | alumno01@sigpro.lab | el título «Modo caos» con la insignia «Caos apagado» |

  Esquema del escenario: Aplicar el borrador guarda el modo caos y muestra su resumen
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha iniciado sesión en /login?tenant=alumno01 y ha abierto /admin?tab=chaos
    Cuando mueve «Latencia máxima» a <latencia>, «Errores 500 en escrituras» a <errores>, deja el interruptor «Textos alternos («Guardar» / «Guardar cambios»)» <interruptor> y pulsa «Aplicar»
    Entonces ve el aviso «Modo caos actualizado» con el cuerpo <cuerpo> y la insignia <insignia>

    Ejemplos:
      | latencia | errores | interruptor | cuerpo | insignia |
      | 400 | 50 | activado | «Latencia 400 ms · errores 50 % · textos alternos sí» | «Caos activo» |
      | 0 | 0 | activado | «Latencia 0 ms · errores 0 % · textos alternos sí» | «Caos activo» |

  Esquema del escenario: Apagar caos devuelve el modo a reposo
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha aplicado latencia <latencia>, errores <errores> y textos alternos <textos> y tiene abierta la pestaña «Modo caos»
    Cuando pulsa «Apagar caos»
    Entonces ve el aviso «Modo caos actualizado» con el cuerpo «Latencia 0 ms · errores 0 % · textos alternos no» y la insignia «Caos apagado»
    Y el deslizador «Latencia máxima» vuelve a 0 ms

    Ejemplos:
      | latencia | errores | textos |
      | 400 | 50 | activos |
      | 0 | 100 | sin activar |

  Esquema del escenario: El botón Aplicar depende de que haya cambios sin guardar
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha iniciado sesión y tiene abierta la pestaña «Modo caos»
    Cuando <accion>
    Entonces el botón «Aplicar» <aplicar> y <aviso>
    Y la insignia del modo caos muestra «Caos apagado»

    Ejemplos:
      | accion | aplicar | aviso |
      | no cambia ningún control | está deshabilitado con el motivo «No hay cambios que guardar» | no aparece el texto «Cambios sin aplicar» |
      | mueve «Latencia máxima» a 100 | está activo | aparece el texto «Cambios sin aplicar» |

  Esquema del escenario: El botón de ejemplo alterna solo con los textos alternos guardados
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha aplicado los textos alternos <estado> y tiene abierta la pestaña «Modo caos»
    Cuando observa el «Botón de ejemplo» y después lo pulsa
    Entonces su texto <comportamiento>
    Y al pulsarlo aparece el aviso informativo «Has pulsado «Guardar»» o «Has pulsado «Guardar cambios»», según el texto que mostraba

    Ejemplos:
      | estado | comportamiento |
      | activos | alterna entre «Guardar» y «Guardar cambios» |
      | desactivados | es siempre «Guardar» |
```

## Fuera de alcance
- Las pestañas «Usuarios» y «Auditoría» de Administración: EP-ADMIN-USUARIOS y EP-AUDITORIA.
- La pestaña «Datos» de Administración: historia 009 de esta épica.
- La pantalla /lab: historia 010 de esta épica.
- El contrato de la API del modo caos: historia 006 de esta épica.
