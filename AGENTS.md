<!--
SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>

SPDX-License-Identifier: MIT
-->

# Agents — support-ukraine

## Project overview

Browser library that adds a Ukraine-support charity banner to any website.
Displays a randomly selected Ukrainian charity with a "Support Ukraine"
message, localized to the visitor's language with RTL support. Inspired by
[hejny/Ukraine](https://github.com/hejny/Ukraine), rewritten as a modern
TypeScript ESM package.

- Language: TypeScript → compiled ESM (`"type": "module"`)
- Runtime: Node.js ≥ 22.13.0 (build/test); browser (runtime)
- Entry point: `dist/index.js` (library API)
- Package manager: npm
- Build: tsup (esbuild-powered) with custom YAML + SCSS plugins

## Commands

```
just build         # tsup && tsc --emitDeclarationOnly (library only)
just build-test    # tsup test entry (TEST_BUILD=1)
just lint          # ESLint (typescript-eslint, unicorn, import-x, promise, n, tsdoc) + reuse
just format        # Prettier write
just format-check  # Prettier check (CI)
just test          # node --test 'dist/test/index.test.js'
just audit         # npm run audit
just pipeline      # format → lint → build → build-test → test  (full CI gate)
```

## TypeScript strictness

tsconfig enables: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`,
`noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
`isolatedModules`.

- MUST use `import type` for type-only imports
- MUST NOT use `any` (ESLint warns; avoid unless unavoidable)
- MUST prefer inline type narrowing (`typeof x === 'string'`) over `as T` casts
- Use `as T` only when TypeScript cannot follow the control flow but correctness
  is provable by the surrounding logic

## Architecture

```
src/
├── index.ts          # Auto-detect build: supportUkraineBlock() via navigator.language + dynamic import
├── banner.ts         # Shared rendering: mountBanner(), DEFAULT_CHARITIES, mergeCharities(), isRTL()
├── types.ts          # Hand-written validators: charitySchema, charitiesSchema, SupportUkraineBlockOptions
├── i18n.ts           # detectLocale(), loadLocale() (generic build only)
├── locales/
│   ├── index.ts      # resolveLocale(), localeLoaders, RTL_LOCALES, SupportedLocale
│   ├── en.yaml       # English strings
│   ├── es.yaml       # Spanish
│   ├── ar.yaml       # Arabic (RTL)
│   └── ...           # 16 locales total
├── entries/          # Per-locale entry points (ar.ts, en.ts …) — static locale import, no dynamic fetch
├── charities.yaml    # Built-in charity database (validated by charitiesSchema)
├── styles.scss       # Banner CSS (compiled to string by esbuild plugin)
└── environment.d.ts  # Module declarations for *.yaml and *.scss
tests/
└── index.test.ts     # node:test + node:assert
dist/                 # tsup output
├── index.js          # Generic auto-detect build + locale chunks (en-*.js …) — two fetches
├── en.js, es.js …    # Pre-localized self-contained builds — one fetch, optimal CWV
└── index.d.ts        # Types (shared by all entry points: "." and "./<locale>")
```

### Build pipeline

tsup compiles both library and tests. Two esbuild plugins handle non-JS assets:

- **yamlPlugin** — reads `.yaml` files, parses with yaml (eemeli), emits as JS modules
- **scssPlugin** — compiles `.scss` with sass, emits CSS as a JS string

Library build is two tsup configs (array):

- **generic**: `src/index.ts` → `dist/index.js` with `splitting: true` — dynamic `import()` keeps each locale as a separate chunk loaded on demand.
- **localized**: `src/entries/*.ts` → `dist/<locale>.js` with `splitting: false` — each locale YAML is imported statically, so the bundle is self-contained with no chained request.

Both use `platform: 'browser'` with `minify: true` (esbuild's minifier — locals mangle, exports preserved, no `dropConsole` so the `isInConsole` option still works at runtime). Test build uses `platform: 'node'` with `removeNodeProtocol: false` to preserve `node:test` / `node:assert` imports without a post-build fixup script, and stays un-minified for readable stack traces.

### Data flow

Generic (auto-detect):

```
supportUkraineBlock(options)
  → detectLocale()              → SupportedLocale (from navigator.languages / navigator.language)
  → loadLocale()                → LocaleMessages (cached, lazy-loaded per locale)
  → mountBanner(lang, messages) → DOM construction → mount.prepend(banner)
```

Localized (pre-bundled, e.g. `dist/es.js`):

```
supportUkraineBlock(options)
  → mountBanner('es', esMessages) → DOM construction → mount.prepend(banner)
    (no detectLocale / loadLocale — messages are bundled inline, `locale` option is ignored)
```

Shared after `mountBanner`:

```
mergeCharities()            → Charity[] (localized taglines)
  → filter by tags         → Charity[]
  → updateSeen()+randomItem → Charity (dontRepeat via localStorage)
  → header with lang+dir   → mount.prepend
```

### SupportUkraineBlockOptions

| Field | Type | Default | Notes |
|---|---|---|---|
| `element` | `HTMLElement` | `document.body` | Target mount point |
| `mode` | `'shift' \| 'overlap' \| 'replace'` | `'shift'` | Shifts content down, floats on top, or swaps a same-class placeholder element (any tag) |
| `fontSize` | `string` | `'87.5%'` | Banner font size — % resolves against the host box's 16px base, immune to root scaling |
| `charities` | `Charity[]` | _(built-in)_ | Custom charity list |
| `tags` | `CharityTag[]` | _(all)_ | Filter: `'military'`, `'humanitarian'`, `'animals'` |
| `dontRepeat` | `boolean` | `true` | Avoid repeats via localStorage |
| `isInConsole` | `boolean` | `true` | Log selected charity to dev console |
| `locale` | `string` | _(auto-detected)_ | Override BCP 47 language tag |

## Testing

Tests use the native Node.js test runner (`node:test` + `node:assert`). No mocha
or jest. Test files live in `tests/` and are compiled to `dist/test/` by tsup.

```
just test          # single run
just test-verbose  # spec reporter
just coverage      # --experimental-test-coverage
```

## ESLint plugins active

- `typescript-eslint` — strict TS checks
- `eslint-plugin-unicorn` — enforces many modern JS patterns (flat/recommended)
- `eslint-plugin-import-x` — import order/resolution
- `eslint-plugin-n` — Node.js best practices
- `eslint-plugin-promise` — promise anti-patterns
- `eslint-plugin-tsdoc` — TSDoc comment syntax (warn only)
- `eslint-config-prettier` — disables formatting rules that conflict with Prettier

## CI/CD

Two GitHub Actions workflows:

- **pipeline.yaml** — runs on PRs and pushes to `main`:
  - `checks` job: lint, format:check, audit (Node 24, ubuntu)
  - `test` job: Node 24, ubuntu-26.04
- **release.yaml** — fires via `workflow_run` after Pipeline succeeds:
  - `gate` job: resolves tag at HEAD, deduplicates
  - `publish-npm` job: OIDC trusted publishing, creates GitHub release

### Release flow

```bash
# 1. bump version (cog updates package.json + CITATION.cff, creates signed tag)
cog bump --auto

# 2. push commit + tag to main
git push origin main && git push origin X.Y.Z

# 3. Pipeline runs → Release fires → npm publish + GitHub release created
```

## Lefthook hooks

- **pre-commit**: prettier (staged files), eslint (staged files), audit, build, test
- **pre-push**: `just pipeline` (full CI gate)

## Community docs

CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, SUPPORT.md, CITATION.cff
are generated by `pf-cli` — not hand-edited.
