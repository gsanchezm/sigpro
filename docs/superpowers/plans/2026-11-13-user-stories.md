# Historias de usuario de SIGPRO — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Producir las historias de usuario de SIGPRO en español (épicas e historias por plataforma, con Esquemas del escenario) como Markdown versionado, con las herramientas para validarlas, medir su cobertura y sincronizarlas con GitHub Issues.

**Architecture:** Un paquete nuevo `packages/stories` (`@sigpro/stories`, TypeScript, Vitest) con funciones puras (parseo, Gherkin, reglas de lint, render, plan de sincronización, cobertura) y efectos solo en los bordes (lectura de disco, CLI `gh`). El contenido vive en `docs/user-stories/<épica>/`. Después de las herramientas se escribe el piloto `EP-LOGIN`, el usuario lo aprueba y se escribe el resto épica a épica con un procedimiento fijo.

**Tech Stack:** Node ≥ 22.13, pnpm 11, TypeScript estricto, Vitest 3.2.7, Zod 3.25.76 (el de `@sigpro/shared`), `yaml`, `tsx` 4.23.15 (el de `apps/api`), CLI `gh` 2.91.

**Spec:** `docs/superpowers/specs/2026-11-13-user-stories-design.md` (aprobada; leerla entera antes de empezar).

## Global Constraints

- Código en inglés, comentarios en español. Sin `switch/case` (mapas de despacho y guard clauses), sin `any`, `strict: true`, inmutable, funciones puras salvo en los bordes (`load.ts`, `gh.ts`, `cli.ts`).
- Commits en inglés, Conventional Commits, con los trailers de atribución de la sesión. **`git add` siempre con rutas concretas** (en el árbol hay un `e2e/tests/zz-visual-check.spec.ts` sin seguimiento a propósito).
- **Nunca** `git push`, ni crear o editar issues en GitHub, sin autorización explícita del usuario en ese momento (el repo `gsanchezm/sigpro` es público). El plan solo prevé una sincronización en seco hasta la Tarea 18.
- Etiquetas: `epic`, `api`, `web`, `movil`, `ios`, `android`, `transversal`, `no-implementada`. Cada historia lleva **exactamente una** de `api|web|movil|ios|android|transversal`; `no-implementada` se suma cuando corresponde; la épica lleva solo `epic`.
- Ids: épica `EP-<SLUG>`, historia `US-<SLUG>-NNN` (numeración dentro de la épica, sin reutilizar). Archivos: `docs/user-stories/<slug-épica>/epic.md` y `.../US-<SLUG>-NNN.md`.
- Prefijos de título: `[API]`, `[Web]`, `[Móvil]`, `[iOS]`, `[Android]`, `[Transversal]`.
- `verificacion`: `ejecutada | codigo | pendiente-nativo | no-ejecutable`. `ios` ⇒ `pendiente-nativo` (o `no-ejecutable`). `no-ejecutable` ⇔ etiqueta `no-implementada`. `verificacion` no se publica.
- Gherkin en español (`Característica`, `Esquema del escenario`, `Ejemplos`, `Dado`, `Cuando`, `Entonces`, `Y`); al menos un Esquema con tabla de Ejemplos por historia, con casos negativos y valores límite (n−1, n, n+1) si hay umbral. Datos concretos (códigos del seed, usuarios demo, mensajes exactos en español, códigos HTTP).
- Términos prohibidos en historias: `data-testid`, `testid`, `getBy…`, `plantedBugs`, `planted`, `defecto plantado`; ninguna historia cita `planted-bugs`. Sin `@usuario` ni `#n` sueltos fuera de código (GitHub los convertiría en menciones y enlaces).
- Marca de identidad en el cuerpo del issue: `<!-- sigpro-story-id: US-LOGIN-003 -->`. La sincronización es idempotente, en seco por defecto, nunca cierra ni borra issues (no se implementa ningún flag para ello).
- `docs/story-discrepancies.md` está **ignorado por git** (solo instructor): guarda desviaciones de comportamientos que existen y no son bugs plantados. Las capacidades ausentes o simuladas no van ahí: se publican como historias `no-implementada`.
- Esta fase no modifica código de las apps.

## Review Focus

1. Archivos con BOM o saltos CRLF (Windows) no deben romper el front matter (Tarea 2).
2. Una sincronización interrumpida a mitad debe poder reanudarse sin duplicar ni dejar épicas sin enlazar (Tarea 6).
3. Un issue de **otra cuenta** que contenga la marca no debe ser actualizado por la sincronización (repo público) (Tarea 6).
4. En los Esquemas, `<` y `>` en comparaciones («valor < 5 y > 3») no son marcadores de posición, y `\|` dentro de una celda es un `|` literal (Tarea 3).
5. Menciones `@x` y referencias `#n` sueltas en el cuerpo notificarían a terceros o enlazarían issues ajenos (Tarea 4).

## Estructura de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `packages/stories/package.json`, `tsconfig.json`, `vitest.config.ts` | paquete, scripts `lint`/`typecheck`/`test`/`stories` |
| `src/model.ts` | constantes (etiquetas, prefijos, verificación), esquemas Zod del front matter, tipos `Epic`, `Story`, `StoryFile` |
| `src/parse.ts` | `parseStoryFile` (puro) y `loadStoryFiles` (lee disco) |
| `src/gherkin.ts` | bloques ```` ```gherkin ````, Esquemas, tablas, marcadores, palabras en inglés |
| `src/rules.ts` | `lintStoryFiles`: mapa de reglas puras → `Finding[]` |
| `src/render.ts` | `renderIssue`, `markerOf` |
| `src/sync.ts` | `planSync` (puro) y `applyOps` (orquesta un `Gh`) |
| `src/gh.ts` | `makeGh(repo)`: adaptador sobre `gh api` (efectos) |
| `src/coverage.ts` | extracción de fuentes, `buildCoverage`, `renderCoverageMarkdown` |
| `src/cli.ts` | `stories lint | coverage | sync` |
| `docs/user-stories/README.md`, `COBERTURA.md`, `<épica>/…` | guía del redactor, matriz generada, contenido |

---

### Task 1: Paquete y modelo

**Files:**
- Create: `packages/stories/package.json`, `packages/stories/tsconfig.json`, `packages/stories/vitest.config.ts`, `packages/stories/src/model.ts`
- Test: `packages/stories/src/model.test.ts`

**Interfaces:**
- Produces (`model.ts`):
  - `PLATFORM_LABELS` (`api|web|movil|ios|android|transversal`), `EXTRA_LABELS` (`epic|no-implementada`), `VERIFICATION`, tipos `PlatformLabel`, `Verification`
  - `TITLE_PREFIX: ReadonlyMap<PlatformLabel, string>`
  - `LABEL_DEFS: readonly { name: string; color: string; description: string }[]` (las 8 etiquetas, descripciones en español)
  - `epicFrontmatterSchema`, `storyFrontmatterSchema` (Zod `.strict()`); campos de historia: `id`, `tipo: 'historia'`, `epica`, `titulo`, `etiquetas: string[]`, `relacionadas?: string[]`, `verificacion`, `cubre?: string[]` (endpoints `"POST /api/auth/login"` o rutas `"/login"` según la plataforma), `permisos?: string[]` (claves de `PERMISSIONS`); campos de épica: `id`, `tipo: 'epica'`, `titulo`, `etiquetas: ['epic']`
  - `type StoryFile = { kind: 'epic' | 'story'; path: string; fm: EpicFrontmatter | StoryFrontmatter; body: string }` (unión discriminada por `kind`)

- [ ] **Step 1: Crear el paquete.** `package.json` (`name: "@sigpro/stories"`, `private`, `type: module`, scripts `lint: eslint .`, `typecheck: tsc --noEmit`, `test: vitest run`, `stories: tsx src/cli.ts`; dependencias exactas como en `packages/shared` y `apps/api`: `@sigpro/shared` `workspace:*`, `zod`, `yaml`; dev: `tsx`, `typescript`, `vitest`, `@types/node`). `tsconfig.json` extiende `../../tsconfig.base.json` con `types: ["node"]`, `noEmit`, `include: ["src", "vitest.config.ts"]`. `vitest.config.ts` con `include: ['src/**/*.test.ts']`. Con la API parada, `pnpm install` (añade `yaml` con `--save-exact`; si pnpm rechaza una versión por `minimumReleaseAge`, elige la última permitida).
- [ ] **Step 2: Test que falla.** `model.test.ts`: el front matter del ejemplo de la spec (`US-LOGIN-003`, `[Web] Bloquear la cuenta tras 5 intentos fallidos`, `etiquetas: ['web']`, `relacionadas: ['US-LOGIN-002']`, `verificacion: 'ejecutada'`) pasa `storyFrontmatterSchema`; `id: 'US-LOGIN-3'` falla; `verificacion: 'otra'` falla; una clave desconocida falla; una épica con `etiquetas: ['web']` falla; `TITLE_PREFIX.get('movil')` es `'[Móvil]'`; `LABEL_DEFS` contiene exactamente los 8 nombres de las constantes globales.
- [ ] **Step 3: Verlo fallar.** Run: `pnpm --filter @sigpro/stories test`. Expected: FAIL (módulo `./model` no existe).
- [ ] **Step 4: Implementar `model.ts`** como describe Interfaces (regex de ids en el esquema: `^EP-[A-Z0-9-]+$`, `^US-[A-Z0-9-]+-\d{3}$`).
- [ ] **Step 5: Verlo pasar.** Run: `pnpm --filter @sigpro/stories test && pnpm --filter @sigpro/stories typecheck && pnpm --filter @sigpro/stories lint`. Expected: verde.
- [ ] **Step 6: Commit.** `git add packages/stories pnpm-lock.yaml` → `feat(stories): package skeleton and front matter model`.

### Task 2: Parseo y carga de archivos

**Files:**
- Create: `packages/stories/src/parse.ts`
- Test: `packages/stories/src/parse.test.ts`

**Interfaces:**
- Consumes: `StoryFile`, esquemas de `model.ts`.
- Produces: `type ParseResult = { ok: true; file: StoryFile } | { ok: false; path: string; error: string }`; `parseStoryFile(path: string, text: string): ParseResult`; `loadStoryFiles(root: string): Promise<readonly ParseResult[]>` (recursivo; solo `epic.md` y `US-*.md`; ordenado por ruta).

- [ ] **Step 1: Tests que fallan.** (a) el archivo de ejemplo de la spec produce `kind: 'story'` y `body` que empieza por `## Historia`; (b) el mismo texto con BOM y CRLF produce el mismo `fm` y `body` salvo los saltos normalizados a `\n` (**Review Focus 1**); (c) sin front matter → `ok: false` con `error` que contiene `front matter`; (d) YAML inválido → `ok: false`; (e) `tipo: epica` → `kind: 'epic'`; (f) `loadStoryFiles` sobre un directorio temporal (`fs.mkdtemp`) con `a/epic.md`, `a/US-A-001.md` y `a/README.md` devuelve 2 resultados; (g) sobre un directorio que no existe devuelve `[]` (el CLI se ejecuta antes de que exista `docs/user-stories`).
- [ ] **Step 2: Verlo fallar.** Run: `pnpm --filter @sigpro/stories test parse`. Expected: FAIL.
- [ ] **Step 3: Implementar `parse.ts`.** Separar el front matter con una expresión que tolere BOM y `\r?\n`; parsear con `yaml`; elegir el esquema por un mapa `tipo → esquema` (sin `switch`); traducir los errores de Zod a un texto corto con la ruta del campo.
- [ ] **Step 4: Verlo pasar.** Run: `pnpm --filter @sigpro/stories test && pnpm --filter @sigpro/stories typecheck && pnpm --filter @sigpro/stories lint`. Expected: verde.
- [ ] **Step 5: Commit.** `feat(stories): parse and load story files`.

### Task 3: Gherkin

**Files:**
- Create: `packages/stories/src/gherkin.ts`
- Test: `packages/stories/src/gherkin.test.ts`

**Interfaces:**
- Produces: `extractGherkinBlocks(body: string): readonly string[]`; `type Outline = { name: string; steps: readonly string[]; tables: readonly { header: readonly string[]; rows: readonly (readonly string[])[] }[] }`; `parseOutlines(gherkin: string): readonly Outline[]`; `placeholdersOf(step: string): readonly string[]`; `findEnglishKeywords(gherkin: string): readonly string[]`.

- [ ] **Step 1: Tests que fallan.** `extractGherkinBlocks` devuelve solo el contenido de los bloques ```` ```gherkin ```` (un cuerpo con uno `gherkin` y uno `ts` → 1). `parseOutlines` sobre un Esquema con `Dado/Cuando/Entonces/Y` y una tabla de 2 filas → 1 Outline, 4 pasos, `header: ['usuario','intento','resultado']`, 2 filas. `placeholdersOf('Cuando envío <usuario> con <contraseña>')` → `['usuario','contraseña']`; `placeholdersOf('Entonces el valor < 5 y > 3')` → `[]` (**Review Focus 4**). La fila `| a \| b | c |` → `['a | b', 'c']`. `findEnglishKeywords('Scenario Outline: x\n Given y\n Examples:')` → `['Scenario Outline','Given','Examples']`; en un texto en español → `[]`.
- [ ] **Step 2: Verlo fallar.** Run: `pnpm --filter @sigpro/stories test gherkin`. Expected: FAIL.
- [ ] **Step 3: Implementar `gherkin.ts`.** Marcador: `<` seguido de un carácter que no sea espacio, contenido sin `<`/`>`, y `>` precedido de no-espacio. Tablas: líneas que empiezan por `|`; dividir por `|` no escapado.
- [ ] **Step 4: Verlo pasar.** Run: `pnpm --filter @sigpro/stories test && pnpm --filter @sigpro/stories typecheck && pnpm --filter @sigpro/stories lint`. Expected: verde.
- [ ] **Step 5: Commit.** `feat(stories): gherkin outline parser`.

### Task 4: Reglas de lint y comando `stories lint`

**Files:**
- Create: `packages/stories/src/rules.ts`, `packages/stories/src/cli.ts`
- Modify: `package.json` (raíz): scripts `stories:lint`, `stories:coverage`, `stories:sync` → `pnpm --filter @sigpro/stories stories <comando>`
- Test: `packages/stories/src/rules.test.ts`, `packages/stories/src/cli.test.ts`

**Interfaces:**
- Consumes: `ParseResult`, `StoryFile`, `parseOutlines`, `extractGherkinBlocks`, `placeholdersOf`, `findEnglishKeywords`, `TITLE_PREFIX`.
- Produces: `type Finding = { path: string; id: string; rule: string; message: string }`; `lintStoryFiles(results: readonly ParseResult[]): readonly Finding[]`. Reglas (id estable): `frontmatter`, `id-unico`, `epica-existe`, `plataforma-unica`, `prefijo-titulo`, `archivo-id` (nombre de archivo = id y carpeta = slug de la épica), `relacionadas-existen`, `historia-como`, `esquema-requerido`, `placeholder-columna`, `fila-celdas`, `gherkin-ingles`, `no-ejecutable-etiqueta`, `ios-pendiente-nativo`, `terminos-prohibidos`, `mencion-suelta`.
- `parseCliArgs(argv: readonly string[]): { command: 'lint' | 'coverage' | 'sync' | null; apply: boolean; write: boolean; check: boolean }` (puro, en `cli.ts`; ignora un `--` suelto, porque `pnpm stories:sync -- --apply` lo reenvía).
- CLI: `stories lint` carga `docs/user-stories` (raíz del repo = `path.resolve(import.meta.dirname, '../../..')`), imprime `ruta: [regla] mensaje` y sale con código 1 si hay hallazgos.

- [ ] **Step 1: Tests que fallan.** Un helper `story(overrides)` arma un `ParseResult` válido (la historia de ejemplo de la spec) y cada test cambia una cosa. Caso positivo: la historia de ejemplo → 0 hallazgos. Negativos, uno por regla: id repetido; `epica` inexistente; dos etiquetas de plataforma / ninguna; título con prefijo `[Web]` en una historia `api`; sin Esquema; `<codigo>` sin columna; fila con una celda de más; `Scenario Outline`; `verificacion: no-ejecutable` sin la etiqueta `no-implementada` y al revés; historia `ios` con `verificacion: ejecutada`; el cuerpo contiene `data-testid`, `getByRole`, `planted-bugs` o `defecto plantado` (un caso cada uno); archivo `US-LOGIN-009.md` con id `US-LOGIN-003`. **Review Focus 5:** `escríbeme a admin@sigpro.test` pasa; `contacta a @maria` y `ver el paso #2` fallan; `` `@maria` `` y un bloque de código con `#2` pasan. `cli.test.ts`: `parseCliArgs(['lint'])` → `command: 'lint'`; `['sync','--apply']` y `['sync','--','--apply']` → `apply: true`; `['sync']` → `apply: false`; `['coverage','--write']` → `write: true`; `['coverage','--check']` → `check: true`; `[]` y `['otro']` → `command: null`.
- [ ] **Step 2: Verlo fallar.** Run: `pnpm --filter @sigpro/stories test rules`. Expected: FAIL.
- [ ] **Step 3: Implementar `rules.ts`** como un `ReadonlyMap<string, Rule>` de reglas puras `(ctx) => Finding[]` donde `ctx` trae el archivo y el índice de todos los archivos (ids, épicas); `lintStoryFiles` las recorre. Las menciones se buscan en el cuerpo sin bloques ni código en línea.
- [ ] **Step 4: Implementar `cli.ts`** con `util.parseArgs` y un mapa de comandos; en esta tarea solo `lint` (los otros imprimen «no implementado» y salen con 1).
- [ ] **Step 5: Verlo pasar.** Run: `pnpm --filter @sigpro/stories test && pnpm --filter @sigpro/stories typecheck && pnpm --filter @sigpro/stories lint && pnpm stories:lint`. Expected: tests verdes y `stories:lint` sale con 0 (todavía no hay historias).
- [ ] **Step 6: Commit.** `feat(stories): story linter and lint command`.

### Task 5: Render a issue de GitHub

**Files:**
- Create: `packages/stories/src/render.ts`
- Test: `packages/stories/src/render.test.ts`

**Interfaces:**
- Produces: `type IssueDraft = { id: string; kind: 'epic' | 'story'; title: string; body: string; labels: readonly string[]; epicId: string | null }`; `storyMarker(id: string): string`; `renderIssue(file: StoryFile): IssueDraft`; `markerOf(body: string): string | null`.

- [ ] **Step 1: Tests que fallan.** Con la historia de ejemplo: `title` = `titulo`; `labels` = `etiquetas`; `body` empieza por `<!-- sigpro-story-id: US-LOGIN-003 -->`, después una línea visible `**Id:** US-LOGIN-003 · **Épica:** EP-LOGIN`, el cuerpo original y una sección `## Relacionadas` con `US-LOGIN-002`; el cuerpo no contiene `---` de front matter ni `verificacion`; `epicId === 'EP-LOGIN'`. Una épica: `epicId === null`, `kind === 'epic'`. `markerOf(draft.body) === 'US-LOGIN-003'` y `markerOf('sin marca') === null`.
- [ ] **Step 2: Verlo fallar.** Run: `pnpm --filter @sigpro/stories test render`. Expected: FAIL.
- [ ] **Step 3: Implementar `render.ts`** (puro; los saltos de línea del cuerpo, `\n`).
- [ ] **Step 4: Verlo pasar.** Run: `pnpm --filter @sigpro/stories test && pnpm --filter @sigpro/stories typecheck && pnpm --filter @sigpro/stories lint`. Expected: verde.
- [ ] **Step 5: Commit.** `feat(stories): render stories as issue drafts`.

### Task 6: Sincronización con GitHub (en seco por defecto)

**Files:**
- Create: `packages/stories/src/sync.ts`, `packages/stories/src/gh.ts`
- Modify: `packages/stories/src/cli.ts` (comando `sync`)
- Test: `packages/stories/src/sync.test.ts`

**Interfaces:**
- Consumes: `IssueDraft`, `markerOf`, `LABEL_DEFS`.
- Produces (`sync.ts`):
  - `type RemoteIssue = { nodeId: string; number: number; title: string; body: string; labels: readonly string[]; state: 'OPEN' | 'CLOSED'; author: string; parentNumber: number | null }`
  - `type Op = { type: 'createLabel'; name: string; color: string; description: string } | { type: 'createIssue'; draft: IssueDraft } | { type: 'updateIssue'; number: number; draft: IssueDraft } | { type: 'linkSubIssue'; epicId: string; storyId: string }`
  - `planSync(input: { drafts: readonly IssueDraft[]; remote: readonly RemoteIssue[]; remoteLabels: readonly string[]; me: string }): readonly Op[]` (orden: etiquetas, épicas, historias, enlaces)
  - `type Gh = { me(): Promise<string>; listIssues(): Promise<readonly RemoteIssue[]>; listLabels(): Promise<readonly string[]>; createLabel(l: { name: string; color: string; description: string }): Promise<void>; createIssue(d: IssueDraft): Promise<{ nodeId: string; number: number }>; updateIssue(n: number, d: IssueDraft): Promise<void>; addSubIssue(parentNodeId: string, childNodeId: string): Promise<void> }`
  - `applyOps(ops: readonly Op[], gh: Gh, opts: { delayMs: number }): Promise<{ done: number; failedAt: Op | null; error: string | null }>`
- Produces (`gh.ts`): `makeGh(repo: string): Gh` sobre `execFile('gh', ['api', …])`: REST para etiquetas e issues (`POST/PATCH /repos/{repo}/issues`, `POST /repos/{repo}/labels`), GraphQL paginado para listar (campos: `id number title body state author{login} labels(first:20){nodes{name}} parent{number}`) y la mutación `addSubIssue`.

- [ ] **Step 1: Tests que fallan (`planSync`, `applyOps` con un `Gh` falso).**
  - Sin issues remotos y 1 épica + 2 historias: `[createLabel × (etiquetas que faltan, comparando sin mayúsculas), createIssue(épica), createIssue × 2, linkSubIssue × 2]`, en ese orden.
  - Idempotente: con los tres issues remotos ya iguales y enlazados (`parentNumber` = número de la épica) → `[]`.
  - Actualiza si cambia el título, el cuerpo o el conjunto de etiquetas; **no** si solo cambian los saltos de línea (`\r\n` frente a `\n`) o el orden de las etiquetas.
  - **Review Focus 2 (reanudar):** épica y una historia ya creadas, la otra no → solo `createIssue` de la que falta y `linkSubIssue` de las dos historias que no tienen padre; nada más.
  - **Review Focus 3 (autor ajeno):** un issue remoto con la marca de `US-LOGIN-001` pero `author: 'otra-persona'` y `me: 'gsanchezm'` → se emite `createIssue` y **no** `updateIssue` sobre el ajeno.
  - Dos drafts con el mismo título y distinto id no se confunden (se casan por marca, no por título).
  - Un issue remoto `CLOSED` con marca propia se actualiza si cambió, y la operación no lo reabre (el `Op` no lleva estado).
  - `applyOps` con `delayMs: 0` ejecuta en orden, resuelve `storyId`/`epicId` a `nodeId` con lo devuelto por `createIssue` (o por `listIssues` para los ya existentes), reintenta hasta 3 veces si el error contiene `rate limit` (espera inyectable), y ante cualquier otro error se detiene y devuelve `failedAt` y `error`.
- [ ] **Step 2: Verlo fallar.** Run: `pnpm --filter @sigpro/stories test sync`. Expected: FAIL.
- [ ] **Step 3: Implementar `sync.ts`** (planificación pura; `applyOps` recibe la espera como función inyectable con 1500 ms por defecto entre operaciones de escritura).
- [ ] **Step 4: Implementar `gh.ts`.** Sin lógica de negocio; cada método una llamada a `gh api`; el repositorio por defecto es `gsanchezm/sigpro`.
- [ ] **Step 5: Comando `stories sync`.** Sin flags: carga y valida (si el linter da hallazgos, aborta), arma los drafts, llama a `listIssues`, `listLabels` y `me`, e **imprime el plan** (recuento por tipo y una línea por operación). Con `--apply`: ejecuta `applyOps` e imprime el informe. Sin más flags.
- [ ] **Step 6: Verlo pasar.** Run: `pnpm --filter @sigpro/stories test && pnpm --filter @sigpro/stories typecheck && pnpm --filter @sigpro/stories lint`. Expected: verde.
- [ ] **Step 7: Humo de solo lectura.** Run: `pnpm stories:sync`. Expected: imprime `0 issues remotos` y un plan con 8 `createLabel` y ninguna otra operación; no ha escrito nada en GitHub (comprobar con `gh issue list --state all`: sigue vacío).
- [ ] **Step 8: Commit.** `feat(stories): idempotent GitHub sync with dry-run default`.

### Task 7: Cobertura

**Files:**
- Create: `packages/stories/src/coverage.ts`
- Modify: `packages/stories/src/cli.ts` (comando `coverage`)
- Test: `packages/stories/src/coverage.test.ts`

**Interfaces:**
- Consumes: `StoryFile` (`cubre`, `permisos`, etiquetas), `PERMISSIONS` de `@sigpro/shared`.
- Produces: `extractEndpoints(controllers: readonly string[]): readonly string[]` (textos de `*.controller.ts` → `"POST /api/auth/login"`); `extractWebRoutes(appTsx: string): readonly string[]`; `mobileRoutesFromFiles(files: readonly string[]): readonly string[]`; `type CoverageRow = { item: string; storyIds: readonly string[] }`; `type Coverage = { endpoints: readonly CoverageRow[]; webRoutes: readonly CoverageRow[]; mobileRoutes: readonly CoverageRow[]; permissions: readonly CoverageRow[] }`; `buildCoverage(sources: { endpoints: readonly string[]; webRoutes: readonly string[]; mobileRoutes: readonly string[]; permissions: readonly string[] }, files: readonly StoryFile[]): Coverage`; `renderCoverageMarkdown(c: Coverage): string`; `holes(c: Coverage): readonly string[]`.
- CLI: `stories coverage` reúne las fuentes del repo (controladores de `apps/api/src`, `apps/web/src/App.tsx`, árbol `apps/mobile/app`, `Object.keys(PERMISSIONS)`), imprime los huecos; `--write` escribe `docs/user-stories/COBERTURA.md`; `--check` sale con 1 si hay huecos o si el archivo está desactualizado.

- [ ] **Step 1: Tests que fallan.** `extractEndpoints` sobre `@Controller('admin') … @Post('reset')` → `POST /api/admin/reset`; `@Controller()` + `@Get('programs/:code/milestones')` → `GET /api/programs/:code/milestones`; `@Controller('audit')` + `@Get()` → `GET /api/audit`. `extractWebRoutes` sobre un fragmento de `App.tsx` devuelve `/login`, `/programs/:code`, … y excluye `/`, `*` y `/lab`. `mobileRoutesFromFiles(['(app)/programs/[code]/index.tsx','(app)/(more)/admin.tsx','index.tsx','_layout.tsx','legal/privacy.tsx'])` → `['/programs/:code','/admin','/legal/privacy']`. `buildCoverage`: una historia `api` con `cubre: ['POST /api/auth/login']` cubre ese endpoint y no una ruta web `/login`; una `movil` con `cubre: ['/login']` cubre la ruta móvil; `permisos: ['program.create']` cubre esa clave; `ios` y `android` cuentan como móvil. `holes` lista lo que no tiene historias. `renderCoverageMarkdown` produce 4 tablas con las historias por elemento y marca `—` en los huecos.
- [ ] **Step 2: Verlo fallar.** Run: `pnpm --filter @sigpro/stories test coverage`. Expected: FAIL.
- [ ] **Step 3: Implementar `coverage.ts` y el comando.**
- [ ] **Step 4: Verlo pasar.** Run: `pnpm --filter @sigpro/stories test && pnpm --filter @sigpro/stories typecheck && pnpm --filter @sigpro/stories lint`. Expected: verde.
- [ ] **Step 5: Humo.** Run: `pnpm stories:coverage`. Expected: lista de huecos con todos los endpoints, rutas y permisos (aún no hay historias); el nº de endpoints coincide con los decoradores de los controladores (comprobar con `grep -rhoE "@(Get|Post|Put|Patch|Delete)\(" apps/api/src --include=*.controller.ts | wc -l`).
- [ ] **Step 6: Commit.** `feat(stories): coverage matrix`.

### Task 8: Cableado del repositorio y guía del redactor

**Files:**
- Modify: `.gitignore`, `.github/workflows/ci.yml` (paso `pnpm stories:lint` tras el lint), `docs/CHANGELOG.md`, `docs/STATUS.md` (sección «Historias de usuario» con estado y lo pendiente)
- Create: `docs/user-stories/README.md`, `docs/story-discrepancies.md` (local, ignorado)

- [ ] **Step 1:** Añadir a `.gitignore`, junto a `docs/planted-bugs.md`, `docs/story-discrepancies.md` con un comentario que explique que es material de instructor. Run: `git check-ignore docs/story-discrepancies.md`. Expected: imprime la ruta.
- [ ] **Step 2:** Crear `docs/story-discrepancies.md` con solo una cabecera y una tabla vacía (épica · historia · qué dice la historia · qué hace la app · fecha).
- [ ] **Step 3:** `docs/user-stories/README.md`: guía para quien escribe y para quien lee (qué es una épica y una historia, etiquetas, plantilla completa con el ejemplo de la spec más los campos opcionales `cubre` (endpoints `"POST /api/auth/login"` en `api`, rutas `"/login"` en `web`/`movil`/`ios`/`android`) y `permisos` (claves de `PERMISSIONS`), reglas del formato y de `no-implementada`, cómo se lee un Esquema del escenario, comandos `stories:lint` / `stories:coverage` / `stories:sync`). **No** menciona los bugs plantados.
- [ ] **Step 4:** Paso de CI `Historias de usuario` con `pnpm stories:lint`. Validar el YAML con `actionlint` si está instalado.
- [ ] **Step 5:** Una línea en `docs/CHANGELOG.md` y la sección en `docs/STATUS.md`.
- [ ] **Step 6: Verificar.** Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm stories:lint`. Expected: todo verde.
- [ ] **Step 7: Commit** con rutas concretas (`.gitignore`, `ci.yml`, `docs/CHANGELOG.md`, `docs/STATUS.md`, `docs/user-stories/README.md`): `docs(stories): authoring guide, CI lint step and gitignored discrepancies file`.

---

## Procedimiento por épica (PE)

Cada tarea de contenido repite estos pasos para cada épica de su lista. «Fuentes» = `docs/SIGPRO-plan.md` (backlog), `docs/DECISIONS.md`, `docs/MOBILE-PARITY.md`, `docs/GUIA-ALUMNO.md` (usuarios, roles y códigos del seed), la pantalla web (`apps/web/src/pages/<módulo>/`), el controlador y servicio de la API, `packages/shared/src` (reglas, esquemas, `permissions.ts`, i18n `es`) y la pantalla móvil equivalente (`apps/mobile/app`, `apps/mobile/src`).

1. **Pila limpia.** (Docker Desktop encendido) `docker compose up -d db`; `pnpm --filter @sigpro/shared build`; con `PLANTED_BUGS=false` en el entorno del proceso: `pnpm --filter api build && pnpm --filter api start` (`MSYS_NO_PATHCONV=1` si un argumento empieza por `/`); `pnpm --filter web dev` (`:5173`); para móvil `pnpm --filter mobile dev` (Expo web `:8081`). Comprobar `curl localhost:3000/api/config` → `plantedBugs: false`. Tenant de trabajo: `alumno20` (nadie más lo usa); restaurarlo al terminar con el reset del tenant (`docs/GUIA-ALUMNO.md`). Al acabar la sesión: `docker compose stop db`.
2. **Leer** las fuentes y `docs/planted-bugs.md` (solo para saber qué es intencionado; no citarlo en nada).
3. **Inventariar** los comportamientos de la épica y escribir `epic.md` (objetivo, alcance, plataformas, fuera de alcance) con la lista de historias previstas: una por comportamiento y plataforma, `ios`/`android` solo si cambia por el sistema, `no-implementada` según las reglas de la spec.
4. **Redactar** cada `US-<SLUG>-NNN.md` con el formato de `docs/user-stories/README.md`, rellenando `cubre` y `permisos`. Describen lo correcto: el valor límite correcto, el orden correcto.
5. **Ejecutar los ejemplos** contra la pila limpia: API con `curl`/`fetch`; web y Expo web con el navegador (herramientas de Chrome o un script de Playwright en el scratchpad). Lo que no coincida: si es una capacidad inexistente, historia `no-implementada`; si existe y difiere (y no es plantado), la historia dice lo correcto y se anota en `docs/story-discrepancies.md`. Fijar `verificacion` (`ejecutada` | `codigo` | `pendiente-nativo` | `no-ejecutable`).
6. **Validar.** Run: `pnpm stories:lint`. Expected: 0 hallazgos.
7. **Commit** de la carpeta de la épica y, si cambió, de nada más (el `story-discrepancies.md` está ignorado): `docs(stories): EP-<SLUG> <resumen>`.

---

### Task 9: Piloto `EP-LOGIN` (puerta de aprobación)

**Files:**
- Create: `docs/user-stories/login/epic.md` y `US-LOGIN-NNN.md`
- Modify: `docs/user-stories/README.md` (si el usuario pide cambios de formato), `packages/stories/src/rules.ts` (idem)

Alcance de partida (el redactor añade, divide o fusiona según lea el código; SSO se funde aquí en lugar de ser épica propia):

| Plataforma | Historias previstas |
| --- | --- |
| `api` | login válido (`mfaRequired` y token temporal) · credenciales inválidas (401, `attempts=n`) · bloqueo en el 5.º intento (423) · cuenta bloqueada de entrada (`bloqueado@sigpro.test`) · cuenta pendiente (403 `pending_approval`, `pendiente@sigpro.test`) · cuenta desactivada (403 `account_disabled`) · cierre de sesión · contrato del SSO (501 `sso_not_available`) |
| `web` | formulario y enlaces · validación de campos antes de enviar · error de credenciales con el nº de intento · aviso de bloqueo · aviso de pendiente y de desactivada · mostrar/ocultar contraseña · mantener la sesión · cerrar sesión y aviso «Sesión cerrada correctamente» · acceso con SSO (`no-implementada`) |
| `movil` | formulario y enlaces · validación · error de credenciales · aviso de bloqueo, pendiente y desactivada · cerrar sesión · **`no-implementada`:** mostrar contraseña, mantener la sesión, aviso de sesión cerrada, acceso con SSO |
| `ios` / `android` | solo si hay una diferencia observable (p. ej. teclado y botón atrás); `ios` con `pendiente-nativo` |

- [ ] **Step 1:** Ejecutar el PE completo para `EP-LOGIN` (carpeta `docs/user-stories/login/`).
- [ ] **Step 2: Sincronización en seco.** Run: `pnpm stories:sync`. Expected: plan con 8 `createLabel`, 1 `createIssue` de épica, N de historias y N enlaces; sin escrituras.
- [ ] **Step 3: Revisión con el usuario.** Mostrar la épica, 3 historias representativas (una `api`, una `web`, una `no-implementada`) y la salida en seco. **Parar y esperar aprobación del formato.** Si pide cambios: actualizar README, reglas del linter y tests, y regenerar el piloto.
- [ ] **Step 4: Commit** (si hubo cambios de formato, primero ellos): `docs(stories): EP-LOGIN pilot`.

### Task 10: Lote Acceso restante

Épicas: `EP-MFA`, `EP-REGISTRO` (registro y reenvío de verificación; el reenvío es 202 sin envío real: historia ejecutable del contrato y otra `no-implementada` del correo), `EP-RECUPERAR` (idem), `EP-SESION` (renovación de token con ventana de 15 min, expiración, refresh en logout).

- [ ] **Step 1:** PE por cada épica, una a una. **Step 2:** `pnpm stories:lint && pnpm stories:sync` (en seco) sin errores. **Step 3:** línea en `docs/CHANGELOG.md` y actualizar `docs/STATUS.md`; commit `docs(stories): access epics`.

### Task 11: Lote Programas

Épicas: `EP-PROG-LISTA` (filtros, orden, paginación de 10, búsqueda), `EP-PROG-METRICAS`, `EP-PROG-DETALLE`, `EP-PROG-ALTA` (asistente y edición, validaciones de fechas y presupuesto > 0), `EP-PROG-GESTION` (archivar, duplicar, eliminar, selección múltiple, CSV), `EP-HITOS` (regla «100 % = cumplido»), `EP-PROVEEDORES`.

- [ ] **Step 1:** PE por cada épica. **Step 2:** `pnpm stories:lint && pnpm stories:sync` en seco. **Step 3:** CHANGELOG, STATUS, commit `docs(stories): programs epics`.

### Task 12: Lote Requisitos

Épicas: `EP-REQ-ARBOL`, `EP-REQ-EDICION` (alta, edición, borrado, reordenar; «Mover a…» en móvil), `EP-REQ-FLUJO` (transiciones y permisos `requirement.*`), `EP-REQ-TRAZA`.

- [ ] **Step 1:** PE por cada épica. **Step 2:** lint y sync en seco. **Step 3:** CHANGELOG, STATUS, commit `docs(stories): requirements epics`.

### Task 13: Lote Verificación y No conformidades

Épicas: `EP-VER-CASOS`, `EP-VER-EJECUCION` (evidencias PNG/PDF, validación de archivos), `EP-VER-INFORME`, `EP-NC-TABLERO` (transiciones válidas, p. ej. `rejected` solo desde `in_analysis`), `EP-NC-GESTION` (alta, edición, asignación, comentarios, cierre con mínimo de 20 caracteres).

- [ ] **Step 1:** PE por cada épica. **Step 2:** lint y sync en seco. **Step 3:** CHANGELOG, STATUS, commit `docs(stories): verification and nonconformity epics`.

### Task 14: Lote Documentos y Panel de misión

Épicas: `EP-DOC-LISTA`, `EP-DOC-VERSIONES`, `EP-DOC-RESTRINGIDOS` (`document.viewRestricted`), `EP-MISION-KPI`, `EP-MISION-FEED` (WebSocket; el KPI «NC abiertas» se actualiza en vivo).

- [ ] **Step 1:** PE por cada épica. **Step 2:** lint y sync en seco. **Step 3:** CHANGELOG, STATUS, commit `docs(stories): documents and mission epics`.

### Task 15: Lote Administración

Épicas: `EP-ADMIN-USUARIOS` (incluye la aprobación de cuentas pendientes como `no-implementada`, `self_change`, `last_admin`), `EP-AUDITORIA`, `EP-CAOS-RESET`.

- [ ] **Step 1:** PE por cada épica. **Step 2:** lint y sync en seco. **Step 3:** CHANGELOG, STATUS, commit `docs(stories): administration epics`.

### Task 16: Lote Transversales

Épicas: `EP-I18N`, `EP-TEMA`, `EP-NAVEGACION` (menú, búsqueda global, campana, responsive), `EP-TOASTS` (autocierre a 3 s), `EP-PERFIL`, `EP-LEGAL-AYUDA`, `EP-MULTITENANT-PERMISOS` (aislamiento por `tenant_id`, matriz `PERMISSIONS`), `EP-A11Y`, `EP-API-PLATAFORMA` (health, config, OpenAPI).

- [ ] **Step 1:** PE por cada épica. **Step 2:** lint y sync en seco. **Step 3:** CHANGELOG, STATUS, commit `docs(stories): cross-cutting epics`.

### Task 17: Cobertura y cierre del contenido

**Files:**
- Create: `docs/user-stories/COBERTURA.md` (generado)
- Modify: `.github/workflows/ci.yml` (añade `pnpm stories:coverage --check` junto a `stories:lint`), historias que cierren huecos

- [ ] **Step 1:** Run: `pnpm stories:coverage`. Expected: lista de huecos. Cerrar cada uno con una historia o justificarlo por escrito en `docs/user-stories/README.md` (p. ej. endpoints de plataforma). Repetir hasta 0 injustificados.
- [ ] **Step 2:** Run: `pnpm stories:coverage --write && pnpm stories:coverage --check`. Expected: exit 0.
- [ ] **Step 3:** Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm stories:lint`. Expected: verde.
- [ ] **Step 4:** Comprobar que ningún entregable delata un defecto plantado: `grep -rniE "planted|plantado" docs/user-stories packages/stories` → solo las reglas del linter y sus tests.
- [ ] **Step 5:** Commit `docs(stories): coverage matrix` y paso de CI de cobertura.

### Task 18: Sincronización con GitHub (puerta de autorización)

- [ ] **Step 1: Plan en seco completo.** Run: `pnpm stories:sync`. Expected: etiquetas, épicas, historias y enlaces; sin escrituras. Mostrar al usuario los recuentos (épicas, historias por etiqueta, `no-implementada`) y 3 issues renderizados.
- [ ] **Step 2: Autorización.** Preguntar al usuario si publica y cuándo. **No continuar sin un sí explícito.** El `git push` de los commits también necesita su autorización.
- [ ] **Step 3: Publicar** (solo con autorización): `pnpm stories:sync -- --apply`. Si se detiene a mitad, relanzar el mismo comando (es reanudable).
- [ ] **Step 4: Verificar.** Run: `gh issue list --state all --limit 1000 --json number --jq length`. Expected: épicas + historias del plan en seco. Run: `pnpm stories:sync`. Expected: 0 operaciones (todo creado y enlazado). Comprobar un hijo (las épicas se crean primero: el primer hijo es el número `nº de épicas + 1`) con `gh api graphql -f query='{ repository(owner:"gsanchezm", name:"sigpro") { issue(number: 39) { parent { number } } } }'` ajustando el número; debe devolver el número de su épica. Registrar los números en `docs/STATUS.md` y commit `docs(stories): publish status` (el push, con su autorización).
