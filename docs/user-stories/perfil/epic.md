---
id: EP-PERFIL
tipo: epica
titulo: "Perfil de la persona usuaria"
etiquetas: [epic]
---

## Objetivo
Que cada persona que ha iniciado sesión vea en «Perfil» a qué cuenta corresponde su sesión (nombre, correo, rol y tenant) y qué le permite su rol, y que pueda fijar sus preferencias de idioma, tema, aviso de notificaciones en tiempo real y resumen semanal. Nada cambia hasta que pulsa «Guardar».

## Alcance
- Los datos de la cuenta de la sesión y su avatar, sin ningún control para cambiarlos.
- Los seis permisos que muestra la página para cada rol del seed, como permitidos o no permitidos.
- Las preferencias en borrador: qué activa «Guardar», qué se descarta al salir sin guardar, qué aviso sale y qué se conserva al recargar la web o al volver a abrir la app.
- La diferencia de la app móvil con la web en los textos alternos del botón «Guardar» del perfil (historia `no-implementada`).

## Plataformas
Web y móvil común a iOS y Android: la pantalla no depende del sistema. La API no tiene un endpoint propio del perfil; los datos de la cuenta son los de la sesión que describe EP-SESION.

## Historias
- US-PERFIL-001: [Web] Ver la cuenta y lo que permite el rol en el perfil
- US-PERFIL-002: [Web] Cambiar las preferencias en borrador y guardarlas en el perfil
- US-PERFIL-003: [Móvil] Ver la cuenta y lo que permite el rol en el perfil
- US-PERFIL-004: [Móvil] Cambiar las preferencias en borrador y guardarlas en el perfil
- US-PERFIL-005: [Móvil] El botón «Guardar» del perfil alterna su texto con los textos alternos, como en la web

## Fuera de alcance
- Cerrar sesión desde el perfil: US-LOGIN-008 (web) y US-LOGIN-013 (móvil). El aviso «Sesión cerrada correctamente.» de la app móvil: US-LOGIN-014, de EP-LOGIN.
- La sesión, su renovación y el paso al acceso cuando no hay sesión: EP-SESION.
- El idioma y el tema como mecanismo de toda la aplicación y el selector de idioma de la cabecera: EP-I18N y EP-TEMA.
- Lo que cuenta la campana de avisos cuando se desactivan las notificaciones en tiempo real: la épica del Panel de misión.
- Cambiar el nombre, el correo, el rol o el tenant de una cuenta: EP-ADMIN-USUARIOS.
- Cómo se activan los textos alternos del modo caos y sus demás efectos: la épica de Administración.
