---
id: US-MISION-FEED-005
tipo: historia
epica: EP-MISION-FEED
titulo: "[API] Reiniciar el tenant devuelve el feed a su historia inicial"
etiquetas: [api]
relacionadas: [US-MISION-FEED-002, US-MISION-FEED-004]
verificacion: ejecutada
---

## Historia
Como quien prepara las pruebas del panel de misión, quiero que reiniciar un tenant deje su feed como estaba al cargar el seed,
para que ningún evento de datos que ya no existen aparezca en la siguiente prueba.

## Reglas
- La historia inicial de un tenant son seis eventos de origen `simulator`, con `seq` del 1 al 6, de los tipos `link`, `milestone`, `thermal`, `telemetry`, `test_pass` y `link_lost`, en ese orden. Sus textos son fijos: el primero es un enlace de datos de `PRG-001` y el último, una pérdida de enlace con `PRG-004`.
- La historia inicial se crea la primera vez que se pide el historial del tenant o se genera un evento en él. Después no cambia, salvo por los eventos nuevos.
- Reiniciar el tenant con `POST /api/admin/reset` borra todos sus eventos. El historial vuelve a ser la historia inicial, y la numeración vuelve a empezar: el siguiente evento que se genere tiene `seq` 7.
- Reiniciar un tenant no cambia el historial de ningún otro tenant.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`, y antes de la fila se comprueba que el caos del tenant está apagado. Los eventos previos se provocan después de ese reinicio, con `POST /api/nc` (una no conformidad en PRG-002, severidad minor, descripción `Desviación de prueba en la ejecución`) y con `POST /api/mission/tick`, ambos con el token de `alumno01@sigpro.lab`. El historial se lee con `GET /api/mission/summary` (campo `recent`) y el token de `gestor@sigpro.test` (`Gestor1234!`). La API se arranca con `SIMULATOR_MS=0`.

## Criterios de aceptación
```gherkin
Característica: Historia inicial del feed tras un reinicio

  Esquema del escenario: Tras reiniciar, el historial vuelve a la historia inicial y la numeración empieza de nuevo
    Dado que en el tenant alumno01, recién reiniciado, se han provocado <previos>
    Cuando alumno01@sigpro.lab reinicia el tenant con POST /api/admin/reset y después se lee el historial
    Entonces el historial tiene 6 eventos, el más reciente con seq 6, y ninguno de los eventos provocados antes aparece
    Y el siguiente evento que se genere tiene seq <siguiente_seq>

    Ejemplos:
      | previos | siguiente_seq |
      | ningún evento | 7 |
      | una no conformidad creada con POST /api/nc (seq 7) | 7 |
      | tres no conformidades creadas con POST /api/nc (seq 7 a 9) y un evento provocado con POST /api/mission/tick (seq 10) | 7 |
```

## Fuera de alcance
- El resto de lo que restaura el reinicio (datos del seed, sesiones y modo caos): EP-CAOS-RESET.
- El resumen `GET /api/mission/summary` con sus indicadores: EP-MISION-KPI.
- La entrega de eventos a las conexiones abiertas: esta épica, historia US-MISION-FEED-002.
