---
id: US-MISION-FEED-002
tipo: historia
epica: EP-MISION-FEED
titulo: "[API] Entregar cada evento solo a las conexiones de su tenant"
etiquetas: [api]
relacionadas: [US-MISION-FEED-001, US-MISION-FEED-003, US-MISION-FEED-005]
verificacion: ejecutada
---

## Historia
Como persona que trabaja en un tenant de SIGPRO, quiero que el panel de misión solo muestre lo que pasa en mi tenant,
para no ver actividad de otras organizaciones aunque compartan la misma API.

## Reglas
- Cada conexión recibe solo los eventos del tenant que figura en su token. Un evento de un tenant nunca llega a una conexión de otro, aunque las dos estén abiertas a la vez.
- Cada tenant numera sus eventos con su propio `seq`, independiente del de los demás. Tras reiniciar un tenant, el primer evento que genera cualquier acción tiene `seq` 7, porque los seis primeros son su historia inicial (US-MISION-FEED-005).
- Un evento que se genera sin ninguna conexión abierta en su tenant se guarda en el historial de ese tenant, aunque no se entregue a nadie. El historial lo lee el resumen del panel.
- Preparación de cada fila: se reinician `alumno01` y `alumno02` con `POST /api/admin/reset` y los tokens de sus administradores (`alumno01@sigpro.lab` y `alumno02@sigpro.lab`, contraseña `Alumno1234!`), con la cabecera `x-tenant` de cada uno. Antes de la fila se comprueba que el caos de cada tenant está apagado. Se obtienen los `accessToken` de `gestor@sigpro.test` en `alumno01` y en `alumno02` con `POST /api/auth/login`, y se abre una conexión en tiempo real con cada uno. La API se arranca con `SIMULATOR_MS=0`.

## Criterios de aceptación
```gherkin
Característica: Aislamiento de los eventos entre tenants

  Esquema del escenario: Un evento solo llega a las conexiones de su tenant
    Dado que en los tenants alumno01 y alumno02, recién reiniciados, hay una conexión abierta con el accessToken de gestor@sigpro.test de cada uno
    Cuando <accion>
    Entonces la conexión de <escucha> <resultado>

    Ejemplos:
      | accion | escucha | resultado |
      | alumno01@sigpro.lab crea con POST /api/nc una no conformidad en alumno01 en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución` | alumno01 | recibe el evento nc_created con seq 7 y el código NC-013 |
      | alumno01@sigpro.lab crea con POST /api/nc una no conformidad en alumno01 en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución` | alumno02 | no recibe ningún evento durante la observación |
      | alumno02@sigpro.lab crea con POST /api/nc una no conformidad en alumno02 en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución` | alumno02 | recibe el evento nc_created con seq 7 y el código NC-013 |
      | alumno02@sigpro.lab crea con POST /api/nc una no conformidad en alumno02 en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución` | alumno01 | no recibe ningún evento durante la observación |
      | alumno01@sigpro.lab provoca un evento en alumno01 con POST /api/mission/tick | alumno02 | no recibe ningún evento durante la observación |
      | alumno01@sigpro.lab provoca un evento en alumno01 con POST /api/mission/tick | alumno01 | recibe el evento de origen simulator con seq 7 |
```

## Fuera de alcance
- Qué eventos existen, con qué forma y con qué cifras: esta épica, historia US-MISION-FEED-003.
- La secuencia del simulador y su encendido: esta épica, historia US-MISION-FEED-004.
- El aislamiento de los datos de las pantallas (listas, programas, tableros): EP-MULTITENANT-PERMISOS.
- El resumen `GET /api/mission/summary` con sus indicadores por tenant: EP-MISION-KPI.
