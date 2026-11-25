# Builds móviles como Release de GitHub — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `mobile-builds.yml` pueda publicar el APK de Android y el `.app` zipeado del simulador de iOS como Release de GitHub, con tag, al lanzarlo con una versión.

**Architecture:** Se amplía el workflow existente (los jobs de compilación están verificados en GitHub) con un job `prepare` que valida la versión antes de gastar minutos, un paso que estampa la versión en `app.json` solo en CI y un job `release` que publica los artefactos con `softprops/action-gh-release@v2`. Sin `version` todo queda como hoy.

**Tech Stack:** GitHub Actions (`workflow_dispatch`), `gh` CLI, `softprops/action-gh-release@v2`, `actions/download-artifact@v4`, Expo prebuild, parser `yaml` del repo para validar en local.

**Spec:** `docs/superpowers/specs/2026-11-25-mobile-releases-design.md`

## Global Constraints

- Jobs `ios-simulator` (`macos-latest`) y `android-emulator` (`ubuntu-latest`): no se tocan salvo `needs: prepare` y el paso de versión.
- Nombres de los archivos publicados: `sigpro-android-emulator.apk` y `sigpro-ios-simulator.zip`.
- Versión válida: `^v[0-9]+\.[0-9]+\.[0-9]+$`. Sin `version` (vacía) no se publica nada.
- URLs de la API por defecto sin cambios: `http://localhost:3000/api` (iOS) y `http://10.0.2.2:3000/api` (Android).
- `permissions: contents: write` solo en el job `release`; `prepare` con `contents: read`.
- Valores de inputs nunca interpolados con `${{ }}` dentro de `run:` (van por `env:`).
- Comentarios del YAML y docs en español; commits en inglés (Conventional Commits).
- Nada de push ni de lanzar el workflow sin orden explícita del usuario.

## Review Focus

1. `version` mal escrita (`1.0.0`, `v1.0`, `v1.0.0; x`): `prepare` falla y no arranca ninguna compilación.
2. El tag o la Release ya existen: `prepare` falla, no se pisa nada.
3. `platforms=android` (o `ios`) con versión: la Release lleva solo lo compilado; el job omitido no la bloquea.
4. Una compilación falla: no se crea ninguna Release parcial.
5. `release_notes` con comillas, `$(…)` o backticks: se escribe literal en el cuerpo, no se ejecuta.

## File Structure

- Modify: `.github/workflows/mobile-builds.yml` (inputs, `prepare`, paso de versión, `release`).
- Modify: `docs/MOBILE-EMULADORES.md` (§1), `docs/STATUS.md`, `docs/CHANGELOG.md`, `docs/DECISIONS.md`.
- Comprobador de estructura: script desechable en el scratchpad de la sesión, no se commitea (YAGNI).

---

### Task 1: Workflow con versión y job `release`

**Files:**
- Modify: `.github/workflows/mobile-builds.yml`
- Scratch (no se commitea): `<scratchpad>/check-workflow.mjs`

**Interfaces:**
- Consumes: el workflow actual (inputs `platforms`, `ios_api_url`, `android_api_url`, `tenant`, `ios_archs`; jobs `ios-simulator`, `android-emulator`; artefactos `sigpro-ios-simulator` y `sigpro-android-emulator`).
- Produces: inputs `version` (string, `''`), `release_notes` (string, `''`), `draft` (boolean, `false`); job `prepare` con output `version` (`''` si no hay publicación); job `release`.

- [ ] **Step 1: Escribir el comprobador (falla ahora)** `check-workflow.mjs`, que carga el YAML con el paquete `yaml` de `packages/stories` y afirma:
  - `on.workflow_dispatch.inputs` tiene `version`, `release_notes` y `draft` (`draft.type === 'boolean'`) y como mucho 10 inputs.
  - `jobs.prepare` existe, `runs-on: ubuntu-latest`, `permissions.contents === 'read'`, `outputs.version` definido.
  - `jobs['ios-simulator'].needs` y `jobs['android-emulator'].needs` incluyen `prepare`.
  - En ambos jobs de compilación el paso de versión (nombre empieza por «Versión de la app») va **antes** del paso «Proyecto nativo (expo prebuild)», tiene `if` sobre `needs.prepare.outputs.version` y su `run` no contiene `${{`.
  - `jobs.release`: `needs` = `[prepare, ios-simulator, android-emulator]`, `permissions.contents === 'write'`, `if` contiene `!cancelled()`, `needs.prepare.outputs.version != ''` y `contains(needs.*.result, 'failure')`; un paso usa `softprops/action-gh-release@v2` con `fail_on_unmatched_files: true`, `target_commitish: ${{ github.sha }}`, `generate_release_notes: true`; ningún `run` de `release` contiene `${{ inputs.`.

- [ ] **Step 2: Ejecutarlo y ver que falla**
  Run: `cd packages/stories && node <scratchpad>/check-workflow.mjs`
  Expected: sale con 1 y dice que faltan los inputs `version`/`release_notes`/`draft`.

- [ ] **Step 3: Inputs y job `prepare`.** Añadir los tres inputs al `workflow_dispatch` (descripciones en español; `version`: «Versión para publicar una Release (p. ej. v1.0.0). Vacío = solo artefactos del run»). Crear `prepare` con `outputs.version: ${{ steps.check.outputs.version }}` y un paso `check` con `env: VERSION: ${{ inputs.version }}`, `GH_TOKEN: ${{ github.token }}`, `GH_REPO: ${{ github.repository }}` que: sin `VERSION` escribe `version=` y sale 0; valida la regex de Global Constraints; falla con `::error::` si `gh release view "$VERSION"` o `gh api "repos/$GH_REPO/git/ref/tags/$VERSION"` tienen éxito; si todo va bien escribe `version=$VERSION` en `$GITHUB_OUTPUT`. Añadir `needs: prepare` a los dos jobs de compilación (conservando su `if`).

- [ ] **Step 4: Paso de versión en los dos jobs de compilación**, justo antes de «Proyecto nativo (expo prebuild)»: nombre «Versión de la app (solo CI, no se commitea)», `if: ${{ needs.prepare.outputs.version != '' }}`, `working-directory: apps/mobile`, `env: VERSION: ${{ needs.prepare.outputs.version }}`, y un `node -e` que lee `app.json`, pone `expo.version = VERSION.slice(1)` y lo reescribe con 2 espacios y salto final.

- [ ] **Step 5: Job `release`** al final del archivo, con la condición del Interfaces (`!cancelled()`, versión no vacía, sin `failure` en `needs.*.result`, y al menos uno de los dos jobs de compilación `success`). Pasos: `actions/download-artifact@v4` con `pattern: sigpro-*`, `path: artifacts`, `merge-multiple: true`; paso «Texto de la Release» que escribe `release-body.md` con `printf` leyendo `RELEASE_NOTES`, `IOS_API`, `ANDROID_API` de `env:` (las notas, un párrafo fijo que dice qué API trae cada archivo y enlaza `docs/MOBILE-EMULADORES.md`); `softprops/action-gh-release@v2` con `tag_name` = `needs.prepare.outputs.version`, `name: SIGPRO <versión>`, `draft: ${{ inputs.draft }}`, `body_path: release-body.md`, `files: artifacts/*` y lo demás de Review Focus.

- [ ] **Step 6: Comprobador en verde y YAML válido**
  Run: `cd packages/stories && node <scratchpad>/check-workflow.mjs`
  Expected: sale con 0.

- [ ] **Step 7: Pruebas de comportamiento en bash** (el script de `prepare` y el de «Texto de la Release» extraídos a un `.sh` de scratchpad con `GITHUB_OUTPUT` falso, `gh` simulado con una función):
  - `v1.0.0` → `version=v1.0.0`; vacía → `version=`; `1.0.0`, `v1.0`, `v1.0.0; x`, `v1.0.0 ` → exit 1 sin tocar `gh`.
  - `gh release view` con éxito → exit 1; `gh api` con éxito → exit 1.
  - `RELEASE_NOTES='"$(echo pwned)" `id` $HOME'` → el `release-body.md` lo contiene **literal** y no aparece `pwned` suelto.
  Expected: todas las comprobaciones pasan.

- [ ] **Step 8: Commit**
  `git add .github/workflows/mobile-builds.yml` y `git commit -m "feat(ci): publish the mobile builds as a GitHub Release"`.

### Task 2: Documentación

**Files:**
- Modify: `docs/MOBILE-EMULADORES.md` (§1), `docs/STATUS.md`, `docs/CHANGELOG.md`, `docs/DECISIONS.md`

**Interfaces:**
- Consumes: los nombres de input y de archivo de Task 1.
- Produces: la guía de descarga desde Releases y las notas de estado.

- [ ] **Step 1: `docs/MOBILE-EMULADORES.md` §1:** añadir «Descargar de Releases» (los dos archivos están en la página de la Release, sin sesión, sin segundo zip y sin caducidad de 30 días) y «Publicar una Release» (`gh workflow run mobile-builds.yml -f version=v1.0.0`; `-f draft=true` para la primera prueba; qué hace cada input nuevo; sin `version` el comportamiento de siempre). Aviso en negrita: la Release se compila con las URLs de API por defecto (local); para Render, pasar `ios_api_url`/`android_api_url`.
- [ ] **Step 2: STATUS, CHANGELOG y DECISIONS** (una entrada cada uno, en el estilo de sus secciones vigentes): qué se hizo; las 4 llamadas del spec («Llamadas mías»); **No verificado:** el job `release` en GitHub (nada subido ni lanzado).
- [ ] **Step 3: Commit**
  `git add docs/MOBILE-EMULADORES.md docs/STATUS.md docs/CHANGELOG.md docs/DECISIONS.md` y `git commit -m "docs(mobile): releases of the emulator builds"`.

### Task 3: Prueba real (solo con orden del usuario)

**Files:** ninguno.

- [ ] **Step 1: Pedir permiso** para el push de los commits y, aparte, para lanzar el workflow.
- [ ] **Step 2: Con permiso, push y lanzar el borrador:** `gh workflow run mobile-builds.yml -f version=v1.0.0 -f draft=true`. Esperar a que termine (iOS tarda 20–40 min).
  Expected: `prepare` en verde, las dos compilaciones en verde y una Release **en borrador** `SIGPRO v1.0.0` con `sigpro-android-emulator.apk` y `sigpro-ios-simulator.zip`; `gh release list` no muestra tag público.
- [ ] **Step 3: Con la comprobación hecha, preguntar** si se borra el borrador o se publica. Actualizar STATUS con el resultado real (en verde o con el fallo).

## Autorrevisión

- **Cobertura del spec:** `version` opcional, `draft`, `prepare` con validación y no pisar (T1 S3), versión estampada sin commitear (T1 S4), job `release` con `target_commitish` y notas autogeneradas (T1 S5), documentación (T2), verificación local y real con permiso (T1 S6–7, T3).
- **Queda al constructor** (según el spec): texto del párrafo fijo, paso de la versión entre jobs (output de `prepare`), caso `platforms=ios|android` (condición del `release` y `merge-multiple`).
- **Consistencia:** `prepare.outputs.version` es el único canal de la versión; los nombres de input son los mismos en el comprobador, el YAML y las docs.
