<!--
SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>

SPDX-License-Identifier: MIT
-->

# @damian-buho/support-ukraine

[![StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://github.com/vshymanskyy/StandWithUkraine/blob/main/docs/README.md)
![NPM Version](https://img.shields.io/npm/v/%40damian-buho%2Fsupport-ukraine?style=flat-square)
![NPM Downloads](https://img.shields.io/npm/dm/%40damian-buho%2Fsupport-ukraine?style=flat-square)
![NPM License](https://img.shields.io/npm/l/%40damian-buho%2Fsupport-ukraine?style=flat-square)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[![Pipeline](https://github.com/damian-buho/support-ukraine/actions/workflows/pipeline.yaml/badge.svg)](https://github.com/damian-buho/support-ukraine/actions/workflows/pipeline.yaml)
[![CodeQL](https://github.com/damian-buho/support-ukraine/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/damian-buho/support-ukraine/actions/workflows/github-code-scanning/codeql)
[![Known Vulnerabilities](https://snyk.io/test/npm/%40damian-buho%2Fsupport-ukraine/badge.svg)](https://snyk.io/test/npm/%40damian-buho%2Fsupport-ukraine)
[![REUSE status](https://api.reuse.software/badge/github.com/damian-buho/support-ukraine)](https://api.reuse.software/info/github.com/damian-buho/support-ukraine)

- Browser library that adds a Ukraine-support charity banner to any website.
- Shows randomly selected Ukrainian charity localized to the visitor's language and respect RTL scripts.
- You can choose kinds of charities.
- Inspired by [hejny/Ukraine](https://github.com/hejny/Ukraine).

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

## Usage

```ts
import {supportUkraineBlock} from '@damian-buho/support-ukraine'

// Auto-detect locale from navigator.language
await supportUkraineBlock()

// Force a specific locale
await supportUkraineBlock({locale: 'es'})
```

The banner is prepended to `document.body` by default. It displays a randomly selected charity with the format:

> 🇺🇦 Support Ukraine: Come Back Alive: Strengthening Ukraine's defense

The entire block is a clickable link to the charity's donation page.

## Options

| Option        | Type                   | Default           | Description                                                               |
|---------------|------------------------|-------------------|---------------------------------------------------------------------------|
| `element`     | `HTMLElement`          | `document.body`   | Target mount element for the banner                                       |
| `mode`        | `'shift' \| 'overlap' \| 'replace'` | `'shift'`         | `'shift'` pushes page content down, `'overlap'` floats on top, `'replace'` swaps a same-class `<header>` placeholder |
| `fontSize`    | `string`               | `'0.875rem'`      | Banner font size                                                          |
| `tags`        | `CharityTag[]`         | _(all)_           | Filter charities by category: `'military'`, `'humanitarian'`, `'animals'` |
| `dontRepeat`  | `boolean`              | `true`            | Avoid repeating charities across page loads using `localStorage`          |
| `isInConsole` | `boolean`              | `true`            | Log the selected charity to the dev console                               |
| `locale`      | `string`               | _(auto-detected)_ | Override the auto-detected BCP 47 language tag                            |

### Filtering by category

Show only military charities:

```ts
await supportUkraineBlock({tags: ['military']})
```

### Replace mode (no layout shift)

Use `replace` mode to swap a same-class `<header>` placeholder element so the banner takes its place without shifting page content:

```html
<!-- Static HTML: renders nothing until JS runs -->
<header class="support-ukraine-block" style="height:2.5rem"></header>
```

```ts
await supportUkraineBlock({mode: 'replace'})
```

The banner finds the first `<header class="support-ukraine-block">` inside the mount element and replaces it in place. If no placeholder is found, it falls back to prepending. This eliminates cumulative layout shift (CLS) because the placeholder already reserves the exact space the banner needs.

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

## Architecture

```
src/
├── index.ts          # Public API: supportUkraineBlock()
├── types.ts          # Charity, SupportUkraineBlockOptions, etc.
├── i18n.ts           # Locale detection, loading, merging
├── locales/          # Per-locale translation files
├── charities.yaml    # Built-in charity database
└── styles.scss       # Banner CSS (compiled by tsup)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
