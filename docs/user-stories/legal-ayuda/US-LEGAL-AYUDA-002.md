---
id: US-LEGAL-AYUDA-002
tipo: historia
epica: EP-LEGAL-AYUDA
titulo: "[Web] Llegar a las páginas legales y a la ayuda desde el pie de Acceso"
etiquetas: [web]
relacionadas: [US-LOGIN-006, US-LEGAL-AYUDA-004]
verificacion: codigo
---

## Historia
Como persona que todavía no ha iniciado sesión y está en una pantalla de acceso, quiero encontrar en el pie de esa pantalla los enlaces «Privacidad», «Condiciones» y «Ayuda»,
para leer la política de privacidad, los términos de uso o la ayuda antes de escribir mi correo y mi contraseña.

## Reglas
- En las pantallas de acceso `/login`, `/register` y `/forgot`, el pie muestra el texto «© 2026 SIGPRO» seguido de los enlaces «Privacidad», «Condiciones» y «Ayuda», en ese orden.
- «Privacidad» lleva a `/legal/privacy`, «Condiciones» lleva a `/legal/terms` y «Ayuda» lleva a `/help`. Cada enlace abre su página en la misma pestaña: no se abre ninguna pestaña nueva.
- Los tres enlaces se pueden usar sin sesión iniciada.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y el navegador se abre sin ninguna sesión de SIGPRO guardada. La fila indica la pantalla de acceso en la que empieza.

## Criterios de aceptación
```gherkin
Característica: Enlaces del pie de la pantalla de acceso en la web

  Esquema del escenario: Cada enlace del pie lleva a su página en la misma pestaña
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /login?tenant=alumno01
    Cuando pulsa <enlace> en el pie
    Entonces llega a <ruta> en la misma pestaña, sin abrir ninguna pestaña nueva
    Y ve el título <titulo>

    Ejemplos:
      | enlace | ruta | titulo |
      | «Privacidad» | /legal/privacy | «Política de privacidad» |
      | «Condiciones» | /legal/terms | «Términos de uso» |
      | «Ayuda» | /help | «Ayuda» |

  Esquema del escenario: El pie aparece en cada pantalla de acceso sin sesión iniciada
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en <pantalla>
    Cuando mira el pie de la pantalla
    Entonces ve el texto «© 2026 SIGPRO» seguido de los enlaces «Privacidad», «Condiciones» y «Ayuda», en ese orden

    Ejemplos:
      | pantalla |
      | /login?tenant=alumno01 |
      | /register |
      | /forgot |
```

## Decisiones pendientes
- Con sesión iniciada, la aplicación web no ofrece ningún enlace a la ayuda ni a estas páginas. La app móvil sí los ofrece en «Más». No está decidido si la web debe ofrecerlos ni en qué parte de la aplicación.

## Fuera de alcance
- El contenido de cada página y su enlace de retorno: US-LEGAL-AYUDA-001 de esta misma épica.
- El formulario de la pantalla de acceso y sus avisos: épica de Inicio y cierre de sesión. El panel «Usuarios de prueba»: épica de la API de plataforma y configuración.
- El idioma y el tema de la cabecera de la pantalla de acceso: épicas «Idioma: español e inglés» (`i18n`) y «Tema claro y oscuro» (`tema`).
- Los enlaces «condiciones de uso» y «política de privacidad» de la casilla de condiciones del formulario de solicitud: épica de Solicitud de acceso y reenvío de la verificación.
