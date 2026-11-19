---
id: US-CAOS-RESET-013
tipo: historia
epica: EP-CAOS-RESET
titulo: "[Móvil] Modo caos en Administración"
etiquetas: [movil]
relacionadas: [US-CAOS-RESET-006, US-CAOS-RESET-011, US-CAOS-RESET-014]
verificacion: codigo
cubre: ["/admin"]
---

## Historia
Como administrador de un tenant que prueba desde el móvil, quiero fijar el modo caos desde la pestaña «Modo caos» de Administración, con los mismos rangos y textos que en la web,
para preparar el caos de una práctica sin usar un ordenador.

## Reglas
- La pestaña se abre con la ruta /admin?tab=chaos. Quien no es admin recibe el aviso «Tu rol no permite administrar el tenant», con el texto «Solo admin puede entrar en Administración.» y una acción para volver.
- Las pestañas de Administración son «Usuarios», «Auditoría», «Modo caos» y «Datos». La pestaña «Modo caos» muestra el título «Modo caos», la insignia «Caos activo» o «Caos apagado» según lo guardado, el texto de ayuda «Solo afecta a este tenant: latencia aleatoria, errores 500 en las escrituras y textos de botón que alternan. Se guarda al aplicar.», los dos controles de rango, el interruptor «Textos alternos («Guardar» / «Guardar cambios»)», los botones «Aplicar» y «Apagar caos», y el botón de ejemplo.
- Los controles de rango son «Latencia máxima», de 0 a 5000 ms en pasos de 100, y «Errores 500 en escrituras», de 0 a 100 % en pasos de 5. Se mueven con los botones «−» y «+» que hay junto a su valor; cada pulsación avanza un paso.
- «Aplicar» solo está activo con cambios. Sin cambios, el motivo «No hay cambios que guardar» aparece como texto visible junto al botón. Con cambios sin aplicar aparece el texto «Cambios sin aplicar».
- «Apagar caos» está deshabilitado, con el motivo «Caos apagado» como texto visible junto al botón, cuando el caos guardado está apagado y no hay cambios.
- «Aplicar» guarda el borrador y muestra el aviso «Modo caos actualizado» con el mismo cuerpo que en la web. Si guardar falla, aparece el aviso de error con la traza y el borrador se conserva.
- El botón de ejemplo muestra «Guardar» o «Guardar cambios», y alterna solo cuando los textos alternos están guardados. Al pulsarlo aparece un aviso informativo con el texto que tenía el botón en ese momento.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos`. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos. La fila empieza sin sesión guardada en la app salvo que diga otra cosa.

## Criterios de aceptación
```gherkin
Característica: Modo caos en la pestaña de Administración de la app móvil

  Esquema del escenario: Solo el admin ve la pestaña Modo caos
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y <cuenta> ha iniciado sesión en la app móvil con el tenant alumno01
    Cuando abre /admin?tab=chaos
    Entonces ve <resultado>

    Ejemplos:
      | cuenta | resultado |
      | gestor@sigpro.test | el aviso «Tu rol no permite administrar el tenant» |
      | alumno01@sigpro.lab | el título «Modo caos» con la insignia «Caos apagado» |

  Esquema del escenario: Aplicar guarda el modo caos fijado con los controles
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha iniciado sesión en la app móvil con el tenant alumno01 y tiene abierta la pestaña «Modo caos» de Administración
    Cuando pulsa «+» junto a «Latencia máxima» <pulsaciones_latencia> veces, pulsa «+» junto a «Errores 500 en escrituras» <pulsaciones_errores> veces, deja el interruptor «Textos alternos («Guardar» / «Guardar cambios»)» <interruptor> y pulsa «Aplicar»
    Entonces ve el aviso «Modo caos actualizado» con el cuerpo <cuerpo> y la insignia <insignia>

    Ejemplos:
      | pulsaciones_latencia | pulsaciones_errores | interruptor | cuerpo | insignia |
      | 4 | 10 | activado | «Latencia 400 ms · errores 50 % · textos alternos sí» | «Caos activo» |
      | 0 | 0 | activado | «Latencia 0 ms · errores 0 % · textos alternos sí» | «Caos activo» |

  Esquema del escenario: Apagar caos devuelve el modo a reposo y los motivos se ven como texto
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha aplicado latencia <latencia>, errores <errores> y textos alternos <textos> y tiene abierta la pestaña «Modo caos»
    Cuando pulsa «Apagar caos»
    Entonces ve el aviso «Modo caos actualizado» con el cuerpo «Latencia 0 ms · errores 0 % · textos alternos no» y la insignia «Caos apagado»
    Y «Apagar caos» queda deshabilitado con el motivo «Caos apagado» visible junto al botón

    Ejemplos:
      | latencia | errores | textos |
      | 400 | 50 | activos |
      | 0 | 100 | desactivados |

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

## Decisiones pendientes
- Si los botones «Guardar» de las demás pantallas móviles deben alternar con el modo caos. Hoy solo alterna el botón de ejemplo de esta pantalla; el resto de «Guardar» de la app no alterna.

## Fuera de alcance
- El reinicio de los datos desde la pestaña «Datos»: historia 014 de esta épica.
- Las pestañas «Usuarios» y «Auditoría», y el diálogo «Información del tenant»: EP-ADMIN-USUARIOS y EP-AUDITORIA.
- El modo caos en la web: historia 011 de esta épica.
- El contrato de la API del modo caos: historia 006 de esta épica.
