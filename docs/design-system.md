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
