# SIGPRO — Design system «1a Ciruela»

Referencia visual vigente. Sustituye a `docs/design-handoff/README.md` (gris-azul, IBM Plex, denso), que queda como histórico (ver `docs/DECISIONS.md`, «Rediseño visual»). Todo vive en **`apps/web/src/styles/index.css`**: tokens como CSS variables, clases base (`.btn`, `.input`, `.card`, `.badge`…) y el tema de Tailwind. Los nombres de token no cambian; solo los valores. Ningún componente usa hex directos.

## Tema y tokens

El tema se aplica con `[data-theme="light|dark"]` en `<html>`. Un contenedor con `data-theme="dark"` vuelve a resolver los tokens a oscuro (lo usa el panel de marca de Acceso).

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#faf8fb` | `#141017` | fondo de la página |
| `--surface` | `#ffffff` | `#1c1721` | tarjetas, paneles, inputs |
| `--surface-2` | `#f4f0f6` | `#261f2c` | cabeceras, campo de búsqueda, segmentado |
| `--border` | `#e6dfea` | `#342b3b` | bordes de tarjeta y tabla |
| `--border-strong` | `#cfc4d6` | `#4a3e54` | bordes de input |
| `--text` | `#1d1424` | `#f0eaf3` | texto |
| `--text-2` | `#5b4f66` | `#b3a7bd` | texto secundario |
| `--text-3` | `#6f627a` | `#968c9f`¹ | etiquetas, ayudas |
| `--accent` | `#7a2e6e` | `#d68ac9` | acción principal, enlaces, foco |
| `--accent-hover` | `#632259`² | `#e3a5d8`² | |
| `--accent-soft` | `#f3e3f0` | `#3a2137` | fila seleccionada, chip activo |
| `--on-accent` | `#ffffff` | `#1d1424` | texto sobre fondos de color fuerte (**oscuro en el tema oscuro**) |
| `--ok` / `--ok-soft` | `#1f7a4d` / `#dff3e7` | `#5fcf93` / `#16301f` | |
| `--warn` / `--warn-soft` | `#8a5200` / `#fbecd0` | `#e6a23c` / `#3a2d14` | |
| `--danger` / `--danger-soft` | `#b93232` / `#fbe4e4` | `#f0716b` / `#3a1f21` | |
| `--info` / `--info-soft` | `#3556b8` / `#e4eafb` | `#8ea6f5` / `#1d2747` | |
| `--neutral` / `--neutral-soft` | `#5b4f66` / `#f4f0f6`² | `#b3a7bd` / `#261f2c`² | |
| `--purple` / `--purple-soft` | `#6b3fc9` / `#ece4fb`² | `#b394f5` / `#2a2140`² | |
| `--shadow` | `0 1px 2px rgba(29,20,36,.05), 0 4px 14px rgba(29,20,36,.06)` | `0 1px 2px rgba(0,0,0,.4)` | tarjetas |
| `--shadow-pop` | `0 12px 32px rgba(29,20,36,.16)`² | `0 12px 32px rgba(0,0,0,.55)`² | popovers, diálogos |
| `--scrim` | `rgba(29,20,36,.45)`² | `rgba(0,0,0,.6)`² | fondo de los diálogos |

¹ Ajustado respecto al encargo (`#85798f`): no llegaba a AA. ² Derivado.

**Contraste (WCAG AA, 4,5:1):** comprobado por script en ambos temas para todos los pares texto/fondo reales (texto y texto secundario sobre `--bg`, `--surface`, `--surface-2` y `--accent-soft`; el color de cada estado sobre su `*-soft` y sobre `--surface`; `--on-accent` sobre `--accent`/`--accent-hover`/`--danger`). En claro pasan todos; en oscuro pasaban todos salvo `--text-3`, ajustado.

## Tipografía

**Geist** (400/500/600) para la interfaz y **Geist Mono** (400/500) para códigos (`PRG-001`, `REQ-017`), fechas y valores tabulares. Autoalojadas con `@fontsource`. Base **14 px / 1,5**; tabla 14 px con mono a 12,5 px.

| Uso | Clase | Tamaño |
| --- | --- | --- |
| Título de página | `.page-title` | 26/600, `letter-spacing -0.02em` (22 px por debajo de 640 px) |
| Título de sección (h2) | `.section-title` | 18/600 |
| Cifra de métrica | `.metric-value` | 28/600, cifras tabulares |
| Etiquetas y cabeceras de tabla | — | 12–13/500 |
| Código / valor tabular | `.mono` | Geist Mono |

## Forma y densidad

| Variable | Valor | Para |
| --- | --- | --- |
| `--radius-ctl` | 10 px | botones, inputs, controles |
| `--radius-card` | 12 px | tarjetas y paneles |
| `--radius-ctl-sm` | 8 px | controles pequeños |
| `--radius-pill` | 999 px | chips y badges |
| `--h-ctl` / `--h-ctl-sm` | 36 / 30 px | botones e inputs |
| `--row-h` / `--head-h` / `--topbar-h` | 48 / 40 / 60 px | fila y cabecera de tabla, barra superior |
| `--page-pad` / `--block-gap` / `--card-pad` | 28 / 24 / 20 px | padding de página, separación entre bloques, padding de tarjeta |

Las utilidades de Tailwind equivalentes son `rounded-ctl`, `rounded-card` y `rounded-ctl-sm`.

**Densidad:** por defecto «aireada». `data-density="media"` en un contenedor raíz (p. ej. `<html>`) deja la fila en 38 px, el padding de página en 20 px, el gap en 16 px y el padding de tarjeta en 16 px² .

## Componentes base (fase 2)

| Componente | Clase | Detalle |
| --- | --- | --- |
| Botón | `.btn` + `.btn-primary` / `-secondary` / `-ghost` / `-danger` | 36 px (`.btn-sm` 30, `.btn-lg` 40), radio 10. Primario: `--accent` sobre `--on-accent`, **sin borde**. Secundario: `--surface`, borde `--border` y `--shadow`. Peligro: texto `--on-accent`. Foco: `outline 2px --accent`, offset 2 |
| Input | `.input` (`.input-filter` 30 px, `.input-header` 36 px) | 36 px, radio 10, 14 px, fondo `--surface`, borde `--border-strong` |
| Tarjeta / popover | `.card`, `.popover` | `--surface`, borde `--border`, radio 12, `--shadow` (popover: `--shadow-pop`) |
| Badge | `.badge` + `data-tone` | píldora 999, **22 px**, 0 9 px, 12/500, fondo `*-soft` y texto del tono, **sin borde**; punto de 6 px. `data-state="validated"` = fondo `--ok` con texto `--surface`. `data-state`/`data-severity` no cambian |
| Chip de filtro | `.chip` (+ `.chip-x`) | 30 px píldora. Vacío: borde discontinuo `--border-strong` con «+ Etiqueta». `data-active="true"`: `--accent-soft` + texto `--accent` + «×». Envuelve el control nativo |
| Segmentado | `.segmented` + `.segmented-opt` | `--surface-2`, radio 10, padding 3; la opción activa (`aria-selected`/`aria-pressed`/`aria-checked`) es una pastilla `--surface` con `--shadow` |
| Tarjeta de métrica | `.metric` + `.metric-label` / `.metric-value` / `.metric-aux` / `.metric-bar` | etiqueta 13 `--text-2`, cifra 28/600, línea auxiliar 12 `--text-3`, barra de 6 px en `--accent` |
| Tabla | `.data-table` | cabecera sin fondo, 12/500 `--text-3` con borde inferior (40 px), fila 48 px, fila seleccionada `--accent-soft`, código en mono `--text-2`, mono 12,5 px |
| Búsqueda global | `.input.input-header` + `.kbd` | 36 px sobre `--surface-2`, sin borde, `kbd` «/» a la derecha |
| Barra superior | — | `--topbar-h` = 60 px (también el bloque del logo en la barra lateral) |
| Spinner | `.spinner` | hereda `currentColor` (sobre el botón primario = `--on-accent`) |

**Excepciones sin variables CSS** (un data-URI no las lee): el logo, los avatares, las miniaturas de evidencia y `public/icon.svg`; sus colores están en `apps/web/src/lib/images.ts` y repiten los tokens.

## Programas (fase 3)

Orden de la página: cabecera (título 26/600, subtítulo, acciones) → **fila de 4 tarjetas de métricas** (`.metric`: Programas, Activos, Avance medio con barra de 6 px, NC abiertas; cifras del tenant, `GET /api/mission/summary`) → **chips de filtro** (`.chip`: «+ Estado», «+ Inicio desde», «+ Fin hasta», «+ Responsable»; activos en `--accent-soft` con «×», más «Limpiar filtros») → tabla `.data-table` + **panel lateral**.

- **Panel lateral** (`programs-panel`): `<aside>` de 380 px en la rejilla (sticky bajo la barra superior), no modal. Código en mono, nombre `.section-title`, estado, responsable, fechas, presupuesto y avance. Se abre con un clic en la fila y se cierra con «×», Esc o al cambiar orden/página/filtros. Con él abierto la tabla oculta las columnas que el panel ya muestra. Por debajo de 1024 px es un drawer a ancho completo.
- **Chips:** son los controles nativos (siempre en el DOM): `getByLabel('Estado')`, `selectOption`, `fill` y el combobox ARIA del responsable funcionan igual que antes. Los «×» se llaman «Quitar «<valor>»».
- **Padding de página** `--page-pad` (28 px) y separación entre bloques `--block-gap` (24 px) se aplican en el `<main>` del shell.
- **Acceso:** mismas clases base; el panel de marca es `data-theme="dark"`.

## Requisitos (fase 4)

Orden de la página: cabecera (título, selector de programa, exportar, «Nuevo requisito») → **4 tarjetas de métricas** (`Metric`: Requisitos, Cobertura de verificación con barra, Pendientes de aprobación, NC abiertas; salen de la lista ya cargada) → **conmutador `.segmented`** (Árbol · Documento · Matriz de trazabilidad) → buscador + chip «+ Estado» → tabla o documento y, a la derecha, el panel de 380 px.

| Pieza | Clase | Detalle |
| --- | --- | --- |
| Árbol-tabla | `.req-tree` > `.req-grid` | Cada fila `li role=treeitem` es una rejilla: Requisito (asa, caret ▾, código mono y título; sangría **22 px** por nivel, raíces en 600) · Estado (badge) · **Pruebas** `n/m` en mono (verde si todo pasa) · **NC** (código de la NC abierta en `--danger`, «+n» si hay más) · menú ⋯. Cabecera `.req-head` (12/500 `--text-3`) fuera del `ul`, `aria-hidden`. Container query: con menos de 640 px de tabla se ocultan Pruebas y NC (`.req-col-extra`) |
| Flujo de aprobación | `.flow` > `.flow-step[data-status]` | Cuatro pasos con punto y línea: hecho (`--accent` lleno, ✓), actual (borde `--accent` y halo `--accent-soft`, nombre 600) y futuro (borde `--border-strong`). El paso actual contiene los botones de transición |
| Trazabilidad | — | Casos enlazados con `ToneBadge` del resultado (Superado / Fallido / Bloqueado / Sin ejecutar) y NC con la severidad (`data-severity`); las cerradas o rechazadas, en `--text-3` con «resuelta» |
| Celda de la matriz | `.matrix-box[data-result]` | La casilla nativa con `appearance: none`, 30 × 24: ✓ `--ok-soft`/`--ok`, ✕ `--danger-soft`/`--danger`, ! `--warn-soft`/`--warn`, · discontinua (sin ejecutar) y `--surface-2` sin glifo (sin relación) |
| Documento | `.doc-section` | Rejilla `88px 1fr auto`: número y código en el margen (mono 12 `--text-3`), título (16/600 en raíces, 14/600 en hijos) con la descripción saneada debajo y el badge de estado a la derecha |

**Dónde están los datos:** `RequirementDto.tests` y `.ncs` (la API las calcula con las ejecuciones de los casos enlazados) y `TraceabilityDto.testCases[].lastResult`. Funciones puras en `packages/shared/src/requirements.ts`: `testsSummary`, `openNcsOf`, `requirementMetrics`, `sectionNumbers`, `FLOW_STATES` y `flowStepStatus`.

## Capturas y cierre (fase 5)

Las capturas **no se versionan**: `docs/screens/` está en `.gitignore` y se genera con `pnpm e2e:screens` (web, claro/oscuro a 1440 y 390 px); las `mobile-*` salen de `pnpm e2e:mobile:screens`. Una captura con un menú o una lista abiertos se hace solo del viewport (ver `e2e/support/screens.ts`). La comparación con el handoff se retiró; la referencia visual es este documento.
