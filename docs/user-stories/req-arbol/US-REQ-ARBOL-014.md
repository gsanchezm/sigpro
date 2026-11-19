---
id: US-REQ-ARBOL-014
tipo: historia
epica: EP-REQ-ARBOL
titulo: "[Móvil] Copiar el código de un requisito y exportar el listado a CSV"
etiquetas: [movil, no-implementada]
relacionadas: [US-REQ-ARBOL-005, US-REQ-ARBOL-007, US-REQ-ARBOL-010]
verificacion: no-ejecutable
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona con una cuenta en SIGPRO que trabaja desde el móvil, quiero copiar el código de un requisito y descargar la lista de requisitos de un programa en CSV,
para pegar el código en otro sitio y tratar la lista fuera de SIGPRO, igual que en la web.

## Reglas
- Esta historia describe lo que la web ya hace y la app móvil todavía no tiene. La paridad con la web es el requisito; el comportamiento de la web está en las historias de la web que figuran en «relacionadas».
- Copiar el código: en la hoja de detalle de un requisito y en su fila del árbol hay un control para copiar el código del requisito. Al usarlo, el código queda copiado y aparece el aviso «Código copiado» con el texto «<código> está en el portapapeles». Si no se puede copiar, aparece el aviso «No se pudo copiar el código».
- Exportar CSV: la pestaña «Árbol» tiene un botón «Exportar CSV». Genera el mismo contenido que la web: la línea de cabecera `code;title;state;priority;parent;tags;tests` y una línea por cada requisito del programa, aunque haya búsqueda activa. Al terminar, aparece el aviso «CSV generado» con el texto «N filas exportadas».
- El botón «Exportar CSV» está deshabilitado cuando el programa no tiene requisitos.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app está en /login, sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo»; se escriben el correo y la contraseña de `gestor@sigpro.test` (`Gestor1234!`), se pulsa «Entrar» y se llega a Programas. Cada fila parte de un contexto nuevo.
- Tras un reinicio, `PRG-002` tiene 14 requisitos, y `REQ-017` es hijo de `REQ-015` y tiene la etiqueta Ciberseguridad.

## Criterios de aceptación
```gherkin
Característica: Copiar el código y exportar el listado de requisitos en la app móvil

  Esquema del escenario: Copiar el código de un requisito desde su hoja de detalle
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil, abre /programs/PRG-002/requirements y tiene abierta la hoja de <codigo>
    Cuando pulsa «Copiar código» en la hoja
    Entonces ve el aviso «Código copiado» con el texto <aviso>

    Ejemplos:
      | codigo | aviso |
      | REQ-017 | «REQ-017 está en el portapapeles» |

  Esquema del escenario: Exportar el listado a CSV entrega todos los requisitos del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/PRG-002/requirements en la pestaña «Árbol»
    Cuando pulsa «Exportar CSV»
    Entonces el archivo generado empieza por la línea code;title;state;priority;parent;tags;tests
    Y tiene 14 líneas de requisitos
    Y ve el aviso «CSV generado» con el texto «14 filas exportadas»

    Ejemplos:
      | programa |
      | PRG-002 |

  Esquema del escenario: Exportar CSV no está disponible en un programa sin requisitos
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil y abre /programs/<programa>/requirements en la pestaña «Árbol»
    Cuando mira el botón «Exportar CSV»
    Entonces el botón está deshabilitado

    Ejemplos:
      | programa |
      | PRG-004 |
```

## Decisiones pendientes
- Cómo se entrega el archivo CSV en el móvil: si con la hoja de compartir del sistema, que es la sustitución de las descargas que documenta `docs/MOBILE-PARITY.md`, u otra forma. No está decidido para esta funcionalidad.
- El texto del motivo cuando el botón «Exportar CSV» está deshabilitado. No está decidido.

## Fuera de alcance
- Copiar el código y exportar el CSV de la web: esta misma épica (EP-REQ-ARBOL), en la historia de la web sobre cifras, documento y CSV, y en la del detalle.
- La exportación de la lista de programas: EP-PROG-LISTA.
- Crear, editar o borrar requisitos desde la pantalla: EP-REQ-EDICION.
