---
id: US-NC-GESTION-005
tipo: historia
epica: EP-NC-GESTION
titulo: "[API] Cerrar una no conformidad con un comentario de cierre de al menos 20 caracteres"
etiquetas: [api]
relacionadas: [US-NC-GESTION-009, US-NC-GESTION-012, US-NC-GESTION-004, US-NC-TABLERO-003, US-NC-TABLERO-004, US-NC-TABLERO-005]
verificacion: codigo
cubre: ["POST /api/nc/:code/transition"]
permisos: [nc.close]
---

## Historia
Como administrador o gestor de programas, quiero cerrar una no conformidad explicando cómo se resolvió,
para que el cierre quede justificado y ninguna desviación se dé por resuelta con una frase vacía.

## Reglas
- Cerrar es pasar la no conformidad a `closed` con `POST /api/nc/:code/transition` y el cuerpo `{"to": "closed", "comment": "..."}`. El comentario de cierre es obligatorio.
- La longitud del comentario de cierre se cuenta sin los espacios del principio y del final. Debe tener al menos **20 caracteres**: con 19, se rechaza; con 20, se acepta; con 21, se acepta. Si tras recortar no queda texto, el motivo es `closureRequired`; si tiene entre 1 y 19 caracteres, `closureShort`. Ambos motivos van en `comment`.
- El texto sin recortar puede tener como máximo 1000 caracteres. Con más, responde 422 `validation_failed` con `commentLong` en `comment`.
- Solo se puede cerrar desde «Acción correctiva» (`corrective_action`). Desde cualquier otro estado responde 409 `invalid_transition`, y la no conformidad no cambia.
- El permiso para cerrar es `nc.close`: lo tienen `admin` y `program_manager`. Los roles `consultant` y `auditor` reciben 403 `forbidden`.
- El orden de las comprobaciones es: primero el rol (403), después el paso de la máquina de estados (409) y por último el comentario de cierre (422).
- La respuesta es 200 con la no conformidad en `state` `closed` y sin estados a los que pasar (`transitions` vacío). El comentario queda guardado como comentario de tipo `closure`, con su texto ya recortado y con la persona que cerró como autora.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, cada cuenta obtiene su token con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y `alumno01@sigpro.lab` (`Alumno1234!`). Según el seed, NC-001 está «Abierta», NC-002 «En análisis», NC-003 «Acción correctiva» y NC-004 «Cerrada».
- En los ejemplos, `(N letras a)` es un texto de N letras `a` seguidas, sin espacios; `(un espacio, N letras a y un espacio)` lleva un espacio delante y otro detrás.

## Criterios de aceptación
```gherkin
Característica: Cierre de una no conformidad por la API

  Esquema del escenario: El comentario de cierre debe tener al menos 20 caracteres tras recortar los espacios
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc/NC-003/transition con x-tenant alumno01, ese token, el paso a closed y el comentario <comentario>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | comentario | respuesta |
      | (19 letras a) | 422 validation_failed con el motivo closureShort en comment |
      | (20 letras a) | 200 con state closed |
      | (21 letras a) | 200 con state closed |
      | (un espacio, 19 letras a y un espacio) | 422 validation_failed con el motivo closureShort en comment |
      | (un espacio, 20 letras a y un espacio) | 200 con state closed |
      | (3 espacios) | 422 validation_failed con el motivo closureRequired en comment |
      | (vacío) | 422 validation_failed con el motivo closureRequired en comment |
      | (sin el campo) | 422 validation_failed con el motivo closureRequired en comment |

  Esquema del escenario: Un comentario de cierre de hasta mil caracteres se acepta y uno mayor no
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc/NC-003/transition con x-tenant alumno01, ese token, el paso a closed y el comentario <comentario>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | comentario | respuesta |
      | (1000 letras a) | 200 con state closed |
      | (1001 letras a) | 422 validation_failed con el motivo commentLong en comment |

  Esquema del escenario: Solo admin y program_manager pueden cerrar
    Dado que en el tenant alumno01, recién reiniciado, <correo> inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc/NC-003/transition con x-tenant alumno01, su token, el paso a closed y el comentario (20 letras a)
    Entonces la respuesta es <respuesta>
    Y NC-003 queda en <estado>

    Ejemplos:
      | correo | respuesta | estado |
      | alumno01@sigpro.lab | 200 con state closed | closed |
      | gestor@sigpro.test | 200 con state closed | closed |
      | consultor@sigpro.test | 403 forbidden | corrective_action |
      | auditor@sigpro.test | 403 forbidden | corrective_action |

  Esquema del escenario: El orden de las comprobaciones es rol, paso y comentario
    Dado que en el tenant alumno01, recién reiniciado, <correo> inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc/<codigo>/transition con x-tenant alumno01, su token, el paso a closed y el comentario <comentario>
    Entonces la respuesta es <respuesta>
    Y la no conformidad no cambia de estado

    Ejemplos:
      | codigo | correo | comentario | respuesta |
      | NC-003 | consultor@sigpro.test | (19 letras a) | 403 forbidden |
      | NC-001 | consultor@sigpro.test | (20 letras a) | 403 forbidden |
      | NC-001 | gestor@sigpro.test | (20 letras a) | 409 invalid_transition |
      | NC-001 | gestor@sigpro.test | (vacío) | 409 invalid_transition |
      | NC-002 | gestor@sigpro.test | (19 letras a) | 409 invalid_transition |
      | NC-002 | gestor@sigpro.test | (20 letras a) | 409 invalid_transition |
      | NC-004 | gestor@sigpro.test | (20 letras a) | 409 invalid_transition |

  Esquema del escenario: El comentario de cierre queda guardado como comentario de cierre y recortado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test inicia sesión con POST /api/auth/login
    Cuando envía POST /api/nc/NC-003/transition con x-tenant alumno01, ese token, el paso a closed y el comentario <comentario>
    Entonces la respuesta es 200 con state closed y transitions vacío
    Y el último comentario de NC-003 tiene kind closure, body <guardado> y authorName Javier Ortega

    Ejemplos:
      | comentario | guardado |
      | (un espacio, 20 letras a y un espacio) | (20 letras a) |
```

## Fuera de alcance
- Los demás pasos de estado (en análisis, acción correctiva, rechazo y reapertura): EP-NC-TABLERO.
- La pantalla del cierre en la web, con su contador y su diálogo, y en la app móvil: US-NC-GESTION-009 y US-NC-GESTION-012.
- Los registros de auditoría del cierre: EP-AUDITORIA.

## Decisiones pendientes
- Qué respuesta se da cuando el rol no tiene permiso y la no conformidad no existe: hoy se responde 404, porque la no conformidad se busca antes de comprobar el rol, mientras que en la edición y en los comentarios el 403 llega antes. Esta historia no fija ese caso.
