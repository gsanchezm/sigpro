---
id: EP-NAVEGACION
tipo: epica
titulo: "Navegación: menú, búsqueda global, campana y diseño responsive"
etiquetas: [epic]
---

## Objetivo
Que quien tiene una sesión en SIGPRO sepa en todo momento dónde está y llegue a cada sección que su rol permite: con la barra lateral en el escritorio y con el cajón de navegación en las pantallas estrechas. Que la búsqueda global encuentre programas, requisitos, casos de prueba, no conformidades y documentos de su propio tenant y lleve a cada resultado. Que la campana cuente los avisos que llegan mientras la sesión está abierta. Y que quien abre una dirección sin sesión llegue a Acceso, y que una dirección que no existe no deje a nadie en una pantalla vacía.

## Alcance
- La búsqueda global de la API (`GET /api/search`): el parámetro, el mínimo de caracteres, los grupos y sus campos, la forma de cada resultado, el límite de cinco por grupo, la exigencia de un acceso válido y el aislamiento por tenant.
- En la web de escritorio (desde 1024 px): la barra lateral con sus entradas por rol, la marca de la sección actual, el plegado, las migas de pan, el cuadro de búsqueda de la cabecera, la campana y el menú de usuario.
- En la web responsive (menos de 1024 px): el cajón de navegación, la búsqueda a pantalla completa y la cabecera con el título de la sección.
- En la web: la campana de avisos (contador, panel y «Marcar leídas») y la insignia de No conformidades del menú.
- La raíz `/`, las direcciones que no existen y las pantallas privadas sin sesión, en la web y en la app móvil.
- En la app móvil: las pestañas inferiores, el menú «Más» según el rol, la pantalla `/search` y la apertura de sus resultados. Como capacidades futuras, la campana y la entrada de Requisitos, que la app todavía no tiene.

## Plataformas
API, web (escritorio y responsive) y móvil común a iOS y Android. Ninguna historia describe un comportamiento propio de iOS o de Android.

## Historias
- US-NAVEGACION-001: [API] Buscar en el tenant y devolver solo los grupos con resultados
- US-NAVEGACION-002: [API] Exigir al menos dos caracteres en el texto de búsqueda
- US-NAVEGACION-003: [API] Exigir un acceso válido y buscar solo en el tenant del acceso
- US-NAVEGACION-004: [Web] Ver en la barra lateral las secciones de mi rol y cuál está activa
- US-NAVEGACION-005: [Web] Diseño de escritorio desde 1024 px: barra lateral plegable y migas de pan
- US-NAVEGACION-006: [Web] Abrir y cerrar el menú de navegación en el diseño responsive
- US-NAVEGACION-007: [Web] Buscar en la cabecera: resultados agrupados, teclado y pantalla completa en responsive
- US-NAVEGACION-008: [Web] Ver los avisos sin leer en la campana y leerlos en su panel
- US-NAVEGACION-009: [Web] Abrir el menú de usuario: Perfil, atajos de teclado y Cerrar sesión
- US-NAVEGACION-010: [Web] Llegar a Programas o a Acceso desde la raíz, las direcciones desconocidas y las privadas
- US-NAVEGACION-011: [Móvil] Navegar con las pestañas inferiores y el menú «Más» según el rol
- US-NAVEGACION-012: [Móvil] Buscar en la pantalla «Búsqueda global» con resultados agrupados
- US-NAVEGACION-013: [Móvil] Abrir cada resultado de la búsqueda en su pantalla móvil
- US-NAVEGACION-014: [Móvil] Llegar a Programas o a Acceso desde la raíz y las pantallas privadas
- US-NAVEGACION-015: [Móvil] Ver la campana de avisos con su contador y su panel
- US-NAVEGACION-016: [Móvil] Llegar a los requisitos de un programa desde la navegación principal

Las historias 015 y 016 llevan la etiqueta `no-implementada`: son capacidades futuras de la app móvil, no se prueban contra la app y dicen en «Decisiones pendientes» lo que aún no está decidido. Las demás son vigentes.

## Fuera de alcance
- Entrar, bloquear la cuenta, el aviso de cierre de sesión y el resto de Acceso: EP-LOGIN. La renovación de la sesión y la duración del acceso: EP-SESION.
- El selector de idioma y el botón de tema de la cabecera: épicas transversales de idioma y de tema.
- Lo que muestra cada sección a la que lleva el menú (programas, requisitos, verificación, no conformidades, documentos, auditoría, administración, perfil y panel de misión): sus épicas. La pantalla `/lab` solo aparece aquí como entrada del menú.
- El buscador de la lista de Programas, que filtra la tabla y no abre resultados: EP-PROG-LISTA.
- Los documentos restringidos fuera de la búsqueda: US-DOC-RESTRINGIDOS-004 (EP-DOC-RESTRINGIDOS).
- La preferencia «Notificaciones en tiempo real» y la página Perfil: EP-PERFIL. El feed del panel de misión y el simulador: EP-MISION-FEED. El endpoint que emite un evento de prueba: EP-MISION-KPI.
- Las páginas legales y la ayuda que enlaza el menú de la app móvil: las épicas transversales de páginas legales y ayuda.
