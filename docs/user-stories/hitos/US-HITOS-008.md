---
id: US-HITOS-008
tipo: historia
epica: EP-HITOS
titulo: "[Web] Mover el avance de un hito con el deslizador"
etiquetas: [web]
relacionadas: [US-HITOS-004, US-HITOS-006, US-HITOS-012]
verificacion: ejecutada
cubre: ["/programs/:code"]
permisos: [milestone.edit]
---

## Historia
Como gestor de programas que trabaja en la web, quiero mover el avance de un hito con su deslizador,
para registrar cuánto se ha avanzado y ver cuándo queda cumplido.

## Reglas
- Cada fila de hito tiene un deslizador de avance de 0 a 100 en pasos de 5, con el nombre «Avance de» seguido del nombre del hito (por ejemplo «Avance de PDR») y el valor «n %» junto a él.
- Cada cambio del deslizador se guarda una vez, cuando se confirma. El valor nuevo se muestra en el deslizador mientras se guarda. Si el servidor rechaza el cambio, el deslizador vuelve al valor anterior y aparece el aviso «No se pudo guardar el hito», con una línea técnica que esta historia no afirma.
- El estado de la fila sale de la respuesta del servidor: con un avance de 100 es «Cumplido», con un avance entre 1 % y 99 % es «En curso» y con 0 % es «Pendiente». Un avance de 100 deja el hito cumplido aunque venga de 0 %.
- Cada cambio guardado muestra el aviso «Hito actualizado» con «nombre del hito · avance n %».
- Tras cada cambio guardado, el recuento de la tabla y la cabecera del programa se actualizan: la barra de avance del programa muestra el nuevo porcentaje (hitos cumplidos sobre el total, redondeado).
- Datos del seed en `alumno01`, tras reiniciarlo: `PRG-001` tiene 9 hitos. SRR está cumplido, PDR va al 10 % y el resto al 0 %. El avance del programa es 11 % y el recuento «1 de 9 hitos cumplidos».
- Preparación de cada fila: en el tenant `alumno01`, se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada y se entra con `gestor@sigpro.test` (`Gestor1234!`) hasta llegar a `/programs`. Desde ahí se abre `/programs/PRG-001` y la pestaña «Hitos».
- Para la fila de error, la prueba responde 500 a `PATCH /api/milestones/PRG-001-M02` en el navegador antes de mover el deslizador.

## Criterios de aceptación
```gherkin
Característica: Deslizador de avance de los hitos en la web

  Esquema del escenario: Mover el deslizador guarda el avance y actualiza el estado, el recuento y la cabecera
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada y ha elegido la pestaña «Hitos» de PRG-001
    Cuando mueve el avance de <hito> a <valor>
    Entonces ve el aviso «Hito actualizado» con <aviso>, el estado de <hito> es <estado>, el recuento dice <recuento> y la cabecera del programa muestra <avance>%

    Ejemplos:
      | hito | valor | aviso | estado | recuento | avance |
      | «PDR» | 100 | «PDR · avance 100 %» | «Cumplido» | «2 de 9 hitos cumplidos» | 22 |
      | «PDR» | 95 | «PDR · avance 95 %» | «En curso» | «1 de 9 hitos cumplidos» | 11 |
      | «PDR» | 0 | «PDR · avance 0 %» | «Pendiente» | «1 de 9 hitos cumplidos» | 11 |
      | «SRR» | 90 | «SRR · avance 90 %» | «En curso» | «0 de 9 hitos cumplidos» | 0 |
      | «CDR» | 100 | «CDR · avance 100 %» | «Cumplido» | «2 de 9 hitos cumplidos» | 22 |

  Esquema del escenario: Un avance que el servidor rechaza vuelve al valor anterior
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en /programs con sesión iniciada, ha elegido la pestaña «Hitos» de PRG-001 y la prueba responde 500 a PATCH /api/milestones/PRG-001-M02 en el navegador
    Cuando mueve el avance de «PDR» a 60
    Entonces ve el aviso «No se pudo guardar el hito», el deslizador de «PDR» vuelve a 10 % y el estado de «PDR» sigue «En curso»

    Ejemplos:
      | hito |
      | PDR |
```

## Fuera de alcance
- El nombre y la fecha límite de un hito: EP-HITOS, en la historia de crear y editar en la tabla de la web.
- El borrado de un hito: EP-HITOS, en la historia de borrado de la web.
- La regla de avance que aplica la API, con sus valores válidos y sus permisos: EP-HITOS, en la historia de la API de avance.
- La ficha del programa, su cabecera y su resto de datos: EP-PROG-DETALLE.
