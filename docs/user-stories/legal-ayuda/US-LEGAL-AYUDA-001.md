---
id: US-LEGAL-AYUDA-001
tipo: historia
epica: EP-LEGAL-AYUDA
titulo: "[Web] Leer las páginas legales y la ayuda, con su contenido y su enlace de retorno"
etiquetas: [web]
relacionadas: [US-LEGAL-AYUDA-003]
verificacion: codigo
cubre: ["/legal/terms", "/legal/privacy", "/help"]
---

## Historia
Como persona con o sin cuenta en SIGPRO, quiero leer en la web los términos de uso, la política de privacidad y la ayuda, con su título, su introducción y sus secciones, y volver desde ellas a la pantalla de acceso o a Programas,
para saber qué es el laboratorio, qué se guarda de mí y cómo empezar sin pedir ayuda a nadie.

## Reglas
- Las tres páginas son `/legal/terms` (título «Términos de uso»), `/legal/privacy` (título «Política de privacidad») y `/help` (título «Ayuda»). Se leen sin sesión iniciada y también con sesión iniciada: no redirigen a ninguna otra ruta.
- Cada página muestra, en este orden: su título, su introducción, la línea «Última actualización: 1 de noviembre de 2026» y, debajo, sus secciones, cada una con su título y su texto.
- Las secciones de cada página, en orden, son:
  - Términos de uso: «1. Uso del laboratorio», «2. Cuentas y datos de prueba» y «3. Disponibilidad».
  - Política de privacidad: «1. Qué se guarda», «2. Cookies» y «3. Borrado».
  - Ayuda: «Acceso», «Tu tenant», «Atajos de teclado» y «Documentación de la API».
- La página de ayuda muestra, debajo de sus secciones, un enlace «Ir a /lab» que lleva a la página `/lab`. Las otras dos páginas no muestran ese enlace.
- El enlace de retorno de cada página es «Volver al acceso» si no hay sesión iniciada, y lleva a `/login`. Si hay sesión iniciada, es «Volver» y lleva a `/programs`. El enlace lleva siempre a esa ruta, aunque la página se haya abierto desde otra pantalla.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y el navegador se abre sin ninguna sesión de SIGPRO guardada. Cuando la fila describe a `gestor@sigpro.test` como persona que ha iniciado sesión, antes de abrir la página se inicia sesión en `/login?tenant=alumno01` con `gestor@sigpro.test` y `Gestor1234!`.

## Criterios de aceptación
```gherkin
Característica: Páginas legales y ayuda en la web

  Esquema del escenario: Las páginas se leen con y sin sesión iniciada, sin redirigir
    Dado que el tenant alumno01 está recién reiniciado y <persona> va a abrir una página
    Cuando abre <ruta>
    Entonces ve el título <titulo>
    Y sigue en <ruta>, sin llegar a /login ni a /programs

    Ejemplos:
      | persona | ruta | titulo |
      | una persona sin sesión iniciada | /legal/terms | «Términos de uso» |
      | una persona sin sesión iniciada | /legal/privacy | «Política de privacidad» |
      | una persona sin sesión iniciada | /help | «Ayuda» |
      | gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234! | /legal/terms | «Términos de uso» |
      | gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234! | /legal/privacy | «Política de privacidad» |
      | gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234! | /help | «Ayuda» |

  Esquema del escenario: Cada página muestra su título y su introducción
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en <ruta>
    Cuando mira la página
    Entonces ve el título <titulo> y, debajo, <introduccion>
    Y ve la línea «Última actualización: 1 de noviembre de 2026»

    Ejemplos:
      | ruta | titulo | introduccion |
      | /legal/terms | «Términos de uso» | (describe: SIGPRO es una aplicación ficticia para practicar la automatización de pruebas, y al usarla se aceptan estas condiciones) |
      | /legal/privacy | «Política de privacidad» | «SIGPRO no trata datos personales reales. Esta página describe qué se guarda en el navegador y en el servidor del laboratorio.» |
      | /help | «Ayuda» | «Resumen rápido para empezar a practicar con SIGPRO.» |

  Esquema del escenario: Cada página muestra sus secciones con su título y su texto
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en <ruta>
    Cuando mira la página
    Entonces ve la sección <seccion> con el texto <texto>

    Ejemplos:
      | ruta | seccion | texto |
      | /legal/terms | «1. Uso del laboratorio» | «El sistema es un entorno de práctica: los datos son inventados y pueden reiniciarse en cualquier momento, también de forma automática cada noche.» |
      | /legal/terms | «2. Cuentas y datos de prueba» | «Las cuentas de demostración son públicas. No introduzcas datos personales ni información real de ninguna organización.» |
      | /legal/terms | «3. Disponibilidad» | (describe: no se garantiza la disponibilidad del servicio, y se pueden activar, a propósito, latencia y errores) |
      | /legal/privacy | «1. Qué se guarda» | «En tu navegador: tema, idioma, tenant y, si lo pides, el token de sesión. En el servidor: los datos ficticios de tu tenant y el registro de auditoría de tus acciones.» |
      | /legal/privacy | «2. Cookies» | «Solo se usan almacenamientos técnicos necesarios para mantener la sesión y las preferencias. No hay cookies de terceros ni analítica.» |
      | /legal/privacy | «3. Borrado» | (describe: los datos del tenant se pueden reiniciar con el botón de reinicio de la página del laboratorio, y una tarea nocturna restaura todos los tenants) |
      | /help | «Acceso» | (describe: se pueden usar los usuarios de prueba de la pantalla de acceso y de la página del laboratorio, y el administrador pide un código de segundo factor de prueba) |
      | /help | «Tu tenant» | (describe: cada persona trabaja en su propio tenant, y los datos de los demás no se ven ni se modifican) |
      | /help | «Atajos de teclado» | «N crea un elemento nuevo en la pantalla actual, / enfoca la búsqueda y Esc cierra diálogos y menús.» |
      | /help | «Documentación de la API» | (describe: la referencia de la API está en /api/docs y puede protegerse con usuario y contraseña) |

  Esquema del escenario: El enlace «Ir a /lab» solo aparece en la ayuda
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada tiene abierta la página <ruta>
    Cuando mira la página completa
    Entonces <aparece> el enlace «Ir a /lab»

    Ejemplos:
      | ruta | aparece |
      | /legal/terms | no aparece |
      | /legal/privacy | no aparece |
      | /help | aparece |

  Esquema del escenario: Pulsar «Ir a /lab» lleva a la página del laboratorio
    Dado que el tenant alumno01 está recién reiniciado y <persona> tiene abierta la página /help
    Cuando pulsa «Ir a /lab»
    Entonces llega a /lab

    Ejemplos:
      | persona |
      | una persona sin sesión iniciada |
      | gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234! |

  Esquema del escenario: El enlace de retorno lleva a la pantalla de acceso o a Programas
    Dado que el tenant alumno01 está recién reiniciado y <persona>
    Cuando <llegada>
    Y pulsa <enlace>
    Entonces llega a <destino>

    Ejemplos:
      | persona | llegada | enlace | destino |
      | una persona sin sesión iniciada | abre /legal/terms directamente en el navegador | «Volver al acceso» | /login |
      | una persona sin sesión iniciada | abre /help directamente en el navegador | «Volver al acceso» | /login |
      | una persona sin sesión iniciada | pulsa «Condiciones» en el pie de /forgot | «Volver al acceso» | /login |
      | una persona sin sesión iniciada | pulsa «Privacidad» en el pie de /register | «Volver al acceso» | /login |
      | gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234! | abre /legal/privacy directamente en el navegador | «Volver» | /programs |
      | gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234! | abre /help directamente en el navegador | «Volver» | /programs |
```

## Decisiones pendientes
- En qué pantallas deben actuar los atajos N y / que describe la sección «Atajos de teclado»: el texto dice «en la pantalla actual», pero no está decidido en cuáles deben funcionar. Esta historia solo fija el texto y no prueba los atajos.

## Fuera de alcance
- El idioma y el tema de la cabecera de estas páginas: épicas «Idioma: español e inglés» (`i18n`) y «Tema claro y oscuro» (`tema`).
- La versión de estas páginas en la app móvil: US-LEGAL-AYUDA-003 de esta misma épica.
- El pie de la pantalla de acceso, con sus enlaces a estas páginas: US-LEGAL-AYUDA-002 de esta misma épica.
- Los enlaces «condiciones de uso» y «política de privacidad» de la casilla de condiciones del formulario de solicitud: épica de Solicitud de acceso y reenvío de la verificación.
- El contenido de la página `/lab` a la que lleva «Ir a /lab» (su FAQ y su reinicio de datos): épica de la página del laboratorio, todavía sin escribir.
