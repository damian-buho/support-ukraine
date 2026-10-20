// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

/**
Build script that generates pages/index.html — a single-page app listing
all charities with localized content. Reads source YAML data from src/ and
emits a self-contained HTML file with embedded translations.

Usage:  node scripts/build-pages.mjs
Output: pages/index.html
*/

import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as loadYaml } from 'yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// ── Locale display names (native script, for the language picker) ──────────

const LOCALE_NAMES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
  pl: 'Polski',
  nl: 'Nederlands',
  sv: 'Svenska',
  uk: 'Українська',
  ar: 'العربية',
  zh: '中文',
  hi: 'हिन्दी',
  th: 'ไทย',
  ja: '日本語',
  ko: '한국어',
}

// RTL locales (must match src/locales/index.ts)
const RTL_LOCALES = ['ar']

// ── Page chrome ───────────────────────────────────────────────────────────
// The banner locale strings carry the banner wording ("Support Ukraine with"
// needs a charity after it), so the page keeps its own title and subtitle.

const PAGE_COPY = {
  en: { title: 'Support Ukraine', subtitle: 'All charities' },
  es: { title: 'Apoya a Ucrania', subtitle: 'Todas las charities' },
  fr: { title: "Soutenir l'Ukraine", subtitle: 'Toutes les charities' },
  de: { title: 'Ukraine unterstützen', subtitle: 'Alle Organisationen' },
  pt: { title: 'Apoie a Ucrânia', subtitle: 'Todas as organizações' },
  it: { title: "Sostieni l'Ucraina", subtitle: 'Tutte le organizzazioni' },
  pl: { title: 'Wesprzyj Ukrainę', subtitle: 'Wszystkie organizacje' },
  nl: { title: 'Steun Oekraïne', subtitle: 'Alle organisaties' },
  sv: { title: 'Stöd Ukraina', subtitle: 'Alla organisationer' },
  uk: { title: 'Підтримай Україну', subtitle: 'Усі організації' },
  ar: { title: 'ادعم أوكرانيا', subtitle: 'جميع الجهات' },
  zh: { title: '支持乌克兰', subtitle: '所有慈善机构' },
  hi: { title: 'यूक्रेन का समर्थन करें', subtitle: 'सभी धर्मार्थ संस्थाएँ' },
  th: { title: 'สนับสนุนยูเครน', subtitle: 'องค์กรทั้งหมด' },
  ja: { title: 'ウクライナを支援する', subtitle: 'すべての団体' },
  ko: { title: '우크라이나를 지원합니다', subtitle: '모든 단체' }
}

// ── Read source data ───────────────────────────────────────────────────────

function readYaml(relativePath) {
  const raw = readFileSync(path.join(ROOT, relativePath), 'utf8')
  return loadYaml(raw)
}

const charities = readYaml('src/charities.yaml')

const locales = {}
for (const code of Object.keys(LOCALE_NAMES)) {
  locales[code] = readYaml(`src/locales/${code}.yaml`)
}

// ── Validate the page inputs ───────────────────────────────────────────────
// A missing key renders an empty string, so it fails here instead of the page.

for (const [code, msgs] of Object.entries(locales)) {
  if (!Object.hasOwn(PAGE_COPY, code)) throw new Error(`PAGE_COPY has no "${code}" entry`)
  if (typeof msgs.donate !== 'string' || !msgs.donate) {
    throw new Error(`src/locales/${code}.yaml has no "donate" string`)
  }
}

for (const charity of charities) {
  if (!charity.urls?.en) throw new Error(`Charity "${charity.id}" has no urls.en`)
}

// ── Build translations JSON (embedded in HTML) ─────────────────────────────

const translations = {}
for (const [code, msgs] of Object.entries(locales)) {
  translations[code] = {
    donate: msgs.donate,
    charities: {},
  }

  // Localized taglines
  for (const charity of charities) {
    const entry = msgs.charities[charity.id]
    translations[code].charities[charity.id] = {
      tagline: entry?.tagline ?? charity.tagline,
    }
  }
}

// ── Generate HTML ──────────────────────────────────────────────────────────

const localeOptions = Object.entries(LOCALE_NAMES)
  .map(([code, name]) => `          <option value="${code}">${name}</option>`)
  .join('\n')

const charitiesJson = JSON.stringify(charities)
const translationsJson = JSON.stringify(translations)
const pageCopyJson = JSON.stringify(PAGE_COPY)
const rtlJson = JSON.stringify(RTL_LOCALES)

const html = `<!--
SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>

SPDX-License-Identifier: MIT
-->

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support Ukraine — All Charities</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, -Segoe-ui, sans-serif;
      background: #fafafa;
      color: #222;
      line-height: 1.5;
    }

    .header {
      background: #0057b7;
      color: #fff;
      padding: 2rem 1.5rem;
      text-align: center;
    }

    .header__title {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }

    .header__subtitle {
      font-size: 1rem;
      opacity: 0.9;
    }

    .controls {
      display: flex;
      justify-content: center;
      padding: 1rem 1.5rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .picker {
      padding: 0.5rem 1rem;
      border: 1px solid #ccc;
      border-radius: 0.375rem;
      font-size: 0.95rem;
      background: #fff;
      cursor: pointer;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.25rem;
      padding: 1rem 1.5rem 3rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 0.5rem;
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: border-color 0.15s;
    }

    .card:hover {
      border-color: #0057b7;
    }

    .card__name {
      font-size: 1.1rem;
      font-weight: 600;
    }

    .card__tagline {
      font-size: 0.9rem;
      color: #555;
      flex: 1;
    }

    .card__link {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      margin-top: 0.25rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: #0057b7;
      text-decoration: none;
    }

    .card__link:hover {
      text-decoration: underline;
    }

    .card__tags {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .tag {
      display: inline-block;
      font-size: 0.75rem;
      padding: 0.15em 0.5em;
      border-radius: 999px;
      background: #e8f0fe;
      color: #0057b7;
      font-weight: 500;
    }

    [dir="rtl"] .card__link { flex-direction: row-reverse; }
    [dir="rtl"] .header { direction: rtl; }

    .footer {
      text-align: center;
      padding: 1.5rem;
      font-size: 0.85rem;
      color: #888;
      border-top: 1px solid #e0e0e0;
    }

    .footer a { color: #0057b7; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }

    @media (prefers-color-scheme: dark) {
      body { background: #1a1a1a; color: #eee; }
      .picker { background: #2a2a2a; border-color: #444; color: #eee; }
      .card { background: #2a2a2a; border-color: #444; }
      .card:hover { border-color: #0057b7; }
      .card__tagline { color: #aaa; }
      .tag { background: #1a3a5c; color: #6db3f8; }
      .footer { border-color: #444; color: #aaa; }
    }
  </style>
</head>
<body>
  <header class="header">
    <h1 class="header__title" id="title"></h1>
    <p class="header__subtitle" id="subtitle"></p>
  </header>

  <nav class="controls">
    <select class="picker" id="lang" aria-label="Language">
${localeOptions}
    </select>
  </nav>

  <main class="grid" id="grid"></main>

  <footer class="footer" id="footer"></footer>

  <script>
    // ── Embedded data ───────────────────────────────────────────────
    const CHARITIES = ${charitiesJson};
    const TRANSLATIONS = ${translationsJson};
    const PAGE_COPY = ${pageCopyJson};
    const RTL_LOCALES = ${rtlJson};

    // ── DOM refs ────────────────────────────────────────────────────
    const titleEl = document.getElementById('title');
    const subtitleEl = document.getElementById('subtitle');
    const gridEl = document.getElementById('grid');
    const langEl = document.getElementById('lang');
    const footerEl = document.getElementById('footer');

    // ── Locale detection ────────────────────────────────────────────
    function detectLocale() {
      const params = new URLSearchParams(location.search);
      const fromUrl = params.get('lang');
      if (fromUrl && TRANSLATIONS[fromUrl]) return fromUrl;

      for (const tag of navigator.languages || []) {
        const base = tag.split('-', 1)[0].toLowerCase();
        if (TRANSLATIONS[base]) return base;
      }
      return 'en';
    }

    // ── Render ──────────────────────────────────────────────────────
    function render(code) {
      const t = TRANSLATIONS[code] || TRANSLATIONS.en;
      const copy = PAGE_COPY[code] || PAGE_COPY.en;
      const isRtl = RTL_LOCALES.includes(code);

      document.documentElement.lang = code;
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.title = \`\${copy.title} — \${copy.subtitle}\`;

      titleEl.textContent = \`\u{1F1FA}\u{1F1E6} \${copy.title}\`;
      subtitleEl.textContent = copy.subtitle;

      gridEl.innerHTML = '';
      for (const c of CHARITIES) {
        const localized = t.charities[c.id] || { tagline: c.tagline };
        const href = c.urls[code] || c.urls.en;

        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = \`
          <h2 class="card__name">\${c.name}</h2>
          <p class="card__tagline">\${localized.tagline}</p>
          <div class="card__tags">
            \${c.tags.map(tag => \`<span class="tag">\${tag}</span>\`).join('')}
          </div>
          <a class="card__link" href="\${href}" target="_blank" rel="noopener noreferrer">
            \${t.donate} \u{2192}
          </a>
        \`;
        gridEl.appendChild(card);
      }

      footerEl.innerHTML = \`<a href="https://github.com/damian-buho/support-ukraine">support-ukraine</a> \u{00B7} MIT\`;

      // Sync picker
      langEl.value = code;

      // Update URL without reload
      const url = new URL(location);
      url.searchParams.set('lang', code);
      history.replaceState(null, '', url);
    }

    // ── Init ────────────────────────────────────────────────────────
    const initial = detectLocale();
    render(initial);

    langEl.addEventListener('change', () => render(langEl.value));
  </script>

  <script type="module">
    import("https://cdn.jsdelivr.net/npm/@damian-buho/support-ukraine@latest/+esm").then(
      ({ supportUkraineBlock }) => {
        supportUkraineBlock({ mode: "shift", isInConsole: false });
      },
    );
  </script>
</body>
</html>
`

// ── Write output ───────────────────────────────────────────────────────────

const pagesDirectory = path.join(ROOT, 'pages')
mkdirSync(pagesDirectory, { recursive: true })
writeFileSync(path.join(pagesDirectory, 'index.html'), html)

copyFileSync(path.join(ROOT, 'dev.html'), path.join(pagesDirectory, 'dev.html'))

console.log(`pages/index.html — generated (${(html.length / 1024).toFixed(1)} KB)`)
console.log(`pages/dev.html — copied from root`)
console.log(`  ${charities.length} charities, ${Object.keys(locales).length} locales`)
