<!--
SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>

SPDX-License-Identifier: MIT
-->

# @damian-buho/support-ukraine

[![StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://github.com/vshymanskyy/StandWithUkraine/blob/main/docs/README.md)
![NPM Version](https://img.shields.io/npm/v/%40damian-buho%2Fsupport-ukraine?style=flat-square)
![npm package minimized gzipped size (scoped)](https://img.shields.io/bundlejs/size/%40damian-buho/support-ukraine?style=flat-square)
![NPM Downloads](https://img.shields.io/npm/dm/%40damian-buho%2Fsupport-ukraine?style=flat-square)
![NPM License](https://img.shields.io/npm/l/%40damian-buho%2Fsupport-ukraine?style=flat-square)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)
![Libraries.io dependency status for GitHub repo](https://img.shields.io/librariesio/github/damian-buho/support-ukraine?style=flat-square)

[![Pipeline](https://github.com/damian-buho/support-ukraine/actions/workflows/pipeline.yaml/badge.svg)](https://github.com/damian-buho/support-ukraine/actions/workflows/pipeline.yaml)
[![CodeQL](https://github.com/damian-buho/support-ukraine/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/damian-buho/support-ukraine/actions/workflows/github-code-scanning/codeql)
[![Known Vulnerabilities](https://snyk.io/test/npm/%40damian-buho%2Fsupport-ukraine/badge.svg)](https://snyk.io/test/npm/%40damian-buho%2Fsupport-ukraine)
[![REUSE status](https://api.reuse.software/badge/github.com/damian-buho/support-ukraine)](https://api.reuse.software/info/github.com/damian-buho/support-ukraine)

- Browser library that adds a Ukraine-support charity banner to any website.
- Shows randomly selected Ukrainian charity localized to the visitor's language and respect RTL scripts.
- You can choose kinds of charities.
- Inspired by [hejny/Ukraine](https://github.com/hejny/Ukraine).

## Screenshots

[Demo / Play with settings](https://damian-buho.github.io/support-ukraine/dev.html)

![I18N support](https://raw.githubusercontent.com/damian-buho/support-ukraine/dev/docs/screenshots/english.png)

![Dark theme support](https://raw.githubusercontent.com/damian-buho/support-ukraine/dev/docs/screenshots/spanish.png)

![RTL Support](https://raw.githubusercontent.com/damian-buho/support-ukraine/dev/docs/screenshots/arabic.png)

## Install

### npm

```shell
npm install @damian-buho/support-ukraine
```

### CDN (no build step)

```html
<script type="module">
    import {supportUkraineBlock} from 'https://cdn.jsdelivr.net/npm/@damian-buho/support-ukraine@1/+esm'

    await supportUkraineBlock()
</script>
```

For optimal Core Web Vitals, avoid the chained locale fetch by loading a pre-localized build:

```html
<script type="module">
    import {supportUkraineBlock} from 'https://cdn.jsdelivr.net/npm/@damian-buho/support-ukraine@1/dist/es.js'

    await supportUkraineBlock()
</script>
```

## Usage

```ts
import {supportUkraineBlock} from '@damian-buho/support-ukraine'

// Auto-detect locale from navigator.language
await supportUkraineBlock()

// Force a specific locale
await supportUkraineBlock({locale: 'es'})
```

For optimal Core Web Vitals, let your server or router decide the language and load only the needed build — no second network request:

```ts
import {supportUkraineBlock} from '@damian-buho/support-ukraine/es'

await supportUkraineBlock()
```

Available localized entry points: `ar`, `de`, `en`, `es`, `fr`, `hi`, `it`, `ja`, `ko`, `nl`, `pl`, `pt`, `sv`, `th`, `uk`, `zh`. The `locale` option is ignored in these builds — they are already localized.

If you still want to read `navigator.language` yourself and avoid the library’s chained fetch, map it to the right bundle:

```html
<script type="module">
  const base = (navigator.language.split('-')[0] ?? 'en').toLowerCase()
  const supported = new Set(['ar','de','en','es','fr','hi','it','ja','ko','nl','pl','pt','sv','th','uk','zh'])
  const locale = supported.has(base) ? base : 'en'

  const { supportUkraineBlock } = await import(
    `https://cdn.jsdelivr.net/npm/@damian-buho/support-ukraine@1/dist/${locale}.js`
  )

  await supportUkraineBlock()
</script>
```

With a bundler the same idea uses the package entry points:

```ts
const base = (navigator.language.split('-')[0] ?? 'en').toLowerCase()
const supported = ['ar','de','en','es','fr','hi','it','ja','ko','nl','pl','pt','sv','th','uk','zh'] as const
type Locale = (typeof supported)[number]
const locale: Locale = (supported as readonly string[]).includes(base) ? (base as Locale) : 'en'

const { supportUkraineBlock } = await import(`@damian-buho/support-ukraine/${locale}`)

await supportUkraineBlock()
```

In both cases only one network request is made — the pre-localized `dist/<locale>.js` — instead of `index.js` → locale chunk.

The banner is prepended to `document.body` by default. It displays a randomly selected charity with the format:

> 🇺🇦 Support Ukraine: Come Back Alive: Strengthening Ukraine's defense

The entire block is a clickable link to the charity's donation page.

## Options

| Option        | Type                                | Default           | Description                                                                                                          |
|---------------|-------------------------------------|-------------------|----------------------------------------------------------------------------------------------------------------------|
| `element`     | `HTMLElement`                       | `document.body`   | Target mount element for the banner                                                                                  |
| `mode`        | `'shift' \| 'overlap' \| 'replace'` | `'shift'`         | `'shift'` pushes page content down, `'overlap'` floats on top, `'replace'` swaps a same-class placeholder element |
| `fontSize`    | `string`                            | `'87.5%'`         | Banner font size; `%` anchors to the widget's own 16px host box, ignoring document root scaling                      |
| `charities`   | `Charity[]`                         | _(built-in)_      | Custom charity list; replaces the built-in database                                                       |
| `tags`        | `CharityTag[]`                      | _(all)_           | Filter charities by category: `'military'`, `'humanitarian'`, `'animals'`                                            |
| `dontRepeat`  | `boolean`                           | `true`            | Avoid repeating charities across page loads using `localStorage`                                                     |
| `isInConsole` | `boolean`                           | `true`            | Log the selected charity to the dev console                                                                          |
| `locale`      | `string`                            | _(auto-detected)_ | Override the auto-detected BCP 47 language tag                                                                       |

### Filtering by category

Show only military charities:

```ts
await supportUkraineBlock({tags: ['military']})
```

### Replace mode (no layout shift)

Use `replace` mode to swap a same-class placeholder element (any tag) so the banner takes its place without shifting
page content:

```html
<!-- Static HTML: renders nothing until JS runs. Mirror the host box (font-size 16px,
     min-height 2.5em = the banner's reserved height) so swap-in causes zero shift. -->
<header class="support-ukraine-block" style="font-size:16px;min-height:2.5em"></header>
```

```ts
await supportUkraineBlock({mode: 'replace'})
```

The banner finds the first element with class `support-ukraine-block` inside the mount element and replaces it in place.
If no placeholder is found, it falls back to prepending. This eliminates cumulative layout shift (CLS) because the
placeholder already reserves the exact space the banner needs.

### Disabling repeat prevention

Allow the same charity to appear on every page load:

```ts
await supportUkraineBlock({dontRepeat: false})
```

## Locale support

The banner is translated to the visitor's language automatically. The following locales are supported:

| Language   | Code | RTL                |
|------------|------|--------------------|
| Arabic     | `ar` | Yes                |
| Chinese    | `zh` |                    |
| Dutch      | `nl` |                    |
| English    | `en` | (default fallback) |
| French     | `fr` |                    |
| German     | `de` |                    |
| Hindi      | `hi` |                    |
| Italian    | `it` |                    |
| Japanese   | `ja` |                    |
| Korean     | `ko` |                    |
| Polish     | `pl` |                    |
| Portuguese | `pt` |                    |
| Spanish    | `es` |                    |
| Swedish    | `sv` |                    |
| Thai       | `th` |                    |
| Ukrainian  | `uk` |                    |

RTL scripts are detected automatically and the banner direction is set accordingly.

For best performance, pick the locale yourself (from `Accept-Language`, `<html lang>`, or your i18n router) and import the matching entry point. The generic `dist/index.js` uses `navigator.language` and a dynamic `import()` for the locale chunk — that chained request delays the banner and hurts CWV. Each `dist/<locale>.js` bundles its messages statically, so it renders in a single fetch.

## Architecture

```
src/
├── index.ts          # Auto-detect build (navigator.language + dynamic import)
├── banner.ts         # Shared banner rendering (mountBanner, DEFAULT_CHARITIES)
├── types.ts          # Charity, SupportUkraineBlockOptions, etc.
├── i18n.ts           # Locale detection, loading, merging (generic build only)
├── locales/          # Per-locale translation files
├── charities.yaml    # Built-in charity database
├── entries/          # Per-locale entry points (ar.ts, es.ts, …) — static import, no fetch
└── styles.scss       # Banner CSS (compiled by tsup)

dist/
├── index.js          # Generic auto-detect build + locale chunks (en-*.js, es-*.js …)
├── en.js, es.js …    # Pre-localized self-contained builds — one fetch, no chained request
└── index.d.ts        # Types (shared by all entry points)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
