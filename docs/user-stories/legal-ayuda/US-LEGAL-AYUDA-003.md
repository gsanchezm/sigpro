---
id: US-LEGAL-AYUDA-003
tipo: historia
epica: EP-LEGAL-AYUDA
titulo: "[Móvil] Leer las páginas legales y la ayuda, con su contenido y su enlace de retorno"
etiquetas: [movil]
relacionadas: [US-LEGAL-AYUDA-001]
verificacion: codigo
cubre: ["/legal/terms", "/legal/privacy", "/help"]
---

## Historia
Como persona con o sin cuenta en SIGPRO que usa la app móvil, quiero leer los términos de uso, la política de privacidad y la ayuda, con su título, su introducción y sus secciones, y volver desde ellas a la pantalla anterior o a la de acceso,
para saber qué es el laboratorio, qué se guarda de mí y cómo empezar desde el teléfono.

## Reglas
- Las tres páginas son `/legal/terms` (título «Términos de uso»), `/legal/privacy` (título «Política de privacidad») y `/help` (título «Ayuda»). Se leen en la app sin sesión iniciada y también con sesión iniciada: no redirigen a ninguna otra ruta.
- Cada página muestra, en este orden: su título, su introducción, la línea «Última actualización: 1 de noviembre de 2026» y, debajo, sus secciones, cada una con su título y su texto. Los textos son los mismos que en la web.
- La ayuda no muestra ningún enlace a la página del laboratorio. Que la página `/lab` quede fuera de la app móvil está decidido.
- El enlace de retorno es «Volver al acceso» si no hay sesión iniciada y «Volver» si la hay.
  - Si la página se abrió desde otra pantalla de la app, el enlace vuelve a esa pantalla.
  - Si la página se abrió directamente, sin pantalla anterior, «Volver al acceso» lleva a `/login` y «Volver» lleva a `/programs`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y la app se abre en el navegador (Expo web) sin ninguna sesión de SIGPRO guardada. Cuando la fila describe a `gestor@sigpro.test` como persona que ha iniciado sesión, antes de abrir la página se inicia sesión en `/login` con `alumno01` en «Tenant de trabajo», `gestor@sigpro.test` y `Gestor1234!`.

## Criterios de aceptación
```gherkin
Característica: Páginas legales y ayuda en la app móvil

  Esquema del escenario: Las páginas se leen con y sin sesión iniciada, sin redirigir
    Dado que el tenant alumno01 está recién reiniciado y <persona> va a abrir una página
    Cuando abre <ruta> en la app
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
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada tiene la app abierta en <ruta>
    Cuando mira la página
    Entonces ve el título <titulo> y, debajo, <introduccion>
    Y ve la línea «Última actualización: 1 de noviembre de 2026»

    Ejemplos:
      | ruta | titulo | introduccion |
      | /legal/terms | «Términos de uso» | (describe: SIGPRO es una aplicación ficticia para practicar la automatización de pruebas, y al usarla se aceptan estas condiciones) |
      | /legal/privacy | «Política de privacidad» | «SIGPRO no trata datos personales reales. Esta página describe qué se guarda en el navegador y en el servidor del laboratorio.» |
      | /help | «Ayuda» | «Resumen rápido para empezar a practicar con SIGPRO.» |

  Esquema del escenario: Cada página muestra sus secciones con su título y su texto
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada tiene la app abierta en <ruta>
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

  Esquema del escenario: La ayuda no ofrece ningún enlace a la página del laboratorio
    Dado que el tenant alumno01 está recién reiniciado y <persona> tiene la app abierta en /help
    Cuando mira toda la página
    Entonces no aparece ningún enlace a /lab, ni «Ir a /lab» ni otro

    Ejemplos:
      | persona |
      | una persona sin sesión iniciada |
      | gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234! |

  Esquema del escenario: El enlace de retorno vuelve a la pantalla anterior o, sin ella, a la de acceso o a Programas
    Dado que el tenant alumno01 está recién reiniciado y <persona>
    Cuando <llegada>
    Y pulsa <enlace>
    Entonces llega a <destino>

    Ejemplos:
      | persona | llegada | enlace | destino |
      | una persona sin sesión iniciada | abre /legal/terms directamente, sin pantalla anterior en la app | «Volver al acceso» | /login |
      | una persona sin sesión iniciada | abre /help directamente, sin pantalla anterior en la app | «Volver al acceso» | /login |
      | una persona sin sesión iniciada | pulsa «Condiciones» en el pie de /login | «Volver al acceso» | /login |
      | una persona sin sesión iniciada | pulsa «condiciones de uso» en el formulario de /register | «Volver al acceso» | /register |
      | gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234! | abre /legal/privacy directamente, sin pantalla anterior en la app | «Volver» | /programs |
      | gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234! | abre «Más» y pulsa «Privacidad» | «Volver» | /more |
```

## Decisiones pendientes
- «Volver al acceso» conserva su texto cuando la pantalla anterior es el formulario de solicitud, y en ese caso vuelve a `/register`, no a `/login`. No está decidido si el texto debe cambiar o si el enlace debe ir siempre a `/login`. Hoy vuelve a la pantalla anterior.
- La sección «Atajos de teclado» tiene el mismo texto que en la web, pero la app móvil no tiene esos atajos. No está decidido si la sección debe mostrarse en la app móvil.

## Fuera de alcance
- La versión web de estas páginas: US-LEGAL-AYUDA-001 de esta misma épica.
- El pie de la pantalla de acceso y la entrada a estas páginas desde «Más»: US-LEGAL-AYUDA-004 de esta misma épica.
- El idioma y el tema de la cabecera de estas páginas: épicas «Idioma: español e inglés» (`i18n`) y «Tema claro y oscuro» (`tema`).
- El botón atrás del sistema en Android desde estas páginas: se escribirá como historia `[Android]` si se decide.
- El resto de opciones de «Más» (búsqueda, documentos, auditoría, administración y perfil): EP-NAVEGACION.
- El comportamiento de los atajos de teclado N, / y Esc: ninguna épica escrita lo cubre todavía.
