---
name: add-charity
description: Add a Ukraine-support charity to the built-in database of this library. Use when the user asks to add, include or register a charity foundation, donor or organisation to the banner, or names a charity URL to support.
---

<!--
SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>

SPDX-License-Identifier: MIT
-->

# Skill: add-charity

Add one charity to the built-in database (`src/charities.yaml`), localize what the
charity’s site localizes, and prove the links resolve.

## When to use

User asks to “add a charity”, “add <foundation> to the banner”, or names a charity
site to support.

## Data model

`src/charities.yaml` is the single source of truth. Each entry:

```yaml
- id: dzygaspaw          # kebab-case, unique, stable (the `exclude` option key)
  name: Dzyga’s Paw      # the international brand name, one per charity
  tagline: Lifesaving tech for Ukrainian defenders
  urls:                  # base language code → the charity's MAIN page; `en` is required
    en: https://dzygaspaw.com
    uk: https://dzygaspaw.com/uk
    de: https://dzygaspaw.com/de
  tags: [military]       # any of: military, humanitarian, animals
```

The schema (`src/types.ts`) rejects a missing `urls.en`, an empty `urls` map, a
non-URL value, an empty `tags` array and a tag outside the three valid ones.

## Process

1. **Research the charity.** Read its home page and its “about” page. Confirm it
   is a Ukrainian charity foundation with a site of its own — a page that
   redirects to another foundation is a duplicate, not a charity.
2. **Pick the tag** from what the charity actually delivers: `military` (weapons,
   drones, gear for units), `humanitarian` (aid, medical, shelter), `animals`
   (shelters and rescue).
3. **Find the localized versions.** Read the language switcher of the home page
   and note each locale’s prefix or slug. Collect the MAIN page per locale —
   the banner links to the charity’s home page, never to its donation page, so
   the donation is one click from there. A locale the site does not serve gets
   no `urls` entry.
4. **Decide the name.** `Charity.name` is a single string, so the banner shows
   one name in every locale: keep the foundation’s international brand name even
   when its own site translates it (`Dzyga’s Paw` stays `Dzyga’s Paw` in the
   Ukrainian locale). The localized message travels in the tagline.
5. **Write the tagline** as one short line describing the mission, in the same
   register as the existing ones (“FPV drone supply for Ukrainian defence
   forces”). Mirror the charity’s own wording where it has one.
6. **Add the entry** at the end of `src/charities.yaml`.
7. **Localize the tagline** in `src/locales/<code>.yaml`, under `charities:`,
   keyed by the charity id, for every locale you can write well. A missing
   entry is safe: the banner falls back to the English tagline. Only these 16
   locales exist: `ar de en es fr hi it ja ko nl pl pt sv th uk zh`.
8. **Pin the URLs** with a test in the `charityUrlFor` block of
   `tests/index.test.ts`: the `en` URL, every locale URL, and the English
   fallback for a locale the charity does not serve.
9. **Regenerate the page**: `just pages`. `pages/index.html` embeds the database
   and is committed — a stale copy lists the old charities.
10. **Run the pipeline**: `just pipeline` (format → lint → build → check-size →
    build-test → test).

## Verification

Every URL added must answer `200` after redirects:

```bash
curl -s -o /dev/null -w '%{http_code} %{url_effective}\n' -L --max-time 30 <url>
```

Check every localized main page, not just the English one: a site can localize
the shell and leave one language on a page that redirects to another.

## Gotchas

- **The size limit moves.** `package.json` caps `./dist/index.js` at 17 kB and
  the database is bundled into it. `just check-size` fails when the cap is
  reached; raise the limit in the same commit.
- **A localized main page is a language prefix** (`/uk`, `/de`) far more often
  than a translated slug. When the site does slugify, percent-encode the
  non-ASCII part (`%D0%BF…`) so no tool in the chain has to guess an encoding.
- **Ids and names are unique.** The test suite asserts both, and the id is what
  `exclude: ['…']` and the seen-list key use — renaming an existing id breaks
  every site that excludes it.
- **One charity is one entry.** A foundation with a separate animal arm (a
  shelter of its own) is a second entry with its own site.
- **The mutation score must stay at 100%.** A new branch without a test shows
  up as a surviving mutant; remove the branch instead of adding a test that
  cannot fail.
- **The library falls back to `en`** for a locale the charity does not serve,
  so a single `en` URL is a valid entry — `nikopol-chance` is one.
