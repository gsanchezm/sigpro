---
id: EP-A11Y
tipo: epica
titulo: "Accesibilidad"
etiquetas: [epic]
---

## Objetivo
Que quien usa SIGPRO con un lector de pantalla, solo con el teclado o con el dedo en la app móvil pueda hacer las mismas tareas que quien usa el ratón: cada control se anuncia con un nombre que dice qué hace, cada imagen tiene su texto, cada motivo se lee como texto, cada aviso llega a quien no lo ve y cada lista dice si está cargando, si está vacía o si ha fallado. Estas reglas son compromisos del producto, no de un único módulo: las pantallas de las demás épicas las cumplen en sus casos, y estas historias describen el comportamiento correcto con ejemplos de pantallas concretas.

## Alcance
- Nombre de los controles, de los campos y de las imágenes, incluidos los avatares (transversal).
- Campos con etiqueta visible, texto de ejemplo distinto de la etiqueta y aviso de error ligado a su campo, con el foco en el primero que falla (transversal).
- Botones deshabilitados con el motivo a la vista (transversal).
- Insignias de estado y de severidad escritas, y barras de progreso con su valor (transversal).
- Estados de carga, vacío y error de las listas (transversal).
- Avisos que quedan dentro de la pantalla y su rol al anunciarse: alerta para el error, estado para lo demás (transversal).
- Web de escritorio: orden de Tab, foco visible, teclas de los menús y del árbol de requisitos, y diálogos con el foco, Esc y el retorno del foco (web).
- App móvil: objetivos táctiles de al menos 44 px y nombres de los controles de las filas y de las pestañas (móvil).

## Plataformas
Transversal (las reglas valen en toda la interfaz), web de escritorio y web responsive donde se indica, y app móvil común a iOS y Android. Ninguna historia describe un comportamiento propio de iOS o de Android: el gesto de volver atrás del sistema queda fuera.

## Historias
- US-A11Y-001: [Transversal] Nombres accesibles y textos alternativos de controles, campos e imágenes
- US-A11Y-002: [Transversal] Campos con etiqueta visible, texto de ejemplo distinto y aviso ligado al campo
- US-A11Y-003: [Transversal] Botones deshabilitados con el motivo a la vista
- US-A11Y-004: [Transversal] Insignias y barras de progreso con su valor escrito
- US-A11Y-005: [Transversal] Listas con carga ocupada, estado vacío y error anunciables
- US-A11Y-006: [Transversal] Avisos dentro de la pantalla: alerta para los errores y estado para las confirmaciones
- US-A11Y-007: [Web] Recorrer y accionar la pantalla solo con el teclado
- US-A11Y-008: [Web] Diálogos: el foco entra, no sale y vuelve al control que lo abrió
- US-A11Y-009: [Móvil] Objetivos táctiles de al menos 44 px y nombres de los controles

## Fuera de alcance
- El contraste de los textos y de los botones en el tema claro y en el oscuro: EP-TEMA (US-TEMA-006).
- Los avisos emergentes que aparecen en una esquina y se retiran solos, su tono y el rol con el que se anuncian según el tono: EP-TOASTS.
- La barra lateral, el cajón de navegación responsive, la búsqueda global y las pestañas de la app móvil en cuanto a qué secciones muestran: EP-NAVEGACION.
- Los textos y las reglas de validación de cada formulario y de cada pantalla: las épicas de su módulo.
- Los atajos de teclado de la página (N, /): ninguna épica escrita los cubre.
- Lectores de pantalla o dispositivos concretos: las historias describen nombres, textos y estados observables, no un programa lector determinado.
