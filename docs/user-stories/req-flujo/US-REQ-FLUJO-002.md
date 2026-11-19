---
id: US-REQ-FLUJO-002
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[API] Rechazar con 409 invalid_transition un paso que la máquina de estados no tiene"
etiquetas: [api]
relacionadas: [US-REQ-FLUJO-001, US-REQ-FLUJO-003, US-REQ-FLUJO-004]
verificacion: codigo
cubre: ["POST /api/requirements/:code/transition"]
---

## Historia
Como cliente de la API, quiero que un paso que el flujo de estados no contempla se rechace con un código estable,
para que ningún requisito quede en una combinación de estados que el proceso no admite.

## Reglas
- Hay diez pares de estado de partida y de destino que la máquina no tiene:
  - el mismo estado: `draft` → `draft`, `approved` → `approved`, `verified` → `verified` y `validated` → `validated`;
  - saltos hacia delante de más de un estado: `draft` → `verified`, `draft` → `validated` y `approved` → `validated`;
  - retrocesos que no van a `draft`: `verified` → `approved`, `validated` → `verified` y `validated` → `approved`.
- Los límites de la escalera son estos: un paso hacia delante a un estado inmediatamente siguiente es válido; el mismo estado no lo es; saltar un estado no lo es; un paso atrás solo es válido si lleva a `draft`. Así, `validated` → `verified` (un estado atrás) es un 409, y `validated` → `draft` (de vuelta al borrador) es válido.
- Cada uno de esos pares responde 409 con `code` y `message` `invalid_transition`, y el requisito no cambia.
- El 409 no depende del permiso de la cuenta que prueba: `alumno01@sigpro.lab` (rol `admin`) puede dar todos los pasos válidos, así que aquí lo que falla es el paso.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, esa cuenta inicia sesión en `alumno01` con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken`. Tras el reinicio, `REQ-001` está en `approved`, `REQ-002` en `verified` y `REQ-003` en `validated` (en `PRG-001`), y `REQ-017` en `draft` (en `PRG-002`).

## Criterios de aceptación
```gherkin
Característica: Pasos que la máquina de estados no tiene

  Esquema del escenario: Un par de estados que el flujo no admite responde 409 y no cambia el estado
    Dado que en el tenant alumno01, recién reiniciado, <requisito> está en estado <desde> y alumno01@sigpro.lab ha iniciado sesión en ese tenant
    Cuando envía POST /api/requirements/<requisito>/transition con el cuerpo {"to": "<hasta>"}
    Entonces la respuesta es 409 con el código invalid_transition
    Y una lectura posterior de <requisito> devuelve el estado <desde>

    Ejemplos:
      | requisito | desde | hasta |
      | REQ-017 | draft | draft |
      | REQ-017 | draft | verified |
      | REQ-017 | draft | validated |
      | REQ-001 | approved | approved |
      | REQ-001 | approved | validated |
      | REQ-002 | verified | verified |
      | REQ-002 | verified | approved |
      | REQ-003 | validated | validated |
      | REQ-003 | validated | verified |
      | REQ-003 | validated | approved |
```

## Fuera de alcance
- Los pasos válidos que el rol sí puede dar, y los que no puede dar (403): en esta misma épica, en sus historias de la API.
- La lectura del requisito tras el intento, en el árbol y en el detalle: EP-REQ-ARBOL.

## Decisiones pendientes
- Qué responde la API cuando fallan a la vez el paso (409 `invalid_transition`) y el permiso del rol (403 `forbidden`) o cuando falla el permiso sobre un requisito que no existe. `docs/DECISIONS.md` fija 403 antes que 409 para las no conformidades «como en Requisitos»; el código de requisitos comprueba hoy el paso antes que el permiso y busca el requisito antes que el permiso. No está decidido cuál es el orden correcto, así que ninguna fila lo afirma.
