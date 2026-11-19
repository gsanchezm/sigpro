---
id: EP-LEGAL-AYUDA
tipo: epica
titulo: "Páginas legales y de ayuda"
etiquetas: [epic]
---

## Objetivo
Que cualquier persona pueda leer, sin iniciar sesión, los términos de uso, la política de privacidad y la ayuda de SIGPRO, y llegar a ellas desde el pie de la pantalla de acceso y, en la app móvil, también desde «Más» con sesión iniciada. Estas páginas explican qué es el laboratorio, qué se guarda y cómo empezar, así que su contenido se prueba tal como está escrito. El enlace de retorno de cada una lleva a la pantalla de acceso o a Programas; en la app móvil, a la pantalla anterior si la hay.

## Alcance
- Las páginas `/legal/terms` (título «Términos de uso»), `/legal/privacy` (título «Política de privacidad») y `/help` (título «Ayuda») en la web y en la app móvil: título, introducción, línea de la última actualización, secciones con su texto y el enlace de retorno «Volver al acceso» o «Volver».
- Que las tres páginas se leen con y sin sesión iniciada, sin redirigir.
- En la web, el enlace «Ir a /lab» de la ayuda, y que solo aparece ahí.
- Los enlaces del pie de la pantalla de acceso «Privacidad», «Condiciones» y «Ayuda», en la web y en la app móvil.
- En la app móvil, la entrada a las tres páginas desde «Más» con sesión iniciada.

## Plataformas
Web y app móvil (común a iOS y Android). No hay historias `ios` ni `android`: estas páginas no cambian según el sistema. El botón atrás del sistema queda fuera (ver «Fuera de alcance»).

## Historias
- US-LEGAL-AYUDA-001: [Web] Leer las páginas legales y la ayuda, con su contenido y su enlace de retorno
- US-LEGAL-AYUDA-002: [Web] Llegar a las páginas legales y a la ayuda desde el pie de Acceso
- US-LEGAL-AYUDA-003: [Móvil] Leer las páginas legales y la ayuda, con su contenido y su enlace de retorno
- US-LEGAL-AYUDA-004: [Móvil] Llegar a las páginas legales y a la ayuda desde el pie de Acceso y desde «Más»

Todas las historias son vigentes. Ninguna lleva `no-implementada`: en la web, con sesión iniciada, no hay enlace a estas páginas; eso se anota como decisión pendiente en la historia 002 y no como capacidad futura.

## Fuera de alcance
- El idioma y el tema de la cabecera de estas páginas y de la pantalla de acceso: épicas «Idioma: español e inglés» (`i18n`) y «Tema claro y oscuro» (`tema`).
- El formulario de la pantalla de acceso y sus avisos: épica de Inicio y cierre de sesión. El panel «Usuarios de prueba»: épica de la API de plataforma y configuración.
- Los enlaces «condiciones de uso» y «política de privacidad» de la casilla de condiciones del formulario de solicitud: épica de Solicitud de acceso y reenvío de la verificación.
- La FAQ de la página `/lab`: no está en la ayuda, sino en la página del laboratorio, que todavía no tiene épica escrita.
- El comportamiento de los atajos de teclado N, / y Esc fuera del texto de la ayuda: ninguna épica escrita lo cubre todavía.
- Las demás opciones de «Más» (búsqueda, documentos, auditoría, administración y perfil): épica de navegación de la app móvil, todavía sin escribir.
- El botón atrás del sistema en Android desde estas páginas: se escribirá como historia `[Android]` si se decide.
