---
id: US-MISION-FEED-009
tipo: historia
epica: EP-MISION-FEED
titulo: "[Móvil] Ver los eventos en directo en /mission: historia inicial, pausa y tope de 50"
etiquetas: [movil]
relacionadas: [US-MISION-FEED-001, US-MISION-FEED-003, US-MISION-FEED-005, US-MISION-FEED-006]
verificacion: codigo
cubre: ["/mission"]
---

## Historia
Como persona con una sesión iniciada en la app móvil de SIGPRO, quiero ver en /mission los eventos de mi tenant según ocurren, con el más reciente arriba y la posibilidad de congelar la lista,
para seguir la actividad desde el teléfono sin recargar la pantalla y leer lo que pasó sin que la lista se mueva.

## Reglas
- La sección «Eventos en directo» muestra primero el historial del tenant, con el evento más reciente arriba. El contador «N eventos» indica cuántas filas se ven.
- Un evento que llega por la conexión en tiempo real aparece arriba del todo sin recargar la pantalla, y el contador sube en 1, salvo que la lista esté en pausa.
- Cada fila muestra su gravedad, su texto (el texto de su tipo con sus valores) y su hora.
- «Pausar feed» congela la lista. Los eventos que llegan durante la pausa no se ven: se cuentan en el aviso de pausa. «Reanudar feed» muestra todos los eventos, pone el contador al día y quita el aviso.
- La lista muestra como máximo 50 eventos. Cuando hay 51, el más antiguo deja de verse.
- Mientras la lista no tiene ningún evento, muestra «Esperando eventos…».
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y antes de la fila se comprueba que el caos del tenant está apagado. Después se abre `/login` en la app sin ninguna sesión de SIGPRO guardada en el dispositivo, se escribe `alumno01` en «Tenant de trabajo», se inicia sesión con `gestor@sigpro.test` (`Gestor1234!`) y se abre `/mission`. Los eventos que se provocan se hacen con `POST /api/mission/tick` y el token de `alumno01@sigpro.lab`, y las no conformidades con `POST /api/nc`. La API se arranca con `SIMULATOR_MS=0`.

## Criterios de aceptación
```gherkin
Característica: Feed en directo en la app móvil

  Esquema del escenario: Al abrir /mission aparece la historia inicial, con el evento más reciente arriba
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app y ha abierto /mission sin provocar ningún evento
    Cuando mira la posición <posicion> de la lista «Eventos en directo»
    Entonces ve el texto <texto>
    Y el contador dice «6 eventos»

    Ejemplos:
      | posicion | texto |
      | 1 | «Pérdida de enlace con PRG-004 durante 5 s» |
      | 6 | «Enlace de datos PRG-001: latencia 20 ms» |

  Esquema del escenario: Un evento nuevo aparece arriba sin recargar la pantalla
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto con la historia inicial
    Cuando alumno01@sigpro.lab provoca <n> eventos con POST /api/mission/tick
    Entonces la primera fila de la lista dice <texto_primero>
    Y el contador dice <contador>

    Ejemplos:
      | n | texto_primero | contador |
      | 1 | «Telemetría PRG-013: 766 paquetes/s» | «7 eventos» |
      | 2 | «Latido del centro de control (T+7)» | «8 eventos» |

  Esquema del escenario: Con la lista en pausa, los eventos nuevos esperan fuera de la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto con la historia inicial
    Cuando pulsa «Pausar feed» y alumno01@sigpro.lab provoca <n> eventos con POST /api/mission/tick
    Entonces la lista sigue con 6 filas y el contador dice «6 eventos»
    Y el aviso de pausa dice <aviso>
    Y el botón dice «Reanudar feed»

    Ejemplos:
      | n | aviso |
      | 0 | «Feed en pausa: los eventos nuevos se guardan y aparecerán al reanudar.» |
      | 2 | «Feed en pausa: los eventos nuevos se guardan y aparecerán al reanudar. 2 eventos nuevos en espera» |
      | 3 | «Feed en pausa: los eventos nuevos se guardan y aparecerán al reanudar. 3 eventos nuevos en espera» |

  Esquema del escenario: Al reanudar, la lista muestra lo que llegó durante la pausa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto con la historia inicial, ha pulsado «Pausar feed» y alumno01@sigpro.lab ha provocado <n> eventos con POST /api/mission/tick
    Cuando pulsa «Reanudar feed»
    Entonces la primera fila de la lista dice <texto_primero>
    Y el contador dice <contador>
    Y el aviso de pausa ya no aparece

    Ejemplos:
      | n | texto_primero | contador |
      | 2 | «Latido del centro de control (T+7)» | «8 eventos» |
      | 3 | «Enlace de datos PRG-001: latencia 76 ms» | «9 eventos» |

  Esquema del escenario: La lista muestra como máximo 50 eventos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene /mission abierto con la historia inicial
    Cuando alumno01@sigpro.lab provoca <n> eventos con POST /api/mission/tick
    Entonces el contador dice <contador>
    Y el evento «Enlace de datos PRG-001: latencia 20 ms» <visibilidad> en la lista

    Ejemplos:
      | n | contador | visibilidad |
      | 43 | «49 eventos» | sigue |
      | 44 | «50 eventos» | sigue |
      | 45 | «50 eventos» | ya no aparece |

  Esquema del escenario: La lista dice «Esperando eventos…» solo mientras no tiene ningún evento
    Dado que en el tenant alumno01, recién reiniciado, la prueba responde con un error 503 a GET /api/mission/summary en el navegador de la app, y gestor@sigpro.test ha iniciado sesión y ha abierto /mission
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | la prueba no provoca ningún evento | la lista está vacía y muestra «Esperando eventos…» |
      | alumno01@sigpro.lab provoca un evento con POST /api/mission/tick | la lista muestra «Telemetría PRG-013: 766 paquetes/s» y ya no muestra «Esperando eventos…» |
```

## Fuera de alcance
- Las cifras del panel («NC abiertas», «Hitos cumplidos») y sus gráficas en vivo: US-MISION-FEED-010.
- El indicador de conexión, el botón «Reintentar» y el resumen tras una caída: US-MISION-FEED-011.
- La forma de los eventos y las cifras que llevan: US-MISION-FEED-003.
- El aviso de error del resumen, los indicadores estáticos, el botón de emitir un evento de prueba y el endpoint `POST /api/mission/tick`: EP-MISION-KPI.
- La campana de avisos y la preferencia «Notificaciones en tiempo real» del Perfil: EP-NAVEGACION y EP-PERFIL.

## Decisiones pendientes
- El catálogo de textos escribe «1 eventos» y «1 eventos nuevos en espera» (plural fijo, sin concordancia con uno). Hoy con un solo evento la pantalla muestra esas formas; las pruebas usan cifras distintas de uno. Esto describe lo que existe; no decide si el texto debe corregirse.
