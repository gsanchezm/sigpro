---
id: EP-TEMA
tipo: epica
titulo: "Tema claro y oscuro"
etiquetas: [epic]
---

## Objetivo
Que cada persona vea SIGPRO en el tema claro o en el oscuro, que pueda cambiarlo con el control de la pantalla en la que está y que su elección se mantenga en el mismo navegador o dispositivo, con textos legibles en los dos temas.

## Alcance
- El control «Cambiar tema» de la web: en la cabecera de la aplicación, en Acceso y en las páginas legales y de ayuda.
- El control «Cambiar tema» de la app móvil en Acceso y en las páginas legales y de ayuda.
- El tema con el que se empieza: claro en la web; en la app móvil, el del sistema mientras no se elija otro.
- Lo que se conserva de la elección: al recargar, al volver a abrir la app, al cerrar sesión y al entrar con otra cuenta del mismo navegador o dispositivo.
- El contraste mínimo de los textos clave en los dos temas.

## Plataformas
Web (escritorio y diseño responsive) y app móvil común a iOS y Android. Las reglas de preferencia y de contraste valen en todas las plataformas (transversal).

## Historias
- US-TEMA-001: [Web] Cambiar el tema con «Cambiar tema» en la aplicación, en Acceso y en las páginas legales
- US-TEMA-002: [Web] Empezar en tema claro y conservar el tema elegido al recargar y al entrar
- US-TEMA-003: [Móvil] Tema inicial: el del sistema hasta que la persona elige uno
- US-TEMA-004: [Móvil] Cambiar el tema con «Cambiar tema» en Acceso y en las páginas legales
- US-TEMA-005: [Transversal] La preferencia de tema es del navegador o del dispositivo, no de la cuenta
- US-TEMA-006: [Transversal] Textos con contraste de al menos 4,5:1 sobre su fondo en los dos temas

## Fuera de alcance
- El grupo «Tema» de Perfil, su borrador y «Guardar»: EP-PERFIL.
- El idioma y su selector de la cabecera: EP-I18N.
- El inicio de sesión, el cierre de sesión y sus avisos: EP-LOGIN.
- El contenido de las páginas legales y de ayuda: EP-LEGAL-AYUDA.
- La cabecera de la aplicación y sus demás controles: EP-NAVEGACION.
- Los colores de los avisos de error y de las insignias de estado sobre sus fondos: cada módulo que los muestra.
