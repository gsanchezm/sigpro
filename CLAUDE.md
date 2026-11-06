# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A **design handoff bundle**, not an application. `design_handoff_sigpro/` holds high-fidelity HTML prototypes of SIGPRO (an engineering-program management system: programs, requirements, verification, non-conformities). The real job is to **recreate these screens in a production stack**; the prototypes are references, not code to ship. The README says to pick React + TypeScript + CSS variables/Tailwind if no stack exists, and none does yet.

There is no build, lint, test, package manager, or git history. `SIGPRO Design System Entregables.zip` is a byte-identical archive of `design_handoff_sigpro/`, so edit the folder and treat the zip as a stale copy.

Everything user-facing (README, UI strings, comments) is **Spanish**; ES is the default language and EN is the secondary one.

## Viewing the prototypes

Open a `.dc.html` file directly in a browser, for example `Invoke-Item "design_handoff_sigpro\SIGPRO Acceso.dc.html"` in PowerShell. It needs network access: `support.js` loads React 18.3.1 and ReactDOM from unpkg at runtime, and the pages load IBM Plex from Google Fonts. Keep `support.js` next to the HTML files. (The runtime can also pull in Babel for `x-import`ed JSX, but none of these prototypes use that.)

- `SIGPRO Acceso.dc.html`: login, MFA, recovery, registration, verification.
- `SIGPRO Programas.dc.html`: app shell, programs table, filters, 3-step wizard, dialogs.
- `SIGPRO Design System.dc.html`: tokens and components, sections 01–08 (color, type, spacing, badges, controls, navigation, feedback, `data-testid` convention).

The pages link to each other with relative URLs and hash params: login success goes to `SIGPRO Programas.dc.html#/programas?role=<role>`, and logout goes to `SIGPRO Acceso.dc.html#/login?logout=1`, which clears the session and shows the "signed out" notice.

## `.dc.html` file anatomy

Each prototype is a single file in three parts, rendered by the runtime in `support.js`:

1. `<x-dc>`: the template. `<helmet>` holds head content (font links and a `<style>` with the token CSS variables). Then comes markup with `{{ expr }}` bindings and `<sc-if value="{{…}}">` / `<sc-for list="{{…}}" as="item">` blocks. `hint-placeholder-*` attributes are placeholder hints for the runtime (`support.js`) and mean nothing in a port.
2. `<script type="text/x-dc" data-dc-script data-props="{json}">`: plain JS, not a module, containing `class Component extends DCLogic`. It is a React class component with `this.state`, `setState`, refs and lifecycle methods. `data-props` (absent in the Design System file) declares the prototype knobs the constructor reads from `props` to seed `this.state`: Acceso has `view`, `theme`, `showTestUsers` and `showTestIds`; Programas has `role`, `dataState`, `theme` and `showTestIds`. The proto bar changes them at runtime.
3. Constants above the class: mock data (`USERS`, `OWNERS`, `seedPrograms()`), the i18n dictionary `T = { es, en }`, and shared inline-style strings (`INPUT`, `BTN`).

Styling is mostly **inline `style` strings plus CSS variables**; there is no shared stylesheet.

**`support.js` is generated** (header: "do not edit", built from `dc-runtime/src/*.ts`, which is not in this repo). Never hand-edit it. Do not port it either.

## Things that are easy to get wrong

- **Tokens are duplicated** in the `<helmet><style>` of each of the three files, as `[data-theme="light"]` and `[data-theme="dark"]` blocks. There is no single source, so a token change must be made in all three files, and `README.md` has to match. Acceso's blocks omit `--purple*` and `--scrim`; the other two include them.
- **Prototype chrome must not be implemented.** The dark top bar (`data-testid="proto-bar"`, with `proto-role`, `proto-view`, `proto-viewport`, `proto-data-state`, `proto-annotations`, `proto-test-users`) and the dashed magenta `data-testid` annotation overlay (`computeAnnots`) exist only for the prototype. Real UI content is everything inside the themed container.
- **`data-testid` values are a contract.** Playwright depends on them, and the pattern is `pantalla-elemento` (`login-submit`, `programs-filter-status`, `toast-close`). Keep them exactly. The README lists them per screen, and Design System section 08 documents the convention.
- **Mock-only behavior to replace with real APIs.** Auth is checked against `USERS` in Acceso. The session lives in `localStorage['sigpro.session']` and cookie consent in `localStorage['sigpro_cookies']`. Programas reads the session on mount to set role and name. Latency is simulated with timers (700 ms login, 800 ms register, 1.4 s redirect overlay). The "server" errors (401, 403, 409, 422, 423, 503, 501) are faked client-side. Endpoints implied by the prototypes: `GET/POST /api/programs`, `DELETE /api/programs/:code`, `POST /api/auth/{login,mfa,register,forgot}`, `GET /api/auth/sso`.
- **Test accounts** (fake, from `USERS` in Acceso) are useful for driving the flows, for example `admin@sigpro.test` / `Admin1234!`, which requires MFA code `123456`. The README has the full table with the locked and pending cases.
- Breakpoints are measured on the **container width** in the prototypes. In production use media queries: ≥1024 full, 640–1023 sidebar collapsed, <640 mobile (drawer, card list instead of table, no breadcrumbs or brand panel).

## Requirements carried from the README (full spec in `design_handoff_sigpro/README.md`)

`README.md` is the spec: exact tokens, per-screen layout, the `data-testid` list, interaction flows and state shapes. Read the relevant section before changing or recreating a screen. The cross-cutting rules are:

- **Fidelity:** high. Colors, type (IBM Plex Sans UI / Plex Mono for codes, dates, amounts, shortcuts, HTTP traces; 13px/1.45 base), spacing, states and copy are final.
- **Theming:** `[data-theme="light|dark"]` on the root container. The Acceso brand panel is always dark.
- **Roles (Programas):** `admin` can do everything. `program_manager` can create, edit and archive, but not delete. `consultant` has read-only access plus export. `auditor` has read-only access. Disallowed actions render **`disabled` with an explanatory `title`**, never hidden.
- **Accessibility:** forms are `noValidate` with custom validation (`aria-invalid` plus an `aria-describedby` message), the owner filter is a full ARIA 1.2 combobox, contrast is at least 4.5:1, and everything is keyboard-operable with a universal focus ring (`outline: 2px solid var(--accent); outline-offset: 2px`). The README's "Accesibilidad / Testing" section lists the rest. Global shortcuts: `N` new program, `/` search, `Esc` closes everything or returns to login.
- **i18n:** every string must exist in both ES and EN. Extract the `T` dictionaries into the project's i18n resources.
- **Assets:** no images. Icons are inline SVG with a 1.5px stroke. Self-host the fonts in production instead of using Google Fonts.
