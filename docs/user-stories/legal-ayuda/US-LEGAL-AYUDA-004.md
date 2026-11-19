---
id: US-LEGAL-AYUDA-004
tipo: historia
epica: EP-LEGAL-AYUDA
titulo: "[Móvil] Llegar a las páginas legales y a la ayuda desde el pie de Acceso y desde «Más»"
etiquetas: [movil]
relacionadas: [US-LOGIN-011, US-LEGAL-AYUDA-002]
verificacion: codigo
---

## Historia
Como persona que usa la app móvil, quiero llegar a la ayuda, a los términos de uso y a la política de privacidad desde el pie de la pantalla de acceso y, con sesión iniciada, desde la pestaña «Más»,
para leerlas sin escribir la dirección de cada página.

## Reglas
- En las pantallas de acceso de la app, `/login`, `/register` y `/forgot`, el pie muestra el texto «© 2026 SIGPRO» seguido de los enlaces «Privacidad», «Condiciones» y «Ayuda», en ese orden.
- «Privacidad» lleva a `/legal/privacy`, «Condiciones» lleva a `/legal/terms` y «Ayuda» lleva a `/help`. La página se abre sobre la pantalla desde la que se pulsó, y su enlace de retorno vuelve a esa pantalla.
- Con sesión iniciada, la pestaña «Más» muestra al final de su lista, para cualquier rol, los elementos «Ayuda», «Condiciones» y «Privacidad», en ese orden. Cada uno lleva a su página.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y la app se abre en el navegador (Expo web) sin ninguna sesión de SIGPRO guardada. Para las filas con sesión iniciada, antes se inicia sesión en `/login` con `alumno01` en «Tenant de trabajo» y la cuenta de la fila.

## Criterios de aceptación
```gherkin
Característica: Entrada a la ayuda y a las páginas legales en la app móvil

  Esquema del escenario: El pie de la pantalla de acceso lleva a cada página
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /login con alumno01 en «Tenant de trabajo»
    Cuando pulsa <enlace> en el pie
    Entonces llega a <ruta>
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
      | /login |
      | /register |
      | /forgot |

  Esquema del escenario: Con sesión iniciada, «Más» ofrece las tres páginas al final de su lista
    Dado que el tenant alumno01 está recién reiniciado y <persona>
    Cuando abre «Más»
    Entonces, al final de su lista, ve «Ayuda», «Condiciones» y «Privacidad», en ese orden

    Ejemplos:
      | persona |
      | gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234! |
      | consultor@sigpro.test, que ha iniciado sesión en alumno01 con Consul1234! |
      | auditor@sigpro.test, que ha iniciado sesión en alumno01 con Audit1234! |

  Esquema del escenario: Cada elemento de «Más» lleva a su página
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234!, tiene abierta la pestaña «Más»
    Cuando pulsa <elemento>
    Entonces llega a <ruta>
    Y ve el título <titulo>

    Ejemplos:
      | elemento | ruta | titulo |
      | «Ayuda» | /help | «Ayuda» |
      | «Condiciones» | /legal/terms | «Términos de uso» |
      | «Privacidad» | /legal/privacy | «Política de privacidad» |
```

## Fuera de alcance
- El resto de opciones de «Más» (búsqueda, documentos, auditoría, administración y perfil): épica de navegación de la app móvil, todavía sin escribir.
- El contenido de las páginas y su enlace de retorno: US-LEGAL-AYUDA-003 de esta misma épica.
- El formulario de la pantalla de acceso y sus avisos: épica de Inicio y cierre de sesión. El panel «Usuarios de prueba»: épica de la API de plataforma y configuración.
- Los enlaces «condiciones de uso» y «política de privacidad» de la casilla de condiciones del formulario de solicitud: épica de Solicitud de acceso y reenvío de la verificación.
- El idioma y el tema de la cabecera de la pantalla de acceso: épicas «Idioma: español e inglés» (`i18n`) y «Tema claro y oscuro» (`tema`).
