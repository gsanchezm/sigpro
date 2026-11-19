---
id: US-NC-TABLERO-004
tipo: historia
epica: EP-NC-TABLERO
titulo: "[API] Permitir el paso solo a los roles con el permiso nc.transition"
etiquetas: [api]
relacionadas: [US-NC-TABLERO-003, US-NC-TABLERO-008, US-NC-TABLERO-009]
verificacion: codigo
cubre: ["POST /api/nc/:code/transition"]
permisos: [nc.transition]
---

## Historia
Como responsable de la gestión de riesgos del tenant, quiero que solo los roles que operan las no conformidades puedan moverlas de estado,
para que quien solo audita pueda leerlas y comentarlas sin alterar su ciclo.

## Reglas
- El permiso `nc.transition` lo tienen `admin`, `program_manager` y `consultant`. El rol `auditor` no lo tiene: puede leer el tablero y el detalle, pero no dar ningún paso.
- Un rol sin `nc.transition` que envía un paso recibe 403 `forbidden`, con la no conformidad sin cambios. Es así también cuando el paso no estaría admitido por la máquina de estados.
- El rol se comprueba antes que la máquina de estados: un rol sin permiso recibe 403 aunque el paso sea uno que la máquina no admite, y un rol con permiso que pide un paso no admitido recibe 409 `invalid_transition`.
- El permiso no cambia lo que la máquina admite: un rol con `nc.transition` sigue sin poder dar un paso que la máquina no admite.
- Esta historia no prueba el paso a `closed`, que además exige `nc.close` (EP-NC-GESTION).
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token del administrador del tenant. Después, cada cuenta de la fila inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa el `accessToken` que recibe: `auditor@sigpro.test` (`Audit1234!`), `consultor@sigpro.test` (`Consul1234!`), `gestor@sigpro.test` (`Gestor1234!`) o `alumno01@sigpro.lab` (`Alumno1234!`, rol admin, sin segundo factor).

## Criterios de aceptación
```gherkin
Característica: Permiso para dar pasos de una no conformidad por la API

  Esquema del escenario: Solo los roles con nc.transition dan un paso admitido
    Dado que en el tenant alumno01, recién reiniciado, NC-001 está en open y la cuenta <cuenta> tiene un accessToken
    Cuando envía POST /api/nc/NC-001/transition con x-tenant alumno01, ese accessToken y to in_analysis
    Entonces la respuesta es <respuesta>
    Y GET /api/nc/NC-001 devuelve state <estado>

    Ejemplos:
      | cuenta | respuesta | estado |
      | auditor@sigpro.test | 403 forbidden | open |
      | consultor@sigpro.test | 200 con state in_analysis | in_analysis |
      | gestor@sigpro.test | 200 con state in_analysis | in_analysis |
      | alumno01@sigpro.lab | 200 con state in_analysis | in_analysis |

  Esquema del escenario: El rol se comprueba antes que la máquina de estados
    Dado que en el tenant alumno01, recién reiniciado, NC-001 está en open y la cuenta <cuenta> tiene un accessToken
    Cuando envía POST /api/nc/NC-001/transition con x-tenant alumno01, ese accessToken, to rejected y sin el campo comment
    Entonces la respuesta es <respuesta>
    Y GET /api/nc/NC-001 devuelve state open

    Ejemplos:
      | cuenta | respuesta |
      | auditor@sigpro.test | 403 forbidden |
      | consultor@sigpro.test | 409 invalid_transition |
```

## Decisiones pendientes
- Hoy, con un código de no conformidad que no existe, la respuesta es 404 `nc_not_found` también para el rol auditor, porque la búsqueda de la no conformidad va antes que la comprobación del permiso. No está decidido si ese caso debe responder 403. Ninguna fila de esta historia lo afirma.

## Fuera de alcance
- El cierre de una no conformidad, que exige `nc.close` además de su comentario de cierre: EP-NC-GESTION.
- Los pasos admitidos y no admitidos por la máquina de estados, para todos los roles con permiso: US-NC-TABLERO-003.
- Los cuerpos no válidos y las no conformidades inexistentes: US-NC-TABLERO-005.
- Los botones y los avisos de permiso de la web y de la app móvil: US-NC-TABLERO-008, US-NC-TABLERO-009 y US-NC-TABLERO-011.
