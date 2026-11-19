---
id: EP-I18N
tipo: epica
titulo: "Idioma: español e inglés"
etiquetas: [epic]
---

## Objetivo
Que cada persona use SIGPRO en español, que es el idioma por defecto, o en inglés, y que ese idioma se vea completo y coherente: todos los textos de la interfaz, los importes, las fechas y los avances, y que se conserve al volver a abrir la aplicación.

## Alcance
- Idioma por defecto y textos de la interfaz en los dos idiomas, como regla válida en todas las plataformas.
- Formato de fechas, importes y avances según el idioma.
- Selector de idioma de la pantalla de Acceso en la web y en la app móvil: cambio de los textos sin recargar la pantalla, conservación al reabrir y, en la web, idioma declarado de la página.
- Selector de idioma de la cabecera de la aplicación de escritorio en la web.
- Mensajes de error de Acceso (credenciales, bloqueo, validación de campos y segundo paso) en el idioma elegido.

## Plataformas
Transversal (idioma por defecto, textos y formatos), web y app móvil común a iOS y Android. No hay un comportamiento propio de un sistema nativo.

## Historias
- US-I18N-001: [Transversal] Idioma por defecto español y textos completos en inglés
- US-I18N-002: [Transversal] Fechas, importes y avances con el formato del idioma
- US-I18N-003: [Web] Elegir el idioma en la pantalla de Acceso y conservarlo
- US-I18N-004: [Web] Mensajes de error de Acceso en el idioma elegido
- US-I18N-005: [Web] Cambiar el idioma desde la cabecera de la aplicación de escritorio
- US-I18N-006: [Móvil] Elegir el idioma en la pantalla de Acceso y conservarlo
- US-I18N-007: [Móvil] Mensajes de error de Acceso en el idioma elegido

## Fuera de alcance
- El tema claro u oscuro: épica de Tema (EP-TEMA).
- El cambio de idioma en la pantalla de Perfil, con su borrador y el botón «Guardar»: épica de Perfil (EP-PERFIL).
- El contenido de Términos, Privacidad y Ayuda y su propio selector de idioma: épica de páginas legales y ayuda (EP-LEGAL-AYUDA).
- Los avisos emergentes y sus textos: épica de avisos (EP-TOASTS).
- Los avisos de error genéricos (sin conexión o error inesperado del servidor), el acceso con certificado digital o SSO, las cuentas bloqueadas, pendientes o desactivadas como estados de la cuenta: épica de Inicio y cierre de sesión (EP-LOGIN).
- El segundo paso de verificación como flujo: épica de Verificación en dos pasos (EP-MFA).
- La pantalla de instructor `/lab`.
